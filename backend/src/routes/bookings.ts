import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { paginationSchema } from '../validators.js'
import { asyncRoute } from '../utils/http.js'
import { cancelTicket, getBooking, getBookings, getCancellationQuote } from '../services/bookings.js'

export const bookingsRouter = Router()
bookingsRouter.use(requireAuth)
// Direct booking was removed: seats are always acquired through a hold and
// confirmed via POST /api/checkouts/confirm.
bookingsRouter.post('/', (_request, response) => {
  response.status(410).json({
    error: {
      code: 'BOOKINGS_VIA_CHECKOUT',
      message: 'Create a seat hold with POST /api/holds, then confirm with POST /api/checkouts/confirm.',
    },
  })
})
bookingsRouter.get(
  '/me',
  asyncRoute(async (request: AuthRequest, response) => {
    const { page, pageSize } = paginationSchema.parse(request.query)
    const result = await getBookings(request.userId!, page, pageSize)
    response.json({ data: result.bookings, pagination: { total: result.total, page, pageSize } })
  }),
)
bookingsRouter.get(
  '/group/:id',
  asyncRoute(async (request: AuthRequest, response) =>
    response.json({ data: await getBooking(request.userId!, String(request.params.id)) }),
  ),
)
bookingsRouter.get(
  '/:ticketId/cancellation-quote',
  asyncRoute(async (request: AuthRequest, response) =>
    response.json({
      data: await getCancellationQuote(request.userId!, String(request.params.ticketId)),
    }),
  ),
)
bookingsRouter.patch(
  '/:id/cancel',
  asyncRoute(async (request: AuthRequest, response) =>
    response.json({
      data: await cancelTicket(request.userId!, String(request.params.id), request.requestId),
    }),
  ),
)
