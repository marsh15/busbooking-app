import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../data/prisma.js'
import { bookingGroupDto, tripInclude } from '../data/dto.js'
import { holdIsValid } from './holds.js'
import { hasDeparted } from '../utils/ist.js'
import { ApiError } from '../utils/http.js'
import { logger } from '../config/logger.js'
import { mockProvider, ProviderTimeoutError, type ProviderOutcome } from './payments.js'
import { parseRules } from './policies.js'

const hydratedGroupInclude = { bookings: { include: { trip: { include: tripInclude } } } } as const

export interface PassengerInput {
  name: string
  age: number
}

export interface AttemptResult {
  attempt: {
    id: string
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'RECONCILIATION_REQUIRED'
    amount: number
    resultCode?: string
    message: string
  }
  booking?: ReturnType<typeof bookingGroupDto>
}

const messages: Record<AttemptResult['attempt']['status'], string> = {
  PENDING: 'The simulated payment is still processing. Check back in a moment.',
  SUCCEEDED: 'The simulated payment succeeded.',
  FAILED: 'The simulated payment was declined. No charge occurred — try again with a new payment.',
  RECONCILIATION_REQUIRED:
    'The simulated payment succeeded too late: the seat hold had already expired, so no ticket was issued and nothing was charged.',
}

async function hydrateGroup(groupId: string) {
  const group = await prisma.bookingGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: hydratedGroupInclude,
  })
  return bookingGroupDto(group)
}

function attemptResult(
  attempt: { id: string; status: string; amount: Prisma.Decimal; resultCode: string | null },
  booking?: Awaited<ReturnType<typeof hydrateGroup>>,
): AttemptResult {
  const status = attempt.status as AttemptResult['attempt']['status']
  return {
    attempt: {
      id: attempt.id,
      status,
      amount: attempt.amount.toNumber(),
      ...(attempt.resultCode ? { resultCode: attempt.resultCode } : {}),
      message: messages[status],
    },
    ...(booking ? { booking } : {}),
  }
}

const fingerprintOf = (holdId: string, passengers: PassengerInput[]) =>
  createHash('sha256')
    .update(JSON.stringify({ holdId, passengers }))
    .digest('hex')

async function markReconciled(
  attemptId: string,
  requestId: string | undefined,
  reason: string,
) {
  await prisma.paymentAttempt.updateMany({
    where: { id: attemptId, status: 'PENDING' },
    data: { status: 'RECONCILIATION_REQUIRED', resultCode: reason },
  })
  logger.info('confirmation_reconciled', { requestId, attemptId, reason })
}

/**
 * Books the hold's seats and records the successful attempt — exactly once.
 * Safety comes from conditional, ordered seat writes plus the unique
 * BookingGroup.holdId constraint, not from SERIALIZABLE isolation.
 */
