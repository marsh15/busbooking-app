export type BusType = 'SLEEPER' | 'SEATER'
export type BookingStatus = 'ACTIVE' | 'CANCELLED'
export type GroupStatus = 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'CANCELLED'

export interface City {
  id: string
  name: string
}
export interface Route {
  id: string
  source: City
  destination: City
}
export interface Bus {
  id: string
  name: string
  operator: string
  type: BusType
  isAc: boolean
  amenities: string[]
}
export interface Seat {
  id: string
  number: string
  deck: number
  row: number
  column: number
  status: 'AVAILABLE' | 'BOOKED'
}
export interface Trip {
  id: string
  route: Route
  bus: Bus
  travelDate: string
  departureTime: string
  arrivalTime: string
  durationMinutes: number
  fare: number
  cancellationCutoffMinutes: number
  cancellationFeePercent: number
  seats: Seat[]
}
export interface User {
  id: string
  name: string
  email: string
  passwordHash: string
}
export interface Booking {
  id: string
  groupId: string
  userId: string
  tripId: string
  seatNumber: string
  passengerName: string
  passengerAge: number
  totalFare: number
  status: BookingStatus
  cancelledAt?: string
  refundAmount?: number
}
export interface BookingGroup {
  id: string
  pnr: string
  userId: string
  status: GroupStatus
  createdAt: string
  bookingIds: string[]
}

export interface SearchFilters {
  routeId?: string
  travelDate?: string
  maxPrice?: number
  isAc?: boolean
  busType?: BusType
  departure?: 'morning' | 'afternoon' | 'evening' | 'night'
  sort?: 'price' | 'departure'
  page?: number
  pageSize?: number
}
