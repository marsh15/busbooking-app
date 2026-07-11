import { randomUUID } from 'node:crypto'
import { db } from '../data/store.js'
import type { Booking, BookingGroup } from '../types.js'
import { isCancellationOpen } from '../utils/ist.js'
import { ApiError } from '../utils/http.js'

let queue = Promise.resolve()
async function atomic<T>(work: () => T | Promise<T>) { const previous = queue; let release!: () => void; queue = new Promise<void>((resolve) => { release = resolve }); await previous; try { return await work() } finally { release() } }
const hydrate = (group: BookingGroup) => ({ ...group, tickets: group.bookingIds.map((id) => db.bookings.find((booking) => booking.id === id)!).map((ticket) => ({ ...ticket, trip: db.trips.find((trip) => trip.id === ticket.tripId)! })) })

export async function createBooking(userId: string, tripId: string, passengers: Array<{ seatNumber: string; name: string; age: number }>) {
  return atomic(() => {
    const trip = db.trips.find((candidate) => candidate.id === tripId)
    if (!trip) throw new ApiError(404, 'TRIP_NOT_FOUND', 'This trip is no longer available.')
    const seats = passengers.map((passenger) => trip.seats.find((seat) => seat.number === passenger.seatNumber))
    if (seats.some((seat) => !seat || seat.status !== 'AVAILABLE')) throw new ApiError(409, 'SEAT_UNAVAILABLE', 'One or more selected seats were just booked. Please choose again.')
    seats.forEach((seat) => { seat!.status = 'BOOKED' })
    const group: BookingGroup = { id: randomUUID(), pnr: `SB${Math.random().toString().slice(2, 8)}`, userId, status: 'ACTIVE', createdAt: new Date().toISOString(), bookingIds: [] }
    const tickets: Booking[] = passengers.map((passenger) => ({ id: randomUUID(), groupId: group.id, userId, tripId, seatNumber: passenger.seatNumber, passengerName: passenger.name, passengerAge: passenger.age, totalFare: trip.fare, status: 'ACTIVE' }))
    group.bookingIds = tickets.map((ticket) => ticket.id)
    db.groups.push(group); db.bookings.push(...tickets)
    return hydrate(group)
  })
}

export function getBookings(userId: string) { return db.groups.filter((group) => group.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(hydrate) }
export function getBooking(userId: string, groupId: string) { const group = db.groups.find((candidate) => candidate.id === groupId); if (!group || group.userId !== userId) throw new ApiError(403, 'FORBIDDEN', 'You cannot access this booking.'); return hydrate(group) }
export async function cancelTicket(userId: string, ticketId: string) {
  return atomic(() => {
    const ticket = db.bookings.find((candidate) => candidate.id === ticketId)
    if (!ticket || ticket.userId !== userId) throw new ApiError(403, 'FORBIDDEN', 'You cannot cancel this ticket.')
    if (ticket.status !== 'ACTIVE') throw new ApiError(409, 'TICKET_NOT_ACTIVE', 'This ticket has already been cancelled.')
    const trip = db.trips.find((candidate) => candidate.id === ticket.tripId)!
    if (!isCancellationOpen(trip)) throw new ApiError(409, 'CANCELLATION_CLOSED', 'The six-hour cancellation window has closed.')
    ticket.status = 'CANCELLED'; ticket.cancelledAt = new Date().toISOString(); ticket.refundAmount = Math.round(ticket.totalFare * (1 - trip.cancellationFeePercent / 100))
    trip.seats.find((seat) => seat.number === ticket.seatNumber)!.status = 'AVAILABLE'
    const group = db.groups.find((candidate) => candidate.id === ticket.groupId)!
    const tickets = group.bookingIds.map((id) => db.bookings.find((booking) => booking.id === id)!)
    group.status = tickets.every((item) => item.status === 'CANCELLED') ? 'CANCELLED' : tickets.some((item) => item.status === 'CANCELLED') ? 'PARTIALLY_CANCELLED' : 'ACTIVE'
    return hydrate(group)
  })
}
