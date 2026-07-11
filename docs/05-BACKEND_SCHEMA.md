# SmartBus Lite — Backend Schema and API Rules

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

## Booking transaction

1. Validate a maximum of six unique selected seats.
2. Validate passenger name and age for every selected seat.
3. Confirm every seat belongs to the requested trip.
4. Start one serializable database transaction.
5. Mark each requested seat as booked only if it is still available.
6. Create one booking group and one ticket per selected seat.
7. If any seat cannot be claimed, roll back all work.
8. Return `409 SEAT_UNAVAILABLE` when another user booked a requested seat first.

## Cancellation transaction

1. Confirm ticket ownership and active status.
2. Confirm the cancellation deadline has not passed.
3. Calculate the mock refund using the trip’s fee percentage.
4. Mark only that ticket as cancelled.
5. Release only that ticket’s seat.
6. Recalculate the parent booking group status:
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
- `POST /api/bookings`
- `GET /api/bookings/me`
- `PATCH /api/bookings/:id/cancel`
- `POST /api/ai/parse-search`
