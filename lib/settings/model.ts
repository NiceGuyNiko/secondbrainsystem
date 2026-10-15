// Settings model shared by every persistence adapter.
// Account-level: Developer Mode, Test Profiles availability, the active profile pointer.
// Profile-level: everything that describes how the interface looks and behaves, including the
// Fluid Calendar and Think About It beta choices. Phase 1 has exactly one (primary) profile;
// Phase 2 adds more profiles without changing this shape.
import type { AgendaPreference } from "@/lib/agenda-state";

export type BetaFeatures = { fluidCalendar: boolean; thinkAboutIt: boolean };
export type ProfilePreferences = {
  betaFeatures: BetaFeatures;
  agendaPreference: AgendaPreference;
  lastPinned: boolean;
  startDay: "Monday" | "Sunday" | "Saturday";
  clock: "12-hour" | "24-hour";
  hiddenCalendars: string[];
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
};

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

export function parsePreferences(raw: unknown): ProfilePreferences {
  const p = record(raw), beta = record(p.betaFeatures);
  return {
    betaFeatures: { fluidCalendar: bool(beta.fluidCalendar, false), thinkAboutIt: bool(beta.thinkAboutIt, false) },
    agendaPreference: pick(p.agendaPreference, ["column", "pin", "toggle"] as const, defaultPreferences.agendaPreference),
    lastPinned: bool(p.lastPinned, false),
    startDay: pick(p.startDay, ["Monday", "Sunday", "Saturday"] as const, defaultPreferences.startDay),
    clock: pick(p.clock, ["12-hour", "24-hour"] as const, defaultPreferences.clock),
    hiddenCalendars: Array.isArray(p.hiddenCalendars) ? [...new Set(p.hiddenCalendars.filter((x): x is string => typeof x === "string"))] : [],
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
export function parseSettings(raw: unknown): Settings | null {
  const s = record(raw);
  if (s.version !== 1 || !Array.isArray(s.profiles)) return null;
  const seen = new Set<string>();
  const profiles: Profile[] = s.profiles.flatMap((value) => {
    const p = record(value);
    if (typeof p.id !== "string" || !p.id || seen.has(p.id)) return [];
    seen.add(p.id);
    return [{
      id: p.id, name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Profile", isPrimary: p.isPrimary === true,
      preferences: parsePreferences(p.preferences),
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
export function settingsFromLegacy(legacy: unknown, legacyStartDay?: string | null, legacyClock?: string | null): Settings {
  const l = record(legacy);
  const preferences = parsePreferences({
    agendaPreference: l.agendaPreference,
    lastPinned: l.lastPinned,
    startDay: l.startDay ?? legacyStartDay,
    clock: l.clock ?? legacyClock,
    hiddenCalendars: l.hidden,
    // The old single Developer Mode switch showed both beta destinations, so keep them visible.
    betaFeatures: l.developer === true ? { fluidCalendar: true, thinkAboutIt: true } : undefined,
  });
  const settings = defaultSettings(preferences);
  settings.account.developerMode = l.developer === true;
  return settings;
}

export const activeProfile = (s: Settings) => s.profiles.find((p) => p.id === s.account.activeProfileId) ?? s.profiles.find((p) => p.isPrimary)!;

// Saved choices are never overwritten by the master switch; availability is computed.
export function effectiveFeatures(s: Settings): EffectiveFeatures {
  const dev = s.account.developerMode, beta = activeProfile(s).preferences.betaFeatures;
  return { developerMode: dev, fluidCalendar: dev && beta.fluidCalendar, thinkAboutIt: dev && beta.thinkAboutIt, testProfiles: dev && s.account.testProfilesEnabled };
}

export function updateAccount(s: Settings, patch: Partial<Omit<AccountSettings, "activeProfileId">>): Settings {
  return { ...s, account: { ...s.account, ...patch } };
}

export function updateActivePreferences(s: Settings, patch: (p: ProfilePreferences) => Partial<ProfilePreferences>, now = new Date().toISOString()): Settings {
  const active = activeProfile(s);
  return { ...s, profiles: s.profiles.map((p) => (p.id === active.id ? { ...p, preferences: parsePreferences({ ...p.preferences, ...patch(p.preferences) }), updatedAt: now } : p)) };
}
