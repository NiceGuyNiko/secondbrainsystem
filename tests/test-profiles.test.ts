import test from "node:test";
import assert from "node:assert/strict";
import {
  activeProfile, createProfile, defaultPreferences, defaultSettings, deleteProfile, duplicateProfile, effectiveFeatures, primaryOf, ProfileError,
  renameProfile, suggestProfileName, switchProfile, updateAccount, updateActivePreferences, MAX_PROFILES, type Settings,
} from "../lib/settings/model";
import { browserSettingsStore, settingsKey, tableSettingsStore } from "../lib/settings/store";
import { appearanceKey } from "../lib/appearance";
import { createDemoClient, DemoDatabase, DEMO_USER_ID } from "../lib/demo/client";
import { demoSeed } from "../lib/demo/seed";

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const enabled = () => updateAccount(defaultSettings(), { developerMode: true, testProfilesEnabled: true });
const withProfile = (s: Settings, name: string) => {
  const { settings, id } = createProfile(s, name);
  return { settings: switchProfile(settings, id), id };
};
const theme = (s: Settings, preset: string) => updateActivePreferences(s, (p) => ({ appearance: { ...p.appearance, preset } }));

test("Profiles keep independent settings", () => {
  let s = theme(enabled(), "black-gold");
  const light = withProfile(s, "Light test");
  s = updateActivePreferences(theme(light.settings, "slate"), () => ({ themeMode: "light", agendaPreference: "toggle", sidebarCollapsed: true, hiddenCalendars: ["Work"], betaFeatures: { fluidCalendar: true, thinkAboutIt: false } }));
  const primary = primaryOf(s);
  assert.equal(primary.preferences.appearance.preset, "black-gold", "editing the test profile left Primary alone");
  assert.equal(primary.preferences.themeMode, "manual");
  assert.equal(primary.preferences.agendaPreference, "column");
  assert.deepEqual(primary.preferences.hiddenCalendars, []);
  assert.equal(effectiveFeatures(s).fluidCalendar, true);
  s = switchProfile(s, primary.id);
  assert.equal(activeProfile(s).preferences.appearance.preset, "black-gold");
  assert.equal(effectiveFeatures(s).fluidCalendar, false, "beta choices follow the profile");
  s = switchProfile(s, light.id);
  assert.equal(activeProfile(s).preferences.appearance.preset, "slate");
  assert.equal(activeProfile(s).preferences.agendaPreference, "toggle");
  assert.equal(activeProfile(s).preferences.sidebarCollapsed, true);
});

test("Account-wide settings are shared by every profile", () => {
  const { settings, id } = withProfile(enabled(), "Second");
  const off = updateAccount(settings, { developerMode: false });
  assert.equal(off.account.developerMode, false);
  assert.equal(activeProfile(off).isPrimary, true, "Primary is used while Developer Mode is off");
  assert.equal(off.account.activeProfileId, id, "the chosen profile is remembered");
  assert.equal(activeProfile(updateAccount(off, { developerMode: true })).id, id, "and comes back");
  const noProfiles = updateAccount(settings, { testProfilesEnabled: false });
  assert.equal(activeProfile(noProfiles).isPrimary, true);
  assert.equal(noProfiles.profiles.length, 2, "profiles are kept, not deleted");
});

test("Create and duplicate copy configuration only, with clear names", () => {
  let s = theme(enabled(), "deep-ocean");
  const copy = createProfile(s, "  Copy   of   current ");
  assert.equal(copy.settings.profiles.at(-1)!.name, "Copy of current");
  assert.equal(copy.settings.profiles.at(-1)!.preferences.appearance.preset, "deep-ocean");
  const fresh = createProfile(s, "Fresh", defaultPreferences);
  assert.equal(fresh.settings.profiles.at(-1)!.preferences.appearance.preset, defaultPreferences.appearance.preset);
  s = copy.settings;
  const dup = duplicateProfile(s, copy.id, suggestProfileName(s, "Copy of current copy"));
  assert.notEqual(dup.id, copy.id);
  assert.deepEqual(dup.settings.profiles.at(-1)!.preferences, copy.settings.profiles.at(-1)!.preferences);
  const changed = updateActivePreferences(switchProfile(dup.settings, dup.id), () => ({ clock: "24-hour" }));
  assert.equal(changed.profiles.find((p) => p.id === copy.id)!.preferences.clock, "12-hour", "duplicates do not share state");
  assert.throws(() => createProfile(s, "copy OF current"), ProfileError, "names are unique regardless of case");
  assert.throws(() => createProfile(s, "   "), ProfileError);
  assert.throws(() => createProfile(s, "x".repeat(41)), ProfileError);
  let full = enabled();
  while (full.profiles.length < MAX_PROFILES) full = createProfile(full, `P${full.profiles.length}`).settings;
  assert.throws(() => createProfile(full, "One too many"), ProfileError);
  assert.equal(suggestProfileName(s, "Copy of current"), "Copy of current 2");
});

