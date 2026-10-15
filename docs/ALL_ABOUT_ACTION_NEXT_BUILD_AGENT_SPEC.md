# All About Action — Next Build: Agent Implementation Specification

> **Owner decisions, 15 October 2026 — read `docs/NEXT-BUILD-PLAN.md` first.** Legacy content migration (§13 items 3–5, §0.12 backfill) is deferred to a later build: existing Goals, Projects, Tasks, Resources and writing Workspaces are not converted. Goals/Projects/Tasks/Resources/Workspaces/Progress Updates are built as templates on a new generic database engine. All seven existing dark themes are kept (not four). The Test Profiles beta switch is account-level. Where this document conflicts with `NEXT-BUILD-PLAN.md`, the plan wins.


**Status:** Approved product direction; implementation specification  
**Prepared:** 2026-10-14  
**App reference:** https://secondbrainsystem.vercel.app  
**Scope:** Database navigation, Goals framework, Task relationships, Notion-style database UI, Workspace widgets, Developer Mode, Beta Features, Test Profiles, adaptive branding, Appearance, and regression fixes.  
**Audience:** Software development agent working in the existing All About Action repository.

> **Agent mission:** Implement the features in this document within the existing application, preserving working Calendar, Fluid Calendar, Think About It, Agenda, account data, and present-day navigation conventions. Deliver functioning, persisted, accessible features—not mockups or disconnected placeholder pages. Begin by inspecting the actual repository, data model, current UI, and available assets. This specification establishes product behavior; adapt file paths and library choices to the actual stack rather than inventing a new stack.

---

## 0. Non-negotiable product decisions

1. **One canonical Goals database.** Vision Goals and Project Goals are records in the same underlying collection, distinguished by `goal_type`.
2. **Many-to-many goal support.** Any Project Goal can support multiple Vision Goals, and any Vision Goal can receive support from multiple Project Goals. Ownership by a Project is separate from these support relationships.
3. **Dual Vision progress.** **Outcome Progress is primary** and **Supporting Progress is secondary**. They are separate metrics and must never be blended into an arbitrary combined percentage.
4. **Databases hold information; Workspaces present it.** A Workspace is a configurable dashboard of widgets representing saved database views/relational views. Editing a widget's data edits the original record.
5. **Tasks are reusable records.** Tasks may relate to multiple Goals, other Tasks, Resources, Projects, and Calendar Blocks without duplication.
6. **Rework left navigation.** Remove standalone primary-nav entries for Goals, Workspaces, and Resources. Introduce **Databases** in primary navigation; when selected, the lower/contextual sidebar area (analogous to the existing per-calendar list) shows available user-facing databases.
7. **Developer Mode is a master visibility gate.** Disabling it does not erase beta-feature settings or underlying data.
8. **Test Profiles are configurations, not accounts.** All profiles for a signed-in user share the same Goals, Projects, Tasks, Calendar events, Resources, and Workspaces.
9. **Themes are manually selected.** Never switch them automatically due to OS preference, time of day, or an inferred matching light/dark variant.
10. **Logo adapts to the active theme; theme does not adapt to the logo.** Preserve the original logo geometry and recognizability.
11. **Preserve The Agenda.** The right panel retains its existing dock/pin/overlay semantics and day-only timeline behavior; database and goal page navigation must not reset those preferences.
12. **No destructive migration or silent data loss.** Keep legacy data until its migration and references are verified.

### Out of scope for this build unless already implemented

- Rebuilding the Calendar engine or replacing the current application shell.
- A generic unrestricted multi-level graph of Goal-to-Goal rollups; V1 progress-bearing support links are **Project Goal → Vision Goal** only.
- Treating every thought or resource as confirmed story canon, a Goal, or a Task.
- True multi-user accounts/permission roles for Test Profiles.
- Arbitrary code execution, custom formulas authored by end users, or background jobs unless already available and appropriate.

---

## 1. Discovery / preparation (required before modifying code)

Inspect and document:

- Framework, routing, component hierarchy, state-management pattern, styling/theme tokens, persistence/back end, authentication, database schema and migration tooling.
- Current Calendar page, left sidebar including lower contextual panel and collapsed mode, Settings pages, developer controls, existing beta flags, profile section, Agenda/pin state, mobile layout, and current Goals/Workspaces/Resources placeholders.
- Logo source assets (SVG preferred), icon usage, favicon, static brand files, theme definitions, and currently used dark themes.
- Existing records, tables, user preferences, local/session storage, database authorization/RLS policy, and feature toggles.
- Existing reusable table/record editor/view components. Reuse compatible components rather than shipping parallel implementations.

**Do not claim exact existing routes, database tables, file names, or framework conventions until verified in the repository.** The SQL-oriented schema below is a recommended logical design. If the app already uses PostgreSQL/Supabase, implement compatible migrations, queries, authorization, and types. If not, translate the same constraints to the actual persistence layer.

Before making schema changes: back up/export representative existing data, produce a migration plan, and record where new and existing features are gated. Treat the screenshots provided in the project conversation as visual reference; the live website is a reference, not evidence of inaccessible source code.

---

## 2. Navigation and user-facing database model

### 2.1 Primary navigation

Retain Calendar and other current navigational features as applicable. Replace standalone **Goals**, **Workspaces**, **Resources** entries with one top-level **Databases** entry. Fluid Calendar and Think About It remain gated by their beta flags.

**On selecting Databases:**

- The main content area opens the last-used database or a simple database landing page.
- The **lower contextual portion of the sidebar** (the same general region currently used for the `Calendars` list in Calendar mode) changes to a `Databases` list. Do **not** force every database into the upper primary-navigation menu.
- The list initially contains **Goals, Projects, Tasks, Resources, Workspaces, Progress Updates**, with recognizable icons. Support listing additional user databases when the existing system supports them.
- Selecting a database opens its Notion-like table/view interface in the main area. Show the selected item clearly.
- Keep an add/manage control for database creation where supported. Creating an additional general-purpose database must not imply automatically creating an app-level module.
- When the sidebar is collapsed, **do not hide the contextual section**: retain icon-based accessible shortcuts and tooltips for calendars or databases as appropriate.
- Calendar mode continues to show its own calendars with visibility toggles. The Databases mode shows databases, not calendar-visibility switches.
- Preserve existing GO, NA, and blue BETA badge styling/meaning. Do not mark completed features with a misleading badge.

### 2.2 Database view system

Users should be able to:

