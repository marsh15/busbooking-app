# VoyageBus — Backend Schema and API Rules

## Core tables

- `users`: account details and Argon2id password hash
- `cities`: supported city names
- `routes`: one-way source and destination city pairs
- `buses`: operator-style bus profiles, amenities, AC state, and bus type
- `trips`: a bus operating on a route for a specific IST travel date/time
- `seats`: seat layout and per-trip availability
- `booking_groups`: one checkout and PNR-style booking reference
- `bookings`: one ticket per booked seat and passenger

## Key data rules

- All primary keys use UUIDs.
- Money uses `DECIMAL`, never JavaScript floating-point numbers.
- Business date/time is interpreted in `Asia/Kolkata`.
- Bus amenities are stored as JSON.
- A seat stores `deck`, `row`, `column`, and `seat_number`.
- `seats` has a unique `(trip_id, seat_number)` index.
- A trip has `cancellation_cutoff_minutes` and `cancellation_fee_percent`.
- A booking stores `total_fare`, `status`, `cancelled_at`, and `refund_amount`.

## Ownership rules

- A user may read only their own booking groups and tickets.
- A user may cancel only their own active ticket.
- A booking group belongs to one user and contains one or more tickets.
- A ticket references exactly one trip and one seat.

## Hold transaction

1. Validate one to six unique selected seats and that the trip has not departed.
2. Release the caller's previous active hold on the same trip.
3. Start one transaction and claim each seat with an ordered conditional write: a seat is claimable when `AVAILABLE` or when its previous hold has expired.
4. If any claim loses the race, roll back the entire hold (`409 SEAT_UNAVAILABLE`).
5. The hold lives ten minutes; expiry frees the seats logically with no cleanup timer.

## Checkout transaction

1. Persist a `PaymentAttempt` (unique on `userId` + `Idempotency-Key`) before calling the simulated provider.
2. Retry with the same key and payload returns the same booking; a different payload with the same key is `409 IDEMPOTENCY_KEY_REUSED`.
3. On provider success, recheck owner, hold validity, departure, and every seat's ownership, then claim all held seats to `BOOKED`, create one booking group (unique `holdId`) and one ticket per seat, and mark the attempt `SUCCEEDED`.
4. Success after hold expiry issues no ticket and marks the attempt `RECONCILIATION_REQUIRED`.

## Cancellation transaction

1. Confirm ticket ownership and active status.
2. Lock the booking group row (`SELECT ... FOR UPDATE`) under `READ COMMITTED` so concurrent cancellations serialize.
3. Recalculate the refund from the group's immutable policy snapshot and the current departure distance; outside every window, cancellation is closed.
4. Mark only that ticket as cancelled and release only its seat.
5. Recalculate the parent booking group status:
   - `ACTIVE`
   - `PARTIALLY_CANCELLED`
   - `CANCELLED`

## Required API endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/csrf`
- `GET /api/routes/search`
- `GET /api/buses`
- `GET /api/buses/:id?tripId=`
- `POST /api/auth/demo`
- `POST /api/holds`
- `GET /api/holds/:id`
- `DELETE /api/holds/:id`
- `POST /api/checkouts/confirm` (with `Idempotency-Key` header)
- `GET /api/checkouts/attempts/:id`
- `GET /api/bookings/me`
- `GET /api/bookings/:ticketId/cancellation-quote`
- `PATCH /api/bookings/:ticketId/cancel`
- `POST /api/ai/parse-search`
