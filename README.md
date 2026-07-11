# SmartBus Lite

SmartBus Lite is a portfolio-ready South India bus-booking MVP. It supports manual and natural-language trip search, visible seat availability, protected multi-seat mock bookings, ticket-level cancellation, and a calm warm-travel interface.

## Quick start

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm install --prefix backend
npm install --prefix frontend
docker compose up -d
npm run db:deploy --prefix backend
npm run db:seed --prefix backend
npm run dev --prefix backend
npm run dev --prefix frontend
```

Open `http://localhost:5173`. The API runs at `http://localhost:4000`.

Use the seeded demo account:

- Email: `demo@smartbus.in`
- Password: `SmartBus123!`

## What is included

- Six seeded South India routes and 24 IST trips across today and tomorrow
- Manual search, filters, empty/loading/error states, and responsive trip cards
- Offline deterministic natural-language parsing (works with no OpenAI key)
- HttpOnly signed session cookie, CSRF double-submit token, Helmet, CORS, Argon2id hashes
- Server-authoritative, up-to-six-seat mock booking with atomic conflict handling
- PNR-style confirmation, grouped booking history, and ticket-level mock cancellation/refund

## Architecture

- `frontend/` — React 19, Vite, React Router, TanStack Query, React Hook Form, Zod, Axios, Zustand
- `backend/` — Express 5, TypeScript, security middleware, API routes/services/validators
- `backend/prisma/schema.prisma` — MySQL/TiDB production data contract
- `docs/` — product, technical, flow, visual, schema, and implementation source documents

Read [ARCHITECTURE.md](ARCHITECTURE.md) and [API_DOCS.md](API_DOCS.md) for the implementation details.

## Verification

```bash
npm run typecheck --prefix backend
npm run test:integration --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
npm run lint --prefix frontend
npm run test:e2e --prefix frontend
```

## Screenshots

![Home search](screenshots/home.png)

![Seat selection](screenshots/seat-selection.png)

![Booking confirmation](screenshots/booking-confirmation.png)

## Local database and deployment

`docker compose up -d` starts MySQL 8.4 using the checked-in development credentials. Run `npm run db:deploy --prefix backend` to apply migrations and `npm run db:seed --prefix backend` to idempotently prepare the demo user and today/tomorrow trips. The API requires `DATABASE_URL` and fails during startup when the database is unavailable; there is no ephemeral fallback.

For schema development, use `npm run db:migrate --prefix backend`. Deploy checked-in migrations with `db:deploy`; do not use development migrations in production. The integration suite also requires Docker MySQL and runs migrations plus the seed before Vitest.

For production, the checked-in Vercel rewrite targets the `smartbus-lite-api` Render service and Render applies migrations before deployment. Configure the real database, frontend origin, secrets, and optional OpenAI key in the provider dashboards. See [docs/07-OPERATIONS.md](docs/07-OPERATIONS.md) for monitoring, backups, restore, and rollback.

## Limitations and future work

- No real payments, payment tokens, refunds, insurance, coupons, boarding points, live tracking, or operator portal
- Local and deployed API instances require a reachable MySQL/TiDB database
- Live OpenAI verification and deployment smoke testing require private provider credentials
