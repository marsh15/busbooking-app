import { parseSearch } from '../services/ai-parser.js'

if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for live verification')
const result = await parseSearch('AC sleeper from Hyderabad to Bengaluru tomorrow night under ₹1200')
if (result.provider !== 'openai')
  throw new Error(`OpenAI verification fell back: ${result.warnings.join(' ')}`)
console.info(JSON.stringify({ status: 'verified', model: process.env.OPENAI_MODEL, result }))
