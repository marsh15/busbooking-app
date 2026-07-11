import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { bookingGroupDto, tripInclude } from '../data/dto.js'
import { prisma } from '../data/prisma.js'
import { isCancellationOpen } from '../utils/ist.js'
import { ApiError } from '../utils/http.js'

const hydratedGroupInclude = { bookings: { include: { trip: { include: tripInclude } } } } as const

async function hydrateGroup(groupId: string) {
  const group = await prisma.bookingGroup.findUniqueOrThrow({ where: { id: groupId }, include: hydratedGroupInclude })
  return bookingGroupDto(group)
}

export async function createBooking(userId: string, tripId: string, passengers: Array<{ seatNumber: string; name: string; age: number }>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const groupId = await prisma.$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({ where: { id: tripId } })
        if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This trip is no longer available.')
        const seats = await tx.seat.findMany({ where: { tripId, seatNumber: { in: passengers.map((item) => item.seatNumber) } }, orderBy: { id: 'asc' } })
        if (seats.length !== passengers.length) throw new ApiError(409, 'SEAT_UNAVAILABLE', 'One or more selected seats were just booked. Please choose again.')
        for (const seat of seats) {
          const claim = await tx.seat.updateMany({ where: { id: seat.id, status: 'AVAILABLE' }, data: { status: 'BOOKED' } })
          if (claim.count !== 1) throw new ApiError(409, 'SEAT_UNAVAILABLE', 'One or more selected seats were just booked. Please choose again.')
        }
        const group = await tx.bookingGroup.create({
          data: {
            pnr: `SB${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
            userId,
            bookings: {
              create: passengers.map((passenger) => {
                const seat = seats.find((candidate) => candidate.seatNumber === passenger.seatNumber)!
                return { userId, tripId, seatId: seat.id, seatNumber: seat.seatNumber, passengerName: passenger.name, passengerAge: passenger.age, totalFare: trip.fare }
              }),
            },
          },
        })
        return group.id
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return hydrateGroup(groupId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && attempt < 2) continue
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ApiError(409, 'SEAT_UNAVAILABLE', 'One or more selected seats were just booked. Please choose again.')
      throw error
    }
  }
  throw new ApiError(500, 'PNR_GENERATION_FAILED', 'Could not generate a booking reference. Please try again.')
}

export async function getBookings(userId: string, page = 1, pageSize = 20) {
  const [groups, total] = await prisma.$transaction([
    prisma.bookingGroup.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: hydratedGroupInclude }),
    prisma.bookingGroup.count({ where: { userId } }),
  ])
  return { bookings: groups.map(bookingGroupDto), total, page, pageSize }
}

export async function getBooking(userId: string, groupId: string) {
  const group = await prisma.bookingGroup.findUnique({ where: { id: groupId }, include: hydratedGroupInclude })
  if (!group || group.userId !== userId) throw new ApiError(403, 'FORBIDDEN', 'You cannot access this booking.')
  return bookingGroupDto(group)
}

export async function cancelTicket(userId: string, ticketId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const groupId = await prisma.$transaction(async (tx) => {
        const ticket = await tx.booking.findUnique({ where: { id: ticketId }, include: { trip: true } })
        if (!ticket || ticket.userId !== userId) throw new ApiError(403, 'FORBIDDEN', 'You cannot cancel this ticket.')
        if (ticket.status !== 'ACTIVE') throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
        const tripForCutoff = { travelDate: ticket.trip.travelDate.toISOString().slice(0, 10), departureTime: ticket.trip.departureTime, cancellationCutoffMinutes: ticket.trip.cancellationCutoffMinutes }
        if (!isCancellationOpen(tripForCutoff)) throw new ApiError(409, 'CANCELLATION_CLOSED', 'The six-hour cancellation window has closed.')
        const refundAmount = ticket.totalFare.mul(new Prisma.Decimal(100).minus(ticket.trip.cancellationFeePercent)).div(100).toDecimalPlaces(0)
        const cancelled = await tx.booking.updateMany({ where: { id: ticket.id, userId, status: 'ACTIVE' }, data: { status: 'CANCELLED', cancelledAt: new Date(), refundAmount } })
        if (cancelled.count !== 1) throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
        await tx.seat.update({ where: { id: ticket.seatId }, data: { status: 'AVAILABLE' } })
        const activeCount = await tx.booking.count({ where: { groupId: ticket.groupId, status: 'ACTIVE' } })
        const totalCount = await tx.booking.count({ where: { groupId: ticket.groupId } })
        await tx.bookingGroup.update({ where: { id: ticket.groupId }, data: { status: activeCount === 0 ? 'CANCELLED' : activeCount < totalCount ? 'PARTIALLY_CANCELLED' : 'ACTIVE' } })
        return ticket.groupId
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return hydrateGroup(groupId)
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
      throw error
    }
  }
  throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
}
