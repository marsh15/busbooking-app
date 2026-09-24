import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { confirmSchema, idempotencyKeySchema } from '../validators.js'
import { ApiError, asyncRoute } from '../utils/http.js'
import { confirmCheckout, getAttempt } from '../services/checkout.js'

export const checkoutRouter = Router()

checkoutRouter.use(requireAuth)

checkoutRouter.post(
  '/confirm',
  asyncRoute(async (request: AuthRequest, response) => {
    const idempotencyKey = idempotencyKeySchema.parse(request.get('idempotency-key'))
    if (!idempotencyKey)
      throw new ApiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'An Idempotency-Key header is required.')
    const input = confirmSchema.parse(request.body)
    // Test-only provider scenario injection; production always uses 'success'.
    const scenario =
      process.env.NODE_ENV === 'production' ? null : (request.get('x-payment-scenario') ?? null)
    const result = await confirmCheckout(
      request.userId!,
      input,
      idempotencyKey,
      scenario,
      request.requestId,
    )
    response.status(result.attempt.status === 'SUCCEEDED' && result.booking ? 200 : 202).json({
      data: result,
    })
  }),
)

checkoutRouter.get(
  '/attempts/:id',
  asyncRoute(async (request: AuthRequest, response) =>
    response.json({ data: await getAttempt(request.userId!, String(request.params.id), request.requestId) }),
  ),
)
