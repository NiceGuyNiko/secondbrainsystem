# All About Action

Next.js, React, TypeScript and Supabase workspace with authenticated calendar and connected thoughts.

## Development

Node 20+; `npm ci`, then `npm run dev`. Supabase authentication and existing owner-scoped `user_items` persistence are preserved. `lib/supabase.ts` contains the existing public project URL and publishable key, which are not privileged credentials. Never put secret/service-role keys in client code.

## Checks

`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Thought workspace

Canonical thoughts use user_items UUIDs. An additive migration in supabase/migrations adds metadata, collection memberships, typed connections and calendar links. See docs/PRD-AUDIT.md for architecture, acceptance coverage and remaining scope; docs/RELEASE.md for the production migration approval and verification gate. Existing calendar works before the migration; new thought capture waits for the new schema.

Vercel deploys the development branch separately. Do not merge main without approval.
