# ALL ABOUT ACTION — ANTIGRAVITY SESSION HANDOFF

> **Superseded in part (15 October 2026).** This handoff describes `main` at `fbc6cdb`. The next-build requirements in §6 were expanded by `docs/ALL_ABOUT_ACTION_NEXT_BUILD_AGENT_SPEC.md`, and the owner's decisions in `docs/NEXT-BUILD-PLAN.md` override both. In particular, settings and Test Profiles are stored in Supabase (with a browser cache), not browser storage only.


**Prepared:** 14 October 2026 (America/Toronto)  
**Purpose:** Bootstrap a *brand-new* Antigravity coding session from the latest **verified GitHub `main` build**, understand the existing application and linked services, and safely implement the next requested changes.  
**Authority order:** (1) GitHub code at the recorded commit; (2) applied Supabase metadata/migration history; (3) directly verified Vercel deployment metadata; (4) repository documentation, which may describe an older branch. A requirements section near the end describes **new work not in the verified build** and must never be mistaken for shipped functionality.

> **Do not blindly implement from this handoff.** On session start, authenticate with the user's own accounts, re-fetch GitHub `main`, confirm whether its SHA has changed, and inspect the current code. If GitHub has advanced since the snapshot below, treat this document as historical context and derive the actual baseline from the new HEAD. No secrets, passwords, service-role keys or Vercel tokens are included in this document.

---

## 1. Verified project identity and exact baseline

