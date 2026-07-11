export type BusType = 'SLEEPER' | 'SEATER'
export interface RouteInfo { id: string; source: { name: string }; destination: { name: string } }
export interface TripCard { id: string; busId: string; busName: string; operator: string; route: RouteInfo; travelDate: string; departureTime: string; arrivalTime: string; durationMinutes: number; fare: number; isAc: boolean; busType: BusType; amenities: string[]; availableSeats: number }
export interface Seat { id: string; number: string; deck: number; row: number; column: number; status: 'AVAILABLE' | 'BOOKED' }
export interface TripDetail extends TripCard { seats: Seat[]; policy: { cutoffMinutes: number; feePercent: number } }
export interface User { id: string; name: string; email: string }
export interface Ticket { id: string; seatNumber: string; passengerName: string; passengerAge: number; totalFare: number; status: 'ACTIVE' | 'CANCELLED'; cancelledAt?: string; refundAmount?: number; trip: TripCard }
export interface BookingGroup { id: string; pnr: string; status: 'ACTIVE' | 'PARTIALLY_CANCELLED' | 'CANCELLED'; createdAt: string; tickets: Ticket[] }
export interface ParsedSearch { source: string | null; destination: string | null; date: string | null; timePreference: string | null; busType: BusType | null; isAc: boolean | null; maxPrice: number | null; provider: string; warnings: string[] }
