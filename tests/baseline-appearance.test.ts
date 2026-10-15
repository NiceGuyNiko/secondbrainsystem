import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { palettes, themeTokens, parseAppearance, appearanceDefaults } from "../lib/appearance";

// Captured from main at fbc6cdb. Phase 3 must keep all seven dark themes visually identical
// unless a token change is deliberate and this fixture is updated in the same reviewed commit.
const baseline = JSON.parse(readFileSync(new URL("./fixtures/dark-theme-tokens.baseline.json", import.meta.url), "utf8")) as Record<string, Record<string, string>>;

test("All seven dark themes keep their baseline tokens", () => {
  assert.deepEqual(Object.keys(baseline).sort(), ["black-gold", "deep-ocean", "midnight", "midnight-forest", "neon-evergreen", "slate", "warm-botanical"]);
  for (const id of Object.keys(baseline)) {
    assert.ok(palettes.some((p) => p.id === id), `dark theme ${id} must remain selectable`);
    assert.deepEqual(themeTokens({ ...appearanceDefaults, preset: id }, false), baseline[id], id);
  }
});

test("Saved appearance preferences keep parsing to the same values", () => {
  const saved = { preset: "black-gold", primaryAccentOverride: "#123456", highlightAccentOverride: "bad", surface: "defined", corners: "rounded", density: "airy", font: "editorial", softenEventColours: true };
  assert.deepEqual(parseAppearance(saved), { ...appearanceDefaults, ...saved, highlightAccentOverride: null });
  assert.deepEqual(parseAppearance(null), appearanceDefaults);
  assert.equal(parseAppearance({ preset: "unknown" }).preset, appearanceDefaults.preset);
});