- Open a database; add/edit/archive records; open a row as a rich editable page.
- Use saved views, with at least **table view** implemented for all new canonical databases. Support board/gallery/timeline where existing infrastructure makes them safe to reuse; do not present inert controls for unimplemented layouts.
- Configure displayed properties, sort order, filters, optional grouping, and view names.
- Open relations through linked-record selectors; render friendly record titles instead of raw IDs.
- Use a relation's inverse view automatically: linking A to B makes B show the relation to A.
- See accurate loading, empty, unsaved, and error states; perform optimistic updates only with rollback/error handling.
- Switch between views without changing the canonical database contents.

**Initial Goals saved views:** All Goals, Vision Goals, Project Goals, Active Goals, Achieved Goals. The filters operate over **one Goals database**, not duplicate tables. Resources remain living, editable, related knowledge records, not static file attachments only.

---

## 3. Canonical schema and relationships

### 3.1 Logical relationships

```text
PROJECTS (1) ────── (many) PROJECT GOALS in GOALS
                            │
                            │ via GOAL_SUPPORT_LINKS (many-to-many)
                            ▼
                       VISION GOALS in GOALS

TASKS (many) ── TASK_GOAL_LINKS ── GOALS (many)
TASKS (many) ── TASK_DEPENDENCIES ── TASKS (many)
TASKS (1) ───── (many) CALENDAR BLOCK links / execution sessions
GOALS (1) ───── (many) GOAL_METRICS / GOAL_MILESTONES / PROGRESS_UPDATES
WORKSPACES (1) ─ (many) WORKSPACE_WIDGETS ── SAVED_DATABASE_VIEWS
```

Use UUIDs or the project's existing durable ID convention for primary keys. Stable IDs must survive rename, reordering, archived records, and profile switches.

### 3.2 `goals` (one table for both kinds)

| Column | Type / values | Behavior |
|---|---|---|
| `id` | Primary key | Immutable identity |
| `account_id` / existing tenant key | FK | Data ownership per signed-in account; match current auth architecture |
| `title` | Nonempty text | Editable name |
| `goal_type` | `vision`, `project` | Type discriminator |
| `description` | Rich text / app-supported blocks | Flexible supporting content |
| `success_criteria` | Rich text | Clear definition of achieved |
| `status` | `draft`, `planned`, `active`, `paused`, `achieved`, `cancelled` | Status distinct from percent |
| `project_id` | Nullable FK to `projects` | **Required iff** `goal_type = project`; null for Vision Goals |
| `outcome_method` | `metric`, `milestone`, `task`, `manual`, nullable | One authoritative outcome method |
| `manual_outcome_pct` | Decimal 0..100, nullable | Used in Manual mode only |
| `start_date` | Date, optional | Planning |
| `target_date` | Date, optional | Planning |
| `achieved_at` | Timestamp, nullable | Explicit achievement event |
| `created_at`, `updated_at`, `archived_at` | Timestamps | History / soft deletion |

Do **not** store separately editable `outcome_pct` and `supporting_pct` values. Compute these deterministically from canonical source data. A cached/materialized projection is acceptable for performance only if invalidation, rebuild, and consistency are addressed.

### 3.3 `goal_support_links` (the many-to-many core)

| Column | Meaning |
|---|---|
| `id` | Stable relationship ID |
| `project_goal_id` | FK to a `goals` record of type `project` |
| `vision_goal_id` | FK to a `goals` record of type `vision` |
| `weight` | Positive finite decimal; default `1` |
| `enabled` | Boolean, default true; determines inclusion in rollup |
| `created_at`, `updated_at` | Audit data |

**Constraints:** unique (`project_goal_id`, `vision_goal_id`); goal types enforced in service/DB trigger or equivalent; both goals must belong to the same signed-in account/tenant; neither link endpoint can be the same record. Unlinking should remove/deactivate the relationship, **not** delete either goal. Use `weight` as relative importance *within the receiving Vision Goal*, not as a globally partitioned allocation.

Display a normalized `Contribution Share` field in the UI: `weight / sum(enabled weights for this Vision Goal) × 100%`. Edits may use numeric weights with an explanatory preview. For V1, project→vision is the only relationship that changes Supporting Progress. Additional 'related to' or 'depends on' connections, if implemented, are informational and must not silently enter rollups.

### 3.4 `goal_metrics`

- Primary key, `goal_id` FK, title/label, `baseline`, `current_value`, `target_value`, `unit`, `direction` (`increase`/`decrease`), timestamps.
- For V1, one metric is designated primary for `outcome_method=metric`; multiple supplemental metrics may be displayed without automatically blending percentages.
- Validate finite numeric values and nonzero baseline-to-target distance. Preserve decimal precision for storage and calculations.
- Metric measurements should be traceable to progress updates where feasible.

### 3.5 `goal_milestones`

- `id`, `goal_id`, `title`, `description`, `weight` (positive), `status` (planned/in_progress/completed), optional `due_date`, timestamps.
- For `outcome_method=milestone`, completed milestones contribute their normalized relative weights. Support marking milestones complete and reversing completion with history.
- Do not assume milestone completion means the Goal status should become `achieved` automatically.

### 3.6 `task_goal_links`

- `id`, `task_id`, `goal_id`, `relationship_role` (e.g., supports / required), `counts_toward_progress` boolean, `weight` positive decimal with default `1`, optional `milestone_id`, timestamps.
- Unique pairing for the same Task, Goal, and contribution role; do not insert duplicates from different UI surfaces.
- A Task may support multiple Goals. **Only links opted into direct Task-based Outcome Progress count in that Goal's task calculation.** Informational/task lists may show other linked Tasks.
- Show indirect Tasks from supporting Project Goals on a Vision page with a distinguishable provenance label, rather than creating new direct links automatically.
- Prevent double credit: for Vision Supporting Progress, consume each linked **Project Goal's Outcome Progress** once per support link. Do **not** separately add all of that Project Goal's Tasks again.

### 3.7 `task_dependencies`

- `id`, `prerequisite_task_id`, `dependent_task_id`, timestamps.
- No self-dependencies, duplicate edges, or cycles. Cross-Project dependencies are allowed. Clearly identify blocked/dependent tasks and detect broken/archived dependencies.
- Subtasks/parent-task composition should use a separate parent relation if already supported; do not mislabel subtasks as dependencies.

### 3.8 `progress_updates`

- `id`, `goal_id`, `event_group_id`, `source_type`, `source_id`, `change_kind`, `outcome_before`, `outcome_after`, `supporting_before`, `supporting_after`, `reason`, `actor_id`, `created_at`.
- Distinguish **work/result progress**, **plan/target/weight adjustment**, **status change**, and **manual override**.
- One source action (e.g., Task completion) should receive one stable `event_group_id`; group affected Project/ Vision Goal history entries under that event.
- Preserve historical values and explanations. Implement idempotency safeguards to prevent duplicate history rows on network retry.
- Do not retroactively rewrite old progress-update values after weights or formulas change.

