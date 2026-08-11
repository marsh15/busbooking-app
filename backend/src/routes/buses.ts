import { Router } from 'express'
import { getTrip, getTripById } from '../services/buses.js'
import { searchTrips } from '../services/search.js'
import { asyncRoute } from '../utils/http.js'
import { tripSearchSchema } from '../validators.js'

export const busesRouter = Router()

busesRouter.get(
  '/trip/:tripId',
  asyncRoute(async (request, response) => {
    response.json({ data: await getTripById(String(request.params.tripId)) })
  }),
)

busesRouter.get(
  '/',
  asyncRoute(async (request, response) => {
    const input = tripSearchSchema.parse(request.query)
    const result = await searchTrips(input)
    response.json({
      data: result.trips.map((trip) => ({
        id: trip.id,
        busId: trip.bus.id,
        busName: trip.bus.name,
        operator: trip.bus.operator,
        route: trip.route,
        travelDate: trip.travelDate,
        departureTime: trip.departureTime,
        arrivalTime: trip.arrivalTime,
        durationMinutes: trip.durationMinutes,
        fare: trip.fare,
        isAc: trip.bus.isAc,
        busType: trip.bus.type,
        amenities: trip.bus.amenities,
        availableSeats: trip.seats.filter((seat) => seat.status === 'AVAILABLE').length,
      })),
      pagination: { total: result.total, page: result.page, pageSize: result.pageSize },
    })
  }),
)

busesRouter.get(
  '/:id',
  asyncRoute(async (request, response) => {
    response.json({ data: await getTrip(String(request.params.id), String(request.query.tripId)) })
  }),
)
