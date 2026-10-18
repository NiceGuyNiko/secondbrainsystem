# Databases Phase 2 — implementation handoff

Status: **unmerged Vercel Preview only**. All work is based on the reviewed `feature/databases-phase-1-preview` commit `dfd1d933ea65cd17b61b18c548ab85f264ef97b5`.

## What is implemented

- Typed custom property definitions for the five canonical categories already supported by `planning_records.kind`: Characters, Events, Perspectives, Scenes, Projects.
- New Properties manager inside existing Databases view: Create, rename, option configuration, show/hide columns, reorder, and reversible archive. Protected Name/ID/Status/Summary system properties cannot be overwritten as custom fields.
- Inspector editor with text, long text, number, date, checkbox, select and multi-select. Values are stored in `planning_records.data.databaseProperties[<immutable-property-uuid>]` without overwriting preexisting fields. Existing planning version checks remain in place.
- New owner-scoped `public.database_property_definitions` table, additive trigger validation, RLS, API grants, and owner/category/typed-value checks in `20261018150000_database_custom_properties.sql`.
- Relation definitions: allowed target databases, one/many cardinality, optional inverse label. Relation chips remain read-only until Phase 3.
- Rollup definitions: future relation path (max three hops), target property ID and aggregate choice. Computed values, provenance and filtered rollups remain scheduled for Phases 3–4. A saved blueprint is NOT a working rollup.
- Fictional sample records and metadata kept in browser-only `aaa-databases-phase2-demo-v1` on Vercel Preview. No real account data or Supabase requests. The existing Reset demo data control clears the new demo store as well.
- Restored four original schema migrations `20261008*` into source control from read-only production migration history, without executing them against production.

## Migration and release gates

**Do not merge this branch into production before separately approving the database schema.** Production does not yet have `database_property_definitions`; when connected to production, this feature would need the reviewed additive migration first.

The hosted Supabase project is production only, and the connected account had no hosted development branches at the start of this phase. Production SQL and production records have not been changed. Docker / local Supabase is not present in the assistant runtime, so integration testing was completed using PGlite and browser-only Demo Mode. Cross-device authenticated persistence has been implemented but **not verified against a local or hosted staging Supabase**.

Before any production change: initialize a local Supabase stack on a machine with Docker; verify restored historical migrations against the original schema; apply the new migration locally; run the existing `npm run db:verify` and additional tests covering owner isolation and metadata API access; check existing canonical data fingerprints; then review the SQL, developer preview and proposed deployment order. Require three separate approvals for merging code, production schema application, and any record import.

## Reuse and non-goals

No duplicate Character, Event, Perspective, Scene or Project records are created in production. No production data import, seeded story canon, new canonical Magic/Powers table, relation edge table, Rollup evaluator, filtered rollup engine, live contextual continuity checker, production deploy, or merge has been done.

The main app shell, Calendar, Agenda, settings, profiles, Goals and Think About It remain unchanged apart from the Databases extension and Demo reset integration. The test fixture uses fictional characters (Mira, Rowan), not real writing records.

## Acceptance checks

- [x] Schema metadata and values have immutable property IDs and can be renamed without modifying canonical values.
- [x] Type-safe frontend serialization, server-side validation and optimistic planning record versioning.
- [x] Owner RLS, reserved names, type mismatch, invalid choices and relation/rollup blueprint validation in PGlite automated tests.
- [x] Phase 2 UI theme-aware, responsive and integrated within the existing `app/page.tsx` shell.
- [x] Demo-browser value persistence and reset tested with in-memory storage.
- [ ] Real local Supabase + Auth/PostgREST verification (no Docker stack in this runtime).
- [ ] Authenticated cross-device persistence test against isolated Supabase.
- [ ] Production schema approval, code merge approval and data migration approval (all **not requested**).

Run the usual `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` in CI. Inspect results for the final branch commit rather than relying on a previous commit's success.
