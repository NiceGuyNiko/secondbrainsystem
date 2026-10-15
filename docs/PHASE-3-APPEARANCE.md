# Phase 3 — Appearance, themes and adaptive logo

Branch `feature/phase-3-appearance`, built on `feature/phase-2-test-profiles`. Not merged; no production database change.

## Themes (`lib/appearance.ts`)

- **Dark (7, unchanged):** Midnight, Slate, Forest (`midnight-forest`; shown as "Forest"), Deep Ocean, Warm Botanical, Neon Evergreen, Black & Gold. Every original token value is preserved and protected by `tests/baseline-appearance.test.ts`; Phase 3 only adds new tokens (selection, menus, switch, logo).
- **Light (4, new):** Porcelain & Ink, Warm Linen, Sage Studio, Blue Hour. Each has explicit values for canvas, sidebar, cards, elevated surfaces, borders, strong borders, text (primary/secondary/muted), selected background and text, accent, text on accent, hover, focus ring, menus, switch track and logo. Starting values come from the specification; muted text and strong borders were darkened slightly so every pairing meets WCAG AA (tested).
- Settings → Appearance shows **Dark themes** and **Light themes** as separate groups. The *Colour mode* control is gone: the theme decides light or dark, and nothing follows the device or the time of day. Accent overrides, surface, corners, spacing, type and softer event colours still work on every theme.
- Calendar event colours are unchanged. GO / NA / blue BETA badges keep their meaning, with light-theme variants that pass contrast (7:1 or better).

## Migration of the old colour mode

Profiles saved with the old *Dark* mode keep their theme exactly. Profiles on *Light* — or *System* while the device was light — move once to the closest designed light theme (Midnight/Deep Ocean → Blue Hour, Slate → Porcelain & Ink, Forest/Neon Evergreen → Sage Studio, Warm Botanical/Black & Gold → Warm Linen). After that, every profile is "manual" and the device preference is never read again (`migrateThemeModes`).

## Adaptive emblem

- `scripts/build-brand-masks.mjs` turns the supplied `public/aaa-logo.png` into two transparency masks (`public/brand/aaa-mark-ring.png`, `public/brand/aaa-mark-glyph.png`) from the emblem's own brightness: same geometry and proportions, black background and glow removed. No redrawing.
- `components/brand-mark.tsx` colours the ring and letterform from the active theme (`--ui-logo-border`, `--ui-logo-glyph`); no backing square. Used in the expanded and collapsed sidebar, the mobile header and Settings → Appearance. Dark themes use the theme's highlight (gold on Black & Gold); light themes use a deep theme colour.
- **Browser tab icon:** `lib/favicon.ts` draws the emblem in the active theme's colours on a small rounded backing (for legibility at 16–32px) and updates the page icon. The static `/icon.png` remains the fallback; some browsers (notably Safari) keep the static icon. The Apple home-screen icon stays static.
- The original vector source is still an open asset request; the masks are generated from the 1254px raster.

## Per-profile behaviour

The theme and all appearance choices remain per profile. Switching profiles applies the theme before paint; reloads restore it; duplicating copies it; a profile created from defaults uses Forest.

## Tests

`tests/themes.test.ts`: 11 themes and groups, light themes explicit (no derived colours), WCAG AA for text on every light surface, accent text, button text, focus ring, control borders and logo, dark-theme text and logo legibility, concrete logo colours for every theme, colour-mode migration, per-profile themes through switching, duplication, defaults and reload. The older layout test now expects black side panels only on dark themes.
