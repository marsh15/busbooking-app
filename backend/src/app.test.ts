import request from 'supertest'

// supertest v7 no longer exports TestAgent; derive it from the factory.
type Agent = ReturnType<typeof request.agent>
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from './app.js'
import { prisma } from './data/prisma.js'
import { seedDemoData } from './data/seed.js'
import { parseSearchFallback } from './services/ai-parser.js'

const seedDate = '2030-01-10'
const idKey = (name: string) => `test-key-${name}-${Math.random().toString(36).slice(2, 8)}`

beforeAll(async () => seedDemoData(seedDate), 30_000)
afterAll(async () => prisma.$disconnect())
const seedDates = Array.from(
  { length: 7 },
  (_, day) => new Date(`2030-01-${String(10 + day).padStart(2, '0')}T00:00:00.000Z`),
)
beforeEach(async () => {
  await prisma.paymentAttempt.deleteMany({ where: { hold: { trip: { travelDate: { in: seedDates } } } } })
  await prisma.booking.deleteMany({ where: { trip: { travelDate: { in: seedDates } } } })
  await prisma.bookingGroup.deleteMany({ where: { bookings: { every: { trip: { travelDate: { in: seedDates } } } } } })
  await prisma.seatHold.deleteMany({ where: { trip: { travelDate: { in: seedDates } } } })
  await prisma.user.deleteMany({
    where: { email: { not: 'demo@voyagebus.in' }, isDemo: false },
  })
  await prisma.seat.updateMany({
    where: { trip: { travelDate: { in: seedDates } } },
    data: { status: 'AVAILABLE', holdId: null, holdExpiresAt: null },
  })
})

