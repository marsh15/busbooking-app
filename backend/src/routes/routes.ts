import { Router } from 'express'
import { findRoute, listRoutes } from '../services/search.js'
import { ApiError, asyncRoute } from '../utils/http.js'

export const routesRouter = Router()
routesRouter.get('/search', asyncRoute(async (request, response) => {
  const source = typeof request.query.source === 'string' ? request.query.source : undefined
  const destination = typeof request.query.destination === 'string' ? request.query.destination : undefined
  if (!source || !destination) return response.json({ data: await listRoutes() })
  const route = await findRoute(source, destination)
  if (!route) throw new ApiError(404, 'ROUTE_NOT_FOUND', 'We do not have a direct route for that journey yet.')
  return response.json({ data: route })
}))
