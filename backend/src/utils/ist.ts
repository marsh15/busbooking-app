const KOLKATA_OFFSET_MINUTES = 330

export function istDate(date = new Date()): string {
  const shifted = new Date(date.getTime() + (date.getTimezoneOffset() + KOLKATA_OFFSET_MINUTES) * 60_000)
  return shifted.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function isCancellationOpen(trip: {
  travelDate: string
  departureTime: string
  cancellationCutoffMinutes: number
}) {
  const departure = new Date(`${trip.travelDate}T${trip.departureTime}:00+05:30`).getTime()
  return Date.now() < departure - trip.cancellationCutoffMinutes * 60_000
}