### 3.9 Existing entities to integrate, not duplicate

- **Projects:** one Project has many Project Goals; Project may be related to Workspaces and Resources.
- **Tasks:** one canonical Task with owning Project (if relevant), optional subtasks/dependencies, multi-goal links, and scheduling/execution associations.
- **Resources / Think About It:** reusable records and thoughts may be linked to Goals, Tasks, and Workspaces without turning every thought into a goal or making tentative material canon.
- **Calendar Blocks:** schedule Tasks/work sessions, preserve execution results and current calendar behavior. A completed work session should not automatically complete the Task unless existing explicit behavior says so.
- **Workspaces:** persistent records that host widgets and curated linked database views.

### 3.10 `saved_database_views`, `workspaces`, and `workspace_widgets`

Suggested minimum:

```text
saved_database_views: id, account_id, source_database,
  name, layout_type, filters_json, sorts_json,
  visible_properties_json, group_config_json, created_at, updated_at

workspaces: id, account_id, title, description,
  optional_project_id, created_at, updated_at, archived_at

workspace_widgets: id, workspace_id, saved_view_id,
  widget_type, title_override, position_json, size_json,
  contextual_filter_json, display_config_json,
  created_at, updated_at
```

A widget references a database view/query. It must **not** copy source Goal/Task/Resource records into widget-specific state. Apply authorization to all loaded/edited records, including filtered relations.

---
## 4. Progress engine: precise behavior

### 4.1 One authoritative Outcome method per Goal

An Outcome Progress value is either a percentage from 0 through 100 inclusive, or **unconfigured/invalid** (represented as null/status, never misrepresented as zero).

1. **Metric:** for `direction=increase`, `clamp(100 × (current - baseline) / (target - baseline), 0, 100)` when `target > baseline`; for `direction=decrease`, `clamp(100 × (baseline - current) / (baseline - target), 0, 100)` when `target < baseline`. Invalid configurations show a fixable setup error.
2. **Milestone:** `100 × sum(weights of completed milestones) / sum(weights of all included milestones)`. No included milestones ⇒ Not configured.
3. **Task:** `100 × sum(weights of completed contributing Tasks) / sum(weights of all contributing Tasks)`. No included Tasks ⇒ Not configured. Weight is per Task–Goal link, not the global weight of the Task.
4. **Manual:** use validated `manual_outcome_pct`; changes request optional explanatory reason and create a progress update.

**V1 behavior:** one designated primary outcome method, not blended method scores. Other stats can appear on the Goal page without changing the authoritative percentage. Tasks can count as complete only through the app's actual Task completion status, not merely a scheduled Calendar Block or work-session record.

### 4.2 Vision Supporting Progress

For Vision Goal `V`, with enabled Project Goal links `i`:

```text
supporting_progress(V) =
  SUM(link_weight_i * outcome_progress(project_goal_i))
  / SUM(link_weight_i)
```

All input Outcome Progress values are percentages in the 0–100 range. Compute at full precision; round only for UI. **Do not compute Supporting Progress when an enabled source Project Goal has missing/invalid Outcome Progress**; instead show `Incomplete setup` and identify the offending source record. No enabled links ⇒ `No supporting goals` (not `0%`).

**Examples:**

| Vision Goal | Linked Project Goal | Source progress | Weight | Weighted contribution |
|---|---|---:|---:|---:|
| Publish Nobody Special | Finish Book 1 draft | 40% | 60 | 24 pts |
| Publish Nobody Special | Finish Book 1 outline | 80% | 40 | 32 pts |
| **Vision result** | | | | **Supporting: 56%** |
| Become an established novelist | Finish Book 1 draft | 40% | 30 | 12 pts |
| Become an established novelist | Build writing routine | 50% | 70 | 35 pts |
| **Vision result** | | | | **Supporting: 47%** |

The Book 1 draft is **one record**, and contributes to both Vision Goals. Updating its Outcome Progress triggers recomputation of both Vision Goals' Supporting Progress.

### 4.3 No blending of dual progress

For Vision Goals:

- **Primary:** Outcome Progress, which measures achievement of the Vision Goal's success criteria (e.g., `0 of 1 books published = 0%`).
- **Secondary:** Supporting Progress, which measures weighted progress of connected Project Goals (e.g., `56%`).
- Both percentages are displayed simultaneously where space permits. Compact widgets show Outcome first and Supporting second (never replace them with a mixed score).
- A Vision Goal with no configured outcome shows **Outcome: Not configured** even if Supporting Progress exists. Do not silently promote Supporting Progress to Outcome Progress in V1.
- Hitting 100% on either percentage does **not** automatically mark the record `achieved`. Achievement is an explicit confirmation against `success_criteria` and records `achieved_at`. A UI suggestion to confirm is appropriate.
- Status, dates, notes, and progress are separate concepts.

### 4.4 Propagation and consistency

```text
User updates task / milestone / metric / manual score
  → persist source change
  → recompute directly impacted Goal Outcome Progress
  → find enabled goal_support_links using that Project Goal
  → recompute Supporting Progress for each receiving Vision Goal
  → write grouped progress_updates only for meaningful changes
  → invalidate/refetch affected Goals, database views, and Workspace widgets
```

Make recalculation deterministic and idempotent; use transactions or equivalent for related writes. Prevent stale overwrites on concurrent edits. Support a reconciliation/rebuild pass for cached progress. For V1, do not recurse Vision-to-Vision, avoiding circular aggregation. Informational relationships never trigger progress propagation.

For edits to a **weight, target, milestone set, or included Task list**, mark historical updates as a **plan adjustment** rather than falsely attributing progress to work performed. If a measured value legitimately decreases, display the decrease and preserve the reason. Treat archived linked records according to an explicit policy—recommended V1: disable support/metric eligibility on archival only after user confirmation, preserving audit history.

---

## 5. Goal database UI and record pages

### 5.1 Goals database landing view

Render a real, editable Notion-style database—not the current placeholder Goals screen. Use the application's existing typography, selected-state treatment, layout spacing, and theme tokens.

**Header:** icon, `Goals`, view tabs/switcher, add Goal, search/filter/sort, view settings. Initial views:

- All Goals
- Vision Goals
- Project Goals
- Active Goals
- Achieved Goals

**Suggested table columns:** Name, Type, Status, Owning Project (Project Goals), Outcome Progress, Supporting Progress (Vision Goals), Target Date, Related Goals. Users may hide/reorder columns as the existing view system allows.

