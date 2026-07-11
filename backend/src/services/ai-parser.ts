import { addDays, istDate } from '../utils/ist.js'
import { z } from 'zod'

export interface ParsedSearch { source: string | null; destination: string | null; date: string | null; timePreference: string | null; busType: 'SLEEPER' | 'SEATER' | null; isAc: boolean | null; maxPrice: number | null; provider: 'fallback' | 'openai'; warnings: string[] }
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

const structuredSchema = z.object({
  source: z.enum(cities as [string, ...string[]]).nullable(),
  destination: z.enum(cities as [string, ...string[]]).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  timePreference: z.enum(['morning', 'afternoon', 'evening', 'night']).nullable(),
  busType: z.enum(['SLEEPER', 'SEATER']).nullable(),
  isAc: z.boolean().nullable(),
  maxPrice: z.number().int().positive().nullable(),
})

export async function parseSearch(query: string): Promise<ParsedSearch> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return parseSearchFallback(query)
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.4-nano',
        input: `Extract only supported SmartBus search fields. Today in Asia/Kolkata is ${istDate()}. Resolve today/tomorrow to YYYY-MM-DD. Only use these cities: ${cities.join(', ')}. Never invent availability. User query: ${query}`,
        text: { format: { type: 'json_schema', name: 'smartbus_search', strict: true, schema: { type: 'object', additionalProperties: false, properties: { source: { type: ['string', 'null'], enum: [...cities, null] }, destination: { type: ['string', 'null'], enum: [...cities, null] }, date: { type: ['string', 'null'] }, timePreference: { type: ['string', 'null'], enum: ['morning', 'afternoon', 'evening', 'night', null] }, busType: { type: ['string', 'null'], enum: ['SLEEPER', 'SEATER', null] }, isAc: { type: ['boolean', 'null'] }, maxPrice: { type: ['integer', 'null'] } }, required: ['source', 'destination', 'date', 'timePreference', 'busType', 'isAc', 'maxPrice'] } } },
      }),
    })
    if (!response.ok) throw new Error(`OpenAI returned ${response.status}`)
    const output = await response.json() as { output_text?: string }
    const fields = structuredSchema.parse(JSON.parse(output.output_text || '{}'))
    return { ...fields, provider: 'openai', warnings: fields.source && fields.destination ? [] : ['Add both a source and destination to see matching buses.'] }
  } catch {
    return { ...parseSearchFallback(query), warnings: ['AI parsing was unavailable, so we used the offline trip parser.'] }
  }
}
