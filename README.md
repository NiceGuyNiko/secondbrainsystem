# All About Action

Next.js, React, TypeScript and Supabase workspace with authenticated calendar and connected thoughts.

## Development

Node 20+ and Docker Desktop; `npm ci`, `npm run db:start`, `npm run db:env`, then `npm run dev`. The database is chosen only by environment variables: production deployments must use production, previews must use a hosted non-production project (none yet, so they refuse to build), and local development uses local Supabase — never production. Anything missing or contradictory refuses to build (`lib/environment.ts`). Non-production pages show a LOCAL/STAGING DATA badge. Only publishable keys belong in client configuration — never secret/service-role keys. Details: `docs/LOCAL-DEVELOPMENT.md`.

## Checks

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Thought workspace

Canonical thoughts use user_items UUIDs. An additive migration in supabase/migrations adds metadata, collection memberships, typed connections and calendar links. See docs/PRD-AUDIT.md for architecture, acceptance coverage and remaining scope; docs/RELEASE.md for the production migration approval and verification gate. Existing calendar works before the migration; new thought capture waits for the new schema.

`main` is the production branch on Vercel; feature branches get preview deployments, which currently share the production Supabase project. Do not merge to main, deploy to production or change the production database without approval.

## Next build

See `docs/NEXT-BUILD-PLAN.md` for approved decisions, the proposed database-engine architecture and the phase plan. The full product specification is `docs/ALL_ABOUT_ACTION_NEXT_BUILD_AGENT_SPEC.md`; the session handoff is `docs/ANTIGRAVITY_HANDOFF.md`.
