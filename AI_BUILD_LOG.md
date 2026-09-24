# AI build log

This log records the AI assistance actually used for the holds, checkout, and cancellation-policy release. Every entry links to evidence in the repository. Nothing here is a reconstruction of what a hypothetical assistant might have done; each correction below was observed and fixed during this work.

## How the work proceeded

- **Mapping before editing.** Two read-only exploration agents produced complete backend and frontend reports (schema, transaction code, routes, seed logic, checkout flow, styles) before any file changed. No code was written from assumptions.
- **Baseline first.** The ~5,000 lines of uncommitted prior work were verified with the full MySQL integration suite, frontend unit tests, lint, build, and Playwright, then committed untouched as `9fe77f9`. Every later feature sits on that verified base.
- **Commit sequence:** `9438322` startup gating and deployment config, `273f589` holds + idempotent checkout, `2d31247` a type fix, `f433888` the hold-based frontend, `f470c09` operator policies.

## Review decisions the assistant made, and why

- **Dropped `SERIALIZABLE` isolation.** TiDB does not support it ([docs](https://docs.pingcap.com/tidbcloud/sql-statement-set-transaction/)). Seat claims, confirmation, and cancellation now use ordered conditional writes inside transactions at the default isolation or explicit `READ COMMITTED`, which both MySQL and TiDB support. The existing race tests and the new ones were re-run on MySQL after the switch.
- **Stored the checkout payload server-side.** An early design kept passenger details only in the client and rebuilt them on retry. That cannot survive a process restart after a lost payment response, so `PaymentAttempt.requestPayload` was added (`prisma/migrations/20260924131000_payment_attempt_payload/migration.sql`) and the attempt-status endpoint resolves stale `PENDING` attempts from it.
- **Exactly-once via constraints, not flags.** Duplicate confirmations are decided by the unique `(userId, idempotencyKey)` on attempts and the unique `BookingGroup.holdId`, plus a conditional claim of the attempt row, rather than application-level locks.
- **Policy snapshots over live reads.** Each booking group stores the operator policy it was sold under (`policySnapshot`), because a live read would let an operator reprice sold tickets. The integration test "keeps a booking on its checkout-time policy even after the operator re-versions" proves it.

## Real AI mistakes, caught by tests and corrected

- **A state write that rolled back with its own error.** The first late-success implementation marked the payment attempt `RECONCILIATION_REQUIRED` inside the same transaction that then threw `409 HOLD_EXPIRED`; the rollback erased the marking, leaving the attempt `PENDING`. The test "issues no ticket and flags reconciliation when simulated success arrives after expiry" failed with `expected 'PENDING' to be 'RECONCILIATION_REQUIRED'`, which localized the bug immediately. The marking moved outside the transaction (`backend/src/services/checkout.ts`).
- **A stale snapshot produced the wrong group status.** Concurrent cancellation of two tickets in one booking ended `PARTIALLY_CANCELLED` instead of `CANCELLED`: under `REPEATABLE READ`, the second transaction's counts read a snapshot taken before it acquired the group lock. The test "cancels two different tickets concurrently" caught it. Fix: `SELECT ... FOR UPDATE` on the group row plus `READ COMMITTED` for that transaction (`backend/src/services/bookings.ts`).
- **A hold that silently never got created.** The checkout page acquired the hold from a mount effect whose cleanup canceled the pending call when React Query re-rendered the component during mount notifications. The frontend test rendered an empty page and `client.hold` was never called; the acquisition now runs as an uncancellable microtask (`frontend/src/pages/Checkout.tsx`).
- **Smaller catches:** the supertest `TestAgent` export no longer exists in v7 (typecheck), and a mock without a `policy` field crashed the checkout render (unit test). Both were fixed in the same session that introduced them.

## Boundaries verified instead of assumed

- `prisma migrate dev` refuses to run non-interactively in this environment. The release therefore uses `prisma migrate diff --from-config-datasource --to-schema ... --script` plus `migrate deploy`, which is also how the checked-in migrations were produced and applied. Migration SQL was reviewed by hand before applying (enum widening, JSON columns, `UPDATE ... JOIN` backfill, and foreign keys were checked against TiDB behavior).
- The mock payment provider keeps no in-memory state: outcomes are deterministic functions of `(scenario, providerRef)`, which is what makes lost-response recovery and restart resolution testable rather than hopeful. Scenario injection other than success is rejected in production (`backend/src/routes/checkout.ts`).
- Raw search text never enters telemetry; the fallback event logs only the error name and query length (`backend/src/services/ai-parser.ts`).

## What the tests prove at this release

`npm run test:integration --prefix backend` (real MySQL) covers hold races with exactly one winner, all-or-nothing multi-seat rollback, expired holds taken over without a cleanup job, departed-trip rejection, replay and concurrent use of one idempotency key producing one PNR, declined payments leaving the hold for a new-key retry, lost responses recovered to the same PNR across a database reconnect, late success reconciled with no ticket, cancellation window boundaries, rounding and ordering (unit suite in `backend/src/services/policies.test.ts`), snapshot immutability, serialized concurrent cancellation, and unauthorized access. `npm run test:e2e --prefix frontend` walks public browse → private demo → hold → checkout → PNR → quote → partial cancellation on desktop and a 390px viewport. A pre-release run of the same integration suite against TiDB Cloud Starter is a release gate documented in the README.

## Not claimed

No scale, uptime, or reliability numbers are claimed beyond the tests above. The payment provider is simulated, the operators are fictional, and the hosting is free-tier.