test("Rename, delete and Primary protection", () => {
  const { settings, id } = withProfile(enabled(), "Draft");
  const renamed = renameProfile(settings, id, "Final");
  assert.equal(renamed.profiles.find((p) => p.id === id)!.name, "Final");
  assert.throws(() => renameProfile(renamed, primaryOf(renamed).id, "Main"), ProfileError);
  assert.throws(() => deleteProfile(renamed, primaryOf(renamed).id), ProfileError);
  assert.throws(() => renameProfile(renamed, id, "primary"), ProfileError, "cannot take the Primary profile's name");
  const deleted = deleteProfile(renamed, id);
  assert.equal(deleted.profiles.length, 1);
  assert.equal(activeProfile(deleted).isPrimary, true, "deleting the profile in use falls back to Primary");
  assert.equal(deleted.account.activeProfileId, primaryOf(deleted).id);
  assert.throws(() => switchProfile(deleted, id), ProfileError);
  const other = createProfile(renamed, "Other");
  const kept = deleteProfile(other.settings, other.id);
  assert.equal(kept.account.activeProfileId, id, "deleting another profile keeps the one in use");
});

test("Profiles persist in Demo Mode across reloads; reset returns to Primary only", async () => {
  const storage = memory();
  const db = new DemoDatabase(storage, () => demoSeed());
  const load = () => tableSettingsStore(createDemoClient(new DemoDatabase(storage, () => demoSeed())), DEMO_USER_ID, { storage, email: "demo" }).load();
  const store = tableSettingsStore(createDemoClient(db), DEMO_USER_ID, { storage, email: "demo" });
  let s = updateAccount(await store.load(), { developerMode: true, testProfilesEnabled: true });
  const a = withProfile(s, "A");
  s = theme(a.settings, "slate");
  const b = withProfile(s, "B");
  s = theme(b.settings, "black-gold");
  await store.save(s);
  const blocksBefore = db.rows("user_items").length;

  let reloaded = await load();
  assert.deepEqual(reloaded.profiles.map((p) => p.name), ["Primary", "A", "B"]);
  assert.equal(activeProfile(reloaded).name, "B");
  assert.equal(activeProfile(reloaded).preferences.appearance.preset, "black-gold");
  reloaded = switchProfile(reloaded, a.id);
  assert.equal(activeProfile(reloaded).preferences.appearance.preset, "slate");

  await store.save(deleteProfile(reloaded, b.id));
  assert.deepEqual((await load()).profiles.map((p) => p.name), ["Primary", "A"], "deleted profile rows are removed");
  assert.equal(db.rows("user_items").length, blocksBefore, "profile changes never touch calendar or thought records");

  db.reset();
  const fresh = await tableSettingsStore(createDemoClient(db), DEMO_USER_ID, { storage: memory(), email: "demo" }).load();
  assert.deepEqual(fresh.profiles.map((p) => p.name), ["Primary"]);
  assert.equal(fresh.account.developerMode, false);
});

test("Existing theme, colour mode and sidebar carry into the Primary profile", async () => {
  const storage = memory({ [appearanceKey]: JSON.stringify({ preset: "warm-botanical", corners: "rounded" }), "think-theme": "light", "think-sidebar-collapsed": "true" });
  const s = await browserSettingsStore(storage, "me@x.y").load();
  const p = activeProfile(s).preferences;
  assert.equal(p.appearance.preset, "warm-botanical");
  assert.equal(p.appearance.corners, "rounded");
  assert.equal(p.themeMode, "light");
  assert.equal(p.sidebarCollapsed, true);

  // Settings saved by Phase 1 (before these fields existed) are filled in the same way.
  const phase1 = memory({ ...Object.fromEntries(storage.data), [settingsKey("old@x.y")]: JSON.stringify({ version: 1, account: { developerMode: true }, profiles: [{ id: "p", name: "Primary", isPrimary: true, preferences: { clock: "24-hour" } }] }) });
  const upgraded = activeProfile(await browserSettingsStore(phase1, "old@x.y").load()).preferences;
  assert.equal(upgraded.clock, "24-hour");
  assert.equal(upgraded.appearance.preset, "warm-botanical");
  assert.equal(upgraded.themeMode, "light");
});
