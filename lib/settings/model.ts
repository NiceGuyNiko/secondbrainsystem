// Settings model shared by every persistence adapter.
// Account-level: Developer Mode, Test Profiles availability, the active profile pointer.
// Profile-level: everything that describes how the interface looks and behaves, including the
// Fluid Calendar and Think About It beta choices, theme and sidebar. Profiles hold configuration
// only: every profile of an account sees the same calendar events, thoughts, goals and tasks.
import type { AgendaPreference } from "@/lib/agenda-state";
import { appearanceDefaults, parseAppearance, type Appearance } from "@/lib/appearance";

export type BetaFeatures = { fluidCalendar: boolean; thinkAboutIt: boolean };
export type ThemeMode = "dark" | "light" | "system";
export type ProfilePreferences = {
  betaFeatures: BetaFeatures;
  agendaPreference: AgendaPreference;
  lastPinned: boolean;
  startDay: "Monday" | "Sunday" | "Saturday";
  clock: "12-hour" | "24-hour";
  hiddenCalendars: string[];
  appearance: Appearance;
  themeMode: ThemeMode;
  sidebarCollapsed: boolean;
};
export type Profile = { id: string; name: string; isPrimary: boolean; preferences: ProfilePreferences; createdAt: string; updatedAt: string };
export type AccountSettings = { developerMode: boolean; testProfilesEnabled: boolean; activeProfileId: string };
export type Settings = { version: 1; account: AccountSettings; profiles: Profile[] };
export type EffectiveFeatures = { developerMode: boolean; fluidCalendar: boolean; thinkAboutIt: boolean; testProfiles: boolean };

export const defaultPreferences: ProfilePreferences = {
  betaFeatures: { fluidCalendar: false, thinkAboutIt: false },
  agendaPreference: "toggle",
  lastPinned: false,
  startDay: "Monday",
  clock: "12-hour",
  hiddenCalendars: [],
  appearance: appearanceDefaults,
  themeMode: "dark",
  sidebarCollapsed: false,
};
export const MAX_PROFILES = 12;
export const MAX_PROFILE_NAME = 40;

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

// `fallback` fills fields that a stored profile does not have yet (for example settings saved
// before a field existed), so adding a preference never resets what was already chosen elsewhere.
export function parsePreferences(raw: unknown, fallback: ProfilePreferences = defaultPreferences): ProfilePreferences {
  const p = record(raw), beta = record(p.betaFeatures);
  return {
    betaFeatures: { fluidCalendar: bool(beta.fluidCalendar, fallback.betaFeatures.fluidCalendar), thinkAboutIt: bool(beta.thinkAboutIt, fallback.betaFeatures.thinkAboutIt) },
    agendaPreference: pick(p.agendaPreference, ["column", "pin", "toggle"] as const, fallback.agendaPreference),
    lastPinned: bool(p.lastPinned, fallback.lastPinned),
    startDay: pick(p.startDay, ["Monday", "Sunday", "Saturday"] as const, fallback.startDay),
    clock: pick(p.clock, ["12-hour", "24-hour"] as const, fallback.clock),
    hiddenCalendars: Array.isArray(p.hiddenCalendars) ? [...new Set(p.hiddenCalendars.filter((x): x is string => typeof x === "string"))] : [...fallback.hiddenCalendars],
    appearance: p.appearance && typeof p.appearance === "object" ? parseAppearance(p.appearance) : fallback.appearance,
    themeMode: pick(p.themeMode, ["dark", "light", "system"] as const, fallback.themeMode),
    sidebarCollapsed: bool(p.sidebarCollapsed, fallback.sidebarCollapsed),
  };
}

export function primaryProfile(preferences: ProfilePreferences = defaultPreferences, now = new Date().toISOString()): Profile {
  return { id: crypto.randomUUID(), name: "Primary", isPrimary: true, preferences, createdAt: now, updatedAt: now };
}

export function defaultSettings(preferences?: ProfilePreferences): Settings {
  const primary = primaryProfile(preferences);
  return { version: 1, account: { developerMode: false, testProfilesEnabled: false, activeProfileId: primary.id }, profiles: [primary] };
}

// Repairs anything stored by older code or damaged: exactly one primary profile, a valid active pointer.
export function parseSettings(raw: unknown, fallback: ProfilePreferences = defaultPreferences): Settings | null {
  const s = record(raw);
  if (s.version !== 1 || !Array.isArray(s.profiles)) return null;
  const seen = new Set<string>();
  const profiles: Profile[] = s.profiles.flatMap((value) => {
    const p = record(value);
    if (typeof p.id !== "string" || !p.id || seen.has(p.id)) return [];
    seen.add(p.id);
    return [{
      id: p.id, name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Profile", isPrimary: p.isPrimary === true,
      preferences: parsePreferences(p.preferences, fallback),
      createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(0).toISOString(),
      updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date(0).toISOString(),
    }];
  });
  if (!profiles.length) return null;
  const primaries = profiles.filter((p) => p.isPrimary);
  const primary = primaries[0] ?? profiles[0];
  for (const p of profiles) p.isPrimary = p === primary;
  const a = record(s.account);
  const active = typeof a.activeProfileId === "string" && profiles.some((p) => p.id === a.activeProfileId) ? a.activeProfileId : primary.id;
  return { version: 1, account: { developerMode: bool(a.developerMode, false), testProfilesEnabled: bool(a.testProfilesEnabled, false), activeProfileId: active }, profiles };
}