**New Goal flow:** add record; choose Vision or Project; enter name and status; if Project Goal, select a Project; choose Outcome Progress method; optionally add success criteria/target and related Goals. Avoid creating unusable blank Project Goals without an owning Project.

### 5.2 Goal detail page — Notion-inspired

The Goal record opens in a full main-area page or page-peek consistent with the app's existing conventions. Keep the app shell, contextual sidebar, breadcrumbs and Agenda present. Use responsive layout; scroll the page content without breaking the Agenda or sidebar.

**Header:** breadcrumb `Databases / Goals / [Goal]`, editable icon/title, goal-type pill, status, optional cover, more-menu, page-open/close controls.

**Editable properties:** status, type (with validation/relation migration warning), owning Project, outcome method, target date, success criteria, related Goals, related Tasks. Support rich page content/notes below properties.

**Vision Goal sections:**

1. **Outcome Progress (prominent):** large value and primary bar; meaningful unit/target or milestone/task method explanation; proper Not configured state.
2. **Supporting Progress (secondary):** smaller but readable bar; list contributing Project Goals, their Outcome values, editable support weights and resulting contribution shares.
3. **Supporting Project Goals** linked database view with `Add existing` and `Create Project Goal` actions; edits affect canonical links.
4. **Related Tasks** view (direct links and indirectly inherited tasks clearly labeled).
5. **Milestones / Metrics** views according to the selected Outcome method.
6. **Resources** linked records and notes.
7. **Progress History** grouped by underlying action and showing changes to Outcome and/or Supporting scores.

**Project Goal sections:**

1. **Outcome Progress** prominent, using the chosen method.
2. **Owning Project** clickable Relation property.
3. **Supports Vision Goals** linked view listing one or multiple Vision Goals with editable weight/share **in each Vision Goal's scope**.
4. **Tasks**, **Milestones/Metrics**, **Resources**, **Calendar/Execution links**, and **Progress History**.

No invented percentage for missing data. A Goal detail page should preserve edits when moving between related records and explain unsaved/failed changes.

### 5.3 Connection editing examples

- From Project Goal `Finish Book 1 draft`, select `Supports Vision Goals` → link both `Publish Nobody Special` and `Become an established novelist`.
- From either Vision Goal page, adjust weight without altering the Project Goal itself.
- Completing a Task associated with the Project Goal recomputes its progress **only if** that Goal's chosen Outcome method depends on that Task (directly or through a metric/milestone change).
- Show updated Supporting percentages immediately after persistence, on both Vision Goal pages and their widgets.

---

## 6. Workspaces as widget hubs

### 6.1 Concept and interaction

A Workspace is an editable dashboard composed of widgets referencing canonical database views and relations. The **Workspaces database** lists Workspace records; opening one launches the dashboard. A Workspace can be associated with a Project or theme but is not required to own or duplicate Goals/Tasks.

At minimum allow:

- Add, remove, rename, reorder and resize widgets; save the layout persistently.
- Select an existing saved database view or create a view while configuring a widget.
- Select filters, sorting, grouping, visible properties and contextual filters.
- Navigate from widget row/card to the original database record.
- Perform safe inline edits where supported, updating all other views from the same source.
- Distinguish empty (no matching data), missing source view, loading, and permission errors.
- Adapt widgets to desktop, narrower columns, and mobile without horizontal overflow.

**Suggested initial widgets:**

| Widget | Backing data | Presentation |
|---|---|---|
| Vision Goal Overview | Goals (`goal_type=vision`) | Dual progress cards, **Outcome on top / Supporting below** |
| Project Goal Progress | Goals (`goal_type=project`) | List/table/compact progress bars |
| Goal Contributions | `goal_support_links` joined to Goals | Linked Goal and contribution weight/share |
| Next Actions | Tasks via Goal or Project relations | Action list and completion |
| Milestone Tracker | `goal_milestones` | Weighted checklist or progress list |
| Progress History | `progress_updates` | Recent changes with source and reason |
| Database View | Any supported saved database view | Reusable table/board/etc. presentation |

**Later, not a blocker:** a Goal Relationship Map widget may visualize existing edges; it must not introduce a duplicate graph store.

### 6.2 Contextual filters

A widget may scope itself to:

- `Project = this Workspace's linked Project`.
- `Vision Goal = selected/current Vision Goal`.
- `Project Goal supports selected Vision Goal`.
- `Related Tasks of displayed Goal(s)`.

Contextual filters are live relations, not manually maintained lists. Newly linked Goals/Tasks appear without hand-editing the widget. The widget stores view and filter configuration, **not records**.

### 6.3 Sidebar and The Agenda compatibility

- Databases uses the lower contextual sidebar list; Workspaces is one user-facing database entry there.
- Collapsed sidebar retains access to the contextual database/calendar controls.
- The Agenda remains a **day-only** miniature schedule spanning 12:00 AM–11:59 PM, with current-time auto-scroll and current-time line/dot at the left; clicking a block reveals linked Task/details instead of an unrelated full edit form.
- In **Toggle** mode, pin/unpin remains visible in overlay and docked states; close records the current selected arrangement, and reopen restores it.
- In **Column** mode, Agenda stays column-style and does not show pin or close controls inconsistent with that mode.
- Never let opening a Goal page silently clear the Agenda or change its current display preference.

---

## 7. Reusable modern pill switches

Replace **binary on/off setting checkboxes** with a shared switch component:

- Rounded pill track, circular sliding thumb, obvious ON/OFF state, polished short-duration transitions.
- Uses active theme accents, readable contrast in all dark/light themes, clear focused/disabled states.
- Supports mouse, keyboard (`Space`, `Enter` as appropriate to component semantics), and touch; label activates switch.
- Implement correct `role="switch"` / `aria-checked`, explicit labels, visible focus ring, reduced-motion preference, and minimum practical tap target.
- Saves changes immediately using the existing persistence conventions; show rollback/error feedback if a save fails.
- No rerender flicker or stale active profile values.
- **Keep checkboxes** for selecting multiple items (for example, calendar visibility lists if those behave as multiselect selections).

Use this component across Developer Mode, Beta Features, and any other genuinely binary settings. Do not indiscriminately convert multiselect lists to switches.

---

## 8. Developer Mode & Beta Features Settings redesign

### Card 1 — Developer Mode

- Rounded card with title, short explanation of experimental features, and a right-aligned **Enable Developer Mode** pill switch.
- `developer_mode_enabled` is an **account-level master gate** (recommended to avoid trapping users out of profile management). Persist immediately.
- When OFF, hide beta-only nav entries and beta feature UIs. **Do not erase** the user's stored beta toggles, theme, profiles, or beta data.
- Still allow enabling Developer Mode again from Settings; don't lock the user out of Settings.

