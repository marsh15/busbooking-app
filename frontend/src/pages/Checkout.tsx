import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useFieldArray, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { client } from '../lib/api'
import { getApiCode, getApiMessage } from '../lib/errors'
import { useAppStore } from '../store'
import type { CheckoutResult } from '../types'

const valuesSchema = z.object({
  passengers: z.array(
    z.object({
      name: z.string().trim().min(2, 'Enter the traveller’s full name.'),
      age: z.coerce
        .number()
        .int('Enter a whole number.')
        .min(1, 'Age must be at least 1.')
        .max(120, 'Age must be 120 or less.'),
    }),
  ),
})
type CheckoutValues = z.infer<typeof valuesSchema>

const keyFor = (holdId: string) => {
  const storageKey = `voyage-checkout-key-${holdId}`
  let key = sessionStorage.getItem(storageKey)
  if (!key) {
    key = `ui-${crypto.randomUUID()}`
    sessionStorage.setItem(storageKey, key)
  }
  return key
}
const rotateKey = (holdId: string) => {
  sessionStorage.removeItem(`voyage-checkout-key-${holdId}`)
}

function useCountdown(expiresAt: string | undefined) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  useEffect(() => {
    if (!expiresAt) return
    const deadline = new Date(expiresAt).getTime()
    const tick = () => setRemainingMs(Math.max(deadline - Date.now(), 0))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])
  return remainingMs
}

const formatClock = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