// One-time transfer of the pre-Phase-1 browser preferences into the primary profile.
// Legacy keys are only read, never removed.
export function settingsFromLegacy(legacy: unknown, legacyStartDay?: string | null, legacyClock?: string | null, fallback: ProfilePreferences = defaultPreferences): Settings {
  const l = record(legacy);
  const preferences = parsePreferences({
    agendaPreference: l.agendaPreference,
    lastPinned: l.lastPinned,
    startDay: l.startDay ?? legacyStartDay,
    clock: l.clock ?? legacyClock,
    hiddenCalendars: l.hidden,
    // The old single Developer Mode switch showed both beta destinations, so keep them visible.
    betaFeatures: l.developer === true ? { fluidCalendar: true, thinkAboutIt: true } : undefined,
  }, fallback);
  const settings = defaultSettings(preferences);
  settings.account.developerMode = l.developer === true;
  return settings;
}

export const primaryOf = (s: Settings) => s.profiles.find((p) => p.isPrimary)!;
export const testProfilesAvailable = (s: Settings) => s.account.developerMode && s.account.testProfilesEnabled;
// The profile in use. While Developer Mode or Test Profiles is off the Primary profile is used;
// the stored choice is kept and comes back when both are on again.
export const activeProfile = (s: Settings) =>
  (testProfilesAvailable(s) && s.profiles.find((p) => p.id === s.account.activeProfileId)) || primaryOf(s);

// Saved choices are never overwritten by the master switch; availability is computed.
export function effectiveFeatures(s: Settings): EffectiveFeatures {
  const dev = s.account.developerMode, beta = activeProfile(s).preferences.betaFeatures;
  return { developerMode: dev, fluidCalendar: dev && beta.fluidCalendar, thinkAboutIt: dev && beta.thinkAboutIt, testProfiles: testProfilesAvailable(s) };
}

export function updateAccount(s: Settings, patch: Partial<Omit<AccountSettings, "activeProfileId">>): Settings {
  return { ...s, account: { ...s.account, ...patch } };
}

export function updateActivePreferences(s: Settings, patch: (p: ProfilePreferences) => Partial<ProfilePreferences>, now = new Date().toISOString()): Settings {
  const active = activeProfile(s);
  return { ...s, profiles: s.profiles.map((p) => (p.id === active.id ? { ...p, preferences: parsePreferences({ ...p.preferences, ...patch(p.preferences) }), updatedAt: now } : p)) };
}

// Profile management. Every operation returns new settings or throws a ProfileError whose message
// can be shown to the person.
export class ProfileError extends Error {}

export function validateProfileName(s: Settings, name: string, exceptId?: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) throw new ProfileError("Give the profile a name.");
  if (clean.length > MAX_PROFILE_NAME) throw new ProfileError(`Use ${MAX_PROFILE_NAME} characters or fewer.`);
  if (s.profiles.some((p) => p.id !== exceptId && p.name.toLowerCase() === clean.toLowerCase())) throw new ProfileError(`A profile called "${clean}" already exists.`);
  return clean;
}

const findProfile = (s: Settings, id: string) => {
  const profile = s.profiles.find((p) => p.id === id);
  if (!profile) throw new ProfileError("That profile no longer exists.");
  return profile;
};

// New profiles start from the given preferences (default: a copy of the profile in use).
// Only configuration is copied; calendar events, thoughts, goals and tasks are shared by all profiles.
export function createProfile(s: Settings, name: string, from: ProfilePreferences = activeProfile(s).preferences, now = new Date().toISOString()): { settings: Settings; id: string } {
  if (s.profiles.length >= MAX_PROFILES) throw new ProfileError(`You can have up to ${MAX_PROFILES} profiles. Delete one first.`);
  const profile: Profile = { id: crypto.randomUUID(), name: validateProfileName(s, name), isPrimary: false, preferences: parsePreferences(structuredClone(from)), createdAt: now, updatedAt: now };
  return { settings: { ...s, profiles: [...s.profiles, profile] }, id: profile.id };
}

export const duplicateProfile = (s: Settings, sourceId: string, name: string, now?: string) => createProfile(s, name, findProfile(s, sourceId).preferences, now);

export function renameProfile(s: Settings, id: string, name: string, now = new Date().toISOString()): Settings {
  const profile = findProfile(s, id);
  if (profile.isPrimary) throw new ProfileError("The Primary profile keeps its name.");
  const clean = validateProfileName(s, name, id);
  return { ...s, profiles: s.profiles.map((p) => (p.id === id ? { ...p, name: clean, updatedAt: now } : p)) };
}

export function switchProfile(s: Settings, id: string): Settings {
  findProfile(s, id);
  return { ...s, account: { ...s.account, activeProfileId: id } };
}

export function deleteProfile(s: Settings, id: string): Settings {
  const profile = findProfile(s, id);
  if (profile.isPrimary) throw new ProfileError("The Primary profile can't be deleted.");
  const profiles = s.profiles.filter((p) => p.id !== id);
  const activeProfileId = s.account.activeProfileId === id ? primaryOf(s).id : s.account.activeProfileId;
  return { ...s, profiles, account: { ...s.account, activeProfileId } };
}

export const suggestProfileName = (s: Settings, base: string) => {
  const taken = new Set(s.profiles.map((p) => p.name.toLowerCase()));
  for (let n = 1; ; n++) {
    const name = n === 1 ? base : `${base} ${n}`;
    if (!taken.has(name.toLowerCase()) && name.length <= MAX_PROFILE_NAME) return name;
  }
};