| System | Verified identifier / link | Meaning |
|---|---|---|
| GitHub repository | [`NiceGuyNiko/secondbrainsystem`](https://github.com/NiceGuyNiko/secondbrainsystem) | **All About Action** application; public repository |
| Clone URL | `https://github.com/NiceGuyNiko/secondbrainsystem.git` | Git checkout source |
| Default branch | `main` | Current merged baseline |
| Latest verified `main` HEAD | `fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0` | Pin source inspection to this SHA |
| Latest GitHub commit | [Commit fbc6cdb](https://github.com/NiceGuyNiko/secondbrainsystem/commit/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0) | Merged 2026-10-15 02:19:28 UTC |
| Merged PR | [#15: Branding, Settings, Ontario holidays and Agenda modes](https://github.com/NiceGuyNiko/secondbrainsystem/pull/15) | Merged into `main` |
| GitHub commit deployment status | **Vercel: success** | Corroborated by direct Vercel inspection of the production deployment. |
| Vercel deployment status target | [Vercel production deployment record](https://vercel.com/niceguyniko/secondbrainsystem/2h6UBcapq7DLbB2k9BnTfRkwM3PD) | **READY / production**; direct Vercel metadata matches the GitHub SHA on `main`. |
| Vercel project ID | `prj_8vQzqlDhnYyc5vLg4Dbm14OCqYFM` | Confirmed by the connected Vercel project. |
| Vercel account/team ID | `team_5sJprWskmkjyOs0Z7vcOIGZu` | Connected project account ID; Vercel access still requires an authorized account. |
| Production URL | https://secondbrainsystem.vercel.app | **Confirmed alias on the current production deployment**. |
| Vercel deployment ID | `dpl_2h6UBcapq7DLbB2k9BnTfRkwM3PD` | Current verified production deployment associated with commit `fbc6cdb`. |
| Deployed project runtime | `Next.js`, Vercel Node.js `24.x` | Project configuration reported by Vercel. |
| Vercel dashboard project path | `niceguyniko/secondbrainsystem` (from GitHub's Vercel status URL) | Project association indicated by the status link; verify settings in Vercel |
| Supabase project | `secondbrainsystem` | Active project observed through linked Supabase metadata |
| Supabase project ref | `rpjeqbbvocgwomiavxqh` | Project ID used for CLI/project lookup |
| Supabase dashboard | https://supabase.com/dashboard/project/rpjeqbbvocgwomiavxqh | Open while signed into the authorized Supabase account |
| Supabase API URL | `https://rpjeqbbvocgwomiavxqh.supabase.co` | Public API endpoint already used by app |
| Supabase region | `us-east-1` | Observed project metadata |
| Database | Postgres 17 | Project metadata reported engine 17; use actual live version on reconnect |

**Verified deployment relationship:** The connected Vercel project returned `READY`, `target=production`, `source=git`, `githubCommitRef=main`, and `githubCommitSha=fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0`. Its attached aliases include `secondbrainsystem.vercel.app`, `secondbrainsystem-niceguyniko.vercel.app`, and `secondbrainsystem-git-main-niceguyniko.vercel.app`. The immutable deployment URL is `https://secondbrainsystem-6jp0r89r0-niceguyniko.vercel.app`. The current source SHA and alias assignment were verified **at handoff time**; the next session must verify whether a newer deployment has replaced them. The repository's older QA file names a **historical development preview**: `https://secondbrainsystem-git-feature-pr11-ui-sidebar-niceguyniko.vercel.app/`; do not use it to validate the newest release.

### Documentation conflict to resolve correctly

`README.md`, `docs/RELEASE.md`, `docs/ACTION-IMPLEMENTATION.md`, and `docs/BROWSER-TESTING-2026-10-14.md` include instructions/status captured **before** PR #15 merged. In particular, `docs/RELEASE.md` says application code is on `feature/pr11-ui-sidebar` and not merged to main; this is stale relative to the verified current `main` HEAD. Retain their architecture, safeguards and QA evidence but **not** their earlier branch-state assertions. `docs/NEXT-BUILD-SETTINGS-AGENDA.md` describes the most recent merged implementation, including its testing limitations.

---

## 2. Connecting Antigravity to GitHub, Supabase and Vercel

Antigravity must use the authorized developer's existing account connections. This file contains names, URLs and command patterns, **not credentials**.

### GitHub — authenticate, clone, inspect, branch

1. Log in to the intended GitHub account in the Antigravity IDE/browser or authenticate Git Credential Manager / GitHub CLI as appropriate. The accessible repository owner is `NiceGuyNiko`.
2. Verify permission to clone/push and check which account is active; don't assume your environment inherited the earlier session's authentication.
3. Clone or refresh the **correct** repository:

```bash
git clone https://github.com/NiceGuyNiko/secondbrainsystem.git
cd secondbrainsystem
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git rev-parse HEAD
git status --short
```

4. Compare `git rev-parse HEAD` with `fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0`. If different, review newer commits, code and documentation before changing anything.
5. Use a fresh feature branch off the verified latest `main` (suggestion: `feature/beta-profiles-adaptive-appearance`), **not** the old `feature/pr11-ui-sidebar` branch. Confirm branch naming conventions before pushing.
6. Make small, reviewable commits and open a PR. Do **not** merge to `main` or delete data without explicit authorization from the project owner.

### Supabase — inspect existing shared project safely

1. Sign in at [Supabase dashboard](https://supabase.com/dashboard/project/rpjeqbbvocgwomiavxqh) with project access. If using Supabase CLI, authenticate interactively (`npx supabase login` or the installed CLI equivalent); never paste access tokens/database passwords into prompts or committed files.
2. Verify project `rpjeqbbvocgwomiavxqh` and confirm it is the intended project. Its reported status at handoff was `ACTIVE_HEALTHY`.
3. Source code uses `lib/supabase.ts` with `@supabase/supabase-js` and **an embedded public project URL and publishable key**. The key is *publishable*, not a service-role key. Do not treat it as privileged or replace authentication with elevated client privileges.
4. Inspect **Tables**, **Database → Migrations**, **Auth** and RLS policies *read-only* before any change. The development preview historically shared live auth/data; assume experiments can affect real users unless an isolated environment is verified.
5. If using the CLI, link only after checking the target:

```bash
# Authenticate using the operator's own secure CLI login first.
npx supabase link --project-ref rpjeqbbvocgwomiavxqh
# Inspect local migration files and remote migration history before any push.
```

6. **Never blindly run `supabase db push`, `db reset`, destructive SQL, or a migration against the shared project.** A feature that only changes frontend appearance/local test profiles may not require any database migration at all. Any schema change requires a reviewed diff, isolation tests, migration plan, backup strategy and explicit approval.

### Vercel — verify deployed commit, test preview, avoid unapproved production changes

1. Authenticate in Vercel as an authorized member of the `niceguyniko` account/team; this session does not inherit Vercel access automatically.
2. Start at the [verified production deployment](https://vercel.com/niceguyniko/secondbrainsystem/2h6UBcapq7DLbB2k9BnTfRkwM3PD), or open the project `secondbrainsystem` (`prj_8vQzqlDhnYyc5vLg4Dbm14OCqYFM`). The confirmed production deployment was `READY`, linked to `main` at `fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0`, and aliased to `https://secondbrainsystem.vercel.app`. Check again for newer deployments.
3. Inspect **Project → Settings → Git**, build/framework settings and environment variables. Connected project metadata reports **Next.js** and **Node.js 24.x**. The repository contains **no `vercel.json` and no `.github/workflows` directory** at the verified HEAD; do not invent special build commands or workflows. Environment variable names/values and build overrides were not enumerated in this handoff; inspect securely in dashboard if relevant, and never copy secret values into chat or source control.
4. For CLI use only if needed, authenticate interactively; verify organization and project before running deployment commands:

```bash
npx vercel whoami
npx vercel link
# Check actual linked project/environment before doing anything destructive.
```

5. Push the development branch and use the existing Git-connected preview workflow **after** confirming how this Vercel project is configured. If an automatic preview appears, inspect its commit SHA and test **that** URL. Avoid deploying to production or changing aliases without owner approval.
6. Environment variables, API keys, database passwords and tokens must remain in managed service settings or untracked local secrets; never paste them into this `.md` file or source-control commits.

**Vercel verification at preparation:** The Vercel integration was connected and used to inspect project `prj_8vQzqlDhnYyc5vLg4Dbm14OCqYFM`, its latest production deployment, SHA, aliases, runtime and its previous preview deployment. **Project build/environment secrets, promotion controls and a live authenticated browser walkthrough were not inspected.** The reported project configuration has SSO protection enabled for `all_except_custom_domains`, so preview/immutable deployment URLs may require authorized sign-in. Never assume a fresh Antigravity session is automatically authenticated merely because this handoff author could inspect the project.

---

## 3. Existing technology and run commands — verified from HEAD

Repository is a **Next.js 15 App Router** application using **React 19**, **TypeScript**, **Tailwind CSS 4**, **Lucide React**, **Supabase JS 2**. Tests are Node's built-in test runner via `tsx`, with isolated PostgreSQL-compatible testing support using `@electric-sql/pglite`.

From `package.json`:

```bash
# Node 20+ according to the repository README.
npm ci
npm run dev       # Next local dev server
npm test          # node --import tsx --test tests/*.test.ts
npm run typecheck # tsc --noEmit
npm run lint      # eslint .
npm run build     # next build
npm run start     # next start, after build
```

`package-lock.json` is present: use `npm ci`, not an uncontrolled dependency update, for a baseline install. The repository excludes `node_modules`, `.next`, `.env*` (other than `.env.example` if present), and `supabase/.temp/` through `.gitignore`. No `.env.example` was present in the inspected tree; do not fabricate its contents.

### Actual repository shape at commit `fbc6cdb`

```text
app/
  page.tsx                 # Main authenticated app shell, navigation, state orchestration
  layout.tsx               # Metadata, app icons, appearance state bootstrap
  globals.css              # App/theme/sidebar/calendar/Agenda styling
  icon.png, apple-icon.png
components/
  auth-gate.tsx            # Supabase auth, sign-in, profile editor
  profile-context.tsx      # Authenticated display name, email, profile/sign-out hooks
  calendar-workspace.tsx   # Calendar UI, editor, recurrence, categories, event state
  month-calendar.tsx       # Month rendering
  agenda.tsx               # Agenda UI/pin and overlay handling
  settings-workspace.tsx   # Settings sections and Developer Mode checkbox
  appearance-settings.tsx # Palette preview/customization, current mode controls
  thought-workspace.tsx    # Thoughts, collections and content UI
  planning-workspace.tsx   # Goals, tasks, workspaces, event/character perspectives
lib/
  supabase.ts              # Public Supabase project client
  appearance.ts            # Current palette definitions and runtime theme tokens
  agenda-state.ts          # Column/Pin/Toggle presentation rules
  ontario-holidays.ts      # Deterministic generated Ontario holidays
  calendar-layout.ts       # Calendar layout and overlap algorithms
  thoughts.ts, planning.ts # Canonical data services
public/
  aaa-logo.png             # Current supplied gold-on-black logo asset
supabase/migrations/
  20261015002355_thought_workspace.sql
  20261015002405_action_workspace.sql
  20261015002528_action_relation_indexes.sql
tests/
  action-layout.test.ts
  next-build.test.ts
  planning-database.test.ts
  thought-database.test.ts
  thought-domain.test.ts
docs/
  PRD-AUDIT.md, ACTION-IMPLEMENTATION.md, RELEASE.md,
  BROWSER-TESTING-2026-10-14.md, NEXT-BUILD-SETTINGS-AGENDA.md
```

Start by reading `README.md`, `docs/NEXT-BUILD-SETTINGS-AGENDA.md`, `docs/ACTION-IMPLEMENTATION.md`, `docs/BROWSER-TESTING-2026-10-14.md`, then inspect actual components instead of replacing them from screenshots or outdated HTML mockups. Use **existing code**, not a new app scaffold.

### Current app behavior (in merged code)

- Authentication gate wraps the main route. `auth-gate.tsx` uses Supabase email/password sign-in, registration, password reset, and a `profiles` record for display name. Sidebar profile menu currently has **Profile**, **Settings**, **Log out** — it does **not** yet have test-profile switching.
- Main destinations: **Calendar (GO)**, **Goals (NA)**, **Workspaces (NA)**, **Resources (NA)**, **Settings (GO)**, **Fluid Calendar (BETA)**, **Think About It (BETA)**. `app/page.tsx` hides both BETA navigation entries whenever the single Developer Mode boolean is false.
- Settings contextual subcategories: General, Appearance, Calendar & Time, Notifications, Account, Privacy & Data, Developer Mode. The existing Developer Mode control is a **checkbox** inside **one panel**; the BETA entries are explanatory rows, **not independent switches**. Notification and privacy actions marked “Planned” are not fully implemented.
- Calendar Month/Week/Day/Fluid interfaces, recurrence, event/category controls and Agenda share the existing calendar data. Contextual subpage/calendar controls remain available when the sidebar collapses.
- Agenda preferences already use `column`, `pin`, `toggle` in `lib/agenda-state.ts`. `column` always opens docked; `pin` opens overlay and can dock temporarily; `toggle` remembers pinned state. `canPin('toggle', ...)` is true for both overlay and pinned states; mobile is full-screen. Preserve this behavior.
- Ontario holidays are generated deterministically in `lib/ontario-holidays.ts`, tagged as Ontario public holiday, Observance, or Common observed date. Holidays render on Holiday/Holidays calendar without inserting generated personal DB records. Movable days/observed collisions are handled. The code intentionally warns ESA substitute dates can differ by employer.
- Existing logo is `public/aaa-logo.png` and icon files; it is **still fixed gold/black** in source, not theme-adaptive.
- Appearance currently defines seven **dark-base palette presets** in `lib/appearance.ts`: Midnight, Slate, Midnight Forest, Deep Ocean, Warm Botanical, Neon Evergreen, Black & Gold. `themeTokens(..., light=true)` generates a generic light palette through a mode-dependent transformation, and the UI still offers `dark`, `light`, and `system` modes. The requested manually selected, separately designed light presets are **not yet implemented**.

### Current preference persistence (very important when extending)

`app/page.tsx`, `app/layout.tsx` and `lib/appearance.ts` persist preferences in **browser `localStorage`**, not a separate SQL profile configuration model.

- `aaa-workspace-preferences-v2:<authenticated-email>`: `developer`, `agendaPreference`, `lastPinned`, `startDay`, `clock`, `hidden` calendar names.
- `aaa-appearance-studio-v1`: chosen appearance preset and customization.
- `think-theme`: `dark`, `light`, or `system`.
- `aaa-resolved-theme-v1`: resolved mode and CSS token cache for startup.
- `think-sidebar-collapsed`: sidebar collapse state.
- `aaa-week-start`, `aaa-clock`: older/direct preference keys also written by shell.

**Next-build design implication:** Test Profiles must partition/namespace these **configuration preferences** so variants do not overwrite one another. They are **not** separate Supabase identities or duplicated authoring data. Plan migration/backward compatibility for old keys, and prevent first-load preference writes from clobbering restored profiles. No new database schema is required merely to switch local configuration variants unless the owner explicitly requests cross-device sync.

---

## 4. Supabase data architecture and migration state

Supabase metadata was inspected read-only. Project `rpjeqbbvocgwomiavxqh` has the following **public** tables at preparation time (all reported `rls_enabled=true`):

| Table | Role |
|---|---|
| `profiles` | Auth-linked profile display/username (`id` references `auth.users`) |
| `user_items` | Canonical account-owned items: `project`, `task`, `resource`, `block`, `event`, `thought`; title and JSONB content; calendar blocks and resource config live here |
| `thought_details` | Thought metadata including hierarchy, collection configuration, saved views, archive and optimistic version |
| `thought_memberships` | Thought inclusion in collections and collection-specific values |
| `thought_connections` | Typed edges/semantic connections among thoughts |
| `planning_counters` | Owner-scoped permanent sequential numbering per planning kind |
| `planning_records` | Canonical thought-linked workspaces, events, characters, perspectives, goals, projects, tasks, scenes and activities; JSONB data |

The `planning_records.kind` constraint includes `workspace`, `event`, `character`, `perspective`, `goal`, `project`, `task`, `scene`, `activity`. Calendar blocks are **not** replaced with a separate parallel writable calendar database. Linked blocks reference a canonical thought through `user_items.thought_id` where appropriate.

### Source-controlled migrations already installed remotely

The Supabase migration history **already lists all three migrations** at handoff:

1. `20261015002355_thought_workspace`
2. `20261015002405_action_workspace`
3. `20261015002528_action_relation_indexes`

Earlier auth/profile migrations are also installed: `20261008053553`, `20261008053619`, `20261008055452`, `20261008060523`. **Do not replay any of these manually.**

Important services include `create_thought`, `save_thought`, `create_thought_collection`, `create_planning_record`, `save_planning_record`, `set_planning_task_completion`, and database constraints/triggers protecting canonical perspective titles and owner/reference relationships. Inspect SQL before changes. RPCs were designed as `SECURITY INVOKER` with authenticated grants; don't bypass RLS for convenience.

### Data/release safeguards inherited from repository documentation

- Database migrations are **additive**; preserve `auth.users`, `profiles`, `user_items`, existing event content, calendar categories, ID/sequence history and owner RLS policies.
- The production-linked development preview uses **shared auth and data** in historical evidence. Never seed test accounts, rewrite calendar records, or insert example story content without approval.
- Historic activation verification found **66 preserved existing calendar blocks** and one category resource with identical fingerprints. That is a historical reference, **not a promise of the current row count**.
- The historic browser QA pass created eight uniquely prefixed records and removed them using an exact UUID allowlist in one transaction; zero QA records remained. Follow the same reversible, clearly authorized approach for any future shared-data UI testing.
- Use isolated PGlite/Postgres tests for schema/domain behavior. The supplied tests cover ownership/RLS and rollback semantics; a test rollback is **not** permission to drop production tables.
- If a deployed feature needs a new migration, first design it, test on an isolated database, verify RLS and existing-data preservation, then seek explicit authorization for the shared project.

---

## 5. Verification from the latest GitHub build

The latest merged release note `docs/NEXT-BUILD-SETTINGS-AGENDA.md` reports:

- **10 automated tests passed** covering Ontario dates, classifications and observed collisions, Agenda modes, and existing layout/database regressions.
- TypeScript and production build passed.
- Lint had warnings but no errors.
- For **this newest Settings/Agenda PR**, real-browser visual interaction checks were **unverified** because the testing environment lacked a usable local browser / localhost cloud reachability; real-device swipe and phone-width screenshot testing remain outstanding.
- No auth changes, SQL migrations or schema changes were required for PR #15.

The older `docs/BROWSER-TESTING-2026-10-14.md` documents successful authenticated desktop checks on the **earlier** development branch for calendar shell, Agenda, task completion, goals, perspective matrix/timeline and cleanup. Do not present those checks as browser QA for the newer PR #15; manually retest impacted UI.

### Before any change

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Document actual results and distinguish pre-existing lint warnings from regressions. For UI work, verify **desktop, narrow widths/mobile, collapsed sidebar, keyboard/focus, light/dark themes, and all Agenda states** in a real browser; inspect console/errors.

### After a development-branch push

1. Confirm GitHub commit/PR and Vercel status correspond to the exact pushed SHA.
2. Open the **new preview URL**, not a memorized old preview/production URL.
3. Sign in only with an authorized test identity; treat preview as connected to shared live data unless Vercel env settings prove otherwise.
4. Exercise local configuration-only interactions without writing shared DB records whenever possible.
5. If authorized DB writes are necessary, log exact test IDs, compare baseline state, clean up only those IDs and verify cleanup.
6. Obtain approval before merging/promoting to production.

---

## 6. **NEXT WORK REQUESTED AFTER THE VERIFIED BUILD** — not implemented at SHA `fbc6cdb`

**Source distinction:** The items below are the project owner's subsequent development instructions, **not features claimed by GitHub `main`**. Start from the verified code in §3 and implement them incrementally, retaining all existing features and working data.

### A. Modern pill-shaped switches

- Create a reusable accessible ON/OFF switch (rounded track, sliding circular thumb, smooth state transition, good focus/touch/keyboard behavior).
- Use it for binary app preferences rather than small checkbox squares. Keep conventional checkboxes for genuine multi-selection where appropriate.
- Switch visuals use selected theme tokens and readable contrast.

### B. Two separate cards in **Settings → Developer Mode**

**Card 1: Developer Mode** with a single master switch and explanation.

**Card 2: Beta Features** with separately controlled rows for:

- **Fluid Calendar** — blue `BETA` badge immediately beside the name, far-right ON/OFF switch.
- **Think About It** — same aligned blue `BETA` badge and independent switch.
- **Test Profiles** — same badge and independent switch.

Badges should retain their blue style and align consistently. Enabling Developer Mode **does not automatically enable every beta feature**; master OFF makes beta functionality unavailable, hides beta navigation, and must **preserve** each remembered feature toggle for later restoration. Each module independently controls its visibility/activation while master is ON. Account data must not be deleted when toggles change. Access protections remain separate from visual toggles.

### C. Beta **Test Profiles** via existing bottom-left profile control

- Add Create, Duplicate, Rename, Switch, Delete (with confirmation) and Manage Test Profiles to the existing profile menu, gated by Developer Mode + Test Profiles ON.
- Test profiles are **per-account UI/configuration variants**, not independent auth identities, separate Supabase accounts, or duplicated tasks/calendar events.
- Each variant independently retains: theme, appearance overrides, sidebar collapsed state, Agenda display preference and last pin state, calendar time/layout preferences, calendar visibility, and individual beta feature choices.
- Allow quickly testing combinations and immediately restoring each saved configuration when switched.
- Preserve the primary profile, prevent accidental primary-profile deletion, maintain a way back when Developer Mode is disabled, and migrate existing local preferences to the initial profile without data loss.
- Default to local client-side storage consistent with existing persistence until cross-device sync is explicitly approved; avoid introducing migrations without necessity.

### D. Fix the **adaptive logo**

- The currently committed `public/aaa-logo.png` is fixed black-and-gold. Preserve the emblem geometry and brand recognition, but adapt its **treatment** (colour, background, border, contrast) to the user's manually selected theme.
- Support light **and** dark presets gracefully, including collapsed/expanded sidebar, mobile header and icons. Prefer scalable/vector treatments where feasible without degrading source geometry.
- This **supersedes** the old merged PR #15 instruction to keep the logo fixed gold across themes; do not assume the old behavior is now desired.

### E. Replace auto-transformed light mode with **independently designed light themes**

- Existing appearance uses dark-base `palettes[]` plus generic `light` or `system` mode in `themeTokens()` / `applyAppearance()`.
- Design quality light presets **separately**, each with explicit canvas, sidebar, panels, borders, text levels, accent, controls and overlay colours. Do **not** dynamically invert a dark preset to create a light preset.
- Proposed light variants from the owner's recent outline: **Porcelain & Ink**, **Warm Linen**, **Sage Studio**, **Blue Hour**. These are planned names/directions, not current GitHub code.
- Keep existing working dark presets; theme selection must be **manual and persistent** per active test profile. Remove automatic OS/system/time-of-day switching behavior for this new appearance design; do not silently change the user's palette.
- Auto-adapt the logo *within* the manually selected theme; auto-changing the *theme* itself is prohibited.
- Preserve calendar category/event colours and verify legibility of blue BETA, GO, NA and UI states on all light themes.

### Acceptance checks for this next feature build

- Master Developer Mode and independent BETA toggles work and persist.
- Hiding/re-enabling a beta module does not delete content or silently enable another module.
- New Test Profiles can quickly switch UI configurations without logging into another account or modifying shared authored data.
- The old single-account localStorage preferences migrate safely to the primary test profile.
- All theme choices are intentionally manual; curated light palettes look native, not inverted, and the emblem matches them.
- All important existing calendar, Agenda, Settings, auth and planning flows still function.
- Run all automated checks and real browser acceptance; get approval before main merge or production promotion.

---

## 7. How the new Antigravity session should begin

**Paste this as the first instruction to the coding agent after opening this handoff:**

> You are continuing **All About Action** in `NiceGuyNiko/secondbrainsystem`, not starting a new application. Authenticate with the account owner using the IDE's normal secure connection flows. First pull the latest GitHub `main`, print its HEAD SHA and compare it with `fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0`. Read the repository README, most recent merged docs, core UI/appearance/Agenda code, database migrations and tests. Verify the known Vercel production deployment `dpl_2h6UBcapq7DLbB2k9BnTfRkwM3PD` (project `prj_8vQzqlDhnYyc5vLg4Dbm14OCqYFM`, production alias `https://secondbrainsystem.vercel.app`) and inspect Supabase project `rpjeqbbvocgwomiavxqh` **read-only**. Identify any differences from this handoff or new unreviewed changes. Run the baseline checks. Then propose an incremental implementation plan for the pending Developer Mode two-card UI, independent beta switches, Test Profiles, adaptive logo and separate manually selected light-theme presets. Build on a new feature branch, preserve existing data and functionality, and do not run live database migrations, merge `main`, or promote production without explicit permission. Verify the exact deployed SHA and test the generated preview, including phone-width/gesture and theme states. Report what was actually tested and what remains unverified.

### Useful pinned source links

- [Main app shell](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/app/page.tsx)
- [Settings workspace](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/components/settings-workspace.tsx)
- [Appearance settings](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/components/appearance-settings.tsx)
- [Appearance tokens](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/lib/appearance.ts)
- [Agenda mode logic](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/lib/agenda-state.ts)
- [Ontario holiday generator](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/lib/ontario-holidays.ts)
- [Auth/profile](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/components/auth-gate.tsx)
- [Latest-build release note](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/docs/NEXT-BUILD-SETTINGS-AGENDA.md)
- [Database/migration implementation notes](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/docs/ACTION-IMPLEMENTATION.md)
- [Older authenticated browser QA and limitations](https://github.com/NiceGuyNiko/secondbrainsystem/blob/fbc6cdb1ca637c33ca6359d0a9e7937d3eb0a9c0/docs/BROWSER-TESTING-2026-10-14.md)

**Handoff integrity:** GitHub identifiers, source structure, code behaviors and commit status were obtained from the actual GitHub repository/commit. Supabase project, tables, RLS flags and migration history were observed via linked Supabase metadata. **Vercel project ID, current production deployment SHA, target, READY status, aliases and runtime were directly verified through the connected Vercel service.** Vercel environment secrets and complete build/Git settings were not retrieved. Planned next-build requirements are clearly separated from the shipped snapshot.
