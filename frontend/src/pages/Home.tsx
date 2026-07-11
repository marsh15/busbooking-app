import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, ArrowRightLeft, BadgeCheck, BusFront, CalendarDays, ChevronRight, Clock3, MapPin, Search, ShieldCheck, Sparkles, Star, UsersRound, Wifi } from 'lucide-react'
import { client } from '../lib/api'
import type { ParsedSearch } from '../types'

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const toSearch = (values: Record<string, string | number | boolean | null>) => { const params = new URLSearchParams(); Object.entries(values).forEach(([key, value]) => { if (value !== null && value !== '') params.set(key, String(value)) }); return `/search?${params}` }
const popularRoutes = [
  { from: 'Hyderabad', to: 'Bengaluru', fare: 699, tone: 'emerald', time: '9h 15m' },
  { from: 'Bengaluru', to: 'Chennai', fare: 549, tone: 'orange', time: '6h 20m' },
  { from: 'Kochi', to: 'Thiruvananthapuram', fare: 399, tone: 'blue', time: '4h 10m' },
]

export function HomePage() {
  const navigate = useNavigate(); const [source, setSource] = useState('Hyderabad'); const [destination, setDestination] = useState('Vijayawada'); const [date, setDate] = useState(today); const [passengers, setPassengers] = useState('1'); const [query, setQuery] = useState(''); const [parsed, setParsed] = useState<ParsedSearch | null>(null)
  const parser = useMutation({ mutationFn: client.parse, onSuccess: setParsed }); const routes = useQuery({ queryKey: ['routes'], queryFn: client.routes })
  const cities = [...new Set(routes.data?.flatMap((route) => [route.source.name, route.destination.name]) ?? [])].sort()
  const search = () => navigate(toSearch({ source, destination, date, passengers })); const useParsed = () => parsed?.source && parsed.destination && navigate(toSearch({ source: parsed.source, destination: parsed.destination, date: parsed.date || today, maxPrice: parsed.maxPrice, isAc: parsed.isAc, busType: parsed.busType, departure: parsed.timePreference }))
  return <main>
    <datalist id="supported-cities">{cities.map((city) => <option value={city} key={city} />)}</datalist>
    <section className="hero-home">
      <div className="hero-glow" /><div className="hero-road" aria-hidden="true" />
      <motion.div className="hero-content" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}>
        <div className="hero-kicker"><Sparkles /> India’s easiest bus booking experience</div>
        <h1>Every great journey<br />starts with a <em>click.</em></h1>
        <p>Compare top operators, choose your perfect seat, and travel with confidence — wherever the road takes you.</p>
        <div className="hero-trust"><span><ShieldCheck /> Secure booking</span><span><BadgeCheck /> Verified operators</span><span><Clock3 /> 24/7 support</span></div>
      </motion.div>
      <motion.section className="search-panel premium" aria-label="Search buses" initial={{ opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: .18 }}>
        <div className="search-tabs"><button className="active"><BusFront /> Bus tickets</button><span>One way</span></div>
        <div className="manual-search">
          <label><span><MapPin /> From</span><input list="supported-cities" value={source} onChange={(e) => setSource(e.target.value)} /></label>
          <button className="swap" aria-label="Swap cities" onClick={() => { setSource(destination); setDestination(source) }}><ArrowRightLeft /></button>
          <label><span><MapPin /> To</span><input list="supported-cities" value={destination} onChange={(e) => setDestination(e.target.value)} /></label>
          <label><span><CalendarDays /> Journey date</span><input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label><span><UsersRound /> Travellers</span><select value={passengers} onChange={(e) => setPassengers(e.target.value)}><option value="1">1 passenger</option><option value="2">2 passengers</option><option value="3">3 passengers</option><option value="4">4 passengers</option></select></label>
          <button className="primary search-button" onClick={search}><Search /> Search buses</button>
        </div>
      </motion.section>
    </section>

    <section className="home-section routes-section"><header className="section-heading"><div><span className="eyebrow">TRENDING JOURNEYS</span><h2>Popular routes this week</h2><p>Routes loved by thousands of travellers</p></div><Link to={toSearch({ source: 'Hyderabad', destination: 'Bengaluru', date: today })}>View all routes <ArrowRight /></Link></header><div className="route-cards">{popularRoutes.map((route, i) => <motion.button className={`route-card ${route.tone}`} key={route.to} whileHover={{ y: -5 }} onClick={() => navigate(toSearch({ source: route.from, destination: route.to, date: today }))}><span className="route-index">0{i + 1}</span><div className="route-places"><strong>{route.from}</strong><span><i /><BusFront /><i /></span><strong>{route.to}</strong></div><div className="route-meta"><span><Clock3 /> {route.time}</span><span>from <b>₹{route.fare}</b></span><ChevronRight /></div></motion.button>)}</div></section>

    <section className="deal-banner"><div><span className="deal-badge">FIRST RIDE OFFER</span><h2>New here? Your first voyage is on us.</h2><p>Get 20% off up to ₹250 on your first booking.</p></div><strong>VOYAGE20</strong><Link to="/register">Claim offer <ArrowRight /></Link></section>

    <section className="home-section smart-section"><div><span className="eyebrow">VOYAGE AI</span><h2>Just say where you want to go.</h2><p>Skip the filters. Describe your trip naturally and we’ll find the right ride.</p><div className="ai-examples"><span>“AC sleeper to Bengaluru tomorrow night”</span><span>“Cheapest bus under ₹800”</span></div></div><div className="ai-card"><Sparkles /><label htmlFor="ai-query">Ask Voyage AI</label><div><input id="ai-query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Describe your journey…" onKeyDown={(e) => e.key === 'Enter' && query.trim() && parser.mutate(query)} /><button onClick={() => parser.mutate(query)} disabled={!query.trim() || parser.isPending}>{parser.isPending ? 'Thinking…' : <ArrowRight />}</button></div>{parser.isError && <p className="form-error">We couldn’t understand that. Try the search above.</p>}{parsed && <div className="ai-result"><span>{parsed.source || '—'} → {parsed.destination || '—'} · {parsed.date || today}</span><button onClick={useParsed}>See buses</button></div>}</div></section>

    <section className="trust-strip"><div><strong>2M+</strong><span>Happy travellers</span></div><div><strong>1,200+</strong><span>Verified operators</span></div><div><strong>4.8 <Star /></strong><span>Average rating</span></div><div><strong>24/7</strong><span>Customer support</span></div></section>
    <section className="home-section why-section"><header className="section-heading centered"><div><span className="eyebrow">THE VOYAGE DIFFERENCE</span><h2>Thoughtful from search to seat</h2></div></header><div className="benefit-grid"><article><ShieldCheck /><h3>Book with confidence</h3><p>Secure payments, verified operators and transparent cancellation policies.</p></article><article><Wifi /><h3>Comfort, your way</h3><p>Filter by amenities, compare every detail and choose the seat you love.</p></article><article><UsersRound /><h3>Here when you need us</h3><p>Friendly support before, during and after every journey.</p></article></div></section>
  </main>
}
