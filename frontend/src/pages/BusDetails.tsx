import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { client } from '../lib/api'
import { SeatMap } from '../components/SeatMap'
import { useAppStore } from '../store'

export function BusDetailsPage() {
  const { busId = '' } = useParams(); const [params] = useSearchParams(); const tripId = params.get('tripId') || ''; const navigate = useNavigate(); const selected = useAppStore((state) => state.selectedSeats); const setSelected = useAppStore((state) => state.setSelectedSeats)
  const trip = useQuery({ queryKey: ['trip', busId, tripId], queryFn: () => client.trip(busId, tripId) })
  if (trip.isLoading) return <main className="page-shell"><div className="skeleton detail-skeleton" /></main>
  if (trip.isError || !trip.data) return <main className="page-shell"><div className="empty-state"><h1>This trip has moved on.</h1><Link className="primary inline" to="/">Find another bus</Link></div></main>
  const item = trip.data
  return <main className="page-shell"><div className="crumb"><Link to="/">Home</Link> <span>›</span> <Link to={`/search?source=${item.route.source.name}&destination=${item.route.destination.name}&date=${item.travelDate}`}>Results</Link> <span>›</span> Choose seats</div><section className="bus-header"><div><p className="eyebrow">{item.operator}</p><h1>{item.busName}</h1><p>{item.busType.toLowerCase()} · {item.isAc ? 'Air conditioned' : 'Non-AC'} · {item.travelDate}</p></div><div className="journey-line"><b>{item.departureTime}<small>{item.route.source.name}</small></b><span>— {Math.floor(item.durationMinutes / 60)}h {item.durationMinutes % 60}m —</span><b>{item.arrivalTime}<small>{item.route.destination.name}</small></b></div></section><div className="detail-layout"><SeatMap seats={item.seats} selected={selected} onChange={setSelected} /><aside className="trip-summary"><p className="eyebrow">YOUR SELECTION</p><h2>{selected.length ? selected.join(', ') : 'No seats yet'}</h2><p>₹{(item.fare * selected.length).toLocaleString('en-IN')} total</p><button className="primary wide" disabled={!selected.length} onClick={() => navigate(`/checkout/${item.id}`)}>Continue to traveller details →</button><hr/><h3>On board</h3><ul>{item.amenities.map((amenity) => <li key={amenity}>✓ {amenity}</li>)}</ul><h3>Cancellation policy</h3><p className="muted">Cancel up to {item.policy.cutoffMinutes / 60} hours before departure. A {item.policy.feePercent}% mock cancellation fee applies.</p></aside></div></main>
}
