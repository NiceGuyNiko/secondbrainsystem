# All About Action

Next.js, React, TypeScript and Supabase workspace with authenticated calendar and connected thoughts.

## Development

Node 20+; `npm ci`, copy `.env.example` to `.env.local` with the **staging** project's values, then `npm run dev`. The Supabase project is chosen only by environment variables: production deployments must use production, previews and local development must use staging, and anything missing or contradictory refuses to build (`lib/environment.ts`). Staging pages show a STAGING DATA badge. Only publishable keys belong in client configuration — never secret/service-role keys. Setup: `docs/STAGING-SETUP.md`.

## Checks

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Thought workspace

Canonical thoughts use user_items UUIDs. An additive migration in supabase/migrations adds metadata, collection memberships, typed connections and calendar links. See docs/PRD-AUDIT.md for architecture, acceptance coverage and remaining scope; docs/RELEASE.md for the production migration approval and verification gate. Existing calendar works before the migration; new thought capture waits for the new schema.

`main` is the production branch on Vercel; feature branches get preview deployments, which currently share the production Supabase project. Do not merge to main, deploy to production or change the production database without approval.

## Next build

See `docs/NEXT-BUILD-PLAN.md` for approved decisions, the proposed database-engine architecture and the phase plan. The full product specification is `docs/ALL_ABOUT_ACTION_NEXT_BUILD_AGENT_SPEC.md`; the session handoff is `docs/ANTIGRAVITY_HANDOFF.md`.
