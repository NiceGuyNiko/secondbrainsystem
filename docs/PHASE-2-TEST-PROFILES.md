# Phase 2 — Test Profiles

Branch `feature/phase-2-test-profiles`, built on `feature/phase-1-settings`. Not merged; no production database change.

## Behaviour

- Available when Developer Mode **and** the account-wide Test Profiles switch are on. The profile control at the bottom of the sidebar then shows the profile in use ("Profile: …", plus a blue dot on the avatar for a non-Primary profile) and its menu lists every profile for one-tap switching, **Return to Primary**, **New profile…** and **Manage profiles…**. "Profile" in the menu is now **Account**, to keep the account and interface profiles distinct.
- **Manage profiles** (dialog; bottom sheet on phones): switch, duplicate, rename, delete with an in-app confirmation, and create a new profile from a copy of the current profile or from default settings. Names are unique (ignoring case), 1–40 characters; up to 12 profiles.
- **Primary** cannot be renamed or deleted. Deleting the profile in use returns to Primary.
- When Developer Mode or Test Profiles is turned off, Primary is used. Every profile and the chosen profile are kept and return when both are on again.
- Profiles hold configuration only. Calendar events, thoughts, goals and tasks are shared by all profiles; creating, duplicating, switching or deleting a profile never creates, copies or deletes those records. The dialog says so.

## Settings boundary

| Account-wide | Per profile |
|---|---|
| Developer Mode, Test Profiles availability, chosen profile | Fluid Calendar and Think About It switches, theme and appearance studio choices, colour mode, Agenda mode and pin state, week start, clock, hidden calendars, sidebar collapsed |

The theme is applied before paint when switching, so the previous profile's theme is never shown. The theme cache used at start-up (`aaa-resolved-theme-v1`, `aaa-appearance-studio-v1`, `think-theme`) always reflects the profile in use.

## Compatibility

- Theme, colour mode and sidebar state that existed before profiles carry into Primary. Settings saved by Phase 1 previews (before these fields existed) are filled from the same keys, so nobody's theme resets.
- Persistence is unchanged from Phase 1: demo rows in `account_preferences` / `test_profiles` (Reset demo data returns to Primary only), browser storage outside Demo Mode until the settings tables are approved. Deleting a profile removes its row.

## Tests

`tests/test-profiles.test.ts`: independent per-profile settings, account-wide boundary, fallback to Primary and restoration, create / duplicate / rename / delete rules and limits, Primary protection, Demo Mode persistence across reloads and deletion of rows, calendar/thought records untouched, reset to Primary only, migration of existing theme and sidebar values. All Phase 0.5 and Phase 1 tests still pass.
