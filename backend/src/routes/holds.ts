import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { holdSchema } from '../validators.js'
import { asyncRoute } from '../utils/http.js'
import { createHold, getHold, releaseHold } from '../services/holds.js'

export const holdsRouter = Router()

holdsRouter.use(requireAuth)

holdsRouter.post(
  '/',
  asyncRoute(async (request: AuthRequest, response) => {
    const input = holdSchema.parse(request.body)
    response
      .status(201)
      .json({ data: await createHold(request.userId!, input.tripId, input.seatNumbers, request.requestId) })
  }),
)

holdsRouter.get(
  '/:id',
  asyncRoute(async (request: AuthRequest, response) =>
    response.json({ data: await getHold(request.userId!, String(request.params.id), request.requestId) }),
  ),
)

holdsRouter.delete(
  '/:id',
  asyncRoute(async (request: AuthRequest, response) => {
    await releaseHold(request.userId!, String(request.params.id), request.requestId)
    response.status(204).send()
  }),
)
