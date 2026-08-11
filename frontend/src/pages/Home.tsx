import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import heroImage from '../assets/voyagebus-hero.avif'
import { client } from '../lib/api'
import type { ParsedSearch } from '../types'

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const popularRoutes = [
  ['Hyderabad', 'Bengaluru'],
  ['Bengaluru', 'Chennai'],
  ['Kochi', 'Thiruvananthapuram'],
]

function toSearch(values: Record<string, string | number | boolean | null>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== null && value !== '') params.set(key, String(value))
  })
  return `/search?${params}`
}

export function HomePage() {
  const navigate = useNavigate()
  const [source, setSource] = useState('Hyderabad')
  const [destination, setDestination] = useState('Vijayawada')
  const [date, setDate] = useState(today)
  const [query, setQuery] = useState('')
  const [parsed, setParsed] = useState<ParsedSearch | null>(null)
  const [searchError, setSearchError] = useState('')

  const parser = useMutation({ mutationFn: client.parse, onSuccess: setParsed })
  const routes = useQuery({ queryKey: ['routes'], queryFn: client.routes })
  const cities = [
    ...new Set(routes.data?.flatMap((route) => [route.source.name, route.destination.name]) ?? []),
  ].sort()

  function search() {
    const from = source.trim()
    const to = destination.trim()
    if (!from || !to) {
      setSearchError('Choose both an origin and a destination.')
      return
    }
    if (from.toLocaleLowerCase() === to.toLocaleLowerCase()) {
      setSearchError('Origin and destination must be different.')
      return
    }
    setSearchError('')
    navigate(toSearch({ source: from, destination: to, date }))
  }

  function updateParsed(key: keyof ParsedSearch, value: string) {
    setParsed((current) => (current ? { ...current, [key]: value || null } : current))
  }

  function useParsed() {
    if (!parsed?.source || !parsed.destination) return
    navigate(
      toSearch({
        source: parsed.source,
        destination: parsed.destination,
        date: parsed.date || today,
        maxPrice: parsed.maxPrice,
        isAc: parsed.isAc,
        busType: parsed.busType,
        departure: parsed.timePreference,
      }),
    )
  }

  return (
    <main id="main-content">
      <datalist id="supported-cities">
        {cities.map((city) => (
          <option value={city} key={city} />
        ))}
      </datalist>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow light">South India, simplified</p>
          <h1>Choose the journey. We’ll keep the booking clear.</h1>
          <p>
            Compare departures, see every available seat, and manage the whole trip from one dependable place.
          </p>
        </div>
        <figure className="hero-media">
          <picture>
            <source media="(min-width: 561px)" srcSet={heroImage} type="image/avif" />
            <img
              src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
              width="1680"
              height="945"
              alt="An intercity coach travelling through the hills of South India"
              fetchPriority="high"
            />
          </picture>
          <figcaption>Designed for the routes you travel most.</figcaption>
        </figure>
      </section>

      <section className="search-panel" aria-labelledby="trip-search-title">
        <h2 id="trip-search-title">Where are you heading?</h2>
        <form
          className="manual-search"
          onSubmit={(event) => {
            event.preventDefault()
            search()
          }}
        >
          <label>
            From
            <input
              list="supported-cities"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              required
            />
          </label>
          <button
            type="button"
            className="swap"
            aria-label="Swap origin and destination"
            onClick={() => {
              setSource(destination)
              setDestination(source)
              setSearchError('')
            }}
          >
            ⇄
          </button>
          <label>
            To
            <input
              list="supported-cities"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
            />
          </label>
          <label>
            Travel date
            <input
              type="date"
              min={today}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <button className="primary" type="submit">
            Search buses <span aria-hidden="true">→</span>
          </button>
        </form>
        {searchError && (
          <p className="form-error" role="alert">
            {searchError}
          </p>
        )}
        <div className="popular">
          <span>Popular:</span>
          {popularRoutes.map(([from, to]) => (
            <button
              type="button"
              key={`${from}-${to}`}
              onClick={() => {
                setSource(from)
                setDestination(to)
                setSearchError('')
              }}
            >
              {from} → {to}
            </button>
          ))}
        </div>
      </section>

      <section className="ai-search" aria-labelledby="assistant-title">
        <div>
          <p className="eyebrow">Search assistant</p>
          <h2 id="assistant-title">Describe the trip in your own words.</h2>
          <p>
            Try “AC sleeper from Hyderabad to Bengaluru tomorrow night under ₹1,200”. You can review every
            field before searching.
          </p>
        </div>
        <div className="ai-input">
          <label className="sr-only" htmlFor="ai-query">
            Describe your trip
          </label>
          <input
            id="ai-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Where and when would you like to travel?"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && query.trim()) parser.mutate(query)
            }}
          />
          <button
            className="primary"
            type="button"
            disabled={!query.trim() || parser.isPending}
            onClick={() => parser.mutate(query)}
          >
            {parser.isPending ? 'Reading…' : 'Review trip'}
          </button>
        </div>
        {parser.isError && (
          <p className="form-error" role="alert">
            We could not understand that yet. Try the regular search above.
          </p>
        )}
        {parsed && (
          <div className="parsed-result">
            <div>
              <div className="parsed-heading">
                <strong>Edit before searching</strong>
                <span>{parsed.provider === 'openai' ? 'AI-assisted' : 'Parsed on this server'}</span>
              </div>
              <div className="parsed-fields">
                <label>
                  From
                  <input
                    list="supported-cities"
                    value={parsed.source || ''}
                    onChange={(event) => updateParsed('source', event.target.value)}
                  />
                </label>
                <label>
                  To
                  <input
                    list="supported-cities"
                    value={parsed.destination || ''}
                    onChange={(event) => updateParsed('destination', event.target.value)}
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    min={today}
                    value={parsed.date || today}
                    onChange={(event) => updateParsed('date', event.target.value)}
                  />
                </label>
              </div>
              <div className="chips">
                {[
                  parsed.timePreference,
                  parsed.busType?.toLowerCase(),
                  parsed.isAc === null ? null : parsed.isAc ? 'AC' : 'Non-AC',
                  parsed.maxPrice ? `Under ₹${parsed.maxPrice}` : null,
                ]
                  .filter(Boolean)
                  .map((value) => (
                    <span key={String(value)}>{value}</span>
                  ))}
              </div>
              {parsed.warnings.map((warning) => (
                <p className="muted" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
            <button className="primary" disabled={!parsed.source || !parsed.destination} onClick={useParsed}>
              Show buses
            </button>
          </div>
        )}
      </section>

      <section className="proof-strip" aria-label="Booking capabilities">
        <p>
          <strong>Live seat status</strong>
          <span>Availability comes from the booking database.</span>
        </p>
        <p>
          <strong>Group booking</strong>
          <span>Reserve up to six seats in one transaction.</span>
        </p>
        <p>
          <strong>Flexible plans</strong>
          <span>Cancel one ticket without changing the rest.</span>
        </p>
        <Link to="/register">
          Plan your first trip <span aria-hidden="true">→</span>
        </Link>
      </section>
    </main>
  )
}
