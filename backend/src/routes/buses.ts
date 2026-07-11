import { Router } from 'express'
import { db } from '../data/store.js'
import { searchTrips } from '../services/search.js'
import { ApiError } from '../utils/http.js'

export const busesRouter = Router()
const asBool = (value: unknown) => value === 'true' ? true : value === 'false' ? false : undefined
const card = (trip: typeof db.trips[number]) => ({
  id: trip.id, busId: trip.bus.id, busName: trip.bus.name, operator: trip.bus.operator, route: trip.route,
  travelDate: trip.travelDate, departureTime: trip.departureTime, arrivalTime: trip.arrivalTime, durationMinutes: trip.durationMinutes,
  fare: trip.fare, isAc: trip.bus.isAc, busType: trip.bus.type, amenities: trip.bus.amenities,
  availableSeats: trip.seats.filter((seat) => seat.status === 'AVAILABLE').length,
})

busesRouter.get('/', (request, response) => {
  const trips = searchTrips({
    routeId: request.query.routeId as string | undefined, travelDate: request.query.travelDate as string | undefined,
    maxPrice: request.query.maxPrice ? Number(request.query.maxPrice) : undefined, isAc: asBool(request.query.isAc),
    busType: request.query.busType as 'SLEEPER' | 'SEATER' | undefined, departure: request.query.departure as 'morning' | 'afternoon' | 'evening' | 'night' | undefined, sort: request.query.sort as 'price' | 'departure' | undefined,
  })
  response.json({ data: trips.map(card), pagination: { total: trips.length, page: 1, pageSize: trips.length } })
})

busesRouter.get('/:id', (request, response) => {
  const trip = db.trips.find((candidate) => candidate.bus.id === request.params.id && candidate.id === request.query.tripId)
  if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This bus trip is no longer available.')
  response.json({ data: { ...card(trip), seats: trip.seats, policy: { cutoffMinutes: trip.cancellationCutoffMinutes, feePercent: trip.cancellationFeePercent } } })
})
