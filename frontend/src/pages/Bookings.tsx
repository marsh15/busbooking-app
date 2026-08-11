import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { client } from '../lib/api'
import type { BookingGroup, Ticket } from '../types'

function getApiMessage(error: unknown) {
  return (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
}

export function ConfirmationPage() {
  const { bookingGroupId = '' } = useParams()
  const booking = useQuery({
    queryKey: ['booking', bookingGroupId],
    queryFn: () => client.booking(bookingGroupId),
  })
  if (booking.isLoading)
    return (
      <main id="main-content" className="page-shell">
        <div className="skeleton detail-skeleton" />
      </main>
    )
  if (booking.isError || !booking.data)
    return (
      <main id="main-content" className="page-shell">
        <div className="empty-state">
          <h1>We couldn't find that confirmation.</h1>
          <Link className="primary inline" to="/my-bookings">
            View my bookings
          </Link>
        </div>
      </main>
    )
  return (
    <main id="main-content" className="page-shell confirmation">
      <section className="confirmation-hero">
        <p className="success-icon">✓</p>
        <p className="eyebrow">Booking confirmed</p>
        <h1>Your seats are reserved.</h1>
        <p>
          Reference <strong>{booking.data.pnr}</strong> · Your payment was simulated successfully.
        </p>
      </section>
      <BookingGroupCard group={booking.data} showCancel={false} />
      <div className="confirmation-actions">
        <Link className="primary inline" to="/my-bookings">
          Manage my booking
        </Link>
        <Link className="outline-button" to="/">
          Find another bus
        </Link>
      </div>
    </main>
  )
}

export function MyBookingsPage() {
  const [page, setPage] = useState(1)
  const bookings = useQuery({ queryKey: ['bookings', page], queryFn: () => client.bookings(page) })
  const pageCount = Math.ceil(
    (bookings.data?.pagination.total ?? 0) / (bookings.data?.pagination.pageSize ?? 20),
  )
  return (
    <main id="main-content" className="page-shell">
      <header className="booking-header">
        <p className="eyebrow">Your travel desk</p>
        <h1>My bookings</h1>
        <p>Every checkout stays together. You can cancel one ticket without changing the rest.</p>
      </header>
      {bookings.isLoading && (
        <>
          <div className="skeleton card-skeleton" />
          <div className="skeleton card-skeleton" />
        </>
      )}
      {bookings.isError && (
        <div className="empty-state">
          <h2>We couldn't load your bookings.</h2>
          <button className="primary" onClick={() => bookings.refetch()}>
            Try again
          </button>
        </div>
      )}
      {bookings.data?.data.length === 0 && (
        <div className="empty-state">
          <h2>No trips booked yet.</h2>
          <p>Start with a route that feels like a good idea.</p>
          <Link className="primary inline" to="/">
            Find buses
          </Link>
        </div>
      )}
      {bookings.data?.data.map((group) => (
        <BookingGroupCard key={group.id} group={group} showCancel />
      ))}
      {pageCount > 1 && (
        <nav className="pagination" aria-label="Booking history pages">
          <button
            className="outline-button"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {pageCount}
          </span>
          <button
            className="outline-button"
            disabled={page === pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </main>
  )
}

function BookingGroupCard({ group, showCancel }: { group: BookingGroup; showCancel: boolean }) {
  const [pending, setPending] = useState<Ticket | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const queryClient = useQueryClient()
  const close = () => {
    setPending(null)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }
  useEffect(() => {
    if (!pending) return
    const dialog = dialogRef.current
    const focusable = dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab' || !focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [pending])
  const cancellation = useMutation({
    mutationFn: client.cancel,
    onSuccess: (updated) => {
      queryClient.setQueriesData({ queryKey: ['bookings'] }, (old: { data: BookingGroup[] } | undefined) =>
        old ? { ...old, data: old.data.map((item) => (item.id === updated.id ? updated : item)) } : old,
      )
      queryClient.setQueryData(['booking', updated.id], updated)
      close()
    },
  })
  const refundAmount = pending
    ? Math.round(pending.totalFare * (1 - pending.trip.cancellationFeePercent / 100))
    : 0
  const cutoffHours = pending ? pending.trip.cancellationCutoffMinutes / 60 : 0
  return (
    <article className="booking-group">
      <header>
        <div>
          <span className={`status ${group.status.toLowerCase()}`}>{group.status.replaceAll('_', ' ')}</span>
          <h2>{group.pnr}</h2>
          <p>
            Booked{' '}
            {new Date(group.createdAt).toLocaleDateString('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <strong>
          ₹{group.tickets.reduce((total, ticket) => total + ticket.totalFare, 0).toLocaleString('en-IN')}
        </strong>
      </header>
      <div className="tickets">
        {group.tickets.map((ticket) => (
          <div className="ticket" key={ticket.id}>
            <div className="ticket-route">
              <b>
                {ticket.trip.route.source.name} → {ticket.trip.route.destination.name}
              </b>
              <span>
                {ticket.trip.travelDate} · {ticket.trip.departureTime} · Seat {ticket.seatNumber}
              </span>
            </div>
            <div>
              <b>{ticket.passengerName}</b>
              <span>
                {ticket.status === 'CANCELLED'
                  ? `Cancelled · Mock refund ₹${ticket.refundAmount}`
                  : 'Active ticket'}
              </span>
            </div>
            {showCancel && ticket.status === 'ACTIVE' && (
              <button
                className="danger-button"
                ref={(node) => {
                  if (pending?.id === ticket.id) triggerRef.current = node
                }}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget
                  setPending(ticket)
                }}
              >
                Cancel ticket
              </button>
            )}
          </div>
        ))}
      </div>
      {pending && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close()
          }}
        >
          <section
            ref={dialogRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-title"
            aria-describedby="cancel-description"
          >
            <p className="eyebrow">Cancel ticket</p>
            <h2 id="cancel-title">Cancel seat {pending.seatNumber}?</h2>
            <p id="cancel-description">
              You'll see a simulated refund of <strong>₹{refundAmount.toLocaleString('en-IN')}</strong>. The
              seat will become available again.
            </p>
            <p className="muted">
              The {pending.trip.cancellationFeePercent}% mock cancellation fee applies until {cutoffHours}{' '}
              {cutoffHours === 1 ? 'hour' : 'hours'} before departure.
            </p>
            {cancellation.isError && (
              <p className="form-error" role="alert">
                {getApiMessage(cancellation.error) ?? 'This ticket can no longer be cancelled.'}
              </p>
            )}
            <div className="modal-actions">
              <button className="outline-button" onClick={close}>
                Keep ticket
              </button>
              <button
                className="danger-button"
                disabled={cancellation.isPending}
                onClick={() => cancellation.mutate(pending.id)}
              >
                {cancellation.isPending ? 'Cancelling…' : 'Confirm cancellation'}
              </button>
            </div>
          </section>
        </div>
      )}
    </article>
  )
}
