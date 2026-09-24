# VoyageBus operations

## Deployment

The demo runs on a $0 stack: Vercel serves the static React frontend, Render runs the Express API (`render.yaml`, service name `voyagebus-api`), and TiDB Cloud Starter is the database with its spending limit set to zero. `vercel.json` rewrites `/api/*` to the Render service so session cookies stay same-origin to the browser; the rewrite destination must match the Render service URL exactly.

Required production values: `DATABASE_URL` (TiDB connection string with TLS), `FRONTEND_ORIGIN` (the Vercel origin), a 32+ character `JWT_SECRET`, and `PUBLIC_REGISTRATION=false` so the deployed demo only issues private demo sessions. `OPENAI_API_KEY` is optional; without it, natural-language search uses the deterministic parser.

Startup order is deliberate: validate environment, connect, apply checked-in migrations (`RUN_MIGRATIONS_ON_START`, plus the Render `preDeployCommand`), run the idempotent rolling seed, clean up expired demo accounts, and only then listen. A failed migration or seed crashes the boot; the API never serves traffic against a stale schema. `/api/health` is process liveness, `/api/ready` verifies database connectivity and is the Render health check path.

## Free-tier limits, stated honestly

- Render's free web service sleeps after 15 minutes without traffic and takes roughly a minute to wake. The frontend polls `/api/ready` within a bounded window (kept under Vercel's 120-second proxied-request limit) and shows a "starting the demo" screen with a manual retry while the API wakes.
- TiDB Cloud Starter's free automatic backups retain one day. Do not assume longer retention without a separately verified workflow.
- Demo sessions are rate-limited per IP (8 per 15 minutes), and expired demo accounts lose access when their session token expires.

## Monitoring

- JSON logs include timestamp, request ID, method, path, status, and duration. Domain events are logged with the propagated request ID: `hold_conflict`, `hold_expired_seen`, `hold_released`, `payment_attempt_created`, `payment_response_lost`, `payment_failed`, `booking_confirmed`, `confirmation_reconciled`, `ticket_cancelled`, `demo_session_created`, `demo_cleanup`, and `parser_fallback` (which records only the error name and query length, never the raw search text).
- `PaymentAttempt` rows left in `RECONCILIATION_REQUIRED` need a human decision; check for them with a query on that status. They carry the hold id, amount, and reason code.
- The scheduled production monitor checks `/api/ready` every 15 minutes and fails visibly in Actions.

## Backups and restore

TiDB Starter's automatic backups retain one day. For a durable copy, export from TiDB (console export or `mysqldump`-compatible tooling over the same TLS connection) and store the artifact in private storage; verify a restore before relying on it.

Restore procedure: create a fresh TiDB Starter cluster (or local MySQL), import the dump, point `DATABASE_URL` at it, and let the boot sequence apply any pending migrations. Verify `/api/ready`, a demo login, search, and one booking before switching traffic. This procedure has been exercised against local MySQL; re-verify it against TiDB before depending on it.

## Rollback

Redeploy the previous Render and Vercel deployments. Migrations in this release are additive except for the dropped flat `Trip.cancellationCutoffMinutes`/`cancellationFeePercent` columns (replaced by versioned policies), so do not roll the database backward; preserve it and roll the application forward with a corrective migration if needed. Roll back immediately for integrity errors, doubled error rate, or readiness failures.
