import { Router } from 'express'
import { aiSearchSchema } from '../validators.js'
import { parseSearch } from '../services/ai-parser.js'
import { asyncRoute } from '../utils/http.js'

export const aiRouter = Router()
aiRouter.post('/parse-search', asyncRoute(async (request, response) => { const { query } = aiSearchSchema.parse(request.body); response.json({ data: await parseSearch(query) }) }))
