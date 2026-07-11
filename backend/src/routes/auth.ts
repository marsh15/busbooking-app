import { Router } from 'express'
import argon2 from 'argon2'
import { randomBytes, randomUUID } from 'node:crypto'
import { db } from '../data/store.js'
import { issueSession, requireAuth, type AuthRequest } from '../middleware/auth.js'
import { authSchema } from '../validators.js'
import { ApiError, asyncRoute } from '../utils/http.js'

export const authRouter = Router()
const publicUser = (user: { id: string; name: string; email: string }) => ({ id: user.id, name: user.name, email: user.email })

authRouter.get('/csrf', (_request, response) => {
  const token = randomBytes(24).toString('hex')
  response.cookie('smartbus_csrf', token, { httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' })
  response.json({ data: { token } })
})

authRouter.post('/register', asyncRoute(async (request, response) => {
  const input = authSchema.extend({ name: authSchema.shape.name.unwrap() }).parse(request.body)
  if (db.users.some((user) => user.email === input.email.toLowerCase())) throw new ApiError(409, 'EMAIL_IN_USE', 'An account already exists for this email.')
  const user = { id: randomUUID(), name: input.name, email: input.email.toLowerCase(), passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }) }
  db.users.push(user)
  issueSession(response, user.id)
  response.status(201).json({ data: { user: publicUser(user) } })
}))

authRouter.post('/login', asyncRoute(async (request, response) => {
  const input = authSchema.pick({ email: true, password: true }).parse(request.body)
  const user = db.users.find((candidate) => candidate.email === input.email.toLowerCase())
  if (!user || !(await argon2.verify(user.passwordHash, input.password))) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  issueSession(response, user.id)
  response.json({ data: { user: publicUser(user) } })
}))

authRouter.post('/logout', (_request, response) => {
  response.clearCookie('smartbus_session', { path: '/' })
  response.json({ data: { loggedOut: true } })
})

authRouter.get('/me', requireAuth, (request: AuthRequest, response) => {
  const user = db.users.find((candidate) => candidate.id === request.userId)
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.')
  response.json({ data: { user: publicUser(user) } })
})
