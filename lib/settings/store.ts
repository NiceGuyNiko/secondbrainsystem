// Persistence adapters for settings. Both implement the same interface, so the UI never knows
// where settings live.
//   tableSettingsStore   — rows in `account_preferences` / `test_profiles` through a Supabase-style
//                          client. Demo Mode uses it with the browser-only demo client. The same
//                          adapter will serve the real Supabase tables once that database change is
//                          approved (Stage B/C).
//   browserSettingsStore — this browser's storage, keyed by account. Used outside Demo Mode until
//                          the settings tables exist in production.
import type { SupabaseClient } from "@supabase/supabase-js";
import { appearanceKey, parseAppearance } from "@/lib/appearance";
import { defaultPreferences, defaultSettings, parseSettings, settingsFromLegacy, type ProfilePreferences, type Settings } from "./model";

export interface SettingsStore {
  load(): Promise<Settings>;
  save(next: Settings): Promise<void>;
}
type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export const settingsKey = (email: string) => `aaa-settings-v1:${email}`;
export const legacyPreferencesKey = (email: string) => `aaa-workspace-preferences-v2:${email}`;

// Preferences that existed before profiles (theme, colour mode, sidebar) were kept in their own
// browser keys. They fill any field a stored profile does not have yet, so nothing visibly resets.
export function legacyFallback(storage: KeyValueStorage | null): ProfilePreferences {
  const read = (key: string) => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  };
  let appearance = defaultPreferences.appearance;
  try {
    const raw = read(appearanceKey);
    if (raw) appearance = parseAppearance(JSON.parse(raw));
  } catch {}
  const mode = read("think-theme");
  return {
    ...defaultPreferences,
    appearance,
    themeMode: mode === "light" || mode === "system" || mode === "dark" ? mode : defaultPreferences.themeMode,
    sidebarCollapsed: read("think-sidebar-collapsed") === "true",
  };
}

function fromLegacy(storage: KeyValueStorage | null, email: string): Settings {
  const fallback = legacyFallback(storage);
  try {
    const legacy = storage?.getItem(legacyPreferencesKey(email));
    if (legacy || storage?.getItem("aaa-week-start") || storage?.getItem("aaa-clock"))
      return settingsFromLegacy(JSON.parse(legacy || "{}"), storage?.getItem("aaa-week-start"), storage?.getItem("aaa-clock"), fallback);
  } catch {}
  return defaultSettings(fallback);
}

export function browserSettingsStore(storage: KeyValueStorage | null, email: string): SettingsStore {
  return {
    async load() {
      try {
        const saved = parseSettings(JSON.parse(storage?.getItem(settingsKey(email)) || "null"), legacyFallback(storage));
        if (saved) return saved;
      } catch {}
      // First run of the new settings: transfer the old preferences once. Writing the new key only
      // happens when it does not exist yet, so nothing that was saved is ever overwritten on load.
      const migrated = fromLegacy(storage, email);
      await this.save(migrated);
      return migrated;
    },
    async save(next) {
      if (!storage) throw new Error("Browser storage is unavailable, so settings cannot be saved.");
      storage.setItem(settingsKey(email), JSON.stringify(next));
    },
  };
}

type AccountRow = { user_id: string; developer_mode_enabled: boolean; test_profiles_enabled: boolean; active_test_profile_id: string };
type ProfileRow = { id: string; user_id: string; name: string; is_primary: boolean; preferences: unknown; created_at: string; updated_at: string };
const checked = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

export function tableSettingsStore(client: SupabaseClient, userId: string, legacy: { storage: KeyValueStorage | null; email: string }): SettingsStore {
  const store: SettingsStore = {
    async load() {
      const account = checked(await client.from("account_preferences").select("*").eq("user_id", userId).maybeSingle()) as AccountRow | null;
      const rows = (checked(await client.from("test_profiles").select("*").eq("user_id", userId)) as ProfileRow[]) ?? [];
      if (!account || !rows.length) {
        const migrated = fromLegacy(legacy.storage, legacy.email);
        await store.save(migrated);
        return migrated;
      }
      const parsed = parseSettings({
        version: 1,
        account: { developerMode: account.developer_mode_enabled, testProfilesEnabled: account.test_profiles_enabled, activeProfileId: account.active_test_profile_id },
        profiles: rows.map((r) => ({ id: r.id, name: r.name, isPrimary: r.is_primary, preferences: r.preferences, createdAt: r.created_at, updatedAt: r.updated_at })),
      }, legacyFallback(legacy.storage));
      if (!parsed) throw new Error("Saved settings could not be read.");
      return parsed;
    },
    async save(next) {
      checked(await client.from("test_profiles").upsert(next.profiles.map((p) => ({ id: p.id, user_id: userId, name: p.name, is_primary: p.isPrimary, preferences: p.preferences, created_at: p.createdAt, updated_at: p.updatedAt }))));
      const keep = new Set(next.profiles.map((p) => p.id));
      const existing = (checked(await client.from("test_profiles").select("id").eq("user_id", userId)) as { id: string }[]) ?? [];
      const removed = existing.map((r) => r.id).filter((id) => !keep.has(id));
      if (removed.length) checked(await client.from("test_profiles").delete().eq("user_id", userId).in("id", removed));
      checked(await client.from("account_preferences").upsert({ user_id: userId, developer_mode_enabled: next.account.developerMode, test_profiles_enabled: next.account.testProfilesEnabled, active_test_profile_id: next.account.activeProfileId, updated_at: new Date().toISOString() }));
    },
  };
  return store;
}
