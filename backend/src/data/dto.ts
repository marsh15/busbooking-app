import type { Prisma } from '@prisma/client'

export const tripInclude = {
  route: { include: { source: true, destination: true } },
  bus: true,
  seats: true,
} satisfies Prisma.TripInclude

type TripRecord = Prisma.TripGetPayload<{ include: typeof tripInclude }>

export function cityDto(city: { id: string; name: string }) {
  return { id: city.id, name: city.name }
}

export function routeDto(route: TripRecord['route']) {
  return { id: route.id, source: cityDto(route.source), destination: cityDto(route.destination) }
}

export function seatDto(seat: TripRecord['seats'][number]) {
  return { id: seat.id, number: seat.seatNumber, deck: seat.deck, row: seat.row, column: seat.column, status: seat.status }
}

export function tripDto(trip: TripRecord) {
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
    seats: trip.seats.map(seatDto),
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
    availableSeats: value.seats.filter((seat) => seat.status === 'AVAILABLE').length,
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
