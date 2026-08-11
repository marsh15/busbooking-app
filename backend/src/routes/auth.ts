import { Router } from 'express'
import argon2 from 'argon2'
import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../data/prisma.js'
import { issueSession, requireAuth, type AuthRequest } from '../middleware/auth.js'
import { authSchema } from '../validators.js'
import { ApiError, asyncRoute } from '../utils/http.js'

export const authRouter = Router()
const publicUser = (user: { id: string; name: string; email: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
})

authRouter.get('/csrf', (_request, response) => {
  const token = randomBytes(24).toString('hex')
  response.cookie('voyagebus_csrf', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  response.json({ data: { token } })
})

authRouter.post(
  '/register',
  asyncRoute(async (request, response) => {
    const input = authSchema.extend({ name: authSchema.shape.name.unwrap() }).parse(request.body)
    try {
      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
        },
      })
      issueSession(response, user.id)
      response.status(201).json({ data: { user: publicUser(user) } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ApiError(409, 'EMAIL_IN_USE', 'An account already exists for this email.')
      throw error
    }
  }),
)

authRouter.post(
  '/login',
  asyncRoute(async (request, response) => {
    const input = authSchema.pick({ email: true, password: true }).parse(request.body)
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } })
    if (!user || !(await argon2.verify(user.passwordHash, input.password)))
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
    issueSession(response, user.id)
    response.json({ data: { user: publicUser(user) } })
  }),
)

authRouter.post('/logout', (_request, response) => {
  response.clearCookie('voyagebus_session', { path: '/' })
  response.json({ data: { loggedOut: true } })
})

authRouter.get(
  '/me',
  requireAuth,
  asyncRoute(async (request: AuthRequest, response) => {
    const user = await prisma.user.findUnique({ where: { id: request.userId } })
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.')
    response.json({ data: { user: publicUser(user) } })
  }),
)
