import type { PolicyInfo } from '../types'

/** Human-readable window lines, widest window first. */
export function policyWindows(policy: PolicyInfo): string[] {
  return policy.rules
    .slice()
    .sort((a, b) => b.beforeDepartureHours - a.beforeDepartureHours)
    .map((rule) => `${rule.beforeDepartureHours}h+ before departure → ${rule.refundPercent}% refund`)
}

export function closingWindow(policy: PolicyInfo): string {
  const smallest = policy.rules.reduce(
    (min, rule) => Math.min(min, rule.beforeDepartureHours),
    Number.POSITIVE_INFINITY,
  )
  return `Cancellation closes within ${smallest}h of departure`
}
