# All About Action — PRD audit and delivery record

Audited branch: `feature/pr11-ui-sidebar`, starting SHA `8a16e06cff5951377ed69e8b2499b7fd174a62f7`.

## Existing application
Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Lucide icons and supabase-js. One authenticated route (`app/page.tsx`), auth/profile components, a large custom calendar, and theme variables in `app/globals.css`. No installed editor, tests, migration history or lockfile at audit time. README was stale: calendar persistence already existed.

Supabase schema verified through read-only metadata queries: `user_items` UUID identity, `user_id default auth.uid()`, title, constrained item_type, JSONB content, timestamps; `profiles` for display names. Both have owner-scoped RLS; item UPDATE policies have USING and WITH CHECK. Calendar events use `item_type=block`, category configuration uses a resource record. No external provider synchronization observed.

Calendar supports day/week/month/fluid layouts, recurrence, series exceptions, all-day ribbons, category configuration, locks, contextual editing, batch creation, timezone conversion and date dragging. Scheduling and calendar are two existing surfaces over the same storage. Authentication was preserved. Public site inspection reached sign-in (email autofocus and password visibility button); authenticated desktop/mobile visual verification requires a signed-in browser. Current production title is still Think About It; development sidebar says All About Action.

## Architecture
Preserve user_items as canonical thought and schedule storage. Add thought_details for hierarchy/version/archive/collection configuration, thought_memberships for multi-collection participation and scoped property values, and thought_connections for typed semantic edges. Collection property definitions and saved view configurations are JSON on collection metadata; member relationships remain relational. Schedule rows link through user_items.thought_id and never copy the thought body. Timed linked schedules acquire canonical UTC instants through a trigger; all-day records retain date semantics.

User selected this extension strategy and a block editor. No collaboration or external sync added. Directed edges: supports, depends_on, inspired_by, references. Symmetric: relates_to, contradicts (canonical endpoint ordering prevents reverse duplicates). Archive retains connections/memberships/schedules; active list/views exclude archived thoughts. Removing membership retains the thought. No hard-delete thought UI. Collection conversion is transactional and keeps selected IDs; enabling collection on an existing thought retains its own ID. Collections may belong to other collections. Parent cycles are rejected under a per-user transactional advisory lock.

## Stages and changed files
1. Audit and additive schema: this document, Supabase migration, database integration tests.
2. Canonical capture/editor/nesting/archive/search: lib/thoughts.ts, components/thought-workspace.tsx.
3. Collections and typed properties, list/table/board views, saved filters/sorts/grouping, semantic links/backlinks: same service/UI files. Built-in views persist configuration on collection metadata.
4. Linked schedules with edits from both surfaces: thought UI plus calendar-workspace.tsx; existing calendar rendering/editing preserved. Event editor opens the linked thought. Thought title saves update linked event titles.
5. Navigation/style integration: app/page.tsx and globals.css; Resources opens collections, Think About It opens thoughts. Existing sidebar structure and mobile menu remain intact. New panels use the existing palette; CSS supports narrow screens and keyboard focus. package.json and lockfile add reproducible test dependencies and scripts.

## Validation and release gates
Run npm test (real Postgres through PGlite, non-owner roles and RLS); npm run typecheck; npm run lint; npm run build. Tests cover transactional conversion failure, IDs, property types/options, hierarchy cycles, stale versions, duplicate symmetric edges, backlink storage, linked schedules, UTC conversion/DST, cross-user visibility/links/schedules, member removal, and DDL rollback rehearsal. Baseline lint: 11 warnings, zero errors. Build passed before the last refinements; rerun at release.

Migration is additive. Never alter auth.users/profiles or rewrite existing calendar content. New triggers validate only linked schedules. Backfill creates metadata for existing thought rows, preserving content. Live migration is a separate release step. Verify on an isolated database before applying; archive and memberships are recoverable, hard deletion is absent. Do not drop the new schema after users have created data: disable the UI and export first. Transactional rollback rehearsal is tested, not a destructive production rollback.

## Remaining scope / limitations
Search and view querying are currently client-side over loaded thoughts; retrieval uses bounded 500-row pages and the inbox renders 50 rows at a time. Server-side content filtering remains necessary for large workspaces. Multiple custom saved view creation, visible-column customization, full rich-text marks, drag-and-drop nested editor blocks, inline event resizing, real-time conflict notifications, and E2E browser automation remain follow-up work. Version checks protect thought content, but collection configuration/value mutations do not yet use optimistic versions. Advanced exports, gallery/graph, formulas, external sync and collaboration are deferred as PRD P1/P2. Original calendar bugs and lint warnings are tracked rather than silently claimed fixed. This implementation must not be described as full PRD completion until remaining scale/performance and authenticated desktop/mobile acceptance tests pass.
