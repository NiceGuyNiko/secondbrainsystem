"use client";
import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import Switch from "./switch";
import BrandMark from "./brand-mark";
import {
  darkPalettes,
  lightPalettes,
  paletteFor,
  themeTokens,
  appearanceDefaults,
  type Appearance,
  type Palette,
  validHex,
} from "@/lib/appearance";

// Colours used to draw each theme's preview card.
const preview = (p: Palette) =>
  p.scheme === "dark"
    ? { canvas: p.canvas, sidebar: "#000000", surface: p.surface, accent: p.accent, highlight: p.highlight, swatches: [p.canvas, p.surface, p.accent, p.highlight] }
    : { canvas: p.canvas, sidebar: p.sidebar, surface: p.card, accent: p.accent, highlight: p.focus, swatches: [p.canvas, p.sidebar, p.accent, p.text] };
const accentDefaults = (p: Palette) => (p.scheme === "dark" ? { primary: p.accent, highlight: p.highlight } : { primary: p.accent, highlight: p.accent });

export default function AppearanceSettings({
  value,
  onChange,
  startDay,
  onStartDay,
  clock,
  onClock,
  onBack,
}: {
  value: Appearance;
  onChange: (p: Appearance) => void;
  startDay: string;
  onStartDay: (s: string) => void;
  clock: string;
  onClock: (s: string) => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState("");
  const patch = (p: Partial<Appearance>) => onChange({ ...value, ...p });
  const palette = paletteFor(value.preset);
  const defaults = accentDefaults(palette);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        ":root {\n" +
          Object.entries(themeTokens(value))
            .map(([k, v]) => `  --ui-${k}: ${v};`)
            .join("\n") +
          "\n}",
      );
      setStatus("Theme CSS copied.");
    } catch {
      setStatus("Clipboard unavailable in this browser.");
    }
  };
  const group = (title: string, list: readonly Palette[]) => (
    <div className="aaa-theme-group" role="group" aria-label={`${title} themes`}>
      <h3>{title} themes</h3>
      <div className="aaa-palette-grid">
        {list.map((p) => {
          const c = preview(p);
          return (
            <button
              key={p.id}
              aria-pressed={value.preset === p.id}
              className={`aaa-palette-card ${value.preset === p.id ? "selected" : ""}`}
              onClick={() =>
                onChange({
                  ...value,
                  preset: p.id,
                  primaryAccentOverride: null,
                  highlightAccentOverride: null,
                })
              }
            >
              <span className="aaa-mini-shell" style={{ background: c.canvas }}>
                <i style={{ background: c.sidebar }} />
                <span style={{ background: c.surface }}>
                  {Array.from({ length: 21 }, (_, i) => (
                    <b key={i} style={{ background: i % 5 === 0 ? c.accent : "transparent" }} />
                  ))}
                </span>
                <i style={{ background: c.sidebar, borderLeft: `2px solid ${c.highlight}` }} />
              </span>
              <strong>
                {p.name}
                {value.preset === p.id && <Check size={16} />}
              </strong>
              <small>{p.description}</small>
              <span className="aaa-swatches">
                {c.swatches.map((colour, i) => (
                  <i key={i} style={{ background: colour }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <div className="aaa-settings">
      <p className="aaa-eyebrow">Settings / Appearance</p>
      <h1>Make this space yours.</h1>
      <p className="calendar-subtle">
        Changes apply immediately and are saved to your current profile. Your calendar colours stay their own.
      </p>
      <div className="aaa-settings-grid">
        <section>
          <h2>01 · Themes</h2>
          <p className="calendar-muted text-xs">Your theme only changes when you choose a different one. It never follows your device’s light or dark setting.</p>
          {group("Dark", darkPalettes)}
          {group("Light", lightPalettes)}
          <p className="calendar-muted text-xs">Choosing a theme resets custom accents.</p>
          <p role="status" className="aaa-active-theme">
            <BrandMark size={22} /> Active theme: <strong>{palette.name}</strong> · {palette.scheme === "dark" ? "Dark" : "Light"}
          </p>
        </section>
        <section className="aaa-customize">
          <h2>02 · Make it yours</h2>
          {(["primaryAccentOverride", "highlightAccentOverride"] as const).map((key, i) => (
            <label key={key}>
              {i ? "Highlight accent" : "Primary accent"}
              <span className="aaa-colour-control">
                <input
                  type="color"
                  aria-label={i ? "Highlight colour" : "Primary colour"}
                  value={value[key] || (i ? defaults.highlight : defaults.primary)}
                  onChange={(e) => patch({ [key]: e.target.value })}
                />
                <input
                  aria-label={i ? "Highlight hex" : "Primary hex"}
                  key={value[key] || palette.id}
                  defaultValue={value[key] || (i ? defaults.highlight : defaults.primary)}
                  maxLength={7}
                  onBlur={(e) => {
                    if (validHex(e.target.value)) patch({ [key]: e.target.value });
                    else e.target.value = value[key] || (i ? defaults.highlight : defaults.primary);
                  }}
                />
              </span>
            </label>
          ))}
          {(
            [
              { key: "surface", label: "Surface treatment", options: ["flat", "layered", "defined"] },
              { key: "corners", label: "Corner style", options: ["sharp", "soft", "rounded"] },
              { key: "density", label: "Spacing", options: ["compact", "balanced", "airy"] },
              { key: "font", label: "Type style", options: ["modern", "system", "editorial"] },
            ] as const
          ).map((group) => (
            <fieldset key={group.key}>
              <legend>{group.label}</legend>
              <div className="aaa-options">
                {group.options.map((option) => (
                  <button key={option} aria-pressed={value[group.key] === option} onClick={() => patch({ [group.key]: option })}>
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <Switch
            label="Softer calendar event colours"
            checked={value.softenEventColours}
            onChange={(softenEventColours) => patch({ softenEventColours })}
          />
          <div className="aaa-options">
            <button onClick={() => void copy()}>
              <Copy size={15} />
              Copy theme CSS
            </button>
            <button onClick={() => onChange({ ...appearanceDefaults })}>
              <RotateCcw size={15} />
              Reset
            </button>
          </div>
          <h2>Calendar preferences</h2>
          <label>
            Week starts on
            <select value={startDay} onChange={(e) => onStartDay(e.target.value)}>
              {["Monday", "Sunday", "Saturday"].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            Clock format
            <select value={clock} onChange={(e) => onClock(e.target.value)}>
              <option>12-hour</option>
              <option>24-hour</option>
            </select>
          </label>
          <button className="calendar-primary" onClick={onBack}>
            Back to calendar
          </button>
          <p role="status">{status}</p>
        </section>
      </div>
    </div>
  );
}
