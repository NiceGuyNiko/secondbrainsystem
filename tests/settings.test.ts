import test from "node:test";
import assert from "node:assert/strict";
import {
  activeProfile, defaultSettings, effectiveFeatures, parseSettings, settingsFromLegacy, updateAccount, updateActivePreferences, type Settings,
} from "../lib/settings/model";
import { browserSettingsStore, legacyPreferencesKey, settingsKey, tableSettingsStore } from "../lib/settings/store";
import { createDemoClient, DemoDatabase, DEMO_USER_ID } from "../lib/demo/client";
import { demoSeed } from "../lib/demo/seed";

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
};
const setBeta = (s: Settings, feature: "fluidCalendar" | "thinkAboutIt", on: boolean) =>
  updateActivePreferences(s, (p) => ({ betaFeatures: { ...p.betaFeatures, [feature]: on } }));

test("New accounts start with everything experimental off and one primary profile", () => {
  const s = defaultSettings();
  assert.deepEqual(effectiveFeatures(s), { developerMode: false, fluidCalendar: false, thinkAboutIt: false, testProfiles: false });
  assert.equal(s.profiles.length, 1);
  assert.equal(activeProfile(s).isPrimary, true);
});

test("Beta switches are independent of each other", () => {
  let s = updateAccount(defaultSettings(), { developerMode: true });
  s = setBeta(s, "fluidCalendar", true);
  assert.deepEqual(effectiveFeatures(s), { developerMode: true, fluidCalendar: true, thinkAboutIt: false, testProfiles: false });
  s = setBeta(s, "thinkAboutIt", true);
  s = setBeta(s, "fluidCalendar", false);
  assert.deepEqual(effectiveFeatures(s), { developerMode: true, fluidCalendar: false, thinkAboutIt: true, testProfiles: false });
  s = updateAccount(s, { testProfilesEnabled: true });
  assert.equal(effectiveFeatures(s).testProfiles, true);
  assert.equal(activeProfile(s).preferences.betaFeatures.thinkAboutIt, true, "account switch leaves profile choices alone");
});

test("Turning Developer Mode off hides beta features but keeps the saved choices", () => {
  let s = updateAccount(defaultSettings(), { developerMode: true, testProfilesEnabled: true });
  s = setBeta(setBeta(s, "fluidCalendar", true), "thinkAboutIt", true);
  const off = updateAccount(s, { developerMode: false });
  assert.deepEqual(effectiveFeatures(off), { developerMode: false, fluidCalendar: false, thinkAboutIt: false, testProfiles: false });
  assert.deepEqual(activeProfile(off).preferences.betaFeatures, { fluidCalendar: true, thinkAboutIt: true });
  assert.equal(off.account.testProfilesEnabled, true);
  assert.deepEqual(effectiveFeatures(updateAccount(off, { developerMode: true })), { developerMode: true, fluidCalendar: true, thinkAboutIt: true, testProfiles: true });
});

test("Old browser preferences transfer once into the primary profile and are left in place", async () => {
  const legacy = { developer: true, agendaPreference: "pin", lastPinned: true, startDay: "Sunday", clock: "24-hour", hidden: ["Work", "Work", 7] };
  const storage = memory({ [legacyPreferencesKey("me@x.y")]: JSON.stringify(legacy) });
  const s = await browserSettingsStore(storage, "me@x.y").load();
  const p = activeProfile(s).preferences;
  assert.equal(s.account.developerMode, true);
  assert.deepEqual(p.betaFeatures, { fluidCalendar: true, thinkAboutIt: true }, "previously visible beta pages stay visible");
  assert.equal(p.agendaPreference, "pin");
  assert.equal(p.lastPinned, true);
  assert.equal(p.startDay, "Sunday");
  assert.equal(p.clock, "24-hour");
  assert.deepEqual(p.hiddenCalendars, ["Work"]);
  assert.ok(storage.data.has(legacyPreferencesKey("me@x.y")), "legacy key is not removed");
  assert.ok(storage.data.has(settingsKey("me@x.y")));
  assert.equal(settingsFromLegacy({}, "Saturday", "24-hour").profiles[0].preferences.startDay, "Saturday", "older separate keys are used too");
});

test("Saved settings are never overwritten on load", async () => {
  const storage = memory();
  const store = browserSettingsStore(storage, "me@x.y");
  const first = await store.load();
  const changed = setBeta(updateAccount(first, { developerMode: true }), "thinkAboutIt", true);
  await store.save(changed);
  storage.setItem(legacyPreferencesKey("me@x.y"), JSON.stringify({ developer: false }));
  const again = await browserSettingsStore(storage, "me@x.y").load();
  assert.deepEqual(again, changed, "a later legacy value does not replace saved settings");
});

test("Damaged settings are repaired: one primary profile and a valid active profile", () => {
  const a = { id: "a", name: "A", isPrimary: true, preferences: {} };
  const b = { id: "b", name: "B", isPrimary: true, preferences: { betaFeatures: { fluidCalendar: "yes" } } };
  const s = parseSettings({ version: 1, account: { developerMode: true, activeProfileId: "missing" }, profiles: [a, b, a] })!;
  assert.equal(s.profiles.length, 2);
  assert.deepEqual(s.profiles.map((p) => p.isPrimary), [true, false]);
  assert.equal(s.account.activeProfileId, "a");
  assert.equal(s.profiles[1].preferences.betaFeatures.fluidCalendar, false);
  assert.equal(parseSettings({ version: 2 }), null);
});

test("Demo Mode stores settings as rows that survive reloads and reset with the demo data", async () => {
  const storage = memory();
  const db = new DemoDatabase(storage, () => demoSeed());
  const store = tableSettingsStore(createDemoClient(db), DEMO_USER_ID, { storage, email: "demo" });
  const loaded = await store.load();
  await store.save(setBeta(updateAccount(loaded, { developerMode: true }), "fluidCalendar", true));
  const reloaded = await tableSettingsStore(createDemoClient(new DemoDatabase(storage, () => demoSeed())), DEMO_USER_ID, { storage, email: "demo" }).load();
  assert.deepEqual(effectiveFeatures(reloaded), { developerMode: true, fluidCalendar: true, thinkAboutIt: false, testProfiles: false });
  assert.equal(reloaded.profiles[0].id, loaded.profiles[0].id, "profile identity is stable");
  db.reset();
  assert.equal(effectiveFeatures(await tableSettingsStore(createDemoClient(db), DEMO_USER_ID, { storage: memory(), email: "demo" }).load()).developerMode, false);
});
