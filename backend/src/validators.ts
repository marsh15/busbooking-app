import { z } from 'zod'

export const authSchema = z.object({ name: z.string().trim().min(2).max(60).optional(), email: z.string().trim().email(), password: z.string().min(8).max(128) })
export const bookingSchema = z.object({ tripId: z.string().min(1), passengers: z.array(z.object({ seatNumber: z.string().regex(/^\d[A-D]$/), name: z.string().trim().min(2).max(60), age: z.coerce.number().int().min(1).max(120) })).min(1).max(6).refine((passengers) => new Set(passengers.map((passenger) => passenger.seatNumber)).size === passengers.length, 'Choose different seats for each passenger.') })
export const aiSearchSchema = z.object({ query: z.string().trim().min(2).max(220) })
