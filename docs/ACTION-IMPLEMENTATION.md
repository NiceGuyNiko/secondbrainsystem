# All About Action implementation — 14 October 2026

Base: `feature/pr11-ui-sidebar` at `02236418c85bf260156dff03fb346ec6477f9fd3`.

The Claude handoff is the baseline. The newer system architecture adds the writing/planning workflow; V5 governs calendar interaction; the appearance document supersedes V5's example blue/charcoal colours. Existing auth, event creation, recurrence, exceptions, category persistence, and thought services are retained. No sample story records are inserted.

## Implemented in code

| Specification | Implementation |
| --- | --- |
| Appearance | Permanent Settings → Appearance; all five previews including Black & Gold; live token engine; custom accent/highlight; flat/layered/defined surfaces; sharp/soft/rounded corners; compact/balanced/airy spacing; typography; event softening; CSS copy/reset; persisted local preferences and startup restoration. Light/system modes retained. |
| Shell | Six destinations; GO/NA/BETA labels; owner-aware possessives; fixed-height expanded/collapsed rows; saved calendars rather than hardcoded names; usable collapsed contextual controls; profile actions; mobile full-screen navigation and focus handling. |
| Month | Measured 4–6-week grid using ResizeObserver; shared ribbon lanes and per-day free-row bullet packing; continuous ribbons; hidden ribbon/bullet counts; boundary month names; protected footer; all-event day hub; existing editor entry points and drag/lock behavior. |
| The Agenda | Shared event state/recurrence; calendar-zone today; closed/overlay/pinned desktop states and full-screen phone presentation; independent 24-hour timeline; projected timed overlaps and cross-midnight events; live marker and Now; all-day section; quick task details; canonical task completion and working-page navigation. |
| Workspaces | Canonical thought extensions for workspaces, world events, characters and perspectives. Existing thoughts can acquire a capability without cloning. Nested events reuse the existing hierarchy. Explicit idea/developing/canon/superseded state. |
| Perspectives | Transactional independent owner-scoped P sequence; relevant pair creation only; repeated create returns existing pair; immutable endpoints; generated title stays current on source rename; optional moment-specific fields and author-reviewed turning points. |
| Views | Perspective Matrix queries the same records as character timelines and list views. Descendant aggregation, chronology, axis swapping, live header/page navigation, filters, 15-row/8-column pages, locally saved matrix choices. Archived records remain stored. |
| Planning | Outcome/milestone goals; numerical measurements separate from task checkoffs; projects and first thoughts; tasks linked to working pages, goals, projects and workspaces; scenes with independent manuscript order/status; source connections use existing canonical thought edges. |
| Execution | Attach a canonical task to a new or existing calendar block. The Agenda resolves completion from that task and opens its working page. Legacy inline event tasks keep their existing saved payload mutation. One task can be reused in multiple sessions. |

Core files: `app/page.tsx`, `components/calendar-workspace.tsx`, the four new UI components, and `lib/appearance.ts`, `lib/calendar-layout.ts`, `lib/planning.ts`. The existing `ThoughtWorkspace` supplies full block editing, collections, references, source links and backlinks.

## Database review and activation — NOT APPLIED LIVE

Read-only audit of `rpjeqbbvocgwomiavxqh` found `user_items` but no `thought_details`, `thought_memberships`, `thought_connections` or `planning_records` on 14 October 2026. The development preview shares the existing live database.

Approval is required by the supplied handoff before installing:

1. `supabase/migrations/20261014030325_thought_workspace.sql` — previously pending thought extension.
2. `supabase/migrations/20261014235844_action_workspace.sql` — planning extension, owner counters, RPCs, task endpoint validation and generated titles.

The second migration preserves existing `user_items` and calendar payloads. New capabilities refer to canonical thoughts; no parallel writable calendar is added. RLS, owner/ref-kind validation, immutable identifiers, foreign keys, uniqueness and optimistic version checks are enforced in Postgres. RPCs use security invoker and explicit authenticated grants. No credentials or secret keys are added.

Before activation, snapshot the database and review grants/advisors against the real project. Apply both in order through the normal migration mechanism after explicit approval. Verify existing calendar/auth first, then a disposable authenticated test account. No schema-dependent creation should be claimed usable until installed. The UI disables workspace creation after a missing-schema load error; existing calendar operations remain on their original store.

Rollback: prefer rolling back the application commit without removing data. Before any SQL rollback, export new records and their relationships. Do not automatically drop thought tables or remove canonical `user_items`; their content is authored data. The isolated tests verify transactional rollback, not permission to remove live data.

## Validation

- `npm test`: 7 passing cases, including isolated Postgres tests covering both migrations, ownership, cross-workspace endpoints, permanent sequence IDs, duplicate pair creation, source rename, archived endpoint retention, canonical task links, stale task/page updates, actual measurement separation, transaction rollback and preservation of existing thoughts.
- `npm run typecheck`: passed.
- `npm run build`: passed (Next.js 15).
- `npm run lint`: no errors; remaining warnings are in pre-existing calendar/auth/config code.
- Live site inspected: sign-in page only. No authenticated browser session was available. Authenticated desktop/mobile visual and end-to-end checks have NOT been completed.
- No live migration, import, production test data, main-branch merge or production deployment was performed by this change.

## Explicit remaining scope

- General arbitrary collection × collection matrices remain a separate design decision: the handoff explicitly leaves cell cardinality, uniqueness, source view semantics and archive policy unconfirmed. This release implements the later confirmed Events × Characters → Perspectives model, not an invented universal intersection schema.
- No Notion workspace/export was supplied or accessed. Import inventory, dry-run mapping, provenance registry, idempotent import and conflict handling need the real source data and the separate import approval described in the handoff.
- Domain-specific workout/recipe session logging, external calendar providers, formula/rollup parity, collaboration, advanced editor drag/undo and AI narrative suggestions were described as later/open features and are not represented as completed.
- Appearance and matrix preferences currently persist in this browser. Account-synced preference storage is a later extension; the specification allows local fallback.
- Realtime updates depend on the project's table publication configuration. Calendar retains its existing realtime/focus refresh. Planning refreshes on mutations and window focus; authenticated multi-tab testing remains part of activation.
- Viewport, 200% zoom, keyboard focus, screen-reader, time-zone/DST and recurrence-creation regression flows require authenticated browser validation before release to production.
