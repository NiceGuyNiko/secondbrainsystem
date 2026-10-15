import test from "node:test";
import assert from "node:assert/strict";
import { appearanceDefaults, darkPalettes, lightCounterpart, lightPalettes, palettes, parseAppearance, schemeOf, themeTokens } from "../lib/appearance";
import {
  activeProfile, createProfile, defaultPreferences, defaultSettings, duplicateProfile, migrateThemeModes, primaryOf, switchProfile,
  updateAccount, updateActivePreferences, type Settings,
} from "../lib/settings/model";
import { browserSettingsStore } from "../lib/settings/store";

const luminance = (hex: string) => {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((x) => parseInt(x, 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const tokens = (preset: string) => themeTokens({ ...appearanceDefaults, preset });

test("Eleven manually selectable themes: the seven dark themes and four designed light themes", () => {
  assert.deepEqual(darkPalettes.map((p) => p.name), ["Midnight", "Slate", "Forest", "Deep Ocean", "Warm Botanical", "Neon Evergreen", "Black & Gold"]);
  assert.deepEqual(lightPalettes.map((p) => p.name), ["Porcelain & Ink", "Warm Linen", "Sage Studio", "Blue Hour"]);
  assert.equal(new Set(palettes.map((p) => p.id)).size, 11);
  for (const p of palettes) assert.equal(schemeOf({ ...appearanceDefaults, preset: p.id }), p.scheme);
});

test("Light themes are explicit designs, not transformed dark themes", () => {
  for (const p of lightPalettes) {
    const t = tokens(p.id);
    assert.equal(t.canvas, p.canvas);
    assert.equal(t.sidebar, p.sidebar);
    assert.equal(t.panel, p.card);
    assert.equal(t.text, p.text);
    assert.equal(t.accent, p.accent);
    for (const v of Object.values(t)) assert.doesNotMatch(v, /color-mix/, `${p.id} uses only explicit colours`);
  }
});

test("Light themes meet WCAG AA contrast for text, accents and controls", () => {
  for (const p of lightPalettes) {
    const t = tokens(p.id);
    for (const surface of ["canvas", "sidebar", "panel", "elevated", "hover", "accent-soft", "floating"])
      for (const text of ["text", "muted", "subtle"])
        assert.ok(contrast(t[text], t[surface]) >= 4.5, `${p.id}: ${text} on ${surface} is ${contrast(t[text], t[surface]).toFixed(2)}`);
    assert.ok(contrast(t["selected-text"], t["accent-soft"]) >= 4.5, `${p.id}: selected text`);
    for (const surface of ["canvas", "panel", "sidebar"]) assert.ok(contrast(t["accent-bright"], t[surface]) >= 4.5, `${p.id}: accent text on ${surface}`);
    assert.ok(contrast(t["on-accent"], t.accent) >= 4.5, `${p.id}: button text`);
    for (const surface of ["canvas", "panel", "sidebar"]) {
      assert.ok(contrast(t["focus-ring"], t[surface]) >= 3, `${p.id}: focus ring on ${surface}`);
      assert.ok(contrast(t["border-strong"], t[surface]) >= 3, `${p.id}: control borders on ${surface}`);
      assert.ok(contrast(t["logo-glyph"], t[surface]) >= 4.5, `${p.id}: logo on ${surface}`);
    }
  }
});

test("Dark themes keep readable text and a visible logo", () => {
  for (const p of darkPalettes) {
    const t = tokens(p.id);
    for (const surface of ["canvas", "panel", "sidebar"]) {
      assert.ok(contrast(t.text, t[surface]) >= 7, `${p.id}: text on ${surface}`);
      assert.ok(contrast(t["logo-glyph"], t.sidebar) >= 4.5, `${p.id}: logo on the sidebar`);
    }
  }
});

test("Every theme provides concrete logo colours for the emblem and the browser icon, with no black backing on light themes", () => {
  for (const p of palettes) {
    const t = tokens(p.id);
    for (const key of ["logo-glyph", "logo-border", "canvas"]) assert.match(t[key], /^#[\dA-F]{6}$/i, `${p.id} ${key}`);
    assert.equal(t["logo-backing"], "transparent");
  }
});

test("Old Light and System colour modes move once to a designed theme; Dark keeps its theme", () => {
  const profileWith = (preset: string, themeMode: "dark" | "light" | "system") => updateActivePreferences(defaultSettings(), (p) => ({ themeMode, appearance: { ...p.appearance, preset, primaryAccentOverride: "#123456" } }));
  const dark = migrateThemeModes(profileWith("black-gold", "dark"), true);
  assert.equal(activeProfile(dark).preferences.appearance.preset, "black-gold");
  assert.equal(activeProfile(dark).preferences.appearance.primaryAccentOverride, "#123456", "custom accents kept when the theme is unchanged");
  const light = migrateThemeModes(profileWith("black-gold", "light"), false);
  assert.equal(activeProfile(light).preferences.appearance.preset, "warm-linen");
  assert.equal(activeProfile(light).preferences.themeMode, "manual");
  assert.equal(activeProfile(migrateThemeModes(profileWith("slate", "system"), true)).preferences.appearance.preset, "porcelain-ink");
  assert.equal(activeProfile(migrateThemeModes(profileWith("slate", "system"), false)).preferences.appearance.preset, "slate");
  const once = migrateThemeModes(light, true);
  assert.equal(once, light, "already-migrated settings are returned unchanged");
  for (const p of darkPalettes) assert.ok(lightPalettes.some((l) => l.id === lightCounterpart[p.id]), `${p.id} has a light counterpart`);
  assert.equal(defaultPreferences.themeMode, "manual");
});

test("Each profile keeps its own theme across switching, duplication and reloads", async () => {
  let s: Settings = updateAccount(defaultSettings(), { developerMode: true, testProfilesEnabled: true });
  const setTheme = (x: Settings, preset: string) => updateActivePreferences(x, (p) => ({ appearance: { ...p.appearance, preset } }));
  s = setTheme(s, "midnight-forest");
  const a = createProfile(s, "Profile A");
  s = setTheme(switchProfile(a.settings, a.id), "porcelain-ink");
  const b = createProfile(s, "Profile B", defaultPreferences);
  assert.equal(b.settings.profiles.at(-1)!.preferences.appearance.preset, appearanceDefaults.preset, "from defaults uses the default theme");
  s = setTheme(switchProfile(b.settings, b.id), "sage-studio");
  const dup = duplicateProfile(s, a.id, "Profile A copy");
  assert.equal(dup.settings.profiles.at(-1)!.preferences.appearance.preset, "porcelain-ink", "duplicates copy the theme");
  s = dup.settings;

  const storage = new Map<string, string>();
  const kv = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v) };
  await browserSettingsStore(kv, "me").save(s);
  const reloaded = await browserSettingsStore(kv, "me").load();
  assert.equal(activeProfile(reloaded).preferences.appearance.preset, "sage-studio");
  assert.equal(primaryOf(reloaded).preferences.appearance.preset, "midnight-forest");
  assert.equal(activeProfile(switchProfile(reloaded, a.id)).preferences.appearance.preset, "porcelain-ink");
  assert.equal(parseAppearance({ preset: "not-a-theme" }).preset, appearanceDefaults.preset, "unknown themes fall back safely");
});
