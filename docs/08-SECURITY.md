# Credential incident response

## What the alert identified

The GitGuardian link to commit `901c903` identifies the deleted shared demo
password in the previous README at line 59. It is an application login paired
with the seeded demo account, not evidence of a company mailbox password.
The seed, integration fixtures, and Postman example still contained the same
published password at the start of this remediation.

The focused source review covered tracked configuration, credential examples,
the seed, login and JWT authentication, and local Git history. It found no SMTP
credentials, provider API keys, private keys, or remote database password URLs.
That is bounded source evidence, not a comprehensive security audit or proof
that every credential is safe.

## Containment

1. If the demo password might have been reused, change it directly at every
   relevant provider, revoke associated app passwords or tokens, and review
   account access. Never paste credentials into an issue, chat, or replacement
   commit. Reuse is currently unknown.
2. Deploy this fix through the normal release process. Seeding no longer creates
   a shared login. Before the server accepts requests, existing historical demo
   accounts have their password hashes replaced with unpredictable values.
   Exact ID and email pairs constrain the update. Account and booking records
   are preserved for incident review.
3. All authentication paths reject the three retired account IDs, including
   previously issued valid JWTs. Use the existing private demo-session button
   for new synthetic accounts instead. No published password is needed.
4. Review bookings associated with the retired accounts privately. Published
   access meant another visitor could read or cancel those accounts' bookings.
   If real traveller data was entered, assess the actual disclosure and the
   required response with the owner.

These code protections take effect only after deployment. No provider credential
rotation, production data access, or deployment was performed during this fix.

## Prevention

- Real environment files, private keys, and SQL dumps are ignored by Git.
  `.env.example` contains local fixtures only. Never reuse those in production.
- Install Gitleaks 8.30.1, then run `git config core.hooksPath .githooks` in each
  clone. The pre-commit hook scans staged additions, redacts output, and blocks
  commits when Gitleaks is missing. Git hooks are local safeguards and can be
  bypassed, so require the `Secret scan` CI check before merging.
- CI scans all tracked files and new PR/push commit ranges with the standard
  Gitleaks rules plus password rules. There is no historical-secret baseline.
  The exact `test-only-password` and Postman variable placeholders are permitted
  by the account-password rule, not by a global scanner exemption.
- Set Postman's `testPassword` locally for your own test account. Leave the
  committed variable empty. Use the private demo endpoint for shared demos.
- Enable GitHub push protection in repository settings where available.

## Historical copies

The old password remains in existing commits, clones, and possibly GitHub cached
views. Removing it from the current source does not erase those copies.
GitHub recommends revoking or rotating affected credentials first:
[removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

After confirming containment, coordinate a history rewrite with every repository
collaborator. In a fresh disposable clone, use `git-filter-repo` 2.47 or newer
with `--sensitive-data-removal --replace-text` and a private replacement file
outside the checkout. Include every historical password variant, without
printing it or committing the replacement file. Scan all rewritten refs, review
the changed refs and commits, then approve the coordinated force-push. Old
clones must be replaced or cleaned before they can push again. GitHub documents
the limits on removing cached views and copies in forks.

No shared history was rewritten or force-pushed during this change.

## Dependency audit and validation

Native npm audits were run against both lockfiles. Compatible lockfile updates
remove the frontend advisories. Scoped backend overrides select MariaDB 3.5.4
and MySQL2 3.24.5 to remove the database-driver advisories without downgrading
Prisma. MariaDB's upstream advisory describes password disclosure during TLS
negotiation in the previous driver:
[GHSA-cqhc-2h57-wpxf](https://github.com/mariadb-corporation/mariadb-connector-nodejs/security/advisories/GHSA-cqhc-2h57-wpxf).

One root advisory remains: `deepmerge-ts` below 8.0.0 can exhaust the stack on
recursive object graphs. npm reports three high entries through `deepmerge-ts`,
`@prisma/config`, and `prisma`. Prisma's pinned configuration dependency still
uses the affected version. The app accepts no externally supplied Prisma
configuration or recursive object graphs at this boundary. This is deferred
pending an upstream compatible fix or a tested upgrade, rather than forcing a
Prisma downgrade or overriding a major dependency without verification.
Owner review date: 2026-10-09.

Regression tests cover rejection of old JWTs on required and optional auth
paths, acceptance of ordinary/private demo sessions, login rejection, and
password-hash revocation while retaining the legacy account. Runtime tests,
type checking, the database-driver upgrade, and clean installs still need
validation. The audit skill requires an OS-enforced sandbox with network
isolation, an empty allowlisted environment, read-only source/toolchain,
scratch-only writes, and CPU/memory/process/disk/time limits. This workspace
has Docker isolation available, but no preloaded Node test image or repository
dependencies. The same skill forbids installing dependencies or allowing builds
to fetch them during validation. No target code or database fixture was
executed on the host.

Run the repository's integration tests and type checks in an appropriately
isolated environment with disposable MySQL data before deployment. Review
dependency lifecycle scripts before clean installation; do not run forced
package-manager remediation. The existing CI suite includes real MySQL
integration tests, frontend tests, lint, formatting, build, and browser checks.
