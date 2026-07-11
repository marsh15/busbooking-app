import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
})

export function requestLogger(request: Request, response: Response, next: NextFunction) {
  const requestId = request.get('x-request-id') || randomUUID()
  response.setHeader('x-request-id', requestId)
  const started = performance.now()
  response.on('finish', () => logger.info('http_request', { requestId, method: request.method, path: request.path, status: response.statusCode, durationMs: Math.round(performance.now() - started) }))
  next()
}