export function CheckoutPage() {
  const { tripId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const holdId = searchParams.get('hold') ?? undefined
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const clearTripSelection = useAppStore((state) => state.clearTripSelection)
  const selectedTripId = useAppStore((state) => state.selectedTripId)
  const storedSeats = useAppStore((state) => state.selectedSeats)
  const selectedSeats = selectedTripId === tripId ? storedSeats : []
  const holdCreationStarted = useRef(false)

  // The server acquires every selected seat in one transaction before the
  // passenger fields appear; the URL then carries the hold id so a refresh
  // restores the server-owned hold instead of the in-memory selection.
  const createHold = useMutation({
    mutationFn: () => client.hold(tripId, selectedSeats),
    onSuccess: (hold) => {
      setSearchParams({ hold: hold.id }, { replace: true })
    },
  })

  useEffect(() => {
    if (!holdId && selectedSeats.length > 0 && !holdCreationStarted.current) {
      holdCreationStarted.current = true
      // Microtask, not a timer: effect cleanups during React Query's mount
      // notifications must never cancel the hold acquisition.
      void Promise.resolve().then(() => createHold.mutate())
    }
  }, [holdId, selectedSeats.length, createHold])

  const holdQuery = useQuery({
    queryKey: ['hold', holdId],
    queryFn: () => client.getHold(holdId!),
    enabled: !!holdId,
    refetchInterval: (query) => (query.state.data?.state === 'ACTIVE' ? 15_000 : false),
  })
  const hold = holdQuery.data
  const remainingMs = useCountdown(hold?.state === 'ACTIVE' ? hold.expiresAt : undefined)
  const expired = !!hold && (hold.state === 'EXPIRED' || (hold.state === 'ACTIVE' && remainingMs === 0))
  const effectiveState = expired ? 'EXPIRED' : hold?.state

  const tripQuery = useQuery({
    queryKey: ['checkout-trip', tripId],
    queryFn: () => client.tripById(tripId),
  })
  const trip = tripQuery.data

  const seats = useMemo(() => hold?.seatNumbers ?? [], [hold])
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(valuesSchema) as unknown as Resolver<CheckoutValues>,
    defaultValues: { passengers: [] },
  })
  const { fields, replace } = useFieldArray({ control: form.control, name: 'passengers' })
  useEffect(() => {
    if (seats.length > 0 && form.getValues('passengers').length !== seats.length) {
      replace(seats.map(() => ({ name: '', age: 25 })))
    }
  }, [seats, form, replace])

  const [attempt, setAttempt] = useState<CheckoutResult | null>(null)
  const attemptQuery = useQuery({
    queryKey: ['attempt', attempt?.attempt.id],
    queryFn: () => client.getAttempt(attempt!.attempt.id),
    enabled: attempt?.attempt.status === 'PENDING',
    refetchInterval: 2_000,
  })
  // When the poll resolves the attempt, prefer its result over the stale copy.
  const activeAttempt =
    attemptQuery.data && attemptQuery.data.attempt.status !== 'PENDING' ? attemptQuery.data : attempt
  const navigatedAfterPoll = useRef(false)
  useEffect(() => {
    if (
      activeAttempt?.attempt.status === 'SUCCEEDED' &&
      activeAttempt.booking &&
      !navigatedAfterPoll.current
    ) {
      navigatedAfterPoll.current = true
      const timer = setTimeout(() => {
        clearTripSelection()
        void queryClient.invalidateQueries({ queryKey: ['bookings'] })
        navigate(`/booking-confirmation/${activeAttempt.booking!.id}`)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [activeAttempt, clearTripSelection, queryClient, navigate])

  const confirmPayment = useMutation({
    mutationFn: (values: CheckoutValues) => client.confirm(hold!.id, values.passengers, keyFor(hold!.id)),
    onSuccess: (result) => {
      setAttempt(result)
      if (result.attempt.status === 'SUCCEEDED' && result.booking) {
        clearTripSelection()
        queryClient.invalidateQueries({ queryKey: ['bookings'] })
        navigate(`/booking-confirmation/${result.booking.id}`)
      }
      if (result.attempt.status === 'FAILED') rotateKey(hold!.id)
    },
  })

  const releaseHold = useMutation({
    mutationFn: () => client.releaseHold(hold!.id),
    onSuccess: () => {
      clearTripSelection()
      void queryClient.invalidateQueries({ queryKey: ['trip'] })
      navigate(trip ? `/bus/${trip.busId}?tripId=${trip.id}` : '/')
    },
  })

  if (!holdId && selectedSeats.length === 0)
    return (
      <main id="main-content" className="page">
        <div className="empty-state">
          <h1>Choose seats first</h1>
          <p>Pick the seats you want from the bus page before checkout.</p>
          {trip && (
            <Link className="primary" to={`/bus/${trip.busId}?tripId=${trip.id}`}>
              Back to the seat map
            </Link>
          )}
        </div>
      </main>
    )

  if (createHold.isPending || (holdId && !hold && holdQuery.isLoading))
    return (
      <main id="main-content" className="page">
        <div className="empty-state" role="status">
          <h1>Reserving your seats…</h1>
          <p>Hold on a moment while we hold these seats for you.</p>
        </div>
      </main>
    )

  if (createHold.isError)
    return (
      <main id="main-content" className="page">
        <div className="empty-state">
          <h1>Those seats just went</h1>
          <p>
            {getApiMessage(createHold.error) ||
              'Another traveller is holding them. Please choose again.'}
          </p>
          {trip && (
            <Link className="primary" to={`/bus/${trip.busId}?tripId=${trip.id}`}>
              Back to the seat map
            </Link>
          )}
        </div>
      </main>
    )

  if (!hold) return null

  if (effectiveState === 'EXPIRED' || effectiveState === 'RELEASED')
    return (
      <main id="main-content" className="page">
        <div className="empty-state">
          <h1>Your hold on these seats has ended</h1>
          <p>
            Seats are held for ten minutes while traveller details are entered. That window closed, so the
            seats were released — nothing was charged.
          </p>
          {trip && (
            <Link className="primary" to={`/bus/${trip.busId}?tripId=${trip.id}`}>
              Choose seats again
            </Link>
          )}
        </div>
      </main>
    )

  if (effectiveState === 'CONSUMED')
    return (
      <main id="main-content" className="page">
        <div className="empty-state">
          <h1>This hold was already used</h1>
          <p>These seats have been confirmed. Find the ticket in your bookings.</p>
          <Link className="primary" to="/my-bookings">
            View my bookings
          </Link>
        </div>
      </main>
    )

  const total = hold.farePerSeat * seats.length
  const expiryImminent = remainingMs !== null && remainingMs <= 60_000 && remainingMs > 0
  const heldSeats = seats.join(', ')
  const pending = activeAttempt?.attempt.status === 'PENDING'
  const failed = activeAttempt?.attempt.status === 'FAILED'

  return (
    <main id="main-content" className="page checkout-page">
      <header className="checkout-header">
        <div>
          <p className="eyebrow">{hold.trip.route}</p>
          <h1>Traveller details</h1>
          <p className="muted">
            {hold.trip.busName} · {hold.trip.operator} · {hold.trip.travelDate} · departs{' '}
            {hold.trip.departureTime} IST
          </p>
        </div>
        <div
          className={`hold-countdown ${expiryImminent ? 'urgent' : ''}`}
          role="timer"
          aria-label="Time remaining on your seat hold"
        >
          <small>Seats held for</small>
          <strong aria-live="polite">{remainingMs !== null ? formatClock(remainingMs) : '—:—'}</strong>
        </div>
      </header>

      <div className="checkout-grid">
        <form onSubmit={form.handleSubmit((values) => confirmPayment.mutate(values))} noValidate>
          <h2>Who is travelling?</h2>
          <p className="muted">
            Seat{seats.length > 1 ? 's' : ''} <strong>{heldSeats}</strong> held for you — one traveller per
            seat.
          </p>
          {fields.map((field, index) => (
            <fieldset className="passenger-row" key={field.id}>
              <legend>Traveller for seat {seats[index]}</legend>
              <label className="field">
                <span>Full name</span>
                <input {...form.register(`passengers.${index}.name`)} autoComplete="name" />
                {form.formState.errors.passengers?.[index]?.name && (
                  <small className="form-error">
                    {form.formState.errors.passengers[index]?.name?.message}
                  </small>
                )}
              </label>
              <label className="field">
                <span>Age</span>
                <input
                  {...form.register(`passengers.${index}.age`)}
                  type="number"
                  min={1}
                  max={120}
                  inputMode="numeric"
                />
                {form.formState.errors.passengers?.[index]?.age && (
                  <small className="form-error">
                    {form.formState.errors.passengers[index]?.age?.message}
                  </small>
                )}
              </label>
            </fieldset>
          ))}

          {failed && (
            <div className="inline-alert" role="alert">
              <strong>The simulated payment was declined.</strong>
              <p>{activeAttempt?.attempt.message}</p>
              <p className="muted">Your seats are still held — try the payment again.</p>
            </div>
          )}
          {confirmPayment.isError && (
            <div className="inline-alert" role="alert">
              <strong>Confirmation did not go through.</strong>
              <p>{getApiMessage(confirmPayment.error) || 'Please try again in a moment.'}</p>
              {getApiCode(confirmPayment.error) === 'HOLD_EXPIRED' && trip && (
                <p>
                  Your hold expired. <Link to={`/bus/${trip.busId}?tripId=${trip.id}`}>Choose seats again</Link>
                </p>
              )}
            </div>
          )}

          <div className="checkout-actions">
            <button
              className="primary wide"
              disabled={confirmPayment.isPending || pending || remainingMs === 0}
            >
              {pending
                ? 'Processing payment…'
                : confirmPayment.isPending
                  ? 'Confirming…'
                  : 'Confirm simulated payment →'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => releaseHold.mutate()}
              disabled={releaseHold.isPending}
            >
              Release seats
            </button>
          </div>
          <p className="muted micro">
            This is a portfolio demo: payment is simulated and nothing is charged. If confirmation is
            interrupted, the same payment key safely resumes the same tickets.
          </p>
        </form>

        <aside className="trip-summary" aria-label="Payment summary">
          <h2>Payment summary</h2>
          <dl>
            <div>
              <dt>Seats ({seats.length})</dt>
              <dd>
                {heldSeats} · ₹{hold.farePerSeat} each
              </dd>
            </div>
            <div>
              <dt>Fare</dt>
              <dd>₹{total}</dd>
            </div>
            <div>
              <dt>Processing</dt>
              <dd>₹0 (simulated)</dd>
            </div>
            <div className="total-row">
              <dt>Total</dt>
              <dd>₹{total}</dd>
            </div>
          </dl>
          {trip?.policy && (
            <p className="muted micro">
              Cancellation policy: this operator closes cancellation {trip.policy.cutoffMinutes / 60}h before
              departure with a {trip.policy.feePercent}% fee. Refunds are quoted per ticket before you
              cancel.
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}
