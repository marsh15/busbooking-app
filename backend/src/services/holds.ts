import { Prisma, SeatStatus } from '@prisma/client'
import { prisma } from '../data/prisma.js'
import { departureInstant, hasDeparted } from '../utils/ist.js'
import { ApiError } from '../utils/http.js'
import { logger } from '../config/logger.js'

export const HOLD_MINUTES = 10
export const MAX_SEATS_PER_HOLD = 6

const seatUnavailable = () =>
  new ApiError(409, 'SEAT_UNAVAILABLE', 'One or more selected seats were just taken. Please choose again.')

const holdInclude = {
  seats: { orderBy: { id: 'asc' as const } },
  trip: { include: { route: { include: { source: true, destination: true } }, bus: { include: { operator: true } } } },
} satisfies Prisma.SeatHoldInclude

type HoldRecord = Prisma.SeatHoldGetPayload<{ include: typeof holdInclude }>

export function holdDto(hold: HoldRecord, now = new Date()) {
  const expired = hold.status === 'ACTIVE' && hold.expiresAt.getTime() <= now.getTime()
  const state =
    hold.status === 'ACTIVE' ? (expired ? 'EXPIRED' : 'ACTIVE') : hold.status
  return {
    id: hold.id,
    tripId: hold.tripId,
    state,
    expiresAt: hold.expiresAt.toISOString(),
    farePerSeat: hold.fareSnapshot.toNumber(),
    seatNumbers: hold.seats.map((seat) => seat.seatNumber),
    trip: {
      id: hold.trip.id,
      busName: hold.trip.bus.name,
      operator: hold.trip.bus.operator.name,
      travelDate: hold.trip.travelDate.toISOString().slice(0, 10),
      departureTime: hold.trip.departureTime,
      arrivalTime: hold.trip.arrivalTime,
      route: `${hold.trip.route.source.name} → ${hold.trip.route.destination.name}`,
    },
  }
}

/**
 * Releases every seat still pointing at the given hold and marks the hold
 * RELEASED. Conditional on status='HELD' so a consumed (booked) seat is never
 * accidentally released. Correctness never depends on this being called —
 * expiry makes unheld releases unnecessary.
 */
async function releaseSeats(tx: Prisma.TransactionClient, holdId: string) {
  await tx.seat.updateMany({
    where: { holdId, status: 'HELD' },
    data: { status: 'AVAILABLE', holdId: null, holdExpiresAt: null },
  })
  await tx.seatHold.updateMany({ where: { id: holdId, status: 'ACTIVE' }, data: { status: 'RELEASED' } })
}

export async function createHold(
  userId: string,
  tripId: string,
  seatNumbers: string[],
  requestId?: string,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const hold = await prisma.$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({ where: { id: tripId } })
        if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This trip is no longer available.')
        if (hasDeparted(trip))
          throw new ApiError(409, 'TRIP_DEPARTED', 'This trip has already departed. Please pick a later date.')

        // A fresh hold on the same trip replaces the traveller's previous one.
        const previousHolds = await tx.seatHold.findMany({
          where: { userId, tripId, status: 'ACTIVE' },
          select: { id: true },
          orderBy: { id: 'asc' },
        })
        for (const previous of previousHolds) await releaseSeats(tx, previous.id)

        const seats = await tx.seat.findMany({
          where: { tripId, seatNumber: { in: seatNumbers } },
          orderBy: { id: 'asc' },
        })
        if (seats.length !== seatNumbers.length) throw seatUnavailable()

        const now = new Date()
        const expiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000)
        const created = await tx.seatHold.create({
          data: {
            userId,
            tripId,
            fareSnapshot: trip.fare,
            expiresAt,
          },
        })

        // Ordered conditional claims: a seat is claimable only when AVAILABLE
        // or its previous hold has expired. Any miss rolls back the whole
        // transaction, so a failed multi-seat hold leaves no partial ownership.
        for (const seat of seats) {
          const claim = await tx.seat.updateMany({
            where: {
              id: seat.id,
              OR: [
                { status: 'AVAILABLE' },
                { status: 'HELD', holdExpiresAt: { lte: now } },
              ] as Prisma.SeatWhereInput[],
            },
            data: { status: 'HELD' as SeatStatus, holdId: created.id, holdExpiresAt: expiresAt },
          })
          if (claim.count !== 1) {
            logger.info('hold_conflict', { requestId, tripId, seatNumber: seat.seatNumber })
            throw seatUnavailable()
          }
        }

        const hydrated = await tx.seatHold.findUniqueOrThrow({
          where: { id: created.id },
          include: holdInclude,
        })
        return hydrated
      })
      return holdDto(hold)
    } catch (error) {
      if (error instanceof ApiError) throw error
      // Deadlock / write conflict retry (MySQL ER_LOCK_WAIT_TIMEOUT / TiDB pessimistic conflicts).
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2024'].includes(error.code) && attempt < 2)
        continue
      throw error
    }
  }
  throw seatUnavailable()
}

export async function getHold(userId: string, holdId: string, requestId?: string) {
  const hold = await prisma.seatHold.findUnique({ where: { id: holdId }, include: holdInclude })
  if (!hold || hold.userId !== userId)
    throw new ApiError(404, 'HOLD_NOT_FOUND', 'This seat hold no longer exists.')
  const dto = holdDto(hold)
  if (dto.state === 'EXPIRED')
    logger.info('hold_expired_seen', { requestId, holdId, tripId: hold.tripId })
  return dto
}

export async function releaseHold(userId: string, holdId: string, requestId?: string) {
  const hold = await prisma.seatHold.findUnique({ where: { id: holdId } })
  if (!hold || hold.userId !== userId)
    throw new ApiError(404, 'HOLD_NOT_FOUND', 'This seat hold no longer exists.')
  if (hold.status !== 'ACTIVE')
    throw new ApiError(409, 'HOLD_NOT_ACTIVE', 'This hold has already been used or released.')
  await prisma.$transaction(async (tx) => {
    await releaseSeats(tx, holdId)
  })
  logger.info('hold_released', { requestId, holdId, tripId: hold.tripId })
}

/** Server-side truth for hold validity; callers separately verify ownership. */
export function holdIsValid(hold: { status: string; expiresAt: Date }, now = new Date()) {
  return hold.status === 'ACTIVE' && hold.expiresAt.getTime() > now.getTime()
}
