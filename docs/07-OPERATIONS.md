# SmartBus Lite operations

## Deployment

Railway builds and typechecks the API from `backend/Dockerfile`; configure `npm run db:deploy` as the Railway service pre-deploy command. Startup verifies configuration, connects to MySQL/TiDB, idempotently prepares current demo trips, and only then accepts traffic. Vercel proxies `/api/*` to the Railway service so cookies remain same-origin to the browser.

Required production values are `DATABASE_URL`, `FRONTEND_ORIGIN`, and a 32+ character `JWT_SECRET`. `OPENAI_API_KEY` is optional; without it, natural-language search uses the deterministic parser. Set `PRODUCTION_API_URL` in GitHub Actions after deployment.

## Monitoring

- `/api/health` is process liveness and `/api/ready` verifies database connectivity.
- JSON logs include timestamp, request ID, method, path, status, and duration. Render log drains can forward these to the chosen monitoring provider.
- The scheduled production monitor checks readiness every 15 minutes and fails visibly in Actions.
- Global, authentication, and AI-specific rate limits return `429 RATE_LIMITED`.

## Backups and restore

Configure `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, and `DATABASE_NAME` as GitHub Actions secrets. The backup workflow creates a transactionally consistent encrypted-in-transit dump every day and retains the artifact for 14 days. For TiDB Cloud, also enable provider-managed backups and test a restore quarterly.

Restore into a fresh database first: decompress the artifact, import it with the MySQL client, run `npm run db:deploy --prefix backend`, and verify `/api/ready`, login, search, and booking history before switching traffic.

## Rollback

Redeploy the previous Railway deployment and Vercel deployment. Migrations are additive for this release, so do not roll the database backward; preserve it and roll the application forward with a corrective migration. Roll back immediately for integrity errors, doubled error rate, or readiness failures.