### Card 2 — Beta Features

Independent rows for:

| Feature | Badge | Control |
|---|---|---|
| Fluid Calendar | blue `BETA` | Switch |
| Think About It | blue `BETA` | Switch |
| Test Profiles | blue `BETA` | Switch |

- Keep existing blue BETA badge styling, placed immediately beside each feature name with consistent name/badge alignment.
- Align switches to the right edge across rows. Brief descriptions optional; ensure clean mobile wrapping.
- Disable these controls visually and functionally while Developer Mode is OFF; retain their stored values.
- Effective feature visibility = `developer_mode_enabled && active_profile.beta_features[feature]`.
- Fluid Calendar and Think About It nav items appear only when their effective flag is true. Do not delete or reset data when hidden.
- Test Profile management is available only when Developer Mode and active-profile Test Profiles flag are enabled. Even when that flag is off, a user with Developer Mode on can reopen Settings and re-enable it; no lockout.
- The primary profile has normal preferences and can define its own beta-feature toggles. Test profile switching restores the new profile's selected toggles.
- If the current route belongs to a beta feature being disabled, redirect to a safe available page with non-destructive feedback.

**Implementation detail:** distinguish saved preference from effective availability. Disabling the master gate must not overwrite saved `true` flags with `false`.

---

## 9. Multiple Test Profiles

### 9.1 Interaction model

Clicking the profile section at the bottom of the sidebar expands a profile menu. When Test Profiles is effectively enabled:

