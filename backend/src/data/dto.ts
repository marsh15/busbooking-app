import type { Prisma } from '@prisma/client'

export const tripInclude = {
  route: { include: { source: true, destination: true } },
  bus: true,
  seats: { include: { hold: { select: { userId: true } } } },
} satisfies Prisma.TripInclude

type TripRecord = Prisma.TripGetPayload<{ include: typeof tripInclude }>

export function cityDto(city: { id: string; name: string }) {
  return { id: city.id, name: city.name }
}

export function routeDto(route: TripRecord['route']) {
  return { id: route.id, source: cityDto(route.source), destination: cityDto(route.destination) }
}

/**
 * A held seat whose expiry has passed is logically available without any
 * cleanup job; the authoritative claim still happens through conditional
 * writes in the hold service.
 */
export function effectiveSeatStatus(
  seat: { status: string; holdExpiresAt: Date | null },
  now = Date.now(),
): 'AVAILABLE' | 'HELD' | 'BOOKED' {
  if (seat.status === 'HELD' && (!seat.holdExpiresAt || seat.holdExpiresAt.getTime() <= now))
    return 'AVAILABLE'
  return seat.status as 'AVAILABLE' | 'HELD' | 'BOOKED'
}

export function seatDto(seat: TripRecord['seats'][number], viewerId?: string | null) {
  const status = effectiveSeatStatus(seat)
  const heldByYou = status === 'HELD' && !!viewerId && seat.hold?.userId === viewerId
  return {
    id: seat.id,
    number: seat.seatNumber,
    deck: seat.deck,
    row: seat.row,
    column: seat.column,
    status,
    ...(heldByYou ? { heldByYou: true } : {}),
  }
}

export function tripDto(trip: TripRecord, viewerId?: string | null) {
  return {
    id: trip.id,
    route: routeDto(trip.route),
    bus: { ...trip.bus, amenities: Array.isArray(trip.bus.amenities) ? trip.bus.amenities : [] },
    travelDate: trip.travelDate.toISOString().slice(0, 10),
    departureTime: trip.departureTime,
    arrivalTime: trip.arrivalTime,
    durationMinutes: trip.durationMinutes,
    fare: trip.fare.toNumber(),
    cancellationCutoffMinutes: trip.cancellationCutoffMinutes,
    cancellationFeePercent: trip.cancellationFeePercent.toNumber(),
    seats: trip.seats.map((seat) => seatDto(seat, viewerId)),
  }
}

export function tripCardDto(trip: TripRecord) {
  const value = tripDto(trip)
  return {
    id: value.id,
    busId: value.bus.id,
    busName: value.bus.name,
    operator: value.bus.operator,
    route: value.route,
    travelDate: value.travelDate,
    departureTime: value.departureTime,
    arrivalTime: value.arrivalTime,
    durationMinutes: value.durationMinutes,
    fare: value.fare,
    isAc: value.bus.isAc,
    busType: value.bus.type,
    amenities: value.bus.amenities,
    availableSeats: trip.seats.filter((seat) => effectiveSeatStatus(seat) === 'AVAILABLE').length,
  }
}

export type HydratedGroup = Prisma.BookingGroupGetPayload<{
  include: { bookings: { include: { trip: { include: typeof tripInclude } } } }
}>

export function bookingGroupDto(group: HydratedGroup) {
  return {
    id: group.id,
    pnr: group.pnr,
    userId: group.userId,
    status: group.status,
    createdAt: group.createdAt.toISOString(),
    tickets: group.bookings.map((ticket) => ({
      id: ticket.id,
      groupId: ticket.groupId,
      userId: ticket.userId,
      tripId: ticket.tripId,
      seatNumber: ticket.seatNumber,
      passengerName: ticket.passengerName,
      passengerAge: ticket.passengerAge,
      totalFare: ticket.totalFare.toNumber(),
      status: ticket.status,
      ...(ticket.cancelledAt ? { cancelledAt: ticket.cancelledAt.toISOString() } : {}),
      ...(ticket.refundAmount ? { refundAmount: ticket.refundAmount.toNumber() } : {}),
      trip: tripDto(ticket.trip),
    })),
  }
}
