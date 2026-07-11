import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import { prisma } from './data/prisma.js'
import { requestLogger } from './config/logger.js'
import { aiLimiter, apiLimiter, authLimiter } from './middleware/rate-limit.js'
import { requireCsrf } from './middleware/auth.js'
import { aiRouter } from './routes/ai.js'
import { authRouter } from './routes/auth.js'
import { bookingsRouter } from './routes/bookings.js'
import { busesRouter } from './routes/buses.js'
import { routesRouter } from './routes/routes.js'
import { errorHandler } from './utils/http.js'

export const app = express()
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') ?? ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
app.use(requestLogger)
app.use('/api', apiLimiter)

app.use('/api', requireCsrf)

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    data: {
      status: 'ok',
    },
  })
})

app.get('/api/ready', async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    response.json({ data: { status: 'ready', database: 'connected' } })
  } catch {
    response.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is not ready.' } })
  }
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/routes', routesRouter)
app.use('/api/buses', busesRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/ai', aiLimiter, aiRouter)

app.use(errorHandler)
