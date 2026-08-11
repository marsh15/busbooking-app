# VoyageBus — Implementation Plan

## Phase 1: Foundation

- Scaffold React/Vite and Express/TypeScript apps.
- Configure Tailwind, linting, typechecking, tests, environment validation, Docker MySQL, and a health endpoint.
- Add documentation skeleton and project scripts.

**Done when:** both apps start locally and pass lint/typecheck.

## Phase 2: Database and seed data

- Create the Prisma schema and migrations.
- Add deterministic, idempotent IST seed data.
- Seed six routes, 24 trips across today/tomorrow, seat layouts, and a demo account.
- Add seed verification.

**Done when:** a clean database can be migrated and seeded repeatedly.

## Phase 3: Authentication and security

- Implement registration, login, logout, CSRF issuance, and session restoration.
- Add secure cookies, CSRF protection, CORS, Helmet, logging, and standard error handling.
- Add protected-route behavior in the frontend.

**Done when:** an unauthenticated user cannot access protected endpoints or pages.

## Phase 4: Search and trip details

- Implement route resolution, trip search, filters, sorting, and trip-detail endpoints.
- Build Home, Search Results, Bus Details, and responsive filters.
- Add loading, empty, and error states.

**Done when:** a user can find seeded trips through manual search.

## Phase 5: Booking and cancellation

- Build the accessible seat map and dynamic passenger forms.
- Implement server-authoritative multi-seat booking transactions.
- Add mock payment review, booking confirmation, booking history, and ticket cancellation.

**Done when:** one booking group can contain multiple tickets and support partial cancellation.

## Phase 6: AI-assisted search

- Add OpenAI structured-output parsing when configured.
- Add deterministic fallback parsing.
- Show editable parsed fields, warnings, and provider information.

**Done when:** searches work with and without an OpenAI key.

## Phase 7: Proof and deployment assets

- Write root documentation, API documentation, architecture diagram, Postman collection, screenshots, Vercel rewrite, and Render configuration.
- Add deployment instructions and limitations.

**Done when:** a reviewer can set up, run, and understand the project from the repository.

## Phase 8: Quality pass

- Add unit tests, API integration tests, and end-to-end Playwright coverage.
- Verify keyboard navigation, focus management, contrast, mobile layouts, and error handling.
- Check for secret leakage.

**Done when:** the primary user journey and concurrency rule are covered by automated tests.
