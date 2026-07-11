import { Router } from 'express'
import { db } from '../data/store.js'
import { findRoute } from '../services/search.js'
import { ApiError } from '../utils/http.js'

export const routesRouter = Router()
routesRouter.get('/search', (request, response) => {
  const source = typeof request.query.source === 'string' ? request.query.source : undefined
  const destination = typeof request.query.destination === 'string' ? request.query.destination : undefined
  if (!source || !destination) return response.json({ data: db.routes })
  const route = findRoute(source, destination)
  if (!route) throw new ApiError(404, 'ROUTE_NOT_FOUND', 'We do not have a direct route for that journey yet.')
  return response.json({ data: route })
})
