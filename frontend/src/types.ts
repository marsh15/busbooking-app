export type BusType = 'SLEEPER' | 'SEATER'
export interface RouteInfo {
  id: string
  source: { name: string }
  destination: { name: string }
}
export interface TripCard {
  id: string
  busId: string
  busName: string
  operator: string
  route: RouteInfo
  travelDate: string
  departureTime: string
  arrivalTime: string
  durationMinutes: number
  fare: number
  isAc: boolean
  busType: BusType
  amenities: string[]
  availableSeats: number
}
export interface Seat {
  id: string
  number: string
  deck: number
  row: number
  column: number
  status: 'AVAILABLE' | 'HELD' | 'BOOKED'
  heldByYou?: boolean
}
export interface PolicyRule {
  beforeDepartureHours: number
  refundPercent: number
}
export interface PolicyInfo {
  operatorName: string
  version: number
  rules: PolicyRule[]
}
export interface TripDetail extends TripCard {
  seats: Seat[]
  policy: PolicyInfo
}
export interface User {
  id: string
  name: string
  email: string
}
export interface Ticket {
  id: string
  seatNumber: string
  passengerName: string
  passengerAge: number
  totalFare: number
  status: 'ACTIVE' | 'CANCELLED'
  cancelledAt?: string
  refundAmount?: number
  trip: {
    id: string
    route: RouteInfo
    travelDate: string
    departureTime: string
    arrivalTime: string
    durationMinutes: number
    fare: number
  }
}
export interface BookingGroup {
  id: string
  pnr: string
  status: 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'CANCELLED'
  createdAt: string
  policySnapshot?: PolicyInfo
  tickets: Ticket[]
}
export interface ParsedSearch {
  source: string | null
  destination: string | null
  date: string | null
  timePreference: string | null
  busType: BusType | null
  isAc: boolean | null
  maxPrice: number | null
  provider: string
  warnings: string[]
}
export interface PageInfo {
  total: number
  page: number
  pageSize: number
}
export interface Paginated<T> {
  data: T
  pagination: PageInfo
}
export interface SeatHold {
  id: string
  tripId: string
  state: 'ACTIVE' | 'EXPIRED' | 'CONSUMED' | 'RELEASED'
  expiresAt: string
  farePerSeat: number
  seatNumbers: string[]
  trip: {
    id: string
    busName: string
    operator: string
    travelDate: string
    departureTime: string
    arrivalTime: string
    route: string
  }
}
export type PaymentAttemptStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'RECONCILIATION_REQUIRED'
export interface CheckoutResult {
  attempt: {
    id: string
    status: PaymentAttemptStatus
    amount: number
    resultCode?: string
    message: string
  }
  booking?: BookingGroup
}
export interface CancellationQuote {
  ticketId: string
  eligible: boolean
  reason?: string
  refundAmount: number
  refundPercent: number
  windowLabel: string
  policy: PolicyInfo
  quotedAt: string
}