describe.sequential('VoyageBus API with MySQL persistence', () => {
  async function signedInAgent(email: string) {
    const agent = request.agent(app)
    const csrf = (await agent.get('/api/auth/csrf')).body.data.token
    await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: email.split('@')[0], email, password: 'VoyageBus123!' })
      .expect(201)
    return { agent, csrf }
  }

  async function firstTrip() {
    return prisma.trip.findFirstOrThrow({
      where: { travelDate: new Date(`${seedDate}T00:00:00.000Z`) },
      orderBy: { id: 'asc' },
    })
  }

  async function createHold(agent: Agent, csrf: string, tripId: string, seatNumbers: string[]) {
    const response = await agent
      .post('/api/holds')
      .set('x-csrf-token', csrf)
      .send({ tripId, seatNumbers })
    expect(response.status).toBe(201)
    return response.body.data as { id: string; expiresAt: string; farePerSeat: number }
  }

  function confirm(
    agent: Agent,
    csrf: string,
    holdId: string,
    passengers: Array<{ name: string; age: number }>,
    key: string,
    scenario?: string,
  ) {
    const call = agent
      .post('/api/checkouts/confirm')
      .set('x-csrf-token', csrf)
      .set('idempotency-key', key)
      .send({ holdId, passengers })
    return scenario ? call.set('x-payment-scenario', scenario) : call
  }

  it('returns an OK health response without querying readiness state', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: { status: 'ok' } })
    const ready = await request(app).get('/api/ready').expect(200)
    expect(ready.body.data).toEqual({ status: 'ready', database: 'connected' })
  })

  it('returns stable JSON errors for unknown endpoints and malformed request bodies', async () => {
    const missing = await request(app).get('/api/not-a-route').expect(404)
    expect(missing.body.error).toEqual({ code: 'NOT_FOUND', message: 'That API endpoint does not exist.' })
    const malformed = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"email":')
      .expect(400)
    expect(malformed.body.error.code).toBe('MALFORMED_JSON')
  })

  it('persists registration and rejects a duplicate email', async () => {
    const first = await signedInAgent('persistent@example.com')
    await first.agent.get('/api/auth/me').expect(200)
    const another = request.agent(app)
    const csrf = (await another.get('/api/auth/csrf')).body.data.token
    const duplicate = await another
      .post('/api/auth/register')
      .set('x-csrf-token', csrf)
      .send({ name: 'Duplicate', email: 'persistent@example.com', password: 'VoyageBus123!' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('EMAIL_IN_USE')
    const loginAgent = request.agent(app)
    const loginCsrf = (await loginAgent.get('/api/auth/csrf')).body.data.token
    await loginAgent
      .post('/api/auth/login')
      .set('x-csrf-token', loginCsrf)
      .send({ email: 'persistent@example.com', password: 'VoyageBus123!' })
      .expect(200)
    await loginAgent.get('/api/auth/me').expect(200)
  })

  it('creates an isolated demo session bound to a 24-hour account', async () => {
    const agent = request.agent(app)
    const csrf = (await agent.get('/api/auth/csrf')).body.data.token
    const first = await agent.post('/api/auth/demo').set('x-csrf-token', csrf).send().expect(201)
    expect(first.body.data.user.email).toMatch(/^demo-[0-9a-f]+@demo\.voyagebus\.in$/)
    await agent.get('/api/auth/me').expect(200)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: first.body.data.user.id } })
    expect(user.isDemo).toBe(true)
    expect(user.demoExpiresAt!.getTime()).toBeGreaterThan(Date.now())

    const secondAgent = request.agent(app)
    const secondCsrf = (await secondAgent.get('/api/auth/csrf')).body.data.token
    const second = await secondAgent.post('/api/auth/demo').set('x-csrf-token', secondCsrf).send().expect(201)
    expect(second.body.data.user.id).not.toBe(first.body.data.user.id)

    // The session token itself expires with the account, so an expired demo
    // session cannot outlive its account and reach bookings.
    const setCookieHeader = first.headers['set-cookie']
    const cookieValues = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader]
    const setCookie = cookieValues.find((value) => value?.startsWith('voyagebus_session='))
    const sessionCookie = setCookie?.split(';')[0]?.split('=')[1]
    const jwt = await import('jsonwebtoken')
    const decoded = jwt.decode(sessionCookie!) as { exp: number }
    expect(decoded.exp * 1000).toBeLessThanOrEqual(user.demoExpiresAt!.getTime() + 5_000)
  })

  it('reruns the seed without duplicates or resetting seat state', async () => {
    const owner = await signedInAgent('seed-preserve@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['1A'])
    await confirm(owner.agent, owner.csrf, hold.id, [{ name: 'Seed Rider', age: 29 }], idKey('seed')).expect(200)
    await seedDemoData(seedDate)
    const dates = [new Date(`${seedDate}T00:00:00.000Z`), new Date('2030-01-11T00:00:00.000Z')]
    expect(await prisma.trip.count({ where: { travelDate: { in: dates } } })).toBe(24)
    expect(await prisma.booking.count({ where: { tripId: trip.id, seatNumber: '1A' } })).toBe(1)
    expect(
      (
        await prisma.seat.findUniqueOrThrow({
          where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '1A' } },
        })
      ).status,
    ).toBe('BOOKED')
  })

  it('returns route, trip, decimal, and seat data using the existing contract', async () => {
    const route = await request(app)
      .get('/api/routes/search')
      .query({ source: 'Hyderabad', destination: 'Vijayawada' })
      .expect(200)
    const trips = await request(app)
      .get('/api/buses')
      .query({ routeId: route.body.data.id, travelDate: seedDate, sort: 'price' })
      .expect(200)
    expect(trips.body.data).toHaveLength(2)
    expect(trips.body.data[0]).toMatchObject({ travelDate: seedDate, availableSeats: 24 })
    expect(typeof trips.body.data[0].fare).toBe('number')
    expect(trips.body.pagination).toEqual({ total: 2, page: 1, pageSize: 10 })
    const detail = await request(app)
      .get(`/api/buses/${trips.body.data[0].busId}`)
      .query({ tripId: trips.body.data[0].id })
      .expect(200)
    expect(detail.body.data.seats[0]).toMatchObject({ number: '1A', status: 'AVAILABLE' })
  })

  it('rejects malformed search and pagination input', async () => {
    await request(app).get('/api/buses').query({ travelDate: 'not-a-date' }).expect(422)
    await request(app).get('/api/buses').query({ maxPrice: 'free' }).expect(422)
    const owner = await signedInAgent('pagination@example.com')
    await owner.agent.get('/api/bookings/me').query({ page: -1 }).expect(422)
  })

  it('rejects the removed direct booking path in favour of holds + checkout', async () => {
    const owner = await signedInAgent('gone@example.com')
    const trip = await firstTrip()
    const response = await owner.agent
      .post('/api/bookings')
      .set('x-csrf-token', owner.csrf)
      .send({ tripId: trip.id, passengers: [{ seatNumber: '1A', name: 'A Traveller', age: 28 }] })
      .expect(410)
    expect(response.body.error.code).toBe('BOOKINGS_VIA_CHECKOUT')
  })

  it('resolves a hold race with exactly one winner and no partial ownership', async () => {
    const first = await signedInAgent('hold-race-a@example.com')
    const second = await signedInAgent('hold-race-b@example.com')
    const trip = await firstTrip()
    const payload = { tripId: trip.id, seatNumbers: ['1C', '1D'] }
    const [one, two] = await Promise.all([
      first.agent.post('/api/holds').set('x-csrf-token', first.csrf).send(payload),
      second.agent.post('/api/holds').set('x-csrf-token', second.csrf).send(payload),
    ])
    expect([one.status, two.status].sort()).toEqual([201, 409])
    const held = await prisma.seat.findMany({
      where: { tripId: trip.id, seatNumber: { in: ['1C', '1D'] } },
      orderBy: { seatNumber: 'asc' },
    })
    expect(held.every((seat) => seat.status === 'HELD')).toBe(true)
    expect(new Set(held.map((seat) => seat.holdId)).size).toBe(1)

    const partial = await second.agent
      .post('/api/holds')
      .set('x-csrf-token', second.csrf)
      .send({ tripId: trip.id, seatNumbers: ['2C', '1C'] })
      .expect(409)
    expect(partial.body.error.code).toBe('SEAT_UNAVAILABLE')
    expect(
      (
        await prisma.seat.findUniqueOrThrow({
          where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '2C' } },
        })
      ).status,
    ).toBe('AVAILABLE')
  })

  it('holds seats exclusively, replaces a previous hold, and exposes them as unavailable to others', async () => {
    const owner = await signedInAgent('hold-owner@example.com')
    const stranger = await signedInAgent('hold-stranger@example.com')
    const trip = await firstTrip()
    const hold = await owner.agent
      .post('/api/holds')
      .set('x-csrf-token', owner.csrf)
      .send({ tripId: trip.id, seatNumbers: ['5A', '5B'] })
      .expect(201)
    expect(hold.body.data.seatNumbers).toEqual(['5A', '5B'])
    const ownView = await owner.agent.get(`/api/buses/trip/${trip.id}`).expect(200)
    expect(
      ownView.body.data.seats.find((seat: { number: string }) => seat.number === '5A'),
    ).toMatchObject({ status: 'HELD', heldByYou: true })
    const strangerView = await stranger.agent.get(`/api/buses/trip/${trip.id}`).expect(200)
    expect(
      strangerView.body.data.seats.find((seat: { number: string }) => seat.number === '5A'),
    ).toMatchObject({ status: 'HELD' })

    const replaced = await owner.agent
      .post('/api/holds')
      .set('x-csrf-token', owner.csrf)
      .send({ tripId: trip.id, seatNumbers: ['6A'] })
      .expect(201)
    expect(
      (
        await prisma.seat.findUniqueOrThrow({
          where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '5A' } },
        })
      ).status,
    ).toBe('AVAILABLE')
    await stranger.agent
      .post('/api/holds')
      .set('x-csrf-token', stranger.csrf)
      .send({ tripId: trip.id, seatNumbers: ['6A'] })
      .expect(409)
    await owner.agent.delete(`/api/holds/${replaced.body.data.id}`).set('x-csrf-token', owner.csrf).send().expect(204)
    expect(
      (
        await prisma.seat.findUniqueOrThrow({
          where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '6A' } },
        })
      ).status,
    ).toBe('AVAILABLE')
  })

  it('treats an expired hold as logically available to another traveller without a cleanup job', async () => {
    const owner = await signedInAgent('hold-expired@example.com')
    const stranger = await signedInAgent('hold-takeover@example.com')
    const trip = await firstTrip()
    const hold = await owner.agent
      .post('/api/holds')
      .set('x-csrf-token', owner.csrf)
      .send({ tripId: trip.id, seatNumbers: ['4B'] })
      .expect(201)
    const past = new Date(Date.now() - 1_000)
    await prisma.seatHold.update({ where: { id: hold.body.data.id }, data: { expiresAt: past } })
    await prisma.seat.updateMany({ where: { holdId: hold.body.data.id }, data: { holdExpiresAt: past } })

    const stale = await owner.agent.get(`/api/holds/${hold.body.data.id}`).expect(200)
    expect(stale.body.data.state).toBe('EXPIRED')
    const anonymousView = await request(app).get(`/api/buses/trip/${trip.id}`).expect(200)
    expect(
      anonymousView.body.data.seats.find((seat: { number: string }) => seat.number === '4B').status,
    ).toBe('AVAILABLE')

    const takeover = await stranger.agent
      .post('/api/holds')
      .set('x-csrf-token', stranger.csrf)
      .send({ tripId: trip.id, seatNumbers: ['4B'] })
      .expect(201)
    const takenHold = await prisma.seatHold.findUniqueOrThrow({
      where: { id: takeover.body.data.id },
      include: { user: true },
    })
    expect(takenHold.user.email).toBe('hold-takeover@example.com')
  })

  it('rejects holds for departed trips', async () => {
    const owner = await signedInAgent('departed@example.com')
    const trip = await prisma.trip.create({
      data: {
        routeId: (await prisma.route.findFirstOrThrow()).id,
        busId: (await prisma.bus.findFirstOrThrow()).id,
        travelDate: new Date('2020-01-01T00:00:00.000Z'),
        departureTime: '07:30',
        arrivalTime: '13:30',
        durationMinutes: 360,
        fare: 500,
        cancellationCutoffMinutes: 360,
        cancellationFeePercent: 10,
      },
    })
    const response = await owner.agent
      .post('/api/holds')
      .set('x-csrf-token', owner.csrf)
      .send({ tripId: trip.id, seatNumbers: ['1A'] })
      .expect(409)
    expect(response.body.error.code).toBe('TRIP_DEPARTED')
    await prisma.trip.delete({ where: { id: trip.id } })
  })

  it('confirms a checkout to tickets and replays the same key to the same PNR', async () => {
    const owner = await signedInAgent('confirm@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['2A', '2B'])
    const key = idKey('replay')
    const passengers = [
      { name: 'First Rider', age: 35 },
      { name: 'Second Rider', age: 36 },
    ]
    const created = await confirm(owner.agent, owner.csrf, hold.id, passengers, key).expect(200)
    expect(created.body.data.attempt.status).toBe('SUCCEEDED')
    expect(created.body.data.booking.tickets).toHaveLength(2)
    expect(created.body.data.booking.status).toBe('ACTIVE')

    const replay = await confirm(owner.agent, owner.csrf, hold.id, passengers, key).expect(200)
    expect(replay.body.data.booking.id).toBe(created.body.data.booking.id)
    expect(replay.body.data.booking.pnr).toBe(created.body.data.booking.pnr)
    expect(await prisma.bookingGroup.count({ where: { holdId: hold.id } })).toBe(1)
    expect(await prisma.booking.count({ where: { groupId: created.body.data.booking.id } })).toBe(2)

    const reused = await confirm(owner.agent, owner.csrf, hold.id, [{ name: 'Someone Else', age: 20 }], key).expect(409)
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('allows exactly one booking when the same key is confirmed concurrently', async () => {
    const owner = await signedInAgent('concurrent-confirm@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['3A'])
    const key = idKey('concurrent')
    const [one, two] = await Promise.all([
      confirm(owner.agent, owner.csrf, hold.id, [{ name: 'Race Rider', age: 31 }], key),
      confirm(owner.agent, owner.csrf, hold.id, [{ name: 'Race Rider', age: 31 }], key),
    ])
    const statuses = [one.body.data.attempt.status, two.body.data.attempt.status]
    expect(statuses).toEqual(['SUCCEEDED', 'SUCCEEDED'])
    const ids = [one.body.data.booking.id, two.body.data.booking.id]
    expect(new Set(ids).size).toBe(1)
    expect(await prisma.bookingGroup.count({ where: { holdId: hold.id } })).toBe(1)
    expect(
      (await prisma.seat.findUniqueOrThrow({ where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '3A' } } }))
        .status,
    ).toBe('BOOKED')
  })

  it('keeps the hold available for a new-key retry after a declined payment', async () => {
    const owner = await signedInAgent('payment-fail@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['4C'])
    const declined = await confirm(
      owner.agent,
      owner.csrf,
      hold.id,
      [{ name: 'Declined Rider', age: 41 }],
      idKey('fail'),
      'failure',
    ).expect(202)
    expect(declined.body.data.attempt.status).toBe('FAILED')
    expect(declined.body.data.attempt.message).toContain('No charge occurred')

    const holdAfter = await owner.agent.get(`/api/holds/${hold.id}`).expect(200)
    expect(holdAfter.body.data.state).toBe('ACTIVE')
    const retry = await confirm(
      owner.agent,
      owner.csrf,
      hold.id,
      [{ name: 'Declined Rider', age: 41 }],
      idKey('retry'),
    ).expect(200)
    expect(retry.body.data.attempt.status).toBe('SUCCEEDED')
    expect(retry.body.data.booking.tickets[0].seatNumber).toBe('4C')
  })

  it('recovers a lost payment response to the same PNR, including across a client restart', async () => {
    const owner = await signedInAgent('payment-lost@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['5C'])
    const key = idKey('lost')
    const passengers = [{ name: 'Lost Rider', age: 45 }]
    const pending = await confirm(owner.agent, owner.csrf, hold.id, passengers, key, 'lost').expect(202)
    expect(pending.body.data.attempt.status).toBe('PENDING')
    expect(await prisma.bookingGroup.count({ where: { holdId: hold.id } })).toBe(0)

    // Simulate a process restart between the charge and the recovery.
    await prisma.$disconnect()
    await prisma.$connect()

    const recovered = await owner.agent
      .get(`/api/checkouts/attempts/${pending.body.data.attempt.id}`)
      .expect(200)
    expect(recovered.body.data.attempt.status).toBe('SUCCEEDED')
    const retryWithSameKey = await confirm(owner.agent, owner.csrf, hold.id, passengers, key).expect(200)
    expect(retryWithSameKey.body.data.booking.pnr).toBe(recovered.body.data.booking.pnr)
    expect(await prisma.bookingGroup.count({ where: { holdId: hold.id } })).toBe(1)
  })

  it('issues no ticket and flags reconciliation when simulated success arrives after expiry', async () => {
    const owner = await signedInAgent('late-success@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['6B'])
    const past = new Date(Date.now() - 1_000)
    await prisma.seatHold.update({ where: { id: hold.id }, data: { expiresAt: past } })
    await prisma.seat.updateMany({ where: { holdId: hold.id }, data: { holdExpiresAt: past } })

    const late = await confirm(owner.agent, owner.csrf, hold.id, [{ name: 'Late Rider', age: 50 }], idKey('late'))
    expect(late.status).toBe(409)
    expect(late.body.error.code).toBe('HOLD_EXPIRED')
    const attempt = await prisma.paymentAttempt.findFirstOrThrow({ where: { holdId: hold.id } })
    expect(attempt.status).toBe('RECONCILIATION_REQUIRED')
    expect(await prisma.bookingGroup.count({ where: { holdId: hold.id } })).toBe(0)
    expect(
      (await prisma.seat.findUniqueOrThrow({ where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '6B' } } }))
        .status,
    ).toBe('HELD')
  })

  it('persists a group and supports partial then final cancellation', async () => {
    const owner = await signedInAgent('cancel@example.com')
    const stranger = await signedInAgent('stranger@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['1A', '1B'])
    const created = await confirm(
      owner.agent,
      owner.csrf,
      hold.id,
      [
        { name: 'First Rider', age: 35 },
        { name: 'Second Rider', age: 36 },
      ],
      idKey('cancel'),
    ).expect(200)
    const [firstTicket, secondTicket] = created.body.data.booking.tickets
    await stranger.agent
      .patch(`/api/bookings/${firstTicket.id}/cancel`)
      .set('x-csrf-token', stranger.csrf)
      .send()
      .expect(403)
    const partial = await owner.agent
      .patch(`/api/bookings/${firstTicket.id}/cancel`)
      .set('x-csrf-token', owner.csrf)
      .send()
      .expect(200)
    expect(partial.body.data.status).toBe('PARTIALLY_CANCELLED')
    expect(partial.body.data.tickets[0].refundAmount).toBe(
      Math.round(partial.body.data.tickets[0].totalFare * 0.9),
    )
    const final = await owner.agent
      .patch(`/api/bookings/${secondTicket.id}/cancel`)
      .set('x-csrf-token', owner.csrf)
      .send()
      .expect(200)
    expect(final.body.data.status).toBe('CANCELLED')
    await owner.agent
      .patch(`/api/bookings/${secondTicket.id}/cancel`)
      .set('x-csrf-token', owner.csrf)
      .send()
      .expect(409)
  })

  it('handles concurrent duplicate cancellation without releasing a seat twice', async () => {
    const owner = await signedInAgent('concurrent-cancel@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['3B'])
    const created = await confirm(
      owner.agent,
      owner.csrf,
      hold.id,
      [{ name: 'Concurrent Rider', age: 38 }],
      idKey('ccancel'),
    ).expect(200)
    const ticketId = created.body.data.booking.tickets[0].id
    const [one, two] = await Promise.all([
      owner.agent.patch(`/api/bookings/${ticketId}/cancel`).set('x-csrf-token', owner.csrf).send(),
      owner.agent.patch(`/api/bookings/${ticketId}/cancel`).set('x-csrf-token', owner.csrf).send(),
    ])
    expect([one.status, two.status].sort()).toEqual([200, 409])
    expect(
      (
        await prisma.seat.findUniqueOrThrow({
          where: { tripId_seatNumber: { tripId: trip.id, seatNumber: '3B' } },
        })
      ).status,
    ).toBe('AVAILABLE')
  })

  it('retrieves the same booking and PNR after reconnecting the database client', async () => {
    const owner = await signedInAgent('restart@example.com')
    const trip = await firstTrip()
    const hold = await createHold(owner.agent, owner.csrf, trip.id, ['4A'])
    const created = await confirm(
      owner.agent,
      owner.csrf,
      hold.id,
      [{ name: 'Restart Rider', age: 40 }],
      idKey('restart'),
    ).expect(200)
    await prisma.$disconnect()
    await prisma.$connect()
    const freshAgent = request.agent(app)
    const csrf = (await freshAgent.get('/api/auth/csrf')).body.data.token
    await freshAgent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf)
      .send({ email: 'restart@example.com', password: 'VoyageBus123!' })
      .expect(200)
    const bookings = await freshAgent.get('/api/bookings/me').expect(200)
    expect(bookings.body.data[0].pnr).toBe(created.body.data.booking.pnr)
  })
})

describe('fallback trip parser', () => {
  it('extracts supported city aliases, preferences, date, and budget', () => {
    const result = parseSearchFallback('AC sleeper from Hyd to Bangalore tomorrow night under ₹1200')
    expect(result).toMatchObject({
      source: 'Hyderabad',
      destination: 'Bengaluru',
      busType: 'SLEEPER',
      isAc: true,
      timePreference: 'night',
      maxPrice: 1200,
      provider: 'fallback',
    })
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
