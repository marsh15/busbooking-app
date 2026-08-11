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
  const departure: Record<NonNullable<SearchFilters['departure']>, Prisma.TripWhereInput> = {
    morning: { departureTime: { lt: '12:00' } },
    afternoon: { departureTime: { gte: '12:00', lt: '17:00' } },
    evening: { departureTime: { gte: '17:00', lt: '20:00' } },
    night: { departureTime: { gte: '20:00' } },
  }
  const where: Prisma.TripWhereInput = {
    ...(filters.routeId ? { routeId: filters.routeId } : {}),
    ...(filters.travelDate ? { travelDate: new Date(`${filters.travelDate}T00:00:00.000Z`) } : {}),
    ...(filters.maxPrice ? { fare: { lte: filters.maxPrice } } : {}),
    ...(filters.isAc === undefined ? {} : { bus: { isAc: filters.isAc } }),
    ...(filters.busType
      ? { bus: { ...(filters.isAc === undefined ? {} : { isAc: filters.isAc }), type: filters.busType } }
      : {}),
    ...(filters.departure ? departure[filters.departure] : {}),
  }
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const orderBy: Prisma.TripOrderByWithRelationInput =
    filters.sort === 'price'
      ? { fare: 'asc' }
      : filters.sort === 'departure'
        ? { departureTime: 'asc' }
        : { id: 'asc' }
  const [records, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: tripInclude,
    }),
    prisma.trip.count({ where }),
  ])
  return { trips: records.map(tripDto), total, page, pageSize }
}
