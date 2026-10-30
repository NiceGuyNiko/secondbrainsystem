# Pages & Databases: first implementation slice

## Target audit

Verified target: NiceGuyNiko/secondbrainsystem, main 49b077450c3ee1c0de9b005fe2b9795b4e5e0c45.
Next.js App Router, React 19, native shell in app/page.tsx, theme tokens in app/globals.css, AuthGate and useProfile for identity. Existing db_* records use user_items pages and power Widgets. Existing test profiles are settings profiles, not isolated data. The new pd_* namespace has no references to either subsystem; workspace identity is (authenticated owner, active settings profile ID).

The supplied ZIP contains contracts, plan and source audit, but not the original HTML/CSS or its browser tests. Exact visual parity cannot be claimed.

## Working in this slice

- Native Pages & Databases destination, with Pages / Databases / Relatabases / Views contextual navigation.
- Feature enabled automatically in Demo Mode; opt in on staging with NEXT_PUBLIC_AAA_PAGES_DATABASES=true. Production explicitly hides it.
- Separate normalized tables, canonical editable page IDs, database membership, nested records, manual ordering, server-side cycle protection and transactional reparenting.
- Independent detailed relationship IDs and creation sequence; same relationship page accessible from either endpoint or its standalone Relatabase.
- Nested Cards, Table and Gallery database layouts; relationship cards; live page embeddings, default database view choice, shared view editing and independent view copies.
- Find/create record endpoints with partial search, full ancestor paths and case-insensitive exact-match prevention.
- Browser-local demo adapter scoped by owner/profile; remote Supabase adapter scoped by server-owned workspace.
- Workspace revision checks serialize mutations, and request IDs make server retries idempotent. Retried IDs cannot carry a changed command.
- Partial-width native mobile drawer for this destination, backdrop dismissal and inherited focus/escape behavior.

## Validation

293 repository tests passed at initial integration; targeted domain/SQL tests and TypeScript rerun after view editing was added. Production build succeeded; pre-existing CSS and lint warnings remain.

Staging hxfkazgqtjlmduqxfgpp received the additive pages_databases_foundation migration. A transaction-rolled-back authenticated SQL smoke test passed create, retry, nested persistence, cycle rejection, separate profile datasets and cross-account RLS. No user records were imported. Production received no DDL or code merge.

Supabase advisors flag the two intentional authenticated SECURITY DEFINER entrypoints. Their explicit auth.uid() ownership check, workspace lock, empty search_path and revoked direct table writes are covered by SQL tests. Anonymous execution is revoked. Pre-existing advisor notices concern create_profile_for_new_user, rls_auto_enable and leaked password protection; these were not changed.

The managed local preview launcher passes Vite flags (--host/--strictPort) to Next.js and fails. No working app configuration was changed to compensate. Deployed preview QA is recorded separately.

## Remaining plan work

This is a first slice, not completion of all acceptance gates. Still needed: generic typed property definitions and editors; conversion previews and migration history; simple relation properties; complete universal picker keyboard behavior; contextual filters/grouping and calendar/date modes; rich page/navigation parent blocks; Guided Builder; export/import; pagination; offline synchronization; full touch and authenticated hosted browser acceptance. Manual order has no timestamp semantics. Full-workspace reads and a single workspace revision are deliberate small-dataset limits of this slice.

The deployment preview is explicitly Demo Mode. Its UI is not evidence of hosted RLS or cross-device persistence. Before production activation, follow docs/DB-SCHEMA-RELEASE-GATE.md, complete authenticated staging acceptance, production schema review, and the remaining product gates.
