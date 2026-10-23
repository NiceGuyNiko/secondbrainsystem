// Theme registry. Every theme is chosen manually; nothing switches automatically.
// Dark themes keep their original hand-tuned values and derivations (protected by
// tests/baseline-appearance.test.ts). Light themes are designed separately with explicit values
// for every surface; they are never produced by inverting or transforming a dark theme.
type DarkPalette = {
  id: string; name: string; description: string; scheme: "dark";
  surface: string; canvas: string; accent: string; highlight: string; text: string;
};
type LightPalette = {
  id: string; name: string; description: string; scheme: "light";
  canvas: string; sidebar: string; card: string; elevated: string; text: string; secondary: string; muted: string;
  border: string; borderStrong: string; selected: string; selectedText: string; accent: string; onAccent: string;
  hover: string; focus: string; floating: string; switchOff: string; logoGlyph: string; logoBorder: string;
};
export type Palette = DarkPalette | LightPalette;

export const palettes: readonly Palette[] = [
  { id: "darkest-night", name: "Darkest Night", description: "Near-black surfaces with cool starlight accents", scheme: "dark", surface: "#11131E", canvas: "#080A12", accent: "#735BBF", highlight: "#B5A6FF", text: "#F5F4FD" },
  { id: "midnight", name: "Midnight", description: "Deep blue and clear accents", scheme: "dark", surface: "#141D31", canvas: "#0B1021", accent: "#3556A2", highlight: "#91B4FF", text: "#F0F4FF" },
  { id: "slate", name: "Slate", description: "Quiet charcoal neutrals", scheme: "dark", surface: "#222832", canvas: "#15191E", accent: "#526574", highlight: "#B9CCD9", text: "#F1F5F8" },
  { id: "midnight-forest", name: "Forest", description: "Calm forest greens", scheme: "dark", surface: "#121916", canvas: "#0C120F", accent: "#346851", highlight: "#79C7A3", text: "#F2F6F3" },
  { id: "deep-ocean", name: "Deep Ocean", description: "Cool and considered", scheme: "dark", surface: "#101C23", canvas: "#0B1319", accent: "#346851", highlight: "#5DB9C0", text: "#EDF9FA" },
  { id: "warm-botanical", name: "Warm Botanical", description: "Warm organic neutrals", scheme: "dark", surface: "#1C1916", canvas: "#13110E", accent: "#346851", highlight: "#C9A976", text: "#F4EFE6" },
  { id: "neon-evergreen", name: "Neon Evergreen", description: "Bright evergreen details", scheme: "dark", surface: "#15191A", canvas: "#0D1210", accent: "#346851", highlight: "#A8F2C6", text: "#FFFFFF" },
  { id: "black-gold", name: "Black & Gold", description: "Antique gold and warm ivory", scheme: "dark", surface: "#1B1812", canvas: "#120F0B", accent: "#C6A15C", highlight: "#E8D39A", text: "#F6F1E7" },
  {
    id: "porcelain-ink", name: "Porcelain & Ink", description: "Clean porcelain with ink-dark type", scheme: "light",
    canvas: "#F5F7FA", sidebar: "#EBF0F5", card: "#FFFFFF", elevated: "#F8FAFC", text: "#16253A", secondary: "#465970", muted: "#55626E",
    border: "#CBD5E0", borderStrong: "#74869A", selected: "#DFE9F3", selectedText: "#16253A", accent: "#244E7C", onAccent: "#FFFFFF",
    hover: "#EAF0F6", focus: "#2260A8", floating: "#FFFFFF", switchOff: "#B1BFCD", logoGlyph: "#244E7C", logoBorder: "#7D93AA",
  },
  {
    id: "warm-linen", name: "Warm Linen", description: "Natural linen with soft warm neutrals", scheme: "light",
    canvas: "#F8F5EF", sidebar: "#F0EADC", card: "#FFFDF8", elevated: "#FBF8F1", text: "#322A20", secondary: "#65594B", muted: "#665B4B",
    border: "#D9CEBD", borderStrong: "#8C7C64", selected: "#EAE0C9", selectedText: "#322A20", accent: "#80602E", onAccent: "#FFFFFF",
    hover: "#F1E8D9", focus: "#805621", floating: "#FFFBF2", switchOff: "#B8AA96", logoGlyph: "#77562A", logoBorder: "#A78C67",
  },
  {
    id: "sage-studio", name: "Sage Studio", description: "Soft sage and natural light surfaces", scheme: "light",
    canvas: "#F5F7F1", sidebar: "#E8EDE4", card: "#FFFFFB", elevated: "#F8FAF4", text: "#20352B", secondary: "#4A6155", muted: "#536358",
    border: "#C7D4C7", borderStrong: "#6E8474", selected: "#DBE8DA", selectedText: "#20352B", accent: "#285C45", onAccent: "#FFFFFF",
    hover: "#E8F0E5", focus: "#246E50", floating: "#FCFDF9", switchOff: "#A9BAAD", logoGlyph: "#285C45", logoBorder: "#83A08A",
  },
  {
    id: "blue-hour", name: "Blue Hour", description: "Pale blue light with deep blue accents", scheme: "light",
    canvas: "#F3F7FB", sidebar: "#E6EFF7", card: "#FFFFFF", elevated: "#F7FAFD", text: "#172C43", secondary: "#496176", muted: "#50647A",
    border: "#C6D6E5", borderStrong: "#6C859D", selected: "#D9E9F8", selectedText: "#172C43", accent: "#215C94", onAccent: "#FFFFFF",
    hover: "#E7F1FA", focus: "#1A6BAB", floating: "#FFFFFF", switchOff: "#AABFD3", logoGlyph: "#215C94", logoBorder: "#86A6C2",
  },
];
export const darkPalettes = palettes.filter((p): p is DarkPalette => p.scheme === "dark");
export const lightPalettes = palettes.filter((p): p is LightPalette => p.scheme === "light");

