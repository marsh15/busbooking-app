import { Router } from 'express'
import { aiSearchSchema } from '../validators.js'
import { parseSearchFallback } from '../services/ai-parser.js'

export const aiRouter = Router()
aiRouter.post('/parse-search', (request, response) => { const { query } = aiSearchSchema.parse(request.body); response.json({ data: parseSearchFallback(query) }) })