- List primary profile and existing test profiles, mark active profile.
- **Create:** ask for a name; initialize from current profile preferences or documented defaults.
- **Rename:** rename test profile (and optionally the primary profile's display label if existing UX supports it; never rename the underlying account).
- **Duplicate:** clone configuration only, not the user's data records.
- **Switch:** immediately load and apply the selected profile's UI preferences without signing out or reloading destructive data.
- **Delete:** confirmation required for test profiles. **Primary profile cannot be deleted.** If deleting active test profile, fall back to primary first.
- Clearly distinguish account identity from the active configuration profile.

### 9.2 Persistence schema

Recommended logical structure:

```text
account_preferences:
  account_id (PK)
  developer_mode_enabled (boolean)
  active_test_profile_id (nullable FK owned by same account)

test_profiles:
  id (PK), account_id (FK), name, is_primary (boolean)
  theme_id
  sidebar_preferences_json
  agenda_preferences_json
  calendar_display_preferences_json
  calendar_visibility_preferences_json
  beta_features_json   // fluid_calendar, think_about_it, test_profiles
  created_at, updated_at
```

Enforce **exactly one undeletable primary profile per account**; unique profile IDs; all active-profile pointers must belong to the same account; protect with current authentication/RLS. If the app already stores settings separately, migrate those settings rather than replacing them blindly. Use structured columns in place of JSON when the codebase convention or query needs justify that choice.

**Per-profile preferences must include:** selected theme, sidebar layout/collapse behavior, Agenda mode and remembered pin/dock state, Calendar display preferences, Calendar visibility selections, all three beta-feature preferences.

**Shared across profiles:** Calendar events, Task/Goal/Project/Resource/Workspace records, progress history, account identity, security permissions, and underlying data connections. **Never use `test_profile_id` as the ownership partition key for canonical app records.**

**Safety edge cases:**

- Switching to a profile where Test Profiles is OFF hides management, but Settings → Developer Mode → Beta Features remains reachable so it can be turned back on; shared data is unaffected.
- Disabling Developer Mode while a test profile is active does not delete it or change the stored active ID; profile management disappears until Developer Mode is re-enabled.
- Deleting a nonactive profile never alters currently visible data.
- Switching profiles with unsaved edits prompts appropriately or finishes safely; no silent lost changes.
- Changing account-level Developer Mode status must persist independently of any test profile.
- If active profile reference becomes invalid, safely fall back to the primary profile and report the recovery.

---
## 10. Adaptive All About Action logo

Treat the supplied emblem as a **shape-preserving adaptive brand mark**, not a permanent black-and-gold bitmap.

Requirements:

1. Locate the highest-quality original vector/transparent asset in the repository or supplied project assets. Preserve recognizable emblem geometry, line relationships, proportions, rounded-square silhouette, and negative space.
2. Prefer SVG with `currentColor`, CSS custom properties, masks, or a small set of explicit theme-compatible variants. Do **not** stretch, redraw inaccurately, or add a permanent black backing square on every theme.
3. Expose independent tokens for logo glyph, border, and optional backing surface. Gold can remain appropriate for Black & Gold and other dark palettes; light themes should use contrast-appropriate dark/colored emblem treatments.
4. Integrate with **manual active theme selection**; changing theme updates logo treatment automatically without changing the theme itself.
5. Verify expanded sidebar, collapsed sidebar, Settings, mobile header, favicon, PWA/application icon where applicable, and small-size rendering.
6. Favicon/application icon may use a purpose-designed backing for legibility at tiny sizes; it need not share the sidebar logo's exact transparent treatment.
7. If the repository has only a flattened low-resolution raster and no trustworthy vector source, **do not invent a new emblem**. Preserve the available shape, implement the safest theme-aware treatment possible, and flag the vector source as an asset blocker requiring the original file.

Visual goal: the emblem should look natively designed for each theme, not pasted onto the surrounding surface.

---

## 11. Appearance system: explicit dark and light themes

### 11.1 Theme behavior

**Settings → Appearance → Themes** must:

- Show **Dark Themes** and **Light Themes** as separate labeled groups of visual preview cards.
- Preserve/refine the existing **Forest**, **Black & Gold**, **Midnight**, and **Slate** themes using their existing handcrafted token values where available.
- Add four independently designed light themes: **Porcelain & Ink**, **Warm Linen**, **Sage Studio**, and **Blue Hour**.
- Apply the chosen theme immediately and persist `theme_id` for the active profile.
- Never derive a light preset by mathematically inverting or transforming a dark preset.
- Never auto-switch themes via OS dark-mode preference, sunrise/sunset, time, other profile's theme, or linked light/dark pairs.
- Restore each profile's explicitly stored theme when switching test profiles.
- Preserve all the existing Calendar event-color identities; adjust surrounding contrast/legibility as necessary rather than collapsing them into one theme accent.

### 11.2 Required semantic token contract

Use the application's existing token architecture if it is already equivalent; otherwise normalize to semantic tokens covering at least:

```text
app.background
sidebar.background
surface.card
surface.elevated
text.primary
text.secondary
text.muted
border.default
nav.selectedBackground
nav.selectedText
accent.primary
accent.onPrimary
interaction.hoverBackground
interaction.focusRing
floating.background       // menus, dropdowns, overlay, pop-out
switch.offTrack
logo.glyph
logo.border
logo.backing
```

Additional disabled/pressed/validation tokens may be needed. Switch ON uses the theme accent with a contrasting thumb; avoid using one fixed switch color across all themes. Existing event colors and GO / NA / blue BETA badge semantics are separate specialized tokens.

### 11.3 Purpose-designed light palette starting values

These are **explicit starter values**, not inverted dark tokens. Visual/contrast testing should inform refinements. Hex values below are a proposed implementation baseline; keep all overrides deliberate and documented.

```yaml
Porcelain & Ink:
  app.background: '#F5F7FA'
  sidebar.background: '#EBF0F5'
  surface.card: '#FFFFFF'
  surface.elevated: '#FFFFFF'
  text.primary: '#16253A'
  text.secondary: '#465970'
  text.muted: '#5F6D7A'
  border.default: '#CBD5E0'
  nav.selectedBackground: '#DFE9F3'
  nav.selectedText: '#16253A'
  accent.primary: '#244E7C'
  accent.onPrimary: '#FFFFFF'
  interaction.hoverBackground: '#EAF0F6'
  interaction.focusRing: '#2260A8'
  floating.background: '#FFFFFF'
  switch.offTrack: '#B1BFCD'
  logo.glyph: '#244E7C'
  logo.border: '#7D93AA'
  logo.backing: transparent

Warm Linen:
  app.background: '#F8F5EF'
  sidebar.background: '#F0EADC'
  surface.card: '#FFFDF8'
  surface.elevated: '#FFFFFC'
  text.primary: '#322A20'
  text.secondary: '#65594B'
  text.muted: '#746958'
  border.default: '#D9CEBD'
  nav.selectedBackground: '#EAE0C9'
  nav.selectedText: '#322A20'
  accent.primary: '#80602E'
  accent.onPrimary: '#FFFFFF'
  interaction.hoverBackground: '#F1E8D9'
  interaction.focusRing: '#805621'
  floating.background: '#FFFBF2'
  switch.offTrack: '#B8AA96'
  logo.glyph: '#77562A'
  logo.border: '#A78C67'
  logo.backing: transparent

Sage Studio:
  app.background: '#F5F7F1'
  sidebar.background: '#E8EDE4'
  surface.card: '#FFFFFB'
  surface.elevated: '#FFFFFF'
  text.primary: '#20352B'
  text.secondary: '#4A6155'
  text.muted: '#667669'
  border.default: '#C7D4C7'
  nav.selectedBackground: '#DBE8DA'
  nav.selectedText: '#20352B'
  accent.primary: '#285C45'
  accent.onPrimary: '#FFFFFF'
  interaction.hoverBackground: '#E8F0E5'
  interaction.focusRing: '#246E50'
  floating.background: '#FCFDF9'
  switch.offTrack: '#A9BAAD'
  logo.glyph: '#285C45'
  logo.border: '#83A08A'
  logo.backing: transparent

Blue Hour:
  app.background: '#F3F7FB'
  sidebar.background: '#E6EFF7'
  surface.card: '#FFFFFF'
  surface.elevated: '#FFFFFF'
  text.primary: '#172C43'
  text.secondary: '#496176'
  text.muted: '#60768A'
  border.default: '#C6D6E5'
  nav.selectedBackground: '#D9E9F8'
  nav.selectedText: '#172C43'
  accent.primary: '#215C94'
  accent.onPrimary: '#FFFFFF'
  interaction.hoverBackground: '#E7F1FA'
  interaction.focusRing: '#1A6BAB'
  floating.background: '#FFFFFF'
  switch.offTrack: '#AABFD3'
  logo.glyph: '#215C94'
  logo.border: '#86A6C2'
  logo.backing: transparent
```

**Quality note:** the proposed primary/secondary/muted text colors have been selected for substantial contrast against their corresponding `surface.card` values. Actual implementation still must test every text-on-background pairing, including sidebar, selected rows, accent buttons, pop-outs, alerts, disabled controls, calendar events, and all badges. Do not treat palette tokens alone as proof of accessibility.

### 11.4 Theme quality / accessibility acceptance

- Body text and non-large labels target **WCAG AA contrast ≥ 4.5:1**; non-text UI indicators and focus/interactive outlines target **≥ 3:1** as applicable.
- Active navigation, hover, focus, pressed, disabled, selected, and error states must remain distinguishable on every theme.
- Popovers, menus, elevated surfaces, dialogs, and Settings cards must not visually disappear into their surrounding background.
- Keep GO, NA, and blue BETA badges recognizable, but verify readable text and contrast across all themes.
- Maintain Calendar event-color distinction and readable event labels.
- Verify the adaptive logo against sidebar and page surfaces on all eight named themes.
- Respect reduced-motion settings for switch/thumb and theme-transition animation. Never use rapid flashing or theme transitions that obscure state.

---

## 12. Settings, persistence, and routing state

1. Theme selection and all per-profile settings are **persisted immediately** and restored after full reload and profile switching.
2. Account-level Developer Mode state is stored separately from per-profile feature flags.
3. Effective feature gates are computed from the master flag plus active-profile preferences; don't store separate mutable effective flags.
4. Avoid stale state: when switching profile, restore theme, sidebar, Agenda, Calendar display/visibility, and beta nav coherently rather than displaying mismatched settings for a render frame.
5. If an async save fails, show understandable feedback and restore the last committed setting or mark the setting unsaved—never claim persistence without success.
6. Maintain stable browser history and deep links for Goal records and database views as supported by existing routing.
7. Preserve the currently selected Database and its view when opening/closing records. Preserve The Agenda across these transitions.
8. Apply profile preferences only to UI/configuration state. They do **not** filter or delete shared app records except through explicit visibility preferences (for example, hiding a Calendar from view must not delete its events).

---
## 13. Migration and data safety

The app may already contain experimental Goals, Workspaces, Resources, Settings, beta flags, and calendar preferences. An agent must **inspect them first** and implement forward-compatible, reversible changes.

### Required migration approach

1. Inventory existing tables, models, client storage keys, defaults, routes, views, and record links. Document which fields will be reused, transformed, or left intact.
2. Make additive schema changes first; create constraints/indexes after existing data has been validated or cleaned in a controlled migration.
3. Backfill existing Goal data into the unified `goals` model without duplicating it. Preserve original source IDs/mappings where migration requires new IDs.
4. Move prior single-parent goal relationships into `goal_support_links` with default weight `1`, preserving prior associations. Do not infer unknown associations.
5. Carry over existing Task–Goal associations and make idempotent link inserts. Preserve Task and Calendar event identities.
6. Backfill the primary Test Profile from existing user settings **before** switching the UI to profile-scoped storage; keep original settings until verified.
7. Preserve existing dark-theme tokens, event category colors, sidebar behavior, and beta feature data.
8. Ensure users can load existing deep links/routes or receive a deliberate non-destructive redirect.
9. Add proper auth/RLS or equivalent permissions to every new table and query. Explicitly prevent cross-account access through guessed relation IDs.
10. Test migration against realistic seeded/representative data and provide a rollback/recovery strategy.

**Never:** drop live tables without signoff; overwrite accounts or records to manufacture sample data; delete beta data when a feature is disabled; convert shared app data into duplicated per-profile data; mark unimplemented features as fully operational.

### Suggested indexes and invariants

- `goals(account_id, goal_type, status)` and `goals(project_id)` as supported by actual query patterns.
- `goal_support_links(vision_goal_id)` and `(project_goal_id)` plus a unique pair index.
- `task_goal_links(goal_id)` and `(task_id)` plus the appropriate uniqueness constraint.
- `task_dependencies(dependent_task_id)` and `(prerequisite_task_id)` plus cycle prevention in application/service layer.
- `progress_updates(goal_id, created_at)` and `(event_group_id)`.
- `workspace_widgets(workspace_id)` and `test_profiles(account_id)`.
- A unique primary Test Profile per account; active profile belongs to the current account.

---

## 14. Unified build sequence

Maintain working checkpoints with reviewable commits/PRs. The Settings phases below follow the requested order; the relational Goals work can proceed in a separate feature branch/workstream where dependencies permit. Merge and verify through the final app shell rather than leaving competing implementations.

### Phase 0 — Audit and baseline

- [ ] Inspect codebase, data model, routing, UI/Settings, brand assets, theme registry, current beta flags and profile storage.
- [ ] Save screenshots/record behaviors for current Calendar, collapsed sidebar, Agenda, Settings, and mobile.
- [ ] Document feature dependencies, migration plan, data backup/recovery strategy, and acceptance-test fixtures.

### Phase 1 — Settings Controls

- [ ] Build accessible reusable pill-switch component with theme tokens and persistence handling.
- [ ] Separate Settings into **Developer Mode** and **Beta Features** rounded cards.
- [ ] Add independent Fluid Calendar, Think About It, Test Profiles switches; preserve blue BETA badges adjacent to names and right-aligned switches.
- [ ] Implement master Developer Mode gate without deleting stored preferences or data.
- [ ] Verify existing multiselect checkboxes are not accidentally changed.

### Phase 2 — Test Profiles

- [ ] Add bottom-sidebar expandable profile menu.
- [ ] Create, rename, duplicate, switch, confirm-delete test profiles; protect primary.
- [ ] Store/restore profile-specific theme, sidebar, Agenda, Calendar display/visibility, and beta feature preferences.
- [ ] Confirm switching changes presentation only; app records remain shared.
- [ ] Handle profile switching, disabled flag, current route, active-profile deletion, and save failures safely.

### Phase 3 — Adaptive Branding

- [ ] Locate and preserve best available source logo asset; request original if insufficient.
- [ ] Implement adaptive SVG/transparent/mask-based treatment with theme glyph/border/backing tokens.
- [ ] Integrate in expanded/collapsed sidebar, favicon/app icon, mobile header, and other existing locations.
- [ ] Verify visual contrast at small and normal sizes; no forced black square on light themes.

### Phase 4 — Appearance

- [ ] Preserve and refine Forest, Black & Gold, Midnight, Slate without automatic inversion.
- [ ] Add independent Porcelain & Ink, Warm Linen, Sage Studio, Blue Hour light palettes.
- [ ] Provide separate Dark / Light theme preview groups in Settings → Appearance.
- [ ] Make selection manual-only and immediate; persist on active profile.
- [ ] Confirm theme and adaptive logo update without theme auto-switching.
- [ ] Validate text, events, badges, popovers, menus, focus states, and mobile presentation.

### Phase 5 — Relational databases & navigation

- [ ] Implement unified Goals table/record semantics and supporting link/metric/milestone/history structures.
- [ ] Integrate Projects, Tasks, Resources, and existing Calendar records without duplication.
- [ ] Replace three standalone nav entries with **Databases** and a Calendar-like lower contextual database list.
- [ ] Preserve collapsed sidebar contextual controls.
- [ ] Implement user-facing database table interface and initial Goals saved views.
- [ ] Confirm migrations and auth/permission constraints.

### Phase 6 — Progress engine & Goal page

- [ ] Implement Metric/Milestone/Task/Manual Outcome calculations and invalid/empty handling.
- [ ] Implement many-to-many support links, normalized contribution weights, and independent Vision Supporting Progress.
- [ ] Implement Task-to-Goal links and cycle-safe Task dependencies.
- [ ] Recalculate affected recipients and create grouped explanatory progress history.
- [ ] Build Notion-style Goal detail pages with interactive relation properties and dual progress UI.
- [ ] Ensure status `achieved` requires confirmation/criteria rather than automatic percent threshold.

### Phase 7 — Workspace widgets

- [ ] Implement Workspace records and widget layout configuration.
- [ ] Add Vision Goal dual-progress, Project Goals, related Tasks, Milestones, Contribution, History, and reusable Database View widgets.
- [ ] Implement contextual relational filters and persist layout/view settings.
- [ ] Make appropriate inline edits write through to canonical records.
- [ ] Validate responsive layout and Agenda coexistence.

### Phase 8 — Full regression, migration validation & handoff

- [ ] End-to-end Settings / Test Profiles / Appearance / branding acceptance tests.
- [ ] End-to-end many-to-many Goals / Task relations / progress calculations tests.
- [ ] Validate Calendar, Fluid Calendar, Think About It, sidebar/Agenda behavior, Resources, existing data, and routing.
- [ ] Verify accessibility and mobile behavior on all eight themes.
- [ ] Run typecheck, lint, unit/integration/E2E tests, and production build where supported.
- [ ] Provide migration notes, test results, screenshots, any remaining blockers, and clear instructions for running and reviewing changes.

---

## 15. Mandatory QA test matrix

| ID | Scenario | Expected result |
|---|---|---|
| G01 | Project Goal P linked to Vision A and Vision B | One P record, two unique support links; both Visions show P |
| G02 | Set P Outcome to 40%; other contributing goals set to 80%/50% with sample weights | Vision A Supporting = **56%**; Vision B Supporting = **47%** |
| G03 | Edit P Outcome to 60% | Both linked Vision support calculations update; neither Vision Outcome changes |
| G04 | Change P's weight in Vision A | Only Vision A support score changes; Vision B unchanged |
| G05 | Vision Outcome 0 of 1 published; Supporting 56% | Show **Outcome 0% primary**, **Supporting 56% secondary** |
| G06 | All supporting projects complete but Vision success criteria not yet met | Supporting 100%; Vision status stays unachieved pending confirmation |
| G07 | New Vision with no support links | `No supporting goals`, **not** 0% |
| G08 | Outcome method missing/invalid | `Not configured` / actionable error, no fabricated 0% |
| G09 | A linked Project Goal has invalid Outcome | Supporting `Incomplete setup`; identify incomplete link, don't silently reweight |
| G10 | Task supports multiple goals | One Task record with inverse relations visible on each Goal |
| G11 | Task completed through workspace | Canonical Task updates; only configured Task-based Goal calculations recalculate |
| G12 | Task cannot start until prerequisite Task completes | Cross-project dependency shown; block logic works and rejects cycles |
| G13 | Edit target/weight after prior progress | Plan-adjustment history entry rather than misleading work-accomplishment entry |
| G14 | Open Goal from Workspace then return | Workspace, database view, sidebar, Agenda state preserved |
| G15 | Archive/unlink goal support relation | Source/target Goals survive; history preserved |
| N01 | Select Databases | Lower contextual sidebar lists user-facing databases; content shows database view |
| N02 | Collapse sidebar on Calendar / Databases | Contextual controls remain reachable by icons/tooltips |
| N03 | Switch to different database saved view | Uses canonical records; filter/sort/column choices persist |
| D01 | Disable Developer Mode while feature flags ON | Beta nav hidden/disabled; stored flags and data preserved |
| D02 | Re-enable Developer Mode | Previously selected profile beta flags restore correctly |
| D03 | Toggle Fluid Calendar alone | Only Fluid Calendar nav visibility changes; Think About It unaffected |
| D04 | Test Profiles feature disabled | Profile management unavailable; can re-enable through Settings; profiles survive |
| P01 | Create and duplicate test profile | Copies UI preferences; no event/task/goal/resource/workspace duplication |
| P02 | Rename and switch profile | Name changes and selected settings (theme/sidebar/Agenda/betas) restore |
| P03 | Delete a test profile | Confirmation appears; primary protected; shared records intact |
| P04 | Delete active test profile | Falls back to primary safely; data intact |
| P05 | Reload after profile preferences change | Saved active profile and settings persist |
| A01 | Select each of eight themes | Theme loads deliberately; no automatic light/dark switch |
| A02 | Change OS dark preference or wait for sunset | Chosen app theme remains unchanged |
| A03 | Switch between profiles with different themes | Correct manually selected theme restored per profile |
| A04 | View logo in dark/light, collapsed/sidebar/mobile/favicon | Brand geometry preserved, theme-appropriate contrast, no mandatory black backing on light UI |
| A05 | Inspect cards, dropdowns, events, switches, BETA/GO/NA badges | Readable, recognizable, with distinct focus/selected states |
| A06 | Keyboard/touch toggle and reduced-motion preference | Switch accessible, operable, and motion-respectful |
| R01 | Existing Calendar events, Resources, Workspaces, and Tasks loaded after migration | No missing, duplicated, or deleted shared records |
| R02 | Open/close Goal page with Agenda in toggle/docked states | Last pin/dock arrangement remains; Column mode unchanged |
| R03 | Authorized user tries another account's Goal/Task/Profile ID | Query/edit blocked by permissions |
| R04 | Save failure or retry during update | No false success, no duplicated links/history; safe recovery |

Automate these checks where feasible with unit tests for formulas/constraints, integration tests for persistence and transaction behavior, and E2E tests for navigation, switches, profile changes, and UI. Include at least one small-screen viewport and one keyboard-only pass.

---

## 16. Definition of done / acceptance criteria

A build is accepted **only when**:

- [ ] Goals, Projects, Tasks, Resources, Workspaces, and Progress Updates are accessible through a functional Databases mode with contextual sidebar list and Notion-style record views.
- [ ] Vision and Project Goals share one canonical model; many-to-many support links work in both directions.
- [ ] Outcome and Supporting Progress calculate correctly, appear separately, and react to updates without double-counting.
- [ ] Task relations, dependencies, Calendar association, and progress history work without duplicating canonical records.
- [ ] Workspace widgets operate on live database/relational views and persist their layout, filters, and source links.
- [ ] The Agenda, collapsed sidebar contextual controls, Calendar UI and existing functionality remain usable.
- [ ] Developer Mode and independent beta controls use accessible pill switches in two rounded cards; BETA badge alignment matches the requested design.
- [ ] Multiple Test Profiles create/rename/duplicate/switch/delete safely, preserve different UI settings, and share all underlying app data.
- [ ] The supplied logo preserves geometry and adapts correctly to each palette in all required sizes and placements.
- [ ] All **four existing dark** and **four new light** themes are explicit, polished, and manually selectable without automatic switching or inversion.
- [ ] All eight themes pass the contrast, visual, keyboard/touch, mobile, and pop-out validation requirements.
- [ ] Existing app records and beta settings survive migrations, hiding features, and profile changes.
- [ ] Migration/tests/build pass, with any remaining limitations documented truthfully.

---

## 17. Agent delivery requirements

Return, as applicable:

1. A brief **repository inventory** and differences between existing architecture and this spec.
2. The actual implemented code/configuration, migrations, types, and component changes in the user's project (not only sample snippets).
3. Seeded/demo fixtures kept clearly separate from production data, useful for checking dual progress and profile switching.
4. Unit/integration/E2E test results with commands used; evidence of all eight theme previews and critical Goal pages where screenshot testing is available.
5. Migration/backfill and rollback notes; any asset blocker (especially original logo source), infrastructure dependency, or open decision.
6. A concise changelog, routes/settings that changed, and instructions for local preview and safe deployment.

**Do not:** assert completion when functionality is mocked, ship breaking migrations unreviewed, overwrite current themes or records arbitrarily, silently hide an acceptance-test failure, or deploy to production without the project's normal approval process.

### First instruction to the implementing agent

> Inspect the existing All About Action repository and explain the current stack, data model, sidebar/Agenda state management, Settings, theme registry, and logo asset situation. Then create an implementation plan mapped to Sections 14–16, identify migration risks, and begin implementing in reviewable steps. Treat this specification as the product contract. Preserve existing user data and functionality, and ask only about genuine blockers that cannot be resolved from the repository and the defined decisions above.
