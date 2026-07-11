import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message) }
}

export const asyncRoute = (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>) =>
  (request: Request, response: Response, next: NextFunction) => { handler(request, response, next).catch(next) }

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (error instanceof ZodError) return response.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', details: error.flatten() } })
  if (error instanceof ApiError) return response.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } })
  console.error(error)
  return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } })
}
