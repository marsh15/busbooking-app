import { Prisma } from '@prisma/client'
import { bookingGroupDto, tripInclude } from '../data/dto.js'
import { prisma } from '../data/prisma.js'
import { departureInstant } from '../utils/ist.js'
import { ApiError } from '../utils/http.js'
import { logger } from '../config/logger.js'
import { parseRules, parseSnapshot, quoteRefund } from './policies.js'

const hydratedGroupInclude = { bookings: { include: { trip: { include: tripInclude } } } } as const

async function hydrateGroup(groupId: string) {
  const group = await prisma.bookingGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: hydratedGroupInclude,
  })
  return bookingGroupDto(group)
}

export async function getBookings(userId: string, page = 1, pageSize = 20) {
  const [groups, total] = await prisma.$transaction([
    prisma.bookingGroup.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: hydratedGroupInclude,
    }),
    prisma.bookingGroup.count({ where: { userId } }),
  ])
  return { bookings: groups.map(bookingGroupDto), total, page, pageSize }
}

export async function getBooking(userId: string, groupId: string) {
  const group = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
    include: hydratedGroupInclude,
  })
  if (!group || group.userId !== userId)
    throw new ApiError(403, 'FORBIDDEN', 'You cannot access this booking.')
  return bookingGroupDto(group)
}

/** Terms the ticket was sold under: the group snapshot, or the trip's live policy for legacy rows. */
async function termsForTicket(ticket: { groupId: string; tripId: string }) {
  const group = await prisma.bookingGroup.findUnique({
    where: { id: ticket.groupId },
    select: { policySnapshot: true },
  })
  const snapshot = parseSnapshot(group?.policySnapshot)
  if (snapshot) return snapshot
  const trip = await prisma.trip.findUnique({
    where: { id: ticket.tripId },
    include: { policy: { include: { operator: true } } },
  })
  if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This trip is no longer available.')
  return {
    operatorName: trip.policy.operator.name,
    version: trip.policy.version,
    rules: parseRules(trip.policy.rules),
  }
}

/**
 * Ticket-level quote. The same calculation runs again inside the cancellation
 * transaction, because a quote can go stale while the traveller decides.
 */
export async function getCancellationQuote(userId: string, ticketId: string) {
  const ticket = await prisma.booking.findUnique({ where: { id: ticketId }, include: { trip: true } })
  if (!ticket || ticket.userId !== userId)
    throw new ApiError(403, 'FORBIDDEN', 'You cannot cancel this ticket.')
  const terms = await termsForTicket(ticket)
  const hoursUntilDeparture = (departureInstant(ticket.trip) - Date.now()) / 3_600_000
  const quote = quoteRefund(terms.rules, ticket.totalFare, hoursUntilDeparture)
  return {
    ticketId: ticket.id,
    eligible: ticket.status === 'ACTIVE' && quote.eligible,
    ...(ticket.status !== 'ACTIVE'
      ? { reason: 'This ticket has already been cancelled.' }
      : !quote.eligible
        ? { reason: quote.windowLabel }
        : {}),
    refundAmount: quote.refundAmount.toNumber(),
    refundPercent: quote.refundPercent,
    windowLabel: quote.windowLabel,
    policy: terms,
    quotedAt: new Date().toISOString(),
  }
}

export async function cancelTicket(userId: string, ticketId: string, requestId?: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const groupId = await prisma.$transaction(
        async (tx) => {
          const preliminary = await tx.booking.findUnique({
            where: { id: ticketId },
            select: { groupId: true, userId: true },
          })
          if (!preliminary || preliminary.userId !== userId)
            throw new ApiError(403, 'FORBIDDEN', 'You cannot cancel this ticket.')

          const ticket = await tx.booking.findUnique({
            where: { id: ticketId },
            include: { trip: { include: { policy: { include: { operator: true } } } } },
          })
          if (!ticket || ticket.userId !== userId)
            throw new ApiError(403, 'FORBIDDEN', 'You cannot cancel this ticket.')
          if (ticket.status !== 'ACTIVE')
            throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')

          const group = await tx.bookingGroup.findUnique({
            where: { id: ticket.groupId },
            select: { policySnapshot: true },
          })
          const snapshot = parseSnapshot(group?.policySnapshot) ?? {
            operatorName: ticket.trip.policy.operator.name,
            version: ticket.trip.policy.version,
            rules: parseRules(ticket.trip.policy.rules),
          }
          // Recalculate at commit time: a stale quote may cross a window.
          const hoursUntilDeparture = (departureInstant(ticket.trip) - Date.now()) / 3_600_000
          const quote = quoteRefund(snapshot.rules, ticket.totalFare, hoursUntilDeparture)
          if (!quote.eligible) throw new ApiError(409, 'CANCELLATION_CLOSED', quote.windowLabel)

          const cancelled = await tx.booking.updateMany({
            where: { id: ticket.id, userId, status: 'ACTIVE' },
            data: { status: 'CANCELLED', cancelledAt: new Date(), refundAmount: quote.refundAmount },
          })
          if (cancelled.count !== 1)
            throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
          await tx.seat.update({
            where: { id: ticket.seatId },
            data: { status: 'AVAILABLE', holdId: null, holdExpiresAt: null },
          })
          // Recompute the group status with conditional writes, not a row
          // lock: TiDB (the deployed engine) does not support the pessimistic
          // SELECT ... FOR UPDATE this once took. A write only lands while the
          // group still carries the status these counts were derived from, so
          // a concurrent cancellation of a sibling ticket forces a re-derive —
          // MySQL re-evaluates the condition after the row-lock wait, and on
          // TiDB the losing transaction aborts at commit (P2034) and retries.
          for (let pass = 0; ; pass += 1) {
            if (pass >= 25)
              throw new ApiError(
                409,
                'CANCELLATION_BUSY',
                'This booking is changing too quickly. Please try again.',
              )
            const [group, activeCount, totalCount] = await Promise.all([
              tx.bookingGroup.findUnique({ where: { id: ticket.groupId }, select: { status: true } }),
              tx.booking.count({ where: { groupId: ticket.groupId, status: 'ACTIVE' } }),
              tx.booking.count({ where: { groupId: ticket.groupId } }),
            ])
            const status =
              activeCount === 0 ? 'CANCELLED' : activeCount < totalCount ? 'PARTIALLY_CANCELLED' : 'ACTIVE'
            if (!group || group.status === status) break
            const landed = await tx.bookingGroup.updateMany({
              where: { id: ticket.groupId, status: group.status },
              data: { status },
            })
            if (landed.count === 1) break
          }
          logger.info('ticket_cancelled', {
            requestId,
            ticketId,
            groupId: ticket.groupId,
            refundPercent: quote.refundPercent,
          })
          return ticket.groupId
        },
        // READ COMMITTED (MySQL + TiDB) so the counts after the group lock
        // observe the other cancellation's committed rows; P2034 conflicts retry.
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      )
      return hydrateGroup(groupId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2)
        continue
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
        throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
      throw error
    }
  }
  throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
}
