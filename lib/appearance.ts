export const palettes = [
  {
    id: "midnight-forest",
    name: "Midnight Forest",
    description: "Calm forest greens",
    surface: "#121916",
    canvas: "#0C120F",
    accent: "#346851",
    highlight: "#79C7A3",
    text: "#F2F6F3",
  },
  {
    id: "deep-ocean",
    name: "Deep Ocean",
    description: "Cool and considered",
    surface: "#101C23",
    canvas: "#0B1319",
    accent: "#346851",
    highlight: "#5DB9C0",
    text: "#EDF9FA",
  },
  {
    id: "warm-botanical",
    name: "Warm Botanical",
    description: "Warm organic neutrals",
    surface: "#1C1916",
    canvas: "#13110E",
    accent: "#346851",
    highlight: "#C9A976",
    text: "#F4EFE6",
  },
  {
    id: "neon-evergreen",
    name: "Neon Evergreen",
    description: "Bright evergreen details",
    surface: "#15191A",
    canvas: "#0D1210",
    accent: "#346851",
    highlight: "#A8F2C6",
    text: "#FFFFFF",
  },
  {
    id: "black-gold",
    name: "Black & Gold",
    description: "Antique gold and warm ivory",
    surface: "#1B1812",
    canvas: "#120F0B",
    accent: "#C6A15C",
    highlight: "#E8D39A",
    text: "#F6F1E7",
  },
] as const;
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
    preset: palettes.some((x) => x.id === p.preset)
      ? p.preset!
      : appearanceDefaults.preset,
    primaryAccentOverride: validHex(p.primaryAccentOverride)
      ? p.primaryAccentOverride!
      : null,
    highlightAccentOverride: validHex(p.highlightAccentOverride)
      ? p.highlightAccentOverride!
      : null,
    surface: ["flat", "layered", "defined"].includes(p.surface || "")
      ? p.surface!
      : appearanceDefaults.surface,
    corners: ["sharp", "soft", "rounded"].includes(p.corners || "")
      ? p.corners!
      : appearanceDefaults.corners,
    density: ["compact", "balanced", "airy"].includes(p.density || "")
      ? p.density!
      : appearanceDefaults.density,
    font: ["modern", "system", "editorial"].includes(p.font || "")
      ? p.font!
      : appearanceDefaults.font,
    softenEventColours: p.softenEventColours === true,
  };
}
export const validHex = (s: unknown): s is string =>
  typeof s === "string" && /^#[\da-f]{6}$/i.test(s);
export function foreground(hex: string) {
  const c = hex
    .slice(1)
    .match(/../g)!
    .map((x) => parseInt(x, 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722 > 0.179
    ? "#101310"
    : "#FFFFFF";
}
export function themeTokens(p: Appearance, light = false) {
  const v = palettes.find((v) => v.id === p.preset) || palettes[0],
    accent = p.primaryAccentOverride || v.accent,
    bright = p.highlightAccentOverride || v.highlight;
  const tokens: Record<string, string> = {
    canvas: light ? "#F1F5F2" : v.canvas,
    sidebar: light ? "#FFFFFF" : "#000000",
    agenda: light ? "#FFFFFF" : "#000000",
    calendar: light ? "#FFFFFF" : v.surface,
    "calendar-alt": light ? "#F6F8F6" : v.canvas,
    panel: light ? "#FFFFFF" : v.surface,
    toolbar: light ? "#F6F8F6" : v.canvas,
    elevated: light
      ? "#EAF0EC"
      : `color-mix(in srgb, ${v.surface} 84%, ${bright})`,
    hover: light
      ? "#E3EBE6"
      : `color-mix(in srgb, ${v.surface} 78%, ${bright})`,
    border: light
      ? "#C6D2CA"
      : `color-mix(in srgb, ${v.surface} ${p.surface === "defined" ? 65 : 80}%, ${bright})`,
    "border-strong": light
      ? "#8A9D90"
      : `color-mix(in srgb, ${v.surface} 50%, ${bright})`,
    text: light ? "#17251C" : v.text,
    muted: light ? "#506256" : v.id === "black-gold" ? "#C0B19A" : "#AFBFB5",
    subtle: light ? "#617268" : v.id === "black-gold" ? "#AB9879" : "#92A69A",
    accent,
    "accent-bright": bright,
    "accent-soft": `color-mix(in srgb, ${accent} 24%, ${light ? "#FFFFFF" : v.surface})`,
    "on-accent": foreground(accent),
    "focus-ring": light ? accent : bright,
    radius:
      p.corners === "sharp" ? "3px" : p.corners === "soft" ? "10px" : "18px",
    "row-padding":
      p.density === "compact"
        ? "4px"
        : p.density === "balanced"
          ? "8px"
          : "12px",
    font:
      p.font === "editorial"
        ? "Georgia, serif"
        : p.font === "system"
          ? "system-ui, sans-serif"
          : "Inter, ui-sans-serif, system-ui, sans-serif",
  };
  if (p.surface === "flat") tokens.elevated = tokens.panel;
  return tokens;
}
export function applyAppearance(
  p: Appearance,
  mode: "dark" | "light" | "system",
) {
  const light =
    mode === "light" ||
    (mode === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.dataset.theme = light ? "light" : "dark";
  document.documentElement.dataset.softenEvents = String(p.softenEventColours);
  const tokens = Object.fromEntries(
    Object.entries(themeTokens(p, light)).map(([k, v]) => ["--ui-" + k, v]),
  );
  for (const [k, v] of Object.entries(tokens))
    document.documentElement.style.setProperty(k, v);
  localStorage.setItem(
    "aaa-resolved-theme-v1",
    JSON.stringify({ mode: light ? "light" : "dark", tokens }),
  );
}
export function ownedPageTitle(name: string, page: string) {
  const n = name.trim();
  return n ? `${n}${/s$/i.test(n) ? "'" : "'s"} ${page}` : `Your ${page}`;
}
