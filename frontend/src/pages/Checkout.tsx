import { useEffect } from 'react'
import { useFieldArray, useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { client } from '../lib/api'
import { useAppStore } from '../store'

const schema = z.object({
  passengers: z.array(
    z.object({
      seatNumber: z.string(),
      name: z.string().trim().min(2, 'Enter the traveller’s name.'),
      age: z.coerce
        .number()
        .int('Enter a whole number.')
        .min(1, 'Age must be at least 1.')
        .max(120, 'Age must be 120 or less.'),
    }),
  ),
})

type CheckoutValues = {
  passengers: Array<{ seatNumber: string; name: string; age: number }>
}

const emptySeatSelection: string[] = []

function getApiMessage(error: unknown) {
  return (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
}

export function CheckoutPage() {
  const { tripId = '' } = useParams()
  const navigate = useNavigate()
  const selectedTripId = useAppStore((state) => state.selectedTripId)
  const storedSeats = useAppStore((state) => state.selectedSeats)
  const clearTripSelection = useAppStore((state) => state.clearTripSelection)
  const selectedSeats = selectedTripId === tripId ? storedSeats : emptySeatSelection

  const trip = useQuery({
    queryKey: ['checkout-trip', tripId],
    queryFn: () => client.tripById(tripId),
  })
  const form = useForm<CheckoutValues>({
    resolver: zodResolver(schema) as Resolver<CheckoutValues>,
    defaultValues: {
      passengers: selectedSeats.map((seatNumber) => ({ seatNumber, name: '', age: 25 })),
    },
  })
  const fields = useFieldArray({ control: form.control, name: 'passengers' })
  const { reset } = form

  useEffect(() => {
    reset({
      passengers: selectedSeats.map((seatNumber) => ({ seatNumber, name: '', age: 25 })),
    })
  }, [reset, selectedSeats])

  const booking = useMutation({
    mutationFn: (values: CheckoutValues) => client.book(tripId, values.passengers),
    onSuccess: (group) => {
      clearTripSelection()
      navigate(`/booking-confirmation/${group.id}`)
    },
  })

  if (!selectedSeats.length) {
    return (
      <main id="main-content" className="page-shell">
        <div className="empty-state">
          <h1>Choose seats first.</h1>
          <p>Your traveller details appear once you select a seat.</p>
          <Link className="primary inline" to="/">
            Find a bus
          </Link>
        </div>
      </main>
    )
  }

  const totalFare = (trip.data?.fare ?? 0) * selectedSeats.length

  return (
    <main id="main-content" className="page-shell checkout">
      <div className="crumb">
        <Link to="/">Home</Link> <span>›</span> Checkout
      </div>
      <header>
        <p className="eyebrow">Almost there</p>
        <h1>Who’s travelling?</h1>
        <p>Payment is simulated—no card or money is required.</p>
      </header>

      {trip.isLoading && (
        <div className="skeleton card-skeleton" aria-label="Loading fare details" aria-busy="true" />
      )}
      {trip.isError && (
        <div className="inline-alert" role="alert">
          <strong>Fare details are unavailable.</strong>
          <span>Return to the seat map and try again.</span>
        </div>
      )}
      {trip.data && (
        <div className="checkout-layout">
          <form onSubmit={form.handleSubmit((values) => booking.mutate(values))} noValidate>
            <section className="passenger-card">
              <h2>Passenger details</h2>
              {fields.fields.map((field, index) => {
                const errors = form.formState.errors.passengers?.[index]
                const nameErrorId = `passenger-${index}-name-error`
                const ageErrorId = `passenger-${index}-age-error`

                return (
                  <div className="passenger" key={field.id}>
                    <span className="seat-pill">Seat {field.seatNumber}</span>
                    <label>
                      Full name
                      <input
                        {...form.register(`passengers.${index}.name`)}
                        autoComplete="name"
                        aria-invalid={Boolean(errors?.name)}
                        aria-describedby={errors?.name ? nameErrorId : undefined}
                      />
                      {errors?.name?.message && (
                        <small id={nameErrorId} className="form-error">
                          {errors.name.message}
                        </small>
                      )}
                    </label>
                    <label>
                      Age
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max="120"
                        {...form.register(`passengers.${index}.age`)}
                        aria-invalid={Boolean(errors?.age)}
                        aria-describedby={errors?.age ? ageErrorId : undefined}
                      />
                      {errors?.age?.message && (
                        <small id={ageErrorId} className="form-error">
                          {errors.age.message}
                        </small>
                      )}
                    </label>
                  </div>
                )
              })}
            </section>

            {booking.isError && (
              <div className="inline-alert" role="alert">
                <strong>{getApiMessage(booking.error) ?? 'Booking could not be completed.'}</strong>
                <Link to={`/bus/${trip.data.busId}?tripId=${tripId}`}>Review live seat availability</Link>
              </div>
            )}
            <button className="primary wide" disabled={booking.isPending}>
              {booking.isPending ? 'Confirming seats…' : 'Confirm simulated payment →'}
            </button>
          </form>

          <aside className="fare-card" aria-label="Fare summary">
            <p className="eyebrow">Fare summary</p>
            <h2>{selectedSeats.join(', ')}</h2>
            <p>{trip.data.busName}</p>
            <div>
              <span>{selectedSeats.length} × seat fare</span>
              <b>₹{totalFare.toLocaleString('en-IN')}</b>
            </div>
            <div>
              <span>Payment processing</span>
              <b>₹0</b>
            </div>
            <hr />
            <div className="fare-total">
              <strong>Total</strong>
              <strong>₹{totalFare.toLocaleString('en-IN')}</strong>
            </div>
            <p className="muted">This is a portfolio demo. Nothing will be charged.</p>
          </aside>
        </div>
      )}
    </main>
  )
}
