import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { bookingSchema } from '../validators.js'
import { asyncRoute } from '../utils/http.js'
import { cancelTicket, createBooking, getBooking, getBookings } from '../services/bookings.js'

export const bookingsRouter = Router()
bookingsRouter.use(requireAuth)
bookingsRouter.post('/', asyncRoute(async (request: AuthRequest, response) => { const input = bookingSchema.parse(request.body); response.status(201).json({ data: await createBooking(request.userId!, input.tripId, input.passengers) }) }))
bookingsRouter.get('/me', (request: AuthRequest, response) => response.json({ data: getBookings(request.userId!), pagination: { total: getBookings(request.userId!).length, page: 1, pageSize: 20 } }))
bookingsRouter.get('/group/:id', (request: AuthRequest, response) => response.json({ data: getBooking(request.userId!, String(request.params.id)) }))
bookingsRouter.patch('/:id/cancel', asyncRoute(async (request: AuthRequest, response) => response.json({ data: await cancelTicket(request.userId!, String(request.params.id)) })))
