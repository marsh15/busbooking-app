import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from './app.js'
import { prisma } from './data/prisma.js'
import { seedDemoData } from './data/seed.js'
import { parseSearchFallback } from './services/ai-parser.js'

const seedDate = '2030-01-10'

beforeAll(async () => seedDemoData(seedDate), 30_000)
afterAll(async () => prisma.$disconnect())
beforeEach(async () => {
  await prisma.booking.deleteMany()
  await prisma.bookingGroup.deleteMany()
  await prisma.user.deleteMany({ where: { email: { not: 'demo@smartbus.in' } } })
  await prisma.seat.updateMany({ where: { trip: { travelDate: { in: [new Date(`${seedDate}T00:00:00.000Z`), new Date('2030-01-11T00:00:00.000Z')] } } }, data: { status: 'AVAILABLE' } })
})

describe.sequential('SmartBus API with MySQL persistence', () => {
  async function signedInAgent(email: string) {
    const agent = request.agent(app)
    const csrf = (await agent.get('/api/auth/csrf')).body.data.token
    await agent.post('/api/auth/register').set('x-csrf-token', csrf).send({ name: email.split('@')[0], email, password: 'SmartBus123!' }).expect(201)
    return { agent, csrf }
  }

  async function firstTrip() {
    return prisma.trip.findFirstOrThrow({ where: { travelDate: new Date(`${seedDate}T00:00:00.000Z`) }, orderBy: { id: 'asc' } })
  }

  it('returns an OK health response without querying readiness state', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: { status: 'ok' } })
    const ready = await request(app).get('/api/ready').expect(200)
    expect(ready.body.data).toEqual({ status: 'ready', database: 'connected' })
  })

  it('persists registration and rejects a duplicate email', async () => {
    const first = await signedInAgent('persistent@example.com')
    await first.agent.get('/api/auth/me').expect(200)
    const another = request.agent(app)
    const csrf = (await another.get('/api/auth/csrf')).body.data.token
    const duplicate = await another.post('/api/auth/register').set('x-csrf-token', csrf).send({ name: 'Duplicate', email: 'persistent@example.com', password: 'SmartBus123!' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE')
    const loginAgent = request.agent(app)
    const loginCsrf = (await loginAgent.get('/api/auth/csrf')).body.data.token
    await loginAgent.post('/api/auth/login').set('x-csrf-token', loginCsrf).send({ email: 'persistent@example.com', password: 'SmartBus123!' }).expect(200)
    await loginAgent.get('/api/auth/me').expect(200)
  })

  it('reruns the seed without duplicates or resetting seat state', async () => {
    const owner = await signedInAgent('seed-preserve@example.com')
    const trip = await firstTrip()
    await owner.agent.post('/api/bookings').set('x-csrf-token', owner.csrf).send({ tripId: trip.id, passengers: [{ seatNumber: '1A', name: 'Seed Rider', age: 29 }] }).expect(201)
    await seedDemoData(seedDate)
    const dates = [new Date(`${seedDate}T00:00:00.000Z`), new Date('2030-01-11T00:00:00.000Z')]
    expect(await prisma.trip.count({ where: { travelDate: { in: dates } } })).toBe(24)
    expect(await prisma.booking.count({ where: { tripId: trip.id, seatNumber: '1A' } })).toBe(1)
    expect((await prisma.seat.findUniqueOrThrow({ where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '1A' } } })).status).toBe('BOOKED')
  })

  it('returns route, trip, decimal, and seat data using the existing contract', async () => {
    const route = await request(app).get('/api/routes/search').query({ source: 'Hyderabad', destination: 'Vijayawada' }).expect(200)
    const trips = await request(app).get('/api/buses').query({ routeId: route.body.data.id, travelDate: seedDate, sort: 'price' }).expect(200)
    expect(trips.body.data).toHaveLength(2)
    expect(trips.body.data[0]).toMatchObject({ travelDate: seedDate, availableSeats: 24 })
    expect(typeof trips.body.data[0].fare).toBe('number')
    expect(trips.body.pagination).toEqual({ total: 2, page: 1, pageSize: 10 })
    const detail = await request(app).get(`/api/buses/${trips.body.data[0].busId}`).query({ tripId: trips.body.data[0].id }).expect(200)
    expect(detail.body.data.seats[0]).toMatchObject({ number: '1A', status: 'AVAILABLE' })
  })

  it('rejects malformed search and pagination input', async () => {
    await request(app).get('/api/buses').query({ travelDate: 'not-a-date' }).expect(422)
    await request(app).get('/api/buses').query({ maxPrice: 'free' }).expect(422)
    const owner = await signedInAgent('pagination@example.com')
    await owner.agent.get('/api/bookings/me').query({ page: -1 }).expect(422)
  })

  it('allows exactly one concurrent owner to claim a seat', async () => {
    const first = await signedInAgent('first@example.com')
    const second = await signedInAgent('second@example.com')
    const trip = await firstTrip()
    const payload = { tripId: trip.id, passengers: [{ seatNumber: '1A', name: 'A Traveller', age: 28 }] }
    const [one, two] = await Promise.all([
      first.agent.post('/api/bookings').set('x-csrf-token', first.csrf).send(payload),
      second.agent.post('/api/bookings').set('x-csrf-token', second.csrf).send(payload),
    ])
    expect([one.status, two.status].sort()).toEqual([201, 409])
    expect(await prisma.booking.count({ where: { tripId: trip.id, seatNumber: '1A', status: 'ACTIVE' } })).toBe(1)
  })

  it('retrieves the same booking and PNR after reconnecting the database client', async () => {
    const owner = await signedInAgent('restart@example.com')
    const trip = await firstTrip()
    const created = await owner.agent.post('/api/bookings').set('x-csrf-token', owner.csrf).send({ tripId: trip.id, passengers: [{ seatNumber: '4A', name: 'Restart Rider', age: 40 }] }).expect(201)
    await prisma.$disconnect()
    await prisma.$connect()
    const freshAgent = request.agent(app)
    const csrf = (await freshAgent.get('/api/auth/csrf')).body.data.token
    await freshAgent.post('/api/auth/login').set('x-csrf-token', csrf).send({ email: 'restart@example.com', password: 'SmartBus123!' }).expect(200)
    const bookings = await freshAgent.get('/api/bookings/me').expect(200)
    expect(bookings.body.data[0].pnr).toBe(created.body.data.pnr)
  })

  it('rolls back every seat in a failed multi-seat claim', async () => {
    const first = await signedInAgent('claim@example.com')
    const second = await signedInAgent('rollback@example.com')
    const trip = await firstTrip()
    await first.agent.post('/api/bookings').set('x-csrf-token', first.csrf).send({ tripId: trip.id, passengers: [{ seatNumber: '1B', name: 'First Rider', age: 30 }] }).expect(201)
    await second.agent.post('/api/bookings').set('x-csrf-token', second.csrf).send({ tripId: trip.id, passengers: [{ seatNumber: '1A', name: 'Second Rider', age: 31 }, { seatNumber: '1B', name: 'Third Rider', age: 32 }] }).expect(409)
    const seat = await prisma.seat.findUniqueOrThrow({ where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '1A' } } })
    expect(seat.status).toBe('AVAILABLE')
  })

  it('persists a group and supports partial then final cancellation', async () => {
    const owner = await signedInAgent('cancel@example.com')
    const stranger = await signedInAgent('stranger@example.com')
    const trip = await firstTrip()
    const created = await owner.agent.post('/api/bookings').set('x-csrf-token', owner.csrf).send({ tripId: trip.id, passengers: [{ seatNumber: '2A', name: 'First Rider', age: 35 }, { seatNumber: '2B', name: 'Second Rider', age: 36 }] }).expect(201)
    const [firstTicket, secondTicket] = created.body.data.tickets
    await stranger.agent.patch(`/api/bookings/${firstTicket.id}/cancel`).set('x-csrf-token', stranger.csrf).send().expect(403)
    const partial = await owner.agent.patch(`/api/bookings/${firstTicket.id}/cancel`).set('x-csrf-token', owner.csrf).send().expect(200)
    expect(partial.body.data.status).toBe('PARTIALLY_CANCELLED')
    expect(partial.body.data.tickets[0].refundAmount).toBe(Math.round(partial.body.data.tickets[0].totalFare * 0.9))
    const final = await owner.agent.patch(`/api/bookings/${secondTicket.id}/cancel`).set('x-csrf-token', owner.csrf).send().expect(200)
    expect(final.body.data.status).toBe('CANCELLED')
    await owner.agent.patch(`/api/bookings/${secondTicket.id}/cancel`).set('x-csrf-token', owner.csrf).send().expect(409)
  })

  it('handles concurrent duplicate cancellation without releasing a seat twice', async () => {
    const owner = await signedInAgent('concurrent-cancel@example.com')
    const trip = await firstTrip()
    const created = await owner.agent.post('/api/bookings').set('x-csrf-token', owner.csrf).send({ tripId: trip.id, passengers: [{ seatNumber: '3A', name: 'Concurrent Rider', age: 38 }] }).expect(201)
    const ticketId = created.body.data.tickets[0].id
    const [one, two] = await Promise.all([
      owner.agent.patch(`/api/bookings/${ticketId}/cancel`).set('x-csrf-token', owner.csrf).send(),
      owner.agent.patch(`/api/bookings/${ticketId}/cancel`).set('x-csrf-token', owner.csrf).send(),
    ])
    expect([one.status, two.status].sort()).toEqual([200, 409])
    expect((await prisma.seat.findUniqueOrThrow({ where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '3A' } } })).status).toBe('AVAILABLE')
  })
})

describe('fallback trip parser', () => {
  it('extracts supported city aliases, preferences, date, and budget', () => {
    const result = parseSearchFallback('AC sleeper from Hyd to Bangalore tomorrow night under ₹1200')
    expect(result).toMatchObject({ source: 'Hyderabad', destination: 'Bengaluru', busType: 'SLEEPER', isAc: true, timePreference: 'night', maxPrice: 1200, provider: 'fallback' })
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
