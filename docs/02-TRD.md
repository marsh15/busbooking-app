# SmartBus Lite — Technical Requirements Document

## Fixed stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Frontend libraries: React Router, TanStack Query, React Hook Form, Zod, Axios, Zustand
- Backend: Node.js, Express, TypeScript
- Backend libraries: Prisma, Zod, Helmet, CORS, Morgan in development, Winston in production
- Database: MySQL locally through Docker Compose; TiDB Cloud Starter for the public demo
- Testing: Vitest, Supertest, Playwright
- Deployment: Vercel frontend and Render API

## Package boundaries

- `frontend/`: feature modules, reusable UI components, API client, routes, hooks, UI state
- `backend/`: routes, validators, services, Prisma access, middleware, utilities
- `docs/`: product and implementation decisions
- `screenshots/`: final proof-of-work images

## Environment variables

### Frontend

- `VITE_API_BASE_URL`

### Backend

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_ORIGIN`
- `NODE_ENV`
- `PORT`
- `OPENAI_API_KEY` (optional)
- `OPENAI_MODEL` (default: `gpt-5.4-nano`)

## Security constraints

- JWT is stored only in a secure, HttpOnly, `SameSite=Lax` cookie.
- JWTs must never be stored in localStorage.
- Mutating requests use CSRF double-submit protection.
- Passwords use Argon2id hashing.
- Input is validated with Zod.
- Helmet is enabled.
- API CORS permits only approved local and production frontend origins.
- Errors follow `{ "error": { "code", "message", "details?" } }`.

## API and deployment constraints

- Successful API responses follow `{ "data": ..., "pagination?": ... }`.
- Validation errors return `422`; unauthenticated requests return `401`; ownership failures return `403`; booking conflicts return `409`.
- Vercel rewrites `/api/*` requests to the Render API, keeping browser traffic same-origin.
- The app operates only in `Asia/Kolkata`.
- Payments are simulated; no card or gateway integration is permitted.
- Missing OpenAI configuration must fall back to deterministic parsing and never block the demo.
