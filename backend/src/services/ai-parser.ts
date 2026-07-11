import { addDays, istDate } from '../utils/ist.js'

export interface ParsedSearch { source: string | null; destination: string | null; date: string | null; timePreference: string | null; busType: 'SLEEPER' | 'SEATER' | null; isAc: boolean | null; maxPrice: number | null; provider: 'fallback'; warnings: string[] }
const cities = ['Hyderabad', 'Vijayawada', 'Bengaluru', 'Chennai', 'Coimbatore', 'Kochi', 'Thiruvananthapuram', 'Visakhapatnam']
const aliases: Record<string, string> = { bangalore: 'Bengaluru', trivandrum: 'Thiruvananthapuram', vizag: 'Visakhapatnam', hyd: 'Hyderabad', cochin: 'Kochi' }
function cityIn(query: string, start: number) {
  const lower = query.toLowerCase()
  const found = [...cities, ...Object.keys(aliases)]
    .map((name) => ({ name, index: lower.indexOf(name.toLowerCase()) }))
    .filter((item) => item.index >= start)
    .sort((a, b) => a.index - b.index)[0]?.name
  return found ? aliases[found.toLowerCase()] || found : null
}
export function parseSearchFallback(query: string): ParsedSearch {
  const clean = query.toLowerCase()
  const source = cityIn(query, 0)
  const sourceIndex = source ? [...cities, ...Object.keys(aliases)]
    .filter((name) => (aliases[name.toLowerCase()] || name) === source)
    .map((name) => clean.indexOf(name.toLowerCase()))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0] ?? 0 : 0
  const destination = cityIn(query, sourceIndex + 1)
  const max = clean.match(/(?:under|below|less than)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i)
  const warnings = [] as string[]
  if (!source || !destination) warnings.push('Add both a source and destination to see matching buses.')
  return {
    source, destination,
    date: clean.includes('tomorrow') ? addDays(istDate(), 1) : clean.includes('today') ? istDate() : null,
    timePreference: clean.includes('morning') ? 'morning' : clean.includes('afternoon') ? 'afternoon' : clean.includes('evening') ? 'evening' : clean.includes('night') ? 'night' : null,
    busType: clean.includes('sleeper') ? 'SLEEPER' : clean.includes('seater') ? 'SEATER' : null,
    isAc: /non[- ]?ac|without ac/.test(clean) ? false : /\bac\b|air ?conditioned/.test(clean) ? true : null,
    maxPrice: max ? Number(max[1]) : null, provider: 'fallback', warnings,
  }
}
