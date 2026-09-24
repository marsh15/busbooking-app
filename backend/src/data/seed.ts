import argon2 from 'argon2'
import { Prisma } from '@prisma/client'
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

  // Everything below is bulk-inserted with skipDuplicates: seeded rows are
  // deterministic, existing rows are never modified, and ten-ish round trips
  // finish in a couple of seconds even with a cross-region database. Order
  // matters: each batch only references tables inserted in earlier batches.
  await prisma.city.createMany({
    data: cities.map((name) => ({ id: stableId('city', name), name })),
    skipDuplicates: true,
  })
  await prisma.route.createMany({
    data: pairs.map(([source, destination]) => ({
      id: stableId('route', `${source}:${destination}`),
      sourceId: stableId('city', source),
      destinationId: stableId('city', destination),
    })),
    skipDuplicates: true,
  })
  await prisma.operator.createMany({
    data: operators.map((operator) => ({
      id: stableId('operator', operator.name),
      name: operator.name,
    })),
    skipDuplicates: true,
  })
  await prisma.cancellationPolicy.createMany({
    data: operators.map((operator) => ({
      id: stableId('policy', operator.policyKey),
      operatorId: stableId('operator', operator.name),
      version: 1,
      isActive: true,
      rules: operator.rules,
    })),
    skipDuplicates: true,
  })
  await prisma.bus.createMany({
    data: buses.map((bus) => ({
      id: stableId('bus', bus.id),
      name: bus.name,
      operatorId: stableId('operator', bus.operatorName),
      type: bus.type,
      isAc: bus.isAc,
      amenities: bus.amenities,
    })),
    skipDuplicates: true,
  })
  await prisma.user.createMany({
    data: [
      {
        id: stableId('user', 'demo@voyagebus.in'),
        name: 'Demo Traveller',
        email: 'demo@voyagebus.in',
        passwordHash: await argon2.hash('VoyageBus123!', { type: argon2.argon2id }),
      },
    ],
    skipDuplicates: true,
  })

  const trips: Array<Prisma.TripCreateManyInput & { id: string }> = []
  const tripKeys: string[] = []
  for (const [routeIndex] of pairs.entries()) {
    for (let day = 0; day < 7; day += 1) {
      for (const slot of [0, 1]) {
        const travelDate = addDays(seedDate, day)
        const bus = buses[(routeIndex + day * 2 + slot) % buses.length]!
        const tripKey = `${pairs[routeIndex]![0]}:${pairs[routeIndex]![1]}:${travelDate}:${slot}`
        tripKeys.push(tripKey)
        trips.push({
          id: stableId('trip', tripKey),
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
        })
      }
    }
  }
  await prisma.trip.createMany({ data: trips, skipDuplicates: true })

  const seats: Array<{
    id: string
    tripId: string
    seatNumber: string
    deck: number
    row: number
    column: number
  }> = []
  trips.forEach((trip, index) => {
    const tripKey = tripKeys[index]!
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
          tripId: trip.id,
          seatNumber,
          deck: 1,
          row,
          column,
        })
      }
    }
  })
  await prisma.seat.createMany({ data: seats, skipDuplicates: true })
}
