import { Router } from 'express'
import { getTrip } from '../services/buses.js'
import { searchTrips } from '../services/search.js'
import { asyncRoute } from '../utils/http.js'

export const busesRouter = Router()
const asBool = (value: unknown) => value === 'true' ? true : value === 'false' ? false : undefined

busesRouter.get('/', asyncRoute(async (request, response) => {
  const trips = await searchTrips({
    routeId: request.query.routeId as string | undefined, travelDate: request.query.travelDate as string | undefined,
    maxPrice: request.query.maxPrice ? Number(request.query.maxPrice) : undefined, isAc: asBool(request.query.isAc),
    busType: request.query.busType as 'SLEEPER' | 'SEATER' | undefined, departure: request.query.departure as 'morning' | 'afternoon' | 'evening' | 'night' | undefined, sort: request.query.sort as 'price' | 'departure' | undefined,
  })
  response.json({ data: trips.map((trip) => ({
    id: trip.id, busId: trip.bus.id, busName: trip.bus.name, operator: trip.bus.operator, route: trip.route,
    travelDate: trip.travelDate, departureTime: trip.departureTime, arrivalTime: trip.arrivalTime, durationMinutes: trip.durationMinutes,
    fare: trip.fare, isAc: trip.bus.isAc, busType: trip.bus.type, amenities: trip.bus.amenities,
    availableSeats: trip.seats.filter((seat) => seat.status === 'AVAILABLE').length,
  })), pagination: { total: trips.length, page: 1, pageSize: trips.length } })
}))

busesRouter.get('/:id', asyncRoute(async (request, response) => {
  response.json({ data: await getTrip(String(request.params.id), String(request.query.tripId)) })
}))
