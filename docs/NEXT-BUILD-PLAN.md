# Next build — decisions, architecture and plan

**Status:** Phase 0.5. Decisions in §1, the hybrid architecture in §4 (with the §4.4 refinement) and the revised phases in §6 are **approved by the owner (15 October 2026)**. Development data isolation: `docs/LOCAL-DEVELOPMENT.md`.
**Baseline:** `main` at `fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0` (PR #15), production deployment `dpl_2h6UBcapq7DLbB2k9BnTfRkwM3PD`.
**Authority:** this document overrides conflicting instructions in `docs/ALL_ABOUT_ACTION_NEXT_BUILD_AGENT_SPEC.md` and `docs/ANTIGRAVITY_HANDOFF.md`. Everything else in the spec remains the product contract.

## 1. Owner decisions (approved)

1. **No legacy content migration in this build.** Existing Goals, Projects, Tasks, measurements, Resources/collections, thoughts and writing Workspaces (Events, Characters, Perspectives, Scenes, Matrix) are not converted, re-linked or rewritten. `planning_records` and thought records are not modified. Spec §13 items 3–5 (backfill/convert) are **deferred**, not cancelled; they happen only after the new system is tested, in a separately approved build.
2. **Generic database engine first.** Build a reusable, Notion-style database engine (databases, typed properties, relations, rollups, formulas, saved views, record pages, templates, widgets). Goals, Projects, Tasks, Resources, Workspaces and Progress Updates are **templates** on that engine, not bespoke tables.
3. **Composable with the thought/block model**, without forcing the engine into `planning_records`, and able to run independently of legacy content until deliberately integrated.
4. **AI-ready, not AI-built.** No AI assistant this build. All structural changes go through validated application operations so an assistant can later propose them for user review. No generated SQL.
5. **Settings storage:** Supabase tables are the source of truth, with a browser cache for instant theme/profile start-up.
   - Account level: Developer Mode, Test Profiles beta availability, active profile pointer.
   - Per profile: theme and appearance overrides, sidebar, Agenda mode and pin state, calendar display and visibility, Fluid Calendar and Think About It beta preferences.
   - Primary profile cannot be deleted; there is always a route back to Primary even when Developer Mode or Test Profiles is off.
   - Fix the overwrite-on-load bug. A one-time transfer of existing browser preferences into the Primary profile is approved; it is not permission to migrate app content.
6. **Themes:** keep all seven dark themes (Forest = `midnight-forest`, Black & Gold, Midnight, Slate, Deep Ocean, Warm Botanical, Neon Evergreen) unchanged; add Porcelain & Ink, Warm Linen, Sage Studio, Blue Hour. Manual selection only. Remove automatic/System switching and dark→light transformation. Existing Light/System users get a safe one-time mapping to an explicit theme and are never switched again.
7. **Logo:** transparency-mask treatment of the existing emblem is approved if accurate; no black backing on light themes; investigate a theme-aware favicon with static fallback.
8. **Imports** (Notion, external calendars, other tools) are later phases and must use isolated test data or staging, never production. Test Profiles do not isolate data.
9. **Safety:** no production schema change, merge to `main`, or production deploy without explicit approval. Additive schema only.
10. **Records stay Thoughts.** Databases and records remain recognizable Thought pages that take part in connections, backlinks and search. Database membership is a relationship of the underlying Thought, not a replacement for its identity. Legacy lists may exclude them only where showing them would duplicate or confuse (§4.4).
11. **"Existing" group is temporary.** The legacy section inside Databases is a compatibility arrangement until deliberate integration produces one unified database and workspace experience.
12. **Development is fail-closed and local.** No second hosted Supabase project (plan limit; no upgrade). Development and database testing use local Supabase (CLI + Docker). Production uses explicitly configured production credentials; Preview fails closed until a hosted non-production project exists; nothing ever falls back to production. Non-production builds show a LOCAL/STAGING DATA indicator. All new migrations are tested locally before any production review.
13. **Database testing** must include a real Supabase stack (local Supabase), including row-level security and permissions, in addition to PGlite tests.
14. **Engine requirements before any AI work:** validation before execution, atomic changes, permission checks, consistent two-way relations, rejection of invalid or circular dependencies, version-conflict handling, idempotent retries, clear errors for missing or invalid calculated values. Formulas: an extensible defined subset. Table, board and gallery views before calendar and timeline.

## 2. Baseline (Phase 0)

| Check | Result on `fbc6cdb` |
|---|---|
| `npm ci` | OK (Node 24.15, npm 11.12) |
| `npm test` | 10/10 pass (12/12 with the Phase 0 baseline tests) |
| `npm run typecheck` | pass |
| `npm run lint` | 0 errors, 6 pre-existing warnings (`auth-gate.tsx`, `calendar-workspace.tsx`, `postcss.config.mjs`) |
| `npm run build` | pass |
| GitHub | `origin/main` = `fbc6cdb`, no open PRs |
| Vercel | GitHub deployment record: Production for `fbc6cdb`, status success; alias responds 200 |
| Supabase | Anonymous role cannot read the schema or tables (expected). Live schema/migration history not re-verified this session — no credentials requested. |

Phase 0 adds `tests/baseline-appearance.test.ts` with `tests/fixtures/dark-theme-tokens.baseline.json`, freezing the seven dark themes' current tokens and the saved-appearance parser so later phases cannot silently change them.

Outstanding Phase 0 item: signed-in baseline screenshots (Calendar, collapsed sidebar, each Agenda mode, Settings, phone width). These need the owner signed in to Chrome; nothing is written.

## 3. Compatibility requirements (existing system)

**Must keep working, unchanged in behaviour:** auth/profile editor; Calendar Month/Week/Day/Fluid with recurrence, categories, locks and drag; The Agenda (column/pin/toggle, day timeline, task quick-details and completion); Think About It (thoughts, block editor, collections, memberships, connections, backlinks); legacy Goals/Projects/Tasks/measurements (`planning_records`); writing Workspaces (Events, Characters, Perspectives, Scenes, Matrix); Ontario holidays.

**Legacy browser storage keys** (read for the one-time settings transfer, left in place until verified):
`aaa-workspace-preferences-v2:<email>` (developer, agendaPreference, lastPinned, startDay, clock, hidden), `aaa-appearance-studio-v1`, `think-theme`, `aaa-resolved-theme-v1`, `think-sidebar-collapsed`, `aaa-week-start`, `aaa-clock`, plus the matrix preferences written by `planning-workspace.tsx`.

**Legacy database objects that the new work must not alter:** `profiles`, `user_items` rows, `thought_details`, `thought_memberships`, `thought_connections`, `planning_records`, `planning_counters` and their triggers/RPCs. Possible exception, to be proposed separately in Phase 5: extending `validate_block_task_links` so calendar blocks can also link engine task records (additive behaviour, no data change).

**Navigation once Databases replaces Goals/Workspaces/Resources:** the legacy screens stay reachable from the Databases contextual list under a clearly labelled *Existing* group (Writing Workspaces, Planning, Resources collections) until integration.

## 4. Proposed architecture — generic database engine

### 4.1 Options compared

| | A. Extend collections | B. Separate engine | **C. Hybrid (recommended)** |
|---|---|---|---|
| Record identity and page | thought | new page table | **thought** (existing `user_items` + `thought_details`) |
| Schema / values | `thought_details.properties` JSON + `thought_memberships.values_json` | new tables | **new normalized tables** |
| Relations | JSON arrays or untyped connections | new table | **new relation table with inverse properties and edge fields** |
| Block editor, backlinks, scheduling | reused | rebuilt | **reused** |
| Risk to legacy data | high (shared triggers/semantics) | none | **none** (legacy tables untouched) |
| Second knowledge system | no | **yes** | no |

Why not A: a thought can belong to many collections with different values per collection, which does not match "a record belongs to one database". Relations would live in unindexed JSON without referential integrity, inverse lookups or edge weights. Views stored as JSON on the collection cannot be referenced by widgets. Changing the shared validation trigger risks existing collections.

Why not B: it duplicates pages, editor, search, backlinks and calendar scheduling — the "second incompatible knowledge system" the owner wants to avoid.

### 4.2 Recommended model

- **Every database and every record is a thought page.** Database pages and record pages get the existing block editor, title, archive, hierarchy, references/backlinks and calendar linking through `user_items.thought_id` for free. A database is therefore composable inside the thought/block model: it can be nested, referenced and opened like any page.
- **The structured layer is new and separate:**

| Table | Purpose |
|---|---|
| `db_databases` | One row per database: `id` = its thought page, owner, icon, `template_key`/`template_version`, `origin` (user/template/import/ai), `dataset` (see §5), archive, version |
| `db_properties` | Typed schema: stable `id`, `database_id`, `name`, `type`, `config jsonb`, `position`, `archived_at`. Renames never break data because values are keyed by property id. |
| `db_records` | Row membership: `record_id` = thought page (unique — one database per record), `database_id`, `values jsonb` keyed by property id, `position`, `version`, `archived_at`, per-database sequence number |
| `db_relations` | One row per link: `property_id`, `source_record_id`, `target_record_id`, `attributes jsonb` (edge fields, e.g. `weight`, `enabled`, `counts_toward_progress`), `position`. Unique per (property, source, target). |
| `db_views` | Saved views: layout (table, board, gallery, list; calendar/timeline later), filter tree, sorts, grouping, visible/ordered properties, per-layout options |
| `db_operation_log` | Append-only log of applied operation batches with idempotency key, actor and origin (user/template/ai/import) — supports retries, audit and future AI review/undo |

- **Property types (V1):** title, text, number, select, multi-select, status, date (single/range), checkbox, url, email, relation, rollup, formula, created time, updated time, unique id. Scalar values are type-checked by a database trigger against `db_properties`.
- **Two-way relations without duplication:** a relation property names its target database and, optionally, an `inverse_property_id` on the target. A link is stored **once** in `db_relations`. The inverse side is read by querying the same row from the other end. Self-relations (subtasks, dependencies, goal support) use the same mechanism. Edge fields declared in the property config (e.g. `weight` default 1, `enabled` default true) are validated on write — this is how weighted Goal support and Task→Goal contribution work generically.
- **Rollups and formulas** are computed, never stored as editable values. A shared, pure TypeScript evaluation engine (`lib/db-engine/`) computes them for views, pages and widgets. Formulas use a small safe expression language parsed to an AST: no code execution, no SQL. Results distinguish a value from **null with a reason** (not configured, incomplete source, invalid configuration), so missing data is never shown as 0%.
- **Operations API (AI-ready):** every structural and data change is a typed operation — `createDatabase`, `addProperty`, `updateProperty`, `createRelationPair`, `createView`, `createRecord`, `setValues`, `link`/`unlink`, `archive`, `instantiateTemplate`, `createWorkspace`, `addWidget`, and so on. Operations are validated in TypeScript (schema validation) and applied atomically by one security-invoker RPC `db_apply_operations(batch, idempotency_key, expected_versions)`, which re-validates ownership and types in Postgres. A `preview` mode returns the resulting diff without writing. Templates, the UI, future imports and a future AI assistant all use this single path. An assistant would produce an operation batch → the user reviews the preview → approves → it is applied.
- **Templates** are versioned code blueprints (properties, relation pairs, views, record page templates) instantiated through `instantiateTemplate`. They are not special tables, so a user can modify a templated database like any other.
- **Security:** owner-only RLS (`user_id = auth.uid()` USING and WITH CHECK) on every table; triggers reject cross-owner references by guessed IDs; security-invoker RPCs with explicit grants; anon revoked — the same conventions as the existing migrations.

### 4.3 Goals framework on the engine

The Goals template is a database with properties: Name, Goal Type (select: Vision/Project), Status (draft…cancelled), Project (relation → Projects; required iff Project Goal, enforced by a template validation rule), Outcome Method (select), Manual Outcome %, Success Criteria, Start/Target Date, Achieved At, and relation pairs:

- **Supports Vision Goals ⇄ Supported by Project Goals** — self-relation on Goals with edge fields `weight` and `enabled`; template rule restricts the Project→Vision direction.
- **Milestones** (relation → a Milestones database with weight and status), **Metrics** (relation → Metrics database: baseline, current, target, unit, direction).
- **Tasks ⇄ Goals** with edge fields `counts_toward_progress` and `weight`.
- **Progress Updates** database (append-only by convention, written by the operation layer).

**Outcome Progress** and **Supporting Progress** are built-in engine functions available to formulas — `outcome_progress()` dispatches on Outcome Method (metric/milestone/task/manual), and `weighted_rollup(relation, property, edge_weight)` gives `Σ(weight·outcome) / Σ(weight)` over enabled edges, returning *Incomplete setup* (naming the source) or *No supporting goals* instead of a number when appropriate. They are two separate properties; there is no blended score. Achievement is an explicit action that sets Status and Achieved At.

**Progress history:** an operation that changes an input (task completion, milestone, metric value, manual %, weight, target) is submitted with the expected record versions plus before/after values computed by the engine. The RPC rejects it if any version changed, then writes the change and the grouped Progress Update rows (one `event_group_id`, classified as work progress or plan adjustment) in one transaction. Retries with the same idempotency key are no-ops. A rebuild pass can recompute current values at any time; history rows are never rewritten.

**Tasks:** Project (relation), Goals (relation with edge fields), Subtasks ⇄ Parent task, Blocked by ⇄ Blocks (cycle rejection in the operation layer and a database trigger), Resources (relation), Calendar sessions (existing calendar blocks linked by `user_items.thought_id` to the task's page; completion stays the task's own checkbox — a session never auto-completes it).

### 4.4 Coexistence with legacy records (no migration)

- Engine tables are new. Legacy tables and rows are not altered.
- Engine databases and records **remain Thoughts** (approved refinement). They appear in Thought search, connection and reference pickers, and backlinks, labelled with their database (e.g. "Goals · G12"). Opening one from anywhere shows the same page with its database properties. A record can be linked from any Thought without being copied.
- Only where a legacy list would duplicate or confuse are they filtered out: the Resources collections list (it shows legacy collections only), and the Think About It inbox, which groups engine records under their database instead of mixing them into loose thoughts. This is a display rule; no data changes.
- Membership is a relationship: `db_records.record_id` → the Thought. Removing a record from a database (archive membership) never deletes the Thought.
- Legacy Goals/Projects/Tasks keep their screens, RPCs and Agenda behaviour. New-engine Goals are separate records; the UI labels the two systems distinctly (*Existing planning* vs the new databases).
- Later integration (separate approval) would be a deliberate import through the same operation API: legacy record → engine record, keeping the same thought page ID, so no page content is copied.

## 5. Safe development and testing

Approved approach (owner steps and commands in `docs/LOCAL-DEVELOPMENT.md`):

1. **PGlite tests** for every migration, trigger, RLS rule, operation and progress formula.
2. **Local Supabase** (CLI + Docker Desktop) as the full integration environment: real Postgres, Auth, PostgREST and RLS. It starts empty (no seed, no production data).
3. **Explicit environment configuration, no fallback:** production deployments require production values; previews require a hosted non-production project (none yet, so previews refuse to build); local development accepts local Supabase or a hosted staging project, never production.
4. **Visible indicator:** LOCAL DATA / STAGING DATA badge and tab-title prefix on every non-production page.
5. **Guarded scripts:** `npm run db:*` only targets the local stack and refuses if the folder is linked to production or a variable could redirect the CLI. `npm run db:verify` checks anonymous access, owner read/write, cross-account isolation and cross-account link rejection with two throwaway local users.
6. **Datasets for future imports:** `db_databases.dataset` (default `primary`) lets import experiments use labelled, deletable datasets — locally (or on a future hosted staging project), never production.
7. A hosted staging project or Supabase Branching can be added later without code changes to the environment rules.

## 6. Proposed phases (revised)

| Phase | Scope | Database |
|---|---|---|
| 0 | Branch, docs (this file, spec, handoff), baseline tests, signed-in screenshots | none |
| 0.5 | Isolated development: fail-closed env config, LOCAL/STAGING DATA indicator, local Supabase (Docker) with guarded db scripts, base migrations committed from production history, RLS verified locally | none on production |
| 1 | Pill switch; Developer Mode and Beta Features cards; independent beta switches; settings persistence service; overwrite-on-load fix | **M1** on staging |
| 2 | Test Profiles: create/duplicate/rename/switch/delete; Primary protected; Return to Primary always available; one-time browser settings transfer; flicker-free start-up cache | M1 |
| 3 | 11 themes in Dark/Light groups; explicit light tokens; manual only; Light/System one-time mapping; mask logo; dynamic favicon with static fallback; contrast tests | none |
| 4a | Engine core: schema, triggers, RLS, operation API and RPC, evaluation engine (rollups, formulas), PGlite tests | **M2** |
| 4b | Engine UI: Databases navigation and contextual list (incl. collapsed), table view, record pages, property editor, filters/sorts/grouping, saved views, URL deep links | none |
| 4c | Board and gallery views; template system | none |
| 5 | Templates: Goals, Projects, Tasks, Resources, Workspaces, Progress Updates, Milestones, Metrics; dual progress; dependencies; progress history; Goal pages | **M3** (+ optional calendar-link trigger extension) |
| 6 | Workspace dashboards: widgets bound to saved views, contextual filters, grid layout, inline edits, writing Workspaces untouched | **M4** |
| 7 | Full regression (spec §15 matrix adapted), accessibility on 11 themes, mobile, keyboard, docs and rollback notes | none |

Migrations: **M1** `account_preferences`, `test_profiles` (unique primary per account, active pointer ownership check). **M2** engine core tables and RPC. **M3** template-specific validation rules and progress history support. **M4** `db_widgets` (layout, size, view reference, contextual filter, display config). Each migration is reviewed with the owner, tested on local Supabase first, then applied to production only with explicit approval. All are additive.

## 7. Known limitations to state honestly

- The formula language will be a defined subset (arithmetic, comparisons, logic, text, dates, `prop()`, rollup helpers, progress functions), not full Notion formula parity.
- Calendar and timeline views of engine databases come after table/board/gallery.
- Legacy collections remain on their current table/board implementation until integration; that is a temporary second view implementation by design.
- The logo source is a 1254 px raster; the original vector file is an open asset request.
