import { useEffect } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { client } from '../lib/api'
import { useAppStore } from '../store'

const schema = z.object({ passengers: z.array(z.object({ seatNumber: z.string(), name: z.string().min(2, 'Enter the traveller’s name.'), age: z.coerce.number().min(1).max(120) })) })
export function CheckoutPage() {
  const { tripId = '' } = useParams(); const navigate = useNavigate(); const selected = useAppStore((state) => state.selectedSeats); const setSelected = useAppStore((state) => state.setSelectedSeats)
  const trip = useQuery({ queryKey: ['checkout-trip', tripId], queryFn: async () => { const cards = await client.trips({}); const found = cards.find((item) => item.id === tripId); if (!found) throw new Error('Trip missing'); return client.trip(found.busId, tripId) } })
  type CheckoutValues = { passengers: Array<{ seatNumber: string; name: string; age: number }> }
  const form = useForm<CheckoutValues>({ resolver: zodResolver(schema) as Resolver<CheckoutValues>, defaultValues: { passengers: selected.map((seatNumber) => ({ seatNumber, name: '', age: 25 })) } }); const fields = useFieldArray({ control: form.control, name: 'passengers' })
  useEffect(() => { form.reset({ passengers: selected.map((seatNumber) => ({ seatNumber, name: '', age: 25 })) }) }, [selected, form])
  const booking = useMutation({ mutationFn: (values: CheckoutValues) => client.book(tripId, values.passengers), onSuccess: (group) => { setSelected([]); navigate(`/booking-confirmation/${group.id}`) } })
  if (!selected.length) return <main className="page-shell"><div className="empty-state"><h1>Choose seats first.</h1><p>Your traveller details appear once you select a seat.</p><Link className="primary inline" to="/">Find a bus</Link></div></main>
  return <main className="page-shell checkout"><div className="crumb"><Link to="/">Home</Link> <span>›</span> Checkout</div><header><p className="eyebrow">ALMOST THERE</p><h1>Who’s travelling?</h1><p>Payment is simulated—no card or money is required.</p></header><div className="checkout-layout"><form onSubmit={form.handleSubmit((values) => booking.mutate(values))}><section className="passenger-card"><h2>Passenger details</h2>{fields.fields.map((field, index) => <div className="passenger" key={field.id}><span className="seat-pill">Seat {field.seatNumber}</span><label>Full name<input {...form.register(`passengers.${index}.name`)} /></label><label>Age<input type="number" {...form.register(`passengers.${index}.age`)} /></label></div>)}</section>{booking.isError && <p className="form-error">{(booking.error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || 'Booking could not be completed. Refresh seats and try again.'}</p>}<button className="primary wide" disabled={booking.isPending}>{booking.isPending ? 'Confirming seats…' : 'Confirm simulated payment →'}</button></form><aside className="fare-card"><p className="eyebrow">FARE SUMMARY</p><h2>{selected.join(', ')}</h2><p>{trip.data?.busName || 'Your selected bus'}</p><div><span>{selected.length} × seat fare</span><b>₹{((trip.data?.fare || 0) * selected.length).toLocaleString('en-IN')}</b></div><div><span>Payment processing</span><b>₹0</b></div><hr/><div className="fare-total"><strong>Total</strong><strong>₹{((trip.data?.fare || 0) * selected.length).toLocaleString('en-IN')}</strong></div><p className="muted">This is a portfolio demo. Nothing will be charged.</p></aside></div></main>
}
