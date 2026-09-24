# API documentation

Every successful response uses `{ "data": ... }`; list responses also contain `pagination`. Failures use `{ "error": { "code", "message", "details?" } }`. Cookie-authenticated mutations require an `x-csrf-token` header issued by `GET /api/auth/csrf`.

## Endpoints

| Method and endpoint | Auth | Purpose |
|---|---:|---|
| `GET /api/health` | No | Process liveness |
| `GET /api/ready` | No | Database readiness; 503 when unavailable |
| `GET /api/auth/csrf` | No | Issue CSRF token/cookie |
| `POST /api/auth/demo` | CSRF | Create an isolated 24-hour demo session (rate-limited) |
| `POST /api/auth/register` | CSRF | `{name,email,password}` → session; 403 when public registration is disabled on the deployed demo |
| `POST /api/auth/login` | CSRF | `{email,password}` → session and user |
| `POST /api/auth/logout` | CSRF | Clear current session |
| `GET /api/auth/me` | Session | Current safe user profile |
| `GET /api/routes/search` | No | Resolve `source`/`destination`; no params lists routes |
| `GET /api/buses` | No | Filter plus `page`/`pageSize` pagination |
| `GET /api/buses/trip/:tripId` | Optional session | Trip profile with seats; own held seats carry `heldByYou` |
| `GET /api/buses/:id?tripId=` | Optional session | Same, addressed by bus id |
| `POST /api/holds` | Session + CSRF | `{tripId, seatNumbers:[1..6]}` → 10-minute hold; replaces the caller's previous hold on that trip |
| `GET /api/holds/:id` | Session | Owner-scoped hold state (`ACTIVE`/`EXPIRED`/`CONSUMED`/`RELEASED`) with `expiresAt` |
| `DELETE /api/holds/:id` | Session + CSRF | Release an active hold (204); expiry also frees seats without this call |
| `POST /api/checkouts/confirm` | Session + CSRF | Confirm a hold with `Idempotency-Key` header; `{holdId, passengers:[{name,age}]}` → attempt state and, on success, the booking group |
| `GET /api/checkouts/attempts/:id` | Session | Owner-scoped attempt status; resolves a stale `PENDING` attempt |
| `POST /api/bookings` | — | Removed (410 `BOOKINGS_VIA_CHECKOUT`); use holds + confirm |
| `GET /api/bookings/me` | Session | Current user's booking groups |
| `GET /api/bookings/group/:id` | Session | One owned group for confirmation |
| `GET /api/bookings/:ticketId/cancellation-quote` | Session | Eligibility, refund amount and percent, applicable window, quoted terms |
| `PATCH /api/bookings/:ticketId/cancel` | Session + CSRF | Cancel one owned ticket; recalculates the quote at commit time |
| `POST /api/ai/parse-search` | CSRF | Parse `{query}` to editable fields; falls back to the offline parser |

## Examples

Acquire a hold:

```http
POST /api/holds
x-csrf-token: <issued token>
Cookie: voyagebus_session=<httpOnly cookie>

{"tripId":"trip-1","seatNumbers":["1A","1B"]}
```

```json
{"data":{"id":"hold-1","tripId":"trip-1","state":"ACTIVE","expiresAt":"2030-01-10T04:30:00.000Z",
 "farePerSeat":1020,"seatNumbers":["1A","1B"],
 "trip":{"id":"trip-1","busName":"Amber Star","operator":"Marigold Trail Travels",
 "travelDate":"2030-01-10","departureTime":"07:30","arrivalTime":"13:30",
 "route":"Hyderabad → Vijayawada"}}}
```

Confirm with a stable idempotency key. Retrying with the same key and payload returns the same booking; a different payload with the same key is rejected with 409 `IDEMPOTENCY_KEY_REUSED`:

```http
POST /api/checkouts/confirm
Idempotency-Key: ui-3f1c9a2e-7b44
x-csrf-token: <issued token>

{"holdId":"hold-1","passengers":[{"name":"Asha Rao","age":29},{"name":"Vikram Rao","age":31}]}
```

```json
{"data":{"attempt":{"id":"attempt-1","status":"SUCCEEDED","amount":2040,
 "message":"The simulated payment succeeded."},
 "booking":{"id":"group-1","pnr":"VB8F2A...","status":"ACTIVE","policySnapshot":{...},"tickets":[...]}}}
```

Quote a cancellation before acting:

```http
GET /api/bookings/ticket-1/cancellation-quote
```

```json
{"data":{"ticketId":"ticket-1","eligible":true,"refundAmount":918,"refundPercent":90,
 "windowLabel":"72h+ before departure",
 "policy":{"operatorName":"Marigold Trail Travels","version":1,"rules":[...]},
 "quotedAt":"2030-01-05T09:12:33.101Z"}}
```

Outside the applicable windows the quote returns `eligible:false` with a `reason`, and cancellation returns 409 `CANCELLATION_CLOSED`.

Common errors: `422 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`/`CSRF_INVALID`, `404 TRIP_NOT_FOUND`/`HOLD_NOT_FOUND`, `409 SEAT_UNAVAILABLE`/`TRIP_DEPARTED`/`HOLD_EXPIRED`/`IDEMPOTENCY_KEY_REUSED`/`CANCELLATION_CLOSED`/`TICKET_NOT_ACTIVE`, `410 BOOKINGS_VIA_CHECKOUT`, `429 RATE_LIMITED`.

Test-only payment injection: in non-production environments, send `x-payment-scenario: failure|delay|lost` with the confirm request to exercise the retry and recovery paths.
