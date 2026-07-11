import rateLimit from 'express-rate-limit'

const response = { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.' } }

const skipInTests = () => process.env.NODE_ENV === 'test'
export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-8', legacyHeaders: false, message: response, skip: skipInTests })
export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: response, skip: skipInTests })
export const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: response, skip: skipInTests })
