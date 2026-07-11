# API documentation

Every successful response uses `{ "data": ... }`; list responses also contain `pagination`. Failures use `{ "error": { "code", "message", "details?" } }`. Cookie-authenticated mutations require an `x-csrf-token` header issued by `GET /api/auth/csrf`.

| Method and endpoint | Auth | Purpose |
|---|---:|---|
| `GET /api/health` | No | Health response |
| `GET /api/ready` | No | Database readiness; returns 503 when unavailable |
| `GET /api/auth/csrf` | No | Issue CSRF token/cookie |
| `POST /api/auth/register` | CSRF | `{name,email,password}` → session and user |
| `POST /api/auth/login` | CSRF | `{email,password}` → session and user |
| `POST /api/auth/logout` | CSRF | Clear current session |
| `GET /api/auth/me` | Session | Current safe user profile |
| `GET /api/routes/search` | No | Resolve `source` and `destination`; no params lists routes |
| `GET /api/buses` | No | Filter plus `page`/`pageSize` pagination |
| `GET /api/buses/trip/:tripId` | No | Direct trip profile lookup for checkout |
| `GET /api/buses/:id?tripId=` | No | Bus/trip profile, availability, amenities, policy, seats |
| `POST /api/bookings` | Session + CSRF | Atomically book `{tripId, passengers:[{seatNumber,name,age}]}` |
| `GET /api/bookings/me` | Session | Current user’s booking groups |
| `GET /api/bookings/group/:id` | Session | One owned group for confirmation |
| `PATCH /api/bookings/:id/cancel` | Session + CSRF | Cancel one owned ticket |
| `POST /api/ai/parse-search` | CSRF | Parse `{query}` to editable fields |

## Examples

```http
GET /api/routes/search?source=Hyderabad&destination=Vijayawada
```

```json
{"data":{"id":"route-1","source":{"name":"Hyderabad"},"destination":{"name":"Vijayawada"}}}
```

```http
POST /api/bookings
x-csrf-token: <issued token>
Cookie: smartbus_session=<httpOnly cookie>

{"tripId":"trip-1-0-0","passengers":[{"seatNumber":"1A","name":"Asha Rao","age":29}]}
```

Common errors: `422 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN` or `CSRF_INVALID`, `404 ROUTE_NOT_FOUND`/`TRIP_NOT_FOUND`, `409 SEAT_UNAVAILABLE`, `409 CANCELLATION_CLOSED`, `429 RATE_LIMITED`.
