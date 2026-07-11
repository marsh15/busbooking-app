import { db } from '../data/store.js'
import type { SearchFilters } from '../types.js'

export function findRoute(source?: string, destination?: string) {
  const normalise = (value?: string) => value?.trim().toLowerCase()
  return db.routes.find((route) => normalise(route.source.name) === normalise(source) && normalise(route.destination.name) === normalise(destination))
}

export function searchTrips(filters: SearchFilters) {
  const trips = db.trips.filter((trip) => {
    const hour = Number(trip.departureTime.slice(0, 2))
    const period = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 20 ? 'evening' : 'night'
    return (!filters.routeId || trip.route.id === filters.routeId)
      && (!filters.travelDate || trip.travelDate === filters.travelDate)
      && (!filters.maxPrice || trip.fare <= filters.maxPrice)
      && (filters.isAc === undefined || trip.bus.isAc === filters.isAc)
      && (!filters.busType || trip.bus.type === filters.busType)
      && (!filters.departure || period === filters.departure)
  })
  return trips.sort((first, second) => filters.sort === 'price' ? first.fare - second.fare : filters.sort === 'departure' ? first.departureTime.localeCompare(second.departureTime) : 0)
}
