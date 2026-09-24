import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { parseSnapshot, quoteRefund } from './policies.js'

const marigold = [
  { beforeDepartureHours: 72, refundPercent: 90 },
  { beforeDepartureHours: 24, refundPercent: 70 },
  { beforeDepartureHours: 6, refundPercent: 40 },
]

describe('cancellation policy thresholds', () => {
  const fare = new Prisma.Decimal(1050)

  it('applies each window at and above its boundary', () => {
    expect(quoteRefund(marigold, fare, 100).refundPercent).toBe(90)
    expect(quoteRefund(marigold, fare, 72).refundPercent).toBe(90)
    expect(quoteRefund(marigold, fare, 71.99).refundPercent).toBe(70)
    expect(quoteRefund(marigold, fare, 24).refundPercent).toBe(70)
    expect(quoteRefund(marigold, fare, 23.5).refundPercent).toBe(40)
    expect(quoteRefund(marigold, fare, 6).refundPercent).toBe(40)
  })

  it('closes cancellation below the smallest window', () => {
    const closed = quoteRefund(marigold, fare, 5.99)
    expect(closed.eligible).toBe(false)
    expect(closed.refundAmount.toNumber()).toBe(0)
    expect(closed.windowLabel).toContain('closed')
  })

  it('rounds refunds to whole rupees with decimal money', () => {
    const quote = quoteRefund(marigold, new Prisma.Decimal(1049), 100)
    expect(quote.refundAmount.toNumber()).toBe(944) // 1049 * 0.9 = 944.1 -> 944
    expect(quoteRefund(marigold, new Prisma.Decimal(1003), 30).refundAmount.toNumber()).toBe(702) // 702.1
  })

  it('orders rules defensively regardless of stored order', () => {
    const shuffled = [...marigold].reverse()
    expect(quoteRefund(shuffled, fare, 100).refundPercent).toBe(90)
    expect(quoteRefund(shuffled, fare, 30).refundPercent).toBe(70)
  })

  it('parses valid snapshots and rejects malformed ones', () => {
    expect(parseSnapshot({ operatorName: 'Op', version: 2, rules: marigold })).toEqual({
      operatorName: 'Op',
      version: 2,
      rules: marigold,
    })
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot({ operatorName: 'Op', version: 2, rules: 'nope' })).toBeNull()
    expect(parseSnapshot({ rules: marigold })).toBeNull()
  })
})
