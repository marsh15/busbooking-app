import { prisma } from '../data/prisma.js'
import { tripCardDto, tripDto, tripInclude } from '../data/dto.js'
import { ApiError } from '../utils/http.js'

export async function getTrip(busId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, busId }, include: tripInclude })
  if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This bus trip is no longer available.')
  const value = tripDto(trip)
  return {
    ...tripCardDto(trip),
    seats: value.seats,
    policy: { cutoffMinutes: value.cancellationCutoffMinutes, feePercent: value.cancellationFeePercent },
  }
}
