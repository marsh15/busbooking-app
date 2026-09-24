import { randomUUID } from 'node:crypto'

/**
 * Simulated payment provider. Moves NO money. Outcomes are deterministic
 * functions of (scenario, providerRef) so a lost HTTP response or a process
 * restart can be resolved by replaying the same simulation — there is no
 * in-memory state to lose.
 *
 * Scenarios other than "success" are only injectable outside production via
 * the x-payment-scenario header, which the test suite uses.
 */
export type PaymentScenario = 'success' | 'failure' | 'delay' | 'lost'

export class ProviderTimeoutError extends Error {
  constructor() {
    super('The payment provider did not respond in time.')
    this.name = 'ProviderTimeoutError'
  }
}

export interface ProviderOutcome {
  ok: boolean
  providerRef: string
  resultCode?: string
}

const DELAY_MS = 1_200
const LOST_RESPONSE_MS = 900

function resolveScenario(scenario: string | null | undefined): PaymentScenario {
  return scenario === 'failure' || scenario === 'delay' || scenario === 'lost' ? scenario : 'success'
}

function outcomeFor(scenario: PaymentScenario, providerRef: string): ProviderOutcome {
  if (scenario === 'failure') return { ok: false, providerRef, resultCode: 'CARD_DECLINED' }
  return { ok: true, providerRef }
}

export const mockProvider = {
  newRef: () => randomUUID(),

  /** First attempt at charging; may throw ProviderTimeoutError ("lost" scenario). */
  async charge(providerRef: string, scenario: string | null | undefined): Promise<ProviderOutcome> {
    const resolved = resolveScenario(scenario)
    if (resolved === 'delay') await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    if (resolved === 'lost') {
      // The provider eventually succeeds, but this HTTP response never arrives.
      await new Promise((resolve) => setTimeout(resolve, LOST_RESPONSE_MS))
      throw new ProviderTimeoutError()
    }
    return outcomeFor(resolved, providerRef)
  },

  /**
   * Ask the provider again what happened to a charge. Never times out: this is
   * the recovery path used when the original response was lost or the process
   * restarted with an attempt still pending.
   */
  async reconcile(providerRef: string, scenario: string | null | undefined): Promise<ProviderOutcome> {
    return outcomeFor(resolveScenario(scenario), providerRef)
  },
}
