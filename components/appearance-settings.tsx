"use client";
import { useState } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import {
  palettes,
  themeTokens,
  appearanceDefaults,
  type Appearance,
  validHex,
} from "@/lib/appearance";
export default function AppearanceSettings({
  value,
  onChange,
  mode,
  onMode,
  startDay,
  onStartDay,
  clock,
  onClock,
  showCalendarPreferences = true,
  onBack,
}: {
  value: Appearance;
  onChange: (p: Appearance) => void;
  mode: string;
  onMode: (v: "light" | "dark" | "system") => void;
  startDay: string;
  onStartDay: (s: string) => void;
  clock: string;
  onClock: (s: string) => void;
  showCalendarPreferences?: boolean;
  onBack: () => void;
}) {
  const [status, setStatus] = useState("");
  const patch = (p: Partial<Appearance>) => onChange({ ...value, ...p });
  const palette = palettes.find((p) => p.id === value.preset) || palettes[0];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        ":root {\n" +
          Object.entries(themeTokens(value, mode === "light"))
            .map(([k, v]) => `  --ui-${k}: ${v};`)
            .join("\n") +
          "\n}",
      );
      setStatus("Theme CSS copied.");
    } catch {
      setStatus("Clipboard unavailable in this browser.");
    }
  };
  return (
    <div className="aaa-settings">
      <p className="aaa-eyebrow">Settings / Appearance</p>
      <h1>Make this space yours.</h1>
      <p className="calendar-subtle">
        Changes apply immediately. Your calendar colours stay their own.
      </p>
      <div className="aaa-settings-grid">
        <section>
          <h2>01 · Colour palettes</h2>
          <div className="aaa-palette-grid">
            {palettes.map((p) => (
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
                <span
                  className="aaa-mini-shell"
                  style={{ background: p.canvas }}
                >
                  <i style={{ background: "#000" }} />
                  <span style={{ background: p.surface }}>
                    {Array.from({ length: 21 }, (_, i) => (
                      <b
                        key={i}
                        style={{
                          background: i % 5 === 0 ? p.accent : "transparent",
                        }}
                      />
                    ))}
                  </span>
                  <i
                    style={{
                      background: "#000",
                      borderLeft: `2px solid ${p.highlight}`,
                    }}
                  />
                </span>
                <strong>
                  {p.name}
                  {value.preset === p.id && <Check size={16} />}
                </strong>
                <small>{p.description}</small>
                <span className="aaa-swatches">
                  {[p.canvas, p.surface, p.accent, p.highlight].map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
              </button>
            ))}
          </div>
          <p className="calendar-muted text-xs">
            Dark side panels stay true black. Choosing a palette resets custom
            accents.
          </p>
          <p role="status">
            Active palette: <strong>{palette.name}</strong>
          </p>
        </section>
        <section className="aaa-customize">
          <h2>02 · Make it yours</h2>
          <label>
            Colour mode
            <select
              value={mode}
              onChange={(e) =>
                onMode(e.target.value as "dark" | "light" | "system")
              }
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
          {(["primaryAccentOverride", "highlightAccentOverride"] as const).map(
            (key, i) => (
              <label key={key}>
                {i ? "Highlight accent" : "Primary accent"}
                <span className="aaa-colour-control">
                  <input
                    type="color"
                    aria-label={i ? "Highlight colour" : "Primary colour"}
                    value={
                      value[key] || (i ? palette.highlight : palette.accent)
                    }
                    onChange={(e) => patch({ [key]: e.target.value })}
                  />
                  <input
                    aria-label={i ? "Highlight hex" : "Primary hex"}
                    key={value[key] || palette.id}
                    defaultValue={
                      value[key] || (i ? palette.highlight : palette.accent)
                    }
                    maxLength={7}
                    onBlur={(e) => {
                      if (validHex(e.target.value))
                        patch({ [key]: e.target.value });
                      else
                        e.target.value =
                          value[key] ||
                          (i ? palette.highlight : palette.accent);
                    }}
                  />
                </span>
              </label>
            ),
          )}
          {(
            [
              {
                key: "surface",
                label: "Surface treatment",
                options: ["flat", "layered", "defined"],
              },
              {
                key: "corners",
                label: "Corner style",
                options: ["sharp", "soft", "rounded"],
              },
              {
                key: "density",
                label: "Spacing",
                options: ["compact", "balanced", "airy"],
              },
              {
                key: "font",
                label: "Type style",
                options: ["modern", "system", "editorial"],
              },
            ] as const
          ).map((group) => (
            <fieldset key={group.key}>
              <legend>{group.label}</legend>
              <div className="aaa-options">
                {group.options.map((option) => (
                  <button
                    key={option}
                    aria-pressed={value[group.key] === option}
                    onClick={() => patch({ [group.key]: option })}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="aaa-check">
            <input
              type="checkbox"
              checked={value.softenEventColours}
              onChange={(e) => patch({ softenEventColours: e.target.checked })}
            />
            Softer calendar event colours
          </label>
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
          {showCalendarPreferences && (
            <>
              <h2>Calendar preferences</h2>
              <label>
                Week starts on
                <select value={startDay} onChange={(e) => onStartDay(e.target.value)}>
                  {["Monday", "Sunday", "Saturday"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label>
                Clock format
                <select value={clock} onChange={(e) => onClock(e.target.value)}>
                  <option>12-hour</option>
                  <option>24-hour</option>
                </select>
              </label>
            </>
          )}
          <button className="calendar-primary" onClick={onBack}>
            Back to calendar
          </button>
          <p role="status">{status}</p>
        </section>
      </div>
    </div>
  );
}
