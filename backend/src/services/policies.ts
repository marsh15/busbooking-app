import { Prisma } from '@prisma/client'

export interface PolicyRule {
  beforeDepartureHours: number
  refundPercent: number
}

/** Immutable copy stored on the booking group at checkout time. */
export interface PolicySnapshot {
  operatorName: string
  version: number
  rules: PolicyRule[]
}

export interface RefundQuote {
  eligible: boolean
  refundPercent: number
  refundAmount: Prisma.Decimal
  windowLabel: string
}

const sortedRules = (rules: PolicyRule[]) => [...rules].sort((a, b) => b.beforeDepartureHours - a.beforeDepartureHours)

/**
 * Threshold refund rules: the first window whose `beforeDepartureHours` the
 * traveller still clears applies. Below the smallest window, cancellation is
 * closed. Both the quote endpoint and the cancellation commit use this exact
 * calculation with decimal money.
 */
export function quoteRefund(
  rules: PolicyRule[],
  totalFare: Prisma.Decimal,
  hoursUntilDeparture: number,
): RefundQuote {
  const ordered = sortedRules(rules)
  const applicable = ordered.find((rule) => hoursUntilDeparture >= rule.beforeDepartureHours)
  if (!applicable)
    return {
      eligible: false,
      refundPercent: 0,
      refundAmount: new Prisma.Decimal(0),
      windowLabel: `Cancellation is closed within ${ordered[ordered.length - 1]?.beforeDepartureHours ?? 0}h of departure`,
    }
  const refundAmount = totalFare
    .mul(applicable.refundPercent)
    .div(100)
    .toDecimalPlaces(0)
  return {
    eligible: true,
    refundPercent: applicable.refundPercent,
    refundAmount,
    windowLabel: `${applicable.beforeDepartureHours}h+ before departure`,
  }
}

export function parseRules(value: unknown): PolicyRule[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (rule): rule is PolicyRule =>
      !!rule &&
      typeof rule === 'object' &&
      typeof (rule as PolicyRule).beforeDepartureHours === 'number' &&
      typeof (rule as PolicyRule).refundPercent === 'number',
  )
}

export function parseSnapshot(value: unknown): PolicySnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<PolicySnapshot>
  if (!snapshot.operatorName || typeof snapshot.version !== 'number') return null
  const rules = parseRules(snapshot.rules)
  if (!rules.length) return null
  return { operatorName: snapshot.operatorName, version: snapshot.version, rules }
}
