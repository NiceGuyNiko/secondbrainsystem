# Phase 1 — Settings and Developer Mode

Branch `feature/phase-1-settings`, built on `feature/phase-0.5-staging` (Demo Mode). Not merged; no production database change.

## Changes

- **Pill switch** (`components/switch.tsx`): `role="switch"` button with `aria-checked`, clickable label, description linked by `aria-describedby`, visible ON/OFF text, theme-token colours, focus ring, disabled state, 44px touch area, no animation under reduced motion. Used for Developer Mode, the three beta features and "Softer calendar event colours". Multi-select controls (calendar visibility) stay as they were.
- **Settings → Developer Mode**: two cards. *Developer Mode* (account-wide master switch). *Beta Features*: Fluid Calendar and Think About It (saved per profile) and Test Profiles (account-wide), each with the existing blue BETA badge. While Developer Mode is off the beta switches are disabled but keep their saved values.
- **Navigation**: Fluid Calendar and Think About It each appear only when Developer Mode **and** their own switch are on. If the page you are on is turned off, you return to the Calendar with a notice; nothing is deleted.
- **Settings model** (`lib/settings/model.ts`): account settings (Developer Mode, Test Profiles availability, active profile) and profile preferences (beta choices, Agenda mode and pin state, week start, clock, hidden calendars). Availability is computed (`effectiveFeatures`); saved choices are never overwritten by the master switch. Phase 2 adds profiles to the same structure.
- **Persistence** (`lib/settings/store.ts`, `lib/settings/use-settings.ts`): settings load once and only explicit changes are saved, which fixes the old overwrite-on-load problem. A failed save restores the last saved settings and shows a message.
  - Demo Mode: rows in `account_preferences` / `test_profiles` inside the browser-only demo data, so *Reset demo data* resets them too.
  - Outside Demo Mode (until the settings tables are approved for production): this browser's storage, key `aaa-settings-v1:<email>`.
  - One-time transfer of the previous browser preferences (`aaa-workspace-preferences-v2:<email>`, `aaa-week-start`, `aaa-clock`). Old keys are read, never removed. Accounts that had the old Developer Mode on keep both beta pages visible.
- **Isolation**: Demo Mode never creates a Supabase client, and now also blocks any request to a Supabase host (fetch, XHR, WebSocket, EventSource, beacon). The Developer Mode page shows how many were blocked.
- Phone layout: the DEMO badge sits at the bottom of the screen so it no longer covers the header.

## Planned database tables (Stage B, not created)

`account_preferences(user_id pk → auth.users, developer_mode_enabled, test_profiles_enabled, active_test_profile_id → test_profiles, updated_at)` and `test_profiles(id pk, user_id, name, is_primary, preferences jsonb, created_at, updated_at)` with owner-only RLS, exactly one primary profile per user, and the active profile owned by the same user. The demo adapter already uses these shapes.

## Tests

`tests/settings.test.ts`, `tests/demo-isolation.test.ts`: defaults, switch independence, Developer Mode off/on keeps choices, legacy transfer, no overwrite on load, repair of damaged settings, demo persistence across reloads and reset, Demo Mode never creating a real client, network guard coverage.
