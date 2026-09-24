import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { ApiError } from '../utils/http.js'

const secret = () => {
  const value = process.env.JWT_SECRET
  if (!value && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production')
  return value || 'development-only-change-me-development-only'
}
export interface AuthRequest extends Request {
  userId?: string
  requestId?: string
}

export function issueSession(response: Response, userId: string, expiresAt?: Date) {
  const maxAge = expiresAt ? Math.max(expiresAt.getTime() - Date.now(), 60_000) : 7 * 24 * 60 * 60 * 1000
  const token = jwt.sign({ sub: userId }, secret(), { expiresIn: Math.floor(maxAge / 1000) })
  response.cookie('voyagebus_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  })
}

export function requireAuth(request: AuthRequest, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.voyagebus_session
    if (!token) throw new Error('missing')
    request.userId = String(jwt.verify(token, secret()).sub)
    next()
  } catch {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'))
  }
}

/** Attaches userId when a valid session exists; anonymous requests pass through. */
export function optionalAuth(request: AuthRequest, _response: Response, next: NextFunction) {
  try {
    const token = request.cookies?.voyagebus_session
    if (token) request.userId = String(jwt.verify(token, secret()).sub)
  } catch {
    request.userId = undefined
  }
  next()
}

export function requireCsrf(request: Request, _response: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next()
  const token = request.get('x-csrf-token')
  if (!token || token !== request.cookies?.voyagebus_csrf)
    return next(
      new ApiError(403, 'CSRF_INVALID', 'Your session could not be verified. Refresh and try again.'),
    )
  return next()
}
