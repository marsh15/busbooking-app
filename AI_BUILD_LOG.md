# AI build log

This record describes actual assistance used in this repository.

## Codex use

- Read the supplied MVP specification and the existing scaffold/documents.
- Implemented the Express API, deterministic IST data, parser fallback, transaction simulation, and React booking interface.
- Added documentation, environment examples, Prisma schema, tests, and build/type/lint checks.
- Ran a real local-browser verification of demo login → search → two-seat selection → protected checkout → mock confirmation, and captured the project screenshots.
- Reviewed type and lint failures during implementation and corrected form resolver typing and a conditional-expression lint issue.

## Observed AI mistakes and review fixes

- The first form resolver wiring used a conditional Zod schema that was incompatible with React Hook Form’s inferred type. The frontend production build exposed it; the form values and resolver type were made explicit.
- A compact conditional expression in the filter setter triggered the project ESLint rule. It was replaced with an explicit `if/else` branch.

## Anticipated risks, not observed failures

- The optional OpenAI structured-output integration is intentionally not activated without a key and a production API client. The deterministic parser always remains the available fallback.
- The production Prisma repository layer is not active in zero-config demo mode. The schema documents the required durable transaction model; the in-memory seed store resets on restart.

No Cursor, Claude Code, or Copilot was used.
