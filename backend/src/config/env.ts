import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  FRONTEND_ORIGIN: z.string().min(1).default('http://localhost:5173,http://127.0.0.1:5173'),
  PORT: z.coerce.number().int().positive().default(4000),
})

export function validateEnvironment() {
  const result = schema.safeParse(process.env)
  if (!result.success)
    throw new Error(
      `Invalid environment configuration: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    )
  if (result.data.NODE_ENV === 'production' && result.data.JWT_SECRET.length < 32)
    throw new Error(
      'Invalid environment configuration: JWT_SECRET must be at least 32 characters in production',
    )
  return result.data
}
