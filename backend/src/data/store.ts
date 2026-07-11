import argon2 from 'argon2'
import { randomUUID } from 'node:crypto'
import type { Booking, BookingGroup, Bus, City, Route, Trip, User } from '../types.js'
import { addDays, istDate } from '../utils/ist.js'

const cityNames = ['Hyderabad', 'Vijayawada', 'Bengaluru', 'Chennai', 'Coimbatore', 'Kochi', 'Thiruvananthapuram', 'Visakhapatnam']
const cityMap = new Map(cityNames.map((name) => [name, { id: name.toLowerCase().replaceAll(' ', '-'), name }]))
const city = (name: string) => cityMap.get(name)!
const pairs: Array<[string, string]> = [
  ['Hyderabad', 'Vijayawada'], ['Hyderabad', 'Bengaluru'], ['Bengaluru', 'Chennai'],
  ['Chennai', 'Coimbatore'], ['Kochi', 'Thiruvananthapuram'], ['Visakhapatnam', 'Hyderabad'],
]

const buses: Bus[] = [
  { id: 'bus-amber', name: 'Amber Star', operator: 'Saffron Travels', type: 'SLEEPER', isAc: true, amenities: ['Wi-Fi', 'Charging point', 'Blanket', 'Live tracking'] },
  { id: 'bus-coast', name: 'Coastal Express', operator: 'Blue Coast', type: 'SEATER', isAc: true, amenities: ['Wi-Fi', 'Water bottle', 'Charging point'] },
  { id: 'bus-night', name: 'Night Rider', operator: 'Deccan Mobility', type: 'SLEEPER', isAc: false, amenities: ['Blanket', 'Reading light', 'First aid'] },
  { id: 'bus-day', name: 'Dayline', operator: 'South Link', type: 'SEATER', isAc: false, amenities: ['Charging point', 'Water bottle'] },
]

function seatLayout() {
  const seats = []
  for (let row = 1; row <= 6; row += 1) {
    for (const [column, suffix] of [[1, 'A'], [2, 'B'], [4, 'C'], [5, 'D']] as const) {
      seats.push({ id: randomUUID(), number: `${row}${suffix}`, deck: 1, row, column, status: 'AVAILABLE' as const })
    }
  }
  return seats
}

function createTrips(seedDate = istDate()): Trip[] {
  return pairs.flatMap(([source, destination], routeIndex) => [0, 1].flatMap((day) => [0, 1].map((slot) => {
    const bus = buses[(routeIndex + day * 2 + slot) % buses.length]!
    const hours = slot === 0 ? '07:30' : '21:15'
    const duration = 300 + (routeIndex % 3) * 55
    const arrivalHour = slot === 0 ? `${12 + (routeIndex % 3)}`.padStart(2, '0') : `${2 + (routeIndex % 3)}`.padStart(2, '0')
    const route: Route = { id: `route-${routeIndex + 1}`, source: city(source), destination: city(destination) }
    return {
      id: `trip-${routeIndex + 1}-${day}-${slot}`,
      route,
      bus,
      travelDate: addDays(seedDate, day),
      departureTime: hours,
      arrivalTime: `${arrivalHour}:${slot === 0 ? '15' : '45'}`,
      durationMinutes: duration,
      fare: 480 + routeIndex * 120 + (bus.type === 'SLEEPER' ? 360 : 0) + (bus.isAc ? 180 : 0),
      cancellationCutoffMinutes: 360,
      cancellationFeePercent: 10,
      seats: seatLayout(),
    }
  })))
}

export const db = {
  cities: [...cityMap.values()] as City[],
  routes: pairs.map(([source, destination], index) => ({ id: `route-${index + 1}`, source: city(source), destination: city(destination) })) as Route[],
  trips: createTrips(process.env.SEED_DATE || istDate()),
  users: [] as User[],
  bookings: [] as Booking[],
  groups: [] as BookingGroup[],
}

export async function ensureDemoUser() {
  if (db.users.some((user) => user.email === 'demo@smartbus.in')) return
  db.users.push({ id: 'demo-user', name: 'Demo Traveller', email: 'demo@smartbus.in', passwordHash: await argon2.hash('SmartBus123!', { type: argon2.argon2id }) })
}

export function resetStore(seedDate = istDate()) {
  db.trips = createTrips(seedDate)
  db.users = []
  db.bookings = []
  db.groups = []
}
