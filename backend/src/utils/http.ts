import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { logger } from '../config/logger.js'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const asyncRoute =
  (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>) =>
  (request: Request, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next)
  }

export function errorHandler(error: unknown, request: Request, response: Response, _next: NextFunction) {
  if (error instanceof SyntaxError && 'status' in error && error.status === 400)
    return response
      .status(400)
      .json({ error: { code: 'MALFORMED_JSON', message: 'The request body must contain valid JSON.' } })
  if (error instanceof ZodError)
    return response.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted fields.',
        details: error.flatten(),
      },
    })
  if (error instanceof ApiError)
    return response
      .status(error.status)
      .json({ error: { code: error.code, message: error.message, details: error.details } })
  logger.error('unhandled_request_error', {
    method: request.method,
    path: request.path,
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
  })
  return response
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } })
}
