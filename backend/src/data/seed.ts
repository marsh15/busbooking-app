import argon2 from 'argon2'
import { createHash } from 'node:crypto'
import { prisma } from './prisma.js'
import { addDays, istDate } from '../utils/ist.js'

const cities = [
  'Hyderabad',
  'Vijayawada',
  'Bengaluru',
  'Chennai',
  'Coimbatore',
  'Kochi',
  'Thiruvananthapuram',
  'Visakhapatnam',
]
const pairs: Array<[string, string]> = [
  ['Hyderabad', 'Vijayawada'],
  ['Hyderabad', 'Bengaluru'],
  ['Bengaluru', 'Chennai'],
  ['Chennai', 'Coimbatore'],
  ['Kochi', 'Thiruvananthapuram'],
  ['Visakhapatnam', 'Hyderabad'],
]
// Clearly fictional operators with distinct, versioned cancellation windows:
// Marigold closes 6h out; Peacock closes 3h out with smaller refunds.
const operators = [
  {
    name: 'Marigold Trail Travels',
    policyKey: 'marigold:v1',
    rules: [
      { beforeDepartureHours: 72, refundPercent: 90 },
      { beforeDepartureHours: 24, refundPercent: 70 },
      { beforeDepartureHours: 6, refundPercent: 40 },
    ],
  },
  {
    name: 'Peacock Roadways',
    policyKey: 'peacock:v1',
    rules: [
      { beforeDepartureHours: 48, refundPercent: 85 },
      { beforeDepartureHours: 12, refundPercent: 60 },
      { beforeDepartureHours: 3, refundPercent: 25 },
    ],
  },
]
const buses = [
  {
    id: 'bus-amber',
    name: 'Amber Star',
    operatorName: 'Marigold Trail Travels',
    type: 'SLEEPER' as const,
    isAc: true,
    amenities: ['Wi-Fi', 'Charging point', 'Blanket', 'Arrival alerts'],
  },
  {
    id: 'bus-coast',
    name: 'Coastal Express',
    operatorName: 'Peacock Roadways',
    type: 'SEATER' as const,
    isAc: true,
    amenities: ['Wi-Fi', 'Water bottle', 'Charging point'],
  },
  {
    id: 'bus-night',
    name: 'Night Rider',
    operatorName: 'Marigold Trail Travels',
    type: 'SLEEPER' as const,
    isAc: false,
    amenities: ['Blanket', 'Reading light', 'First aid'],
  },
  {
    id: 'bus-day',
    name: 'Dayline',
    operatorName: 'Peacock Roadways',
    type: 'SEATER' as const,
    isAc: false,
    amenities: ['Charging point', 'Water bottle'],
  },
]

const stableId = (kind: string, key: string) => {
  // Keep the original namespace so a product rename never duplicates existing seeded rows.
  const hex = createHash('sha256').update(`smartbus:${kind}:${key}`).digest('hex').slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`
}

export async function seedDemoData(seedDate = process.env.SEED_DATE || istDate()) {
  // Seven rolling days keep the demo useful across the whole review window and
  // make later cancellation-policy slabs reachable.
  const currentDates = Array.from(
    { length: 7 },
    (_, day) => new Date(`${addDays(seedDate, day)}T00:00:00.000Z`),
  )
  const staleTrips = await prisma.trip.findMany({
    where: { isDemo: true, travelDate: { notIn: currentDates }, bookings: { none: {} } },
    select: { id: true },
  })
  if (staleTrips.length) {
    const ids = staleTrips.map(({ id }) => id)
    await prisma.$transaction([
      prisma.seat.deleteMany({ where: { tripId: { in: ids } } }),
      prisma.trip.deleteMany({ where: { id: { in: ids } } }),
    ])
  }

  for (const name of cities)
    await prisma.city.upsert({ where: { name }, update: {}, create: { id: stableId('city', name), name } })
  for (const [index, [source, destination]] of pairs.entries()) {
    const sourceId = stableId('city', source)
    const destinationId = stableId('city', destination)
    await prisma.route.upsert({
      where: { sourceId_destinationId: { sourceId, destinationId } },
      update: {},
      create: { id: stableId('route', `${source}:${destination}`), sourceId, destinationId },
    })
  }
  for (const operator of operators) {
    const operatorId = stableId('operator', operator.name)
    await prisma.operator.upsert({
      where: { id: operatorId },
      update: {},
      create: { id: operatorId, name: operator.name },
    })
    await prisma.cancellationPolicy.upsert({
      where: { operatorId_version: { operatorId, version: 1 } },
      update: {},
      create: {
        id: stableId('policy', operator.policyKey),
        operatorId,
        version: 1,
        isActive: true,
        rules: operator.rules,
      },
    })
  }
  for (const bus of buses) {
    const id = stableId('bus', bus.id)
    await prisma.bus.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: bus.name,
        operatorId: stableId('operator', bus.operatorName),
        type: bus.type,
        isAc: bus.isAc,
        amenities: bus.amenities,
      },
    })
  }
  await prisma.user.upsert({
    where: { email: 'demo@voyagebus.in' },
    update: {},
    create: {
      id: stableId('user', 'demo@voyagebus.in'),
      name: 'Demo Traveller',
      email: 'demo@voyagebus.in',
      passwordHash: await argon2.hash('VoyageBus123!', { type: argon2.argon2id }),
    },
  })

  for (const [routeIndex] of pairs.entries()) {
    for (let day = 0; day < 7; day += 1) {
      for (const slot of [0, 1]) {
        const travelDate = addDays(seedDate, day)
        const bus = buses[(routeIndex + day * 2 + slot) % buses.length]!
        const tripKey = `${pairs[routeIndex]![0]}:${pairs[routeIndex]![1]}:${travelDate}:${slot}`
        const tripId = stableId('trip', tripKey)
        const data = {
          routeId: stableId('route', `${pairs[routeIndex]![0]}:${pairs[routeIndex]![1]}`),
          busId: stableId('bus', bus.id),
          policyId: stableId(
            'policy',
            operators.find((operator) => operator.name === bus.operatorName)!.policyKey,
          ),
          travelDate: new Date(`${travelDate}T00:00:00.000Z`),
          departureTime: slot === 0 ? '07:30' : '21:15',
          arrivalTime:
            `${slot === 0 ? 12 + (routeIndex % 3) : 2 + (routeIndex % 3)}`.padStart(2, '0') +
            `:${slot === 0 ? '15' : '45'}`,
          durationMinutes: 300 + (routeIndex % 3) * 55,
          isDemo: true,
          fare: 480 + routeIndex * 120 + (bus.type === 'SLEEPER' ? 360 : 0) + (bus.isAc ? 180 : 0),
        }
        await prisma.trip.upsert({ where: { id: tripId }, update: {}, create: { id: tripId, ...data } })
        const seats = []
        for (let row = 1; row <= 6; row += 1) {
          for (const [column, suffix] of [
            [1, 'A'],
            [2, 'B'],
            [4, 'C'],
            [5, 'D'],
          ] as const) {
            const seatNumber = `${row}${suffix}`
            seats.push({
              id: stableId('seat', `${tripKey}:${seatNumber}`),
              tripId,
              seatNumber,
              deck: 1,
              row,
              column,
            })
          }
        }
        await prisma.seat.createMany({ data: seats, skipDuplicates: true })
      }
    }
  }
}
