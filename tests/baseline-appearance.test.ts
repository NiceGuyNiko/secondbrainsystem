import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { palettes, themeTokens, parseAppearance, appearanceDefaults } from "../lib/appearance";

// Captured from main at fbc6cdb. All seven dark themes must keep every original token value.
// New tokens may be added (Phase 3 added logo, menu and switch tokens); changing an original value
// requires a deliberate, reviewed update of this fixture in the same commit.
const baseline = JSON.parse(readFileSync(new URL("./fixtures/dark-theme-tokens.baseline.json", import.meta.url), "utf8")) as Record<string, Record<string, string>>;

test("All seven dark themes keep their baseline tokens", () => {
  assert.deepEqual(Object.keys(baseline).sort(), ["black-gold", "deep-ocean", "midnight", "midnight-forest", "neon-evergreen", "slate", "warm-botanical"]);
  for (const id of Object.keys(baseline)) {
    assert.ok(palettes.some((p) => p.id === id), `dark theme ${id} must remain selectable`);
    const tokens = themeTokens({ ...appearanceDefaults, preset: id });
    for (const [token, value] of Object.entries(baseline[id])) assert.equal(tokens[token], value, `${id} ${token}`);
  }
});

test("Saved appearance preferences keep parsing to the same values", () => {
  const saved = { preset: "black-gold", primaryAccentOverride: "#123456", highlightAccentOverride: "bad", surface: "defined", corners: "rounded", density: "airy", font: "editorial", softenEventColours: true };
  assert.deepEqual(parseAppearance(saved), { ...appearanceDefaults, ...saved, highlightAccentOverride: null });
  assert.deepEqual(parseAppearance(null), appearanceDefaults);
  assert.equal(parseAppearance({ preset: "unknown" }).preset, appearanceDefaults.preset);
});
