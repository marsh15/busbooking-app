import { z } from 'zod'

export const authSchema = z.object({ name: z.string().trim().min(2).max(60).optional(), email: z.string().trim().email(), password: z.string().min(8).max(128) })
export const bookingSchema = z.object({ tripId: z.string().min(1), passengers: z.array(z.object({ seatNumber: z.string().regex(/^\d[A-D]$/), name: z.string().trim().min(2).max(60), age: z.coerce.number().int().min(1).max(120) })).min(1).max(6).refine((passengers) => new Set(passengers.map((passenger) => passenger.seatNumber)).size === passengers.length, 'Choose different seats for each passenger.') })
export const aiSearchSchema = z.object({ query: z.string().trim().min(2).max(220) })
const positiveInt = (maximum: number) => z.coerce.number().int().min(1).max(maximum)
export const paginationSchema = z.object({ page: positiveInt(100_000).default(1), pageSize: positiveInt(50).default(20) })
export const tripSearchSchema = paginationSchema.extend({
  pageSize: positiveInt(50).default(10),
  routeId: z.string().uuid().optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  maxPrice: z.coerce.number().positive().finite().optional(),
  isAc: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  busType: z.enum(['SLEEPER', 'SEATER']).optional(),
  departure: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  sort: z.enum(['price', 'departure']).optional(),
})
