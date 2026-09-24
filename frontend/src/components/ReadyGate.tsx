import { useEffect, useRef, useState } from 'react'
import { client } from '../lib/api'

/**
 * The demo API sleeps when idle (Render free tier) and can take about a minute
 * to wake. The static site renders immediately; this gate polls /api/ready with
 * a bounded window (kept under Vercel's 120s proxied-request limit) and offers
 * a manual retry once the window is exhausted.
 */
const READY_WINDOW_MS = 110_000
const RETRY_DELAY_MS = 5_000

export function ReadyGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [slow, setSlow] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const windowStart = useRef<number | null>(null)

  useEffect(() => {
    windowStart.current ??= Date.now()
    let alive = true
    void (async () => {
      try {
        await client.ready()
        if (alive) setReady(true)
      } catch {
        if (!alive) return
        const elapsed = Date.now() - (windowStart.current ?? 0)
        if (elapsed < READY_WINDOW_MS) {
          setTimeout(() => {
            if (alive) setAttempt((value) => value + 1)
          }, RETRY_DELAY_MS)
        } else {
          setSlow(true)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [attempt])

  if (ready) return <>{children}</>

  return (
    <div className="ready-gate" role="status" aria-live="polite">
      <div className="ready-gate-card">
        <div className="ready-gate-spinner" aria-hidden="true" />
        <h1>VoyageBus is starting the demo</h1>
        <p>
          The demo server sleeps when idle and is waking up now. This usually takes under a minute
          {attempt > 1 ? ` — still trying (attempt ${attempt})` : ''}.
        </p>
        {slow && (
          <>
            <p className="ready-gate-hint">
              It is taking longer than usual. The free demo server may be busy or restarting.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                windowStart.current = Date.now()
                setSlow(false)
                setAttempt((value) => value + 1)
              }}
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}