export type Appearance = {
  version: 1;
  preset: string;
  primaryAccentOverride: string | null;
  highlightAccentOverride: string | null;
  surface: "flat" | "layered" | "defined";
  corners: "sharp" | "soft" | "rounded";
  density: "compact" | "balanced" | "airy";
  font: "modern" | "system" | "editorial";
  softenEventColours: boolean;
};
export const appearanceDefaults: Appearance = {
  version: 1,
  preset: "midnight-forest",
  primaryAccentOverride: null,
  highlightAccentOverride: null,
  surface: "layered",
  corners: "soft",
  density: "balanced",
  font: "modern",
  softenEventColours: false,
};
export const appearanceKey = "aaa-appearance-studio-v1";
export function parseAppearance(raw: unknown): Appearance {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<Appearance>;
  return {
    ...appearanceDefaults,
    preset: palettes.some((x) => x.id === p.preset) ? p.preset! : appearanceDefaults.preset,
    primaryAccentOverride: validHex(p.primaryAccentOverride) ? p.primaryAccentOverride! : null,
    highlightAccentOverride: validHex(p.highlightAccentOverride) ? p.highlightAccentOverride! : null,
    surface: ["flat", "layered", "defined"].includes(p.surface || "") ? p.surface! : appearanceDefaults.surface,
    corners: ["sharp", "soft", "rounded"].includes(p.corners || "") ? p.corners! : appearanceDefaults.corners,
    density: ["compact", "balanced", "airy"].includes(p.density || "") ? p.density! : appearanceDefaults.density,
    font: ["modern", "system", "editorial"].includes(p.font || "") ? p.font! : appearanceDefaults.font,
    softenEventColours: p.softenEventColours === true,
  };
}
export const validHex = (s: unknown): s is string => typeof s === "string" && /^#[\da-f]{6}$/i.test(s);
export function foreground(hex: string) {
  const c = hex
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722 > 0.179 ? "#101310" : "#FFFFFF";
}
// Linear blend of two hex colours, used where a concrete colour is needed (e.g. the favicon).
export function mixHex(a: string, b: string, weightOfA: number) {
  const pa = a.slice(1).match(/../g)!.map((x) => parseInt(x, 16)), pb = b.slice(1).match(/../g)!.map((x) => parseInt(x, 16));
  return "#" + pa.map((x, i) => Math.round(x * weightOfA + pb[i] * (1 - weightOfA)).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export const paletteFor = (id: string): Palette => palettes.find((p) => p.id === id) ?? palettes.find((p) => p.id === appearanceDefaults.preset)!;
export const schemeOf = (p: Appearance) => paletteFor(p.preset).scheme;

// Nearest designed light theme for each dark theme, used once to move people who had chosen the
// old automatic Light (or System while their device was light) onto a real light theme.
export const lightCounterpart: Record<string, string> = {
  "darkest-night": "porcelain-ink",
  midnight: "blue-hour", slate: "porcelain-ink", "midnight-forest": "sage-studio", "deep-ocean": "blue-hour",
  "warm-botanical": "warm-linen", "neon-evergreen": "sage-studio", "black-gold": "warm-linen",
};

const shape = (p: Appearance) => ({
  radius: p.corners === "sharp" ? "3px" : p.corners === "soft" ? "10px" : "18px",
  "row-padding": p.density === "compact" ? "4px" : p.density === "balanced" ? "8px" : "12px",
  font: p.font === "editorial" ? "Georgia, serif" : p.font === "system" ? "system-ui, sans-serif" : "Inter, ui-sans-serif, system-ui, sans-serif",
});

export function themeTokens(p: Appearance): Record<string, string> {
  const v = paletteFor(p.preset);
  if (v.scheme === "light") {
    const accent = p.primaryAccentOverride || v.accent, bright = p.highlightAccentOverride || v.accent;
    const tokens: Record<string, string> = {
      canvas: v.canvas, sidebar: v.sidebar, agenda: v.sidebar, calendar: v.card, "calendar-alt": v.canvas, panel: v.card, toolbar: v.canvas,
      elevated: v.elevated, hover: v.hover, border: p.surface === "defined" ? v.borderStrong : v.border, "border-strong": v.borderStrong,
      text: v.text, muted: v.secondary, subtle: v.muted, accent, "accent-bright": bright,
      "accent-soft": p.primaryAccentOverride ? mixHex(accent, "#FFFFFF", 0.16) : v.selected,
      "on-accent": p.primaryAccentOverride ? foreground(accent) : v.onAccent, "focus-ring": v.focus,
      "selected-text": v.selectedText, floating: v.floating, "switch-off": v.switchOff,
      "logo-glyph": v.logoGlyph, "logo-border": v.logoBorder, "logo-backing": "transparent",
      ...shape(p),
    };
    if (p.surface === "flat") tokens.elevated = tokens.panel;
    return tokens;
  }
  const accent = p.primaryAccentOverride || v.accent, bright = p.highlightAccentOverride || v.highlight;
  const tokens: Record<string, string> = {
    canvas: v.canvas,
    sidebar: "#000000",
    agenda: "#000000",
    calendar: v.surface,
    "calendar-alt": v.canvas,
    panel: v.surface,
    toolbar: v.canvas,
    elevated: `color-mix(in srgb, ${v.surface} 84%, ${bright})`,
    hover: `color-mix(in srgb, ${v.surface} 78%, ${bright})`,
    border: `color-mix(in srgb, ${v.surface} ${p.surface === "defined" ? 65 : 80}%, ${bright})`,
    "border-strong": `color-mix(in srgb, ${v.surface} 50%, ${bright})`,
    text: v.text,
    muted: v.id === "black-gold" ? "#C0B19A" : "#AFBFB5",
    subtle: v.id === "black-gold" ? "#AB9879" : "#92A69A",
    accent,
    "accent-bright": bright,
    "accent-soft": `color-mix(in srgb, ${accent} 24%, ${v.surface})`,
    "on-accent": foreground(accent),
    "focus-ring": bright,
    ...shape(p),
    // Added in Phase 3 (not part of the original dark baseline): selection, menus, switches, logo.
    "selected-text": v.text,
    floating: v.surface,
    "switch-off": mixHex(v.surface, "#FFFFFF", 0.7),
    "logo-glyph": bright,
    "logo-border": mixHex(bright, v.surface, 0.6),
    "logo-backing": "transparent",
  };
  if (p.surface === "flat") tokens.elevated = tokens.panel;
  return tokens;
}

// Applies the chosen theme. The colour scheme comes from the theme itself; the operating system's
// light/dark preference is never consulted. Returns the applied tokens.
export function applyAppearance(p: Appearance) {
  const scheme = schemeOf(p);
  const raw = themeTokens(p);
  document.documentElement.dataset.theme = scheme;
  document.documentElement.dataset.softenEvents = String(p.softenEventColours);
  const tokens = Object.fromEntries(Object.entries(raw).map(([k, v]) => ["--ui-" + k, v]));
  for (const [k, v] of Object.entries(tokens)) document.documentElement.style.setProperty(k, v);
  try {
    localStorage.setItem("aaa-resolved-theme-v1", JSON.stringify({ mode: scheme, tokens }));
  } catch {}
  return raw;
}
export function ownedPageTitle(name: string, page: string) {
  const n = name.trim();
  return n ? `${n}${/s$/i.test(n) ? "'" : "'s"} ${page}` : `Your ${page}`;
}
