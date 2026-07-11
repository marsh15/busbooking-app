import type { Prisma } from '@prisma/client'
import { prisma } from '../data/prisma.js'
import { routeDto, tripDto, tripInclude } from '../data/dto.js'
import type { SearchFilters } from '../types.js'

const normalise = (value?: string) => value?.trim().toLowerCase()

export async function listRoutes() {
  const routes = await prisma.route.findMany({ include: { source: true, destination: true } })
  return routes.map(routeDto)
}

export async function findRoute(source?: string, destination?: string) {
  const route = await prisma.route.findFirst({
    where: {
      source: { name: normalise(source) },
      destination: { name: normalise(destination) },
    },
    include: { source: true, destination: true },
  })
  return route ? routeDto(route) : null
}

export async function searchTrips(filters: SearchFilters) {
  const where: Prisma.TripWhereInput = {
    ...(filters.routeId ? { routeId: filters.routeId } : {}),
    ...(filters.travelDate ? { travelDate: new Date(`${filters.travelDate}T00:00:00.000Z`) } : {}),
    ...(filters.maxPrice ? { fare: { lte: filters.maxPrice } } : {}),
    ...(filters.isAc === undefined ? {} : { bus: { isAc: filters.isAc } }),
    ...(filters.busType ? { bus: { ...(filters.isAc === undefined ? {} : { isAc: filters.isAc }), type: filters.busType } } : {}),
  }
  const trips = (await prisma.trip.findMany({ where, include: tripInclude })).map(tripDto)
  const filtered = trips.filter((trip) => {
    if (!filters.departure) return true
    const hour = Number(trip.departureTime.slice(0, 2))
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 20 ? 'evening' : 'night'
    return period === filters.departure
  })
  return filtered.sort((first, second) => filters.sort === 'price' ? first.fare - second.fare : filters.sort === 'departure' ? first.departureTime.localeCompare(second.departureTime) : 0)
}
