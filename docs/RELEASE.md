# Release and verification

## Current state — 14 October 2026

Application code is on `feature/pr11-ui-sidebar`. Core UI/planning implementation: `6ba32afbd1b8aa3b019ac38f3040b5eab9d62556`; Vercel reported success. Main has not been merged.

After the user's explicit approval at 20:23 Toronto time, the previously pending thought migration and the action-workspace migration were installed on the shared Supabase project `rpjeqbbvocgwomiavxqh`. A follow-up index migration addresses the foreign-key checks identified by the performance advisor. Do not reapply those files manually.

See `docs/ACTION-IMPLEMENTATION.md` for the specification map, activation evidence and exact remaining scope.

## Completed database checks

- Both main migrations and the follow-up indexes installed successfully.
- All new tables have RLS and owner policies.
- Authenticated live smoke test passed inside a rolled-back transaction: canonical creation, perspective uniqueness, task completion, goal measurements, calendar task links and cross-owner isolation.
- All 66 existing calendar blocks and saved category configuration have identical before/after content fingerprints.
- No sample records, auth accounts or imported Notion data were left behind.
- Seven automated tests pass against isolated Postgres, including all migration files. TypeScript, lint (warnings only), and the production build passed for the application commit.

## Remaining release verification

The preview shares production auth/data. Authenticated desktop/mobile UI tests remain unverified in this agent's browser. Verify capture/refresh, nested moves, collection conversion, typed properties, table/board consistency, backlinks, writing matrix/timeline, goal measurements, linked task execution and the preserved event editor before merging to main.

General arbitrary database-axis semantics and Notion import still require the unresolved product choices/source data identified in the handoff. No further live import is authorized by database activation alone.

Commands: `npm ci`; `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`.
