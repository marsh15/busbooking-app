import { prisma } from '../data/prisma.js'
import { tripCardDto, tripDto, tripInclude } from '../data/dto.js'
import { ApiError } from '../utils/http.js'

export async function getTrip(busId: string, tripId: string, viewerId?: string | null) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, busId }, include: tripInclude })
  if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This bus trip is no longer available.')
  const value = tripDto(trip, viewerId)
  return {
    ...tripCardDto(trip),
    seats: value.seats,
    policy: value.policy,
  }
}

export async function getTripById(tripId: string, viewerId?: string | null) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: tripInclude })
  if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This bus trip is no longer available.')
  const value = tripDto(trip, viewerId)
  return {
    ...tripCardDto(trip),
    seats: value.seats,
    policy: value.policy,
  }
}
