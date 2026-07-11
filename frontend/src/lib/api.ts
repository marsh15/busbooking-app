import axios from 'axios'
import type { BookingGroup, ParsedSearch, RouteInfo, TripCard, TripDetail, User } from '../types'

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api', withCredentials: true })
let csrfToken: string | undefined
api.interceptors.request.use((config) => { if (!['get', 'head'].includes(config.method || 'get') && csrfToken) config.headers['x-csrf-token'] = csrfToken; return config })
async function csrf() { if (!csrfToken) csrfToken = (await api.get('/auth/csrf')).data.data.token as string }
const data = <T>(request: Promise<{ data: { data: T } }>) => request.then((response) => response.data.data)

export const client = {
  csrf,
  me: () => data<{ user: User }>(api.get('/auth/me')),
  login: async (values: { email: string; password: string }) => { await csrf(); return data<{ user: User }>(api.post('/auth/login', values)) },
  register: async (values: { name: string; email: string; password: string }) => { await csrf(); return data<{ user: User }>(api.post('/auth/register', values)) },
  logout: async () => { await csrf(); return data<{ loggedOut: boolean }>(api.post('/auth/logout')) },
  route: (source: string, destination: string) => data<RouteInfo>(api.get('/routes/search', { params: { source, destination } })),
  trips: (params: Record<string, string | boolean | number | undefined>) => data<TripCard[]>(api.get('/buses', { params })),
  trip: (busId: string, tripId: string) => data<TripDetail>(api.get(`/buses/${busId}`, { params: { tripId } })),
  parse: (query: string) => data<ParsedSearch>(api.post('/ai/parse-search', { query })),
  book: async (tripId: string, passengers: Array<{ seatNumber: string; name: string; age: number }>) => { await csrf(); return data<BookingGroup>(api.post('/bookings', { tripId, passengers })) },
  bookings: () => data<BookingGroup[]>(api.get('/bookings/me')),
  booking: (id: string) => data<BookingGroup>(api.get(`/bookings/group/${id}`)),
  cancel: async (ticketId: string) => { await csrf(); return data<BookingGroup>(api.patch(`/bookings/${ticketId}/cancel`)) },
}
