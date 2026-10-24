# Database schema release gate — All About Action V5

**Current release incident: 24 October 2026.** The widget feature branch was ready in Vercel, but production Supabase had none of its four `aaa_*` tables; staging had three and was missing `aaa_page_sections` and the widget database-lifecycle migration. A previous database-engine release on **20 October 2026** similarly reached a frontend environment before its required production schema. This is a repeated **code/schema deployment drift** issue, not a cosmetic widget bug.

The 24 October remediation applied the reviewed source-controlled widget migrations to both environments. Staging already had an earlier `widget_library` migration under a different timestamp (`20261023065804`); do **not** replay `20261023150000_widget_library.sql` on that project or blindly use `supabase db push`. Reconcile migration history explicitly before any future CLI-based migration replay. No demo/test data was copied between projects.

## Rules that apply to every new feature, demo mode, asset, widget, and database view

1. **A preview build is not backend acceptance.** Vercel `READY`, TypeScript, local/PGlite tests, static assets, and browser-local Demo Mode do not prove that tables/functions exist remotely.
2. **One schema source of truth.** Every real Supabase table/RPC read by application code needs a reviewed, committed migration. Run `npm run db:contract` before opening a PR. CI runs the same command and fails if it finds a new undefined table/RPC, missing table RLS, or unreviewed dynamic table name.
3. **Do not confuse Demo Mode with staging.** Demo Mode has fictional, browser-local data; it cannot validate server persistence or RLS. `account_preferences` and `test_profiles` are currently deliberately emulated by `tableSettingsStore` only in Demo Mode, while real accounts use `browserSettingsStore`. The static checker allows those exact call sites only. If future profiles/assets need these tables in real Supabase, create a separate approved migration and remove the exception.
4. **Every deployment has a specific data target.** Feature-branch Vercel previews must use the staging project `hxfkazgqtjlmduqxfgpp` (not production `rpjeqbbvocgwomiavxqh`), with an explicit staging environment flag. Main/production must use the production project and production flag. Test profiles are **not** isolated accounts or datasets.
5. **Two real remote schema checks before merge.** Generate the current, read-only SQL from live client references:

   ```sh
   npm run db:contract -- --sql
   ```

   Execute the resulting SELECT in **staging and production** using an authorized SQL console/MCP connection. Both must return `schema_readiness.ready = true`, with empty `missing_tables`, `rls_disabled`, and `missing_functions`. Also compare the remote migration history to the reviewed SQL, inspect changes to grants/policies/triggers, and resolve any drift. The command has **no credentials** and cannot establish remote readiness on its own.
6. **Staging-first functional acceptance.** Sign into the actual staging preview (not Demo Mode), add/edit/remove widgets, rearrange/spanning sections, reload and verify persistence. Repeat with a second staging account to ensure it cannot read or alter the first user's data. An anonymous request must not reveal owner data. Record results in the PR.
7. **Production schema before production code.** Back up or capture a safe baseline before production DDL. Apply reviewed additive migrations in dependency order and check RLS, grants, required functions, counts, and readiness again. Never silently run a destructive migration, import staging/fictional records, or treat a code-merge approval as authorization to copy real data.
8. **Merge and observe.** Only after the checks above and explicit code/production-structure approvals may the feature PR merge to `main`. Verify the Vercel production deployment target/commit and check runtime errors. Keep data migration/import as its own approval.

If staging authentication or required remote evidence is unavailable, **hold the production merge** and report what cannot be verified. Do not replace missing evidence with a Demo Mode screenshot.

## Current widget release details

Required source migrations, in order:

- `20261023150000_widget_library.sql` — definitions, library pages, placements, ownership validation/RLS.
- `20261023153652_widget_page_sections.sql` — named sections and owner-only RLS.
- `20261023161721_widget_sync_database_lifecycle.sql` — width/height bounds and `db_delete_database` limited to acceptance datasets, with exact-name confirmation.

On 24 October, staging received the second and third migrations (the first was already installed in equivalent form). Production received all three. Read-only validation confirmed the four new tables, enabled RLS/owner policies, accepted width constraint, and `SECURITY INVOKER` deletion function with no anonymous execution. Existing `db_records` remained at **31 staging / 40 production**; production has no widget placements yet, and staging's three test placements remain separate. This is **schema readiness** evidence; an authenticated browser smoke test is recorded separately.

## Automation boundaries

The CI contract checker is intentionally offline and safe for untrusted PR code. It enforces migration **source coverage**, not deployment of those migrations. No CI connection to production credentials is configured. The generated read-only remote SQL and staging/production verification are therefore mandatory release checks until a protected CI deployment check with properly scoped credentials and approvals is provisioned.
