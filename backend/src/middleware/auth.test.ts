import cookieParser from 'cookie-parser'
import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { retiredDemoAccounts } from '../config/retired-demo.js'
import { errorHandler } from '../utils/http.js'
import { optionalAuth, requireAuth, type AuthRequest } from './auth.js'

const testSecret = 'test-session-signing-key-for-retirement-checks'
const app = express()
app.use(cookieParser())
app.get('/protected', requireAuth, (req: AuthRequest, res) => res.json({ userId: req.userId }))
app.get('/optional', optionalAuth, (req: AuthRequest, res) => res.json({ userId: req.userId ?? null }))
app.use(errorHandler)

beforeEach(() => vi.stubEnv('JWT_SECRET', testSecret))
afterEach(() => vi.unstubAllEnvs())

const sessionCookie = (userId: string) =>
  `voyagebus_session=${jwt.sign({ sub: userId }, testSecret, { expiresIn: '1h' })}`

describe('retired shared demo sessions', () => {
  it.each(retiredDemoAccounts)('rejects a valid old JWT for $id', async ({ id }) => {
    const response = await request(app).get('/protected').set('Cookie', sessionCookie(id)).expect(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
    const optional = await request(app).get('/optional').set('Cookie', sessionCookie(id)).expect(200)
    expect(optional.body.userId).toBeNull()
  })

  it('continues accepting private demo and regular user sessions', async () => {
    for (const id of ['private-demo-user', 'registered-user']) {
      const response = await request(app).get('/protected').set('Cookie', sessionCookie(id)).expect(200)
      expect(response.body.userId).toBe(id)
    }
  })
})