async function finalizeSuccess(
  attempt: { id: string; holdId: string; userId: string },
  passengers: PassengerInput[],
  requestId: string | undefined,
): Promise<AttemptResult> {
  for (let retry = 0; retry < 3; retry += 1) {
    try {
      const groupId = await prisma.$transaction(
        async (tx) => {
          const hold = await tx.seatHold.findUnique({
            where: { id: attempt.holdId },
            include: {
              seats: { orderBy: { id: 'asc' } },
              trip: { include: { policy: { include: { operator: true } } } },
            },
          })
          if (!hold || hold.userId !== attempt.userId)
            throw new ApiError(404, 'HOLD_NOT_FOUND', 'This seat hold no longer exists.')

          // Another confirmation of the same hold already finished: replay it.
          if (hold.status === 'CONSUMED') {
            const existing = await tx.bookingGroup.findUnique({ where: { holdId: hold.id } })
            if (existing) {
              await tx.paymentAttempt.updateMany({
                where: { id: attempt.id, status: 'PENDING' },
                data: { status: 'SUCCEEDED', bookingGroupId: existing.id },
              })
              return existing.id
            }
          }

          const now = new Date()
          if (!holdIsValid(hold, now) || hasDeparted(hold.trip, now.getTime())) {
            // Simulated success arrived after the hold expired (or the trip
            // departed): no ticket, and the attempt needs manual attention.
            throw new ApiError(
              409,
              'HOLD_EXPIRED',
              'Your seat hold expired before the payment could be confirmed. Nothing was charged — please pick your seats again.',
            )
          }

          if (hold.seats.length !== passengers.length)
            throw new ApiError(
              409,
              'PASSENGER_COUNT_MISMATCH',
              'Passenger details must match the seats on your hold.',
            )

          for (const seat of hold.seats) {
            const claim = await tx.seat.updateMany({
              where: { id: seat.id, status: 'HELD', holdId: hold.id, holdExpiresAt: { gt: now } },
              data: { status: 'BOOKED', holdExpiresAt: null },
            })
            if (claim.count !== 1) {
              const existing = await tx.bookingGroup.findUnique({ where: { holdId: hold.id } })
              if (existing) {
                await tx.paymentAttempt.updateMany({
                  where: { id: attempt.id, status: 'PENDING' },
                  data: { status: 'SUCCEEDED', bookingGroupId: existing.id },
                })
                return existing.id
              }
              throw new ApiError(
                409,
                'SEAT_UNAVAILABLE',
                'One or more held seats changed state. Nothing was charged.',
              )
            }
          }

          const group = await tx.bookingGroup.create({
            data: {
              pnr: `VB${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
              userId: attempt.userId,
              holdId: hold.id,
              // Immutable terms for this sale: later policy edits cannot
              // change what this booking was sold under.
              policySnapshot: {
                operatorName: hold.trip.policy.operator.name,
                version: hold.trip.policy.version,
                rules: parseRules(hold.trip.policy.rules).map((rule) => ({
                  beforeDepartureHours: rule.beforeDepartureHours,
                  refundPercent: rule.refundPercent,
                })),
              },
              bookings: {
                create: passengers.map((passenger, index) => ({
                  userId: attempt.userId,
                  tripId: hold.tripId,
                  seatId: hold.seats[index]!.id,
                  seatNumber: hold.seats[index]!.seatNumber,
                  passengerName: passenger.name,
                  passengerAge: passenger.age,
                  totalFare: hold.fareSnapshot,
                })),
              },
            },
          })
          await tx.seatHold.update({ where: { id: hold.id }, data: { status: 'CONSUMED' } })
          const claimed = await tx.paymentAttempt.updateMany({
            where: { id: attempt.id, status: 'PENDING' },
            data: { status: 'SUCCEEDED', bookingGroupId: group.id },
          })
          if (claimed.count !== 1) {
            // A concurrent finalize with the same idempotency key won.
            const winner = await tx.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } })
            if (winner.bookingGroupId) return winner.bookingGroupId
          }
          return group.id
        },
        // READ COMMITTED is supported by both MySQL and TiDB and keeps replay
        // checks seeing the latest committed state.
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      )
      logger.info('booking_confirmed', { requestId, attemptId: attempt.id, groupId })
      return attemptResult(
        await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
        await hydrateGroup(groupId),
      )
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'HOLD_EXPIRED' || error.code === 'SEAT_UNAVAILABLE')
      ) {
        // The transaction rolled back with the throw; record the durable
        // reconciliation state separately so the attempt is not silently PENDING.
        await markReconciled(
          attempt.id,
          requestId,
          error.code === 'HOLD_EXPIRED' ? 'hold_expired_before_confirm' : 'seat_claim_lost',
        )
        throw error
      }
      if (error instanceof ApiError) throw error
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        (error.meta.target as string[]).some((field) => ['holdId', 'pnr'].includes(field))
      ) {
        // Unique holdId → duplicate confirmation lost the race; pnr → collision. Retry replays.
        continue
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2024'].includes(error.code) &&
        retry < 2
      )
        continue
      throw error
    }
  }
  throw new ApiError(409, 'SEAT_UNAVAILABLE', 'Could not confirm the hold. Please try again.')
}

async function runProvider(attempt: { providerRef: string; providerScenario: string | null }) {
  return mockProvider.charge(attempt.providerRef, attempt.providerScenario)
}

/**
 * One server-orchestrated confirmation. Safe to retry with the same
 * Idempotency-Key and payload: it returns the existing attempt (and booking)
 * instead of charging or ticketing twice.
 */
export async function confirmCheckout(
  userId: string,
  input: { holdId: string; passengers: PassengerInput[] },
  idempotencyKey: string,
  scenario: string | null,
  requestId?: string,
): Promise<AttemptResult> {
  const fingerprint = fingerprintOf(input.holdId, input.passengers)

  let attempt = await prisma.paymentAttempt.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
  })
  if (!attempt) {
    const hold = await prisma.seatHold.findUnique({
      where: { id: input.holdId },
      include: { seats: { where: { status: 'HELD', holdId: input.holdId } } },
    })
    if (!hold || hold.userId !== userId)
      throw new ApiError(404, 'HOLD_NOT_FOUND', 'This seat hold no longer exists.')
    try {
      attempt = await prisma.paymentAttempt.create({
        data: {
          userId,
          holdId: input.holdId,
          idempotencyKey,
          amount: hold.fareSnapshot.mul(hold.seats.length),
          requestFingerprint: fingerprint,
          requestPayload: input.passengers.map((passenger) => ({
            name: passenger.name,
            age: passenger.age,
          })),
          provider: 'mock',
          providerScenario: scenario,
          providerRef: mockProvider.newRef(),
        },
      })
      logger.info('payment_attempt_created', {
        requestId,
        attemptId: attempt.id,
        holdId: input.holdId,
        amount: attempt.amount.toNumber(),
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        attempt = await prisma.paymentAttempt.findUniqueOrThrow({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
        })
      } else throw error
    }
  }

  if (attempt.requestFingerprint !== fingerprint)
    throw new ApiError(
      409,
      'IDEMPOTENCY_KEY_REUSED',
      'This payment key was already used with different details. Start a fresh payment.',
    )

  if (attempt.status === 'SUCCEEDED')
    return attemptResult(attempt, await hydrateGroup(attempt.bookingGroupId!))
  if (attempt.status === 'FAILED' || attempt.status === 'RECONCILIATION_REQUIRED')
    return attemptResult(attempt)

  let outcome: ProviderOutcome
  try {
    outcome = await runProvider(attempt)
  } catch (error) {
    if (error instanceof ProviderTimeoutError) {
      // Response lost in transit; the attempt stays PENDING and is resolvable
      // by retrying with the same key or polling the attempt endpoint.
      logger.info('payment_response_lost', { requestId, attemptId: attempt.id })
      return attemptResult(attempt)
    }
    throw error
  }

  if (!outcome.ok) {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: 'PENDING' },
      data: { status: 'FAILED', resultCode: outcome.resultCode },
    })
    logger.info('payment_failed', { requestId, attemptId: attempt.id, resultCode: outcome.resultCode })
    return attemptResult(
      await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } }),
    )
  }

  return finalizeSuccess(attempt, input.passengers, requestId)
}

/**
 * Status lookup that also gives a stale PENDING attempt the chance to resolve
 * (deterministic replay keeps the outcome identical after a restart).
 */
export async function getAttempt(
  userId: string,
  attemptId: string,
  requestId?: string,
): Promise<AttemptResult> {
  let attempt = await prisma.paymentAttempt.findUnique({ where: { id: attemptId } })
  if (!attempt || attempt.userId !== userId)
    throw new ApiError(404, 'ATTEMPT_NOT_FOUND', 'This payment attempt does not exist.')
  if (attempt.status === 'SUCCEEDED')
    return attemptResult(attempt, await hydrateGroup(attempt.bookingGroupId!))
  if (attempt.status === 'PENDING') {
    // Deterministic replay: the same (scenario, providerRef) pair resolves to
    // the same outcome even after a process restart.
    const outcome = await mockProvider.reconcile(attempt.providerRef, attempt.providerScenario)
    if (outcome.ok) {
      const passengers = (attempt.requestPayload as PassengerInput[] | null) ?? []
      return finalizeSuccess(attempt, passengers, requestId)
    }
  }
  return attemptResult(attempt)
}

export { markReconciled }
