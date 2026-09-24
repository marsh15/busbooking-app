import { describe, expect, it } from 'vitest'
import { addDays, istDate } from '../utils/ist.js'
import { parseSearchFallback } from './ai-parser.js'
import corpus from '../data/ai-eval-corpus.json' with { type: 'json' }

const dateSemantics = (value: string | null) =>
  value === null
    ? null
    : value === istDate()
      ? 'today'
      : value === addDays(istDate(), 1)
        ? 'tomorrow'
        : 'unexpected'

describe(`AI search parsing evaluation corpus (v${corpus.version})`, () => {
  it('extracts the expected fields for every case', () => {
    for (const testCase of corpus.cases) {
      const result = parseSearchFallback(testCase.input)
      const expected = testCase.expect
      if (expected.source !== undefined) expect(result.source, testCase.input).toBe(expected.source)
      if (expected.destination !== undefined)
        expect(result.destination, testCase.input).toBe(expected.destination)
      if (expected.date !== undefined) expect(dateSemantics(result.date), testCase.input).toBe(expected.date)
      if (expected.timePreference !== undefined)
        expect(result.timePreference, testCase.input).toBe(expected.timePreference)
      if (expected.busType !== undefined) expect(result.busType, testCase.input).toBe(expected.busType)
      if (expected.isAc !== undefined) expect(result.isAc, testCase.input).toBe(expected.isAc)
      if (expected.maxPrice !== undefined) expect(result.maxPrice, testCase.input).toBe(expected.maxPrice)
      if (expected.warningCount !== undefined)
        expect(result.warnings, testCase.input).toHaveLength(expected.warningCount)
    }
  })

  it('always returns schema-valid filter shapes with the fallback provider marked', () => {
    for (const testCase of corpus.cases) {
      const result = parseSearchFallback(testCase.input)
      expect(result.provider).toBe('fallback')
      expect(['morning', 'afternoon', 'evening', 'night', null]).toContain(result.timePreference)
      expect(['SLEEPER', 'SEATER', null]).toContain(result.busType)
      expect([true, false, null]).toContain(result.isAc)
      expect(result.maxPrice === null || (Number.isInteger(result.maxPrice) && result.maxPrice > 0)).toBe(
        true,
      )
      expect(Array.isArray(result.warnings)).toBe(true)
      if (result.date) expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('keeps offline parsing comfortably fast', () => {
    const started = performance.now()
    const iterations = 10
    for (let round = 0; round < iterations; round += 1)
      for (const testCase of corpus.cases) parseSearchFallback(testCase.input)
    const perCaseMs = (performance.now() - started) / (iterations * corpus.cases.length)
    expect(perCaseMs).toBeLessThan(5)
  })
})
