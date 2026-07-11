import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Armchair, BusFront, CalendarDays, ChevronDown, Clock3, Coffee, Filter, Heart, MapPin, Moon, PlugZap, SlidersHorizontal, Snowflake, Star, Sun, Sunset, Wifi } from 'lucide-react'
import { client } from '../lib/api'
import type { TripCard } from '../types'

const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`
const amenityIcons: Record<string, React.ElementType> = { WiFi: Wifi, Charging: PlugZap, Blanket: Moon, Water: Coffee }

export function SearchPage() {
  const [params, setParams] = useSearchParams(); const [mobileFilters, setMobileFilters] = useState(false); const source = params.get('source') || ''; const destination = params.get('destination') || ''; const date = params.get('date') || ''
  const route = useQuery({ queryKey: ['route', source, destination], queryFn: () => client.route(source, destination), enabled: Boolean(source && destination), retry: false }); const page = Math.max(1, Number(params.get('page')) || 1)
  const trips = useQuery({ queryKey: ['trips', route.data?.id, date, params.toString()], queryFn: () => client.tripsPage({ routeId: route.data?.id, travelDate: date, maxPrice: params.get('maxPrice') || undefined, isAc: params.get('isAc') || undefined, busType: params.get('busType') || undefined, departure: params.get('departure') || undefined, sort: params.get('sort') || undefined, page, pageSize: 6 }), enabled: Boolean(route.data?.id) })
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next) }; const clear = () => setParams({ source, destination, date })
  return <main className="search-page">
    <section className="search-summary"><div className="route-summary"><span><MapPin /></span><div><small>FROM</small><strong>{source || 'Origin'}</strong></div><ArrowRight /><div><small>TO</small><strong>{destination || 'Destination'}</strong></div></div><div className="date-summary"><CalendarDays /><div><small>JOURNEY DATE</small><strong>{date || 'Choose date'}</strong></div></div><Link to="/">Modify search</Link></section>
    <div className="results-toolbar"><div><h1>{trips.data?.pagination.total ?? '—'} buses available</h1><p>{source} to {destination} · Prices include all taxes</p></div><button className="mobile-filter-button" onClick={() => setMobileFilters(true)}><Filter /> Filters</button><label>Sort by <select value={params.get('sort') || ''} onChange={(e) => update('sort', e.target.value)}><option value="">Recommended</option><option value="price">Lowest fare</option><option value="departure">Earliest departure</option></select><ChevronDown /></label></div>
    <div className="results-layout">
      <Filters className={mobileFilters ? 'open' : ''} params={params} update={update} clear={clear} close={() => setMobileFilters(false)} />
      <section aria-live="polite" className="trip-results">
        {(route.isLoading || trips.isLoading) && [1,2,3].map((n) => <div className="skeleton card-skeleton" key={n} />)}
        {(route.isError || trips.isError) && <Empty title="This route is taking a breather." body="Try one of our popular corridors or adjust your search." action="Back to search" />}
        {trips.data?.data.length === 0 && <div className="empty-state"><BusFront /><h2>No buses match these filters</h2><p>Widen your preferences to see more journeys.</p><button className="primary" onClick={clear}>Clear all filters</button></div>}
        {trips.data?.data.map((trip, index) => <TripCardView key={trip.id} trip={trip} index={index} />)}
        {trips.data && trips.data.pagination.total > trips.data.pagination.pageSize && <nav className="pagination" aria-label="Result pages"><button className="outline-button" disabled={page <= 1} onClick={() => update('page', String(page - 1))}>Previous</button><span>Page {page} of {Math.ceil(trips.data.pagination.total / trips.data.pagination.pageSize)}</span><button className="outline-button" disabled={page * trips.data.pagination.pageSize >= trips.data.pagination.total} onClick={() => update('page', String(page + 1))}>Next</button></nav>}
      </section>
    </div>
  </main>
}

function Filters({ className, params, update, clear, close }: { className: string; params: URLSearchParams; update: (k:string,v:string)=>void; clear:()=>void; close:()=>void }) {
  const timeOptions = [{ value: 'morning', label: 'Morning', icon: Sun }, { value: 'afternoon', label: 'Afternoon', icon: Sunset }, { value: 'night', label: 'Night', icon: Moon }]
  return <aside className={`filters ${className}`}><header><h2><SlidersHorizontal /> Filters</h2><button onClick={clear}>Clear all</button><button className="filter-close" onClick={close}>Done</button></header><div className="filter-group"><h3>Departure time</h3><div className="time-chips">{timeOptions.map(({value,label,icon:Icon}) => <button className={params.get('departure') === value ? 'active' : ''} onClick={() => update('departure', params.get('departure') === value ? '' : value)} key={value}><Icon /><span>{label}</span></button>)}</div></div><div className="filter-group"><h3>Bus type</h3>{[['SLEEPER','Sleeper'],['SEATER','Seater']].map(([value,label]) => <label className="check-row" key={value}><input type="checkbox" checked={params.get('busType') === value} onChange={() => update('busType', params.get('busType') === value ? '' : value)} /><Armchair /><span>{label}</span></label>)}</div><div className="filter-group"><h3>Comfort</h3><label className="check-row"><input type="checkbox" checked={params.get('isAc') === 'true'} onChange={() => update('isAc', params.get('isAc') === 'true' ? '' : 'true')} /><Snowflake /><span>Air conditioned</span></label></div><div className="filter-group"><h3>Maximum fare</h3><select value={params.get('maxPrice') || ''} onChange={(e) => update('maxPrice', e.target.value)}><option value="">Any price</option><option value="800">Up to ₹800</option><option value="1200">Up to ₹1,200</option><option value="1600">Up to ₹1,600</option></select></div></aside>
}

function TripCardView({ trip, index }: { trip: TripCard; index: number }) {
  const soon = index === 0 && Number(trip.departureTime.split(':')[0]) < 12
  return <motion.article className={`trip-card ${soon ? 'departing' : ''}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}>
    {soon && <div className="departing-badge"><Clock3 /> Departing soon</div>}
    <div className="operator"><span className="operator-icon"><BusFront /></span><div><h2>{trip.operator}</h2><p>{trip.busName} · {trip.busType === 'SLEEPER' ? 'Sleeper coach' : 'Executive seater'}</p></div><button className="favorite" aria-label={`Save ${trip.operator}`}><Heart /></button></div>
    <div className="journey-times"><div><strong>{trip.departureTime}</strong><span>{trip.route.source.name}</span></div><div className="duration"><span>{duration(trip.durationMinutes)}</span><i><BusFront /></i></div><div><strong>{trip.arrivalTime}</strong><span>{trip.route.destination.name}</span></div></div>
    <div className="amenities"><span className="rating"><Star /> 4.{8 - index % 3}</span>{trip.isAc && <span title="Air conditioned"><Snowflake /> AC</span>}{trip.amenities.slice(0,3).map((item) => { const Icon = amenityIcons[item] || BadgeIcon; return <span title={item} key={item}><Icon /> {item}</span> })}</div>
    <div className="trip-action"><div className="seats-left"><Armchair /><span><b>{trip.availableSeats}</b> seats left</span></div><div className="price"><small>Starts from</small><strong>₹{trip.fare.toLocaleString('en-IN')}</strong><span>per seat</span></div><Link className="primary" to={`/bus/${trip.busId}?tripId=${trip.id}`}>View seats <ArrowRight /></Link></div>
  </motion.article>
}
function BadgeIcon() { return <Wifi /> }
function Empty({ title, body, action }: { title:string; body:string; action:string }) { return <div className="empty-state"><BusFront /><h2>{title}</h2><p>{body}</p><Link className="primary inline" to="/">{action}</Link></div> }
