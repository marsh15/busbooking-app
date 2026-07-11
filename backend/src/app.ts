import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { ensureDemoUser } from './data/store.js'
import { requireCsrf } from './middleware/auth.js'
import { aiRouter } from './routes/ai.js'
import { authRouter } from './routes/auth.js'
import { bookingsRouter } from './routes/bookings.js'
import { busesRouter } from './routes/buses.js'
import { routesRouter } from './routes/routes.js'
import { errorHandler } from './utils/http.js'

export const app = express()

void ensureDemoUser()

app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') ?? ['http://localhost:5173'], credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use(cookieParser())
if (process.env.NODE_ENV !== 'test') app.use(morgan('tiny'))

app.use('/api', requireCsrf)

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    data: {
      status: 'ok',
    },
  })
})

app.use('/api/auth', authRouter)
app.use('/api/routes', routesRouter)
app.use('/api/buses', busesRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/ai', aiRouter)

app.use(errorHandler)
