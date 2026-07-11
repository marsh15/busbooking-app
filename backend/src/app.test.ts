import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from './app.js'
import { db, resetStore } from './data/store.js'
import { parseSearchFallback } from './services/ai-parser.js'

describe('GET /api/health', () => {
  it('returns an OK health response', async () => {
    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      data: {
        status: 'ok',
      },
    })
  })
})

describe('fallback trip parser', () => {
  it('extracts supported city aliases, preferences, date, and budget', () => {
    const result = parseSearchFallback('AC sleeper from Hyd to Bangalore tomorrow night under ₹1200')
    expect(result).toMatchObject({ source: 'Hyderabad', destination: 'Bengaluru', busType: 'SLEEPER', isAc: true, timePreference: 'night', maxPrice: 1200, provider: 'fallback' })
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('booking ownership and seat conflicts', () => {
  beforeEach(() => resetStore('2030-01-10'))

  async function signedInAgent(email: string) {
    const agent = request.agent(app)
    const csrf = (await agent.get('/api/auth/csrf')).body.data.token
    await agent.post('/api/auth/register').set('x-csrf-token', csrf).send({ name: email.split('@')[0], email, password: 'SmartBus123!' }).expect(201)
    return { agent, csrf }
  }

  it('allows only one concurrent owner to claim a seat and releases it after cancellation', async () => {
    const first = await signedInAgent('first@example.com')
    const second = await signedInAgent('second@example.com')
    const trip = db.trips[0]!
    const payload = { tripId: trip.id, passengers: [{ seatNumber: '1A', name: 'A Traveller', age: 28 }] }
    const [one, two] = await Promise.all([
      first.agent.post('/api/bookings').set('x-csrf-token', first.csrf).send(payload),
      second.agent.post('/api/bookings').set('x-csrf-token', second.csrf).send(payload),
    ])
    expect([one.status, two.status].sort()).toEqual([201, 409])
    const success = one.status === 201 ? one : two
    const owner = one.status === 201 ? first : second
    const ticketId = success.body.data.tickets[0].id
    const cancelled = await owner.agent.patch(`/api/bookings/${ticketId}/cancel`).set('x-csrf-token', owner.csrf).send()
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('CANCELLED')
    expect(trip.seats.find((seat) => seat.number === '1A')?.status).toBe('AVAILABLE')
  })
})
