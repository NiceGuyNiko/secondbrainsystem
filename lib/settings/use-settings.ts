"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { environment } from "@/lib/environment";
import { supabase } from "@/lib/supabase";
import { activeProfile, defaultPreferences, defaultSettings, effectiveFeatures, migrateThemeModes, type EffectiveFeatures, type ProfilePreferences, type Settings } from "./model";
import { browserSettingsStore, tableSettingsStore } from "./store";

const storage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Loads settings once, then saves only explicit changes (never on load).
// A failed save restores the last saved settings and reports the problem.
export function useSettings(email: string, userId: string) {
  const store = useMemo(
    () => (environment.ok && environment.data === "demo" ? tableSettingsStore(supabase, userId, { storage: storage(), email }) : browserSettingsStore(storage(), email)),
    [email, userId],
  );
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const current = useRef<Settings | null>(null), committed = useRef<Settings | null>(null), writable = useRef(false);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    let live = true;
    writable.current = false;
    store.load().then(
      (stored) => {
        if (!live) return;
        // One-time conversion of the old Light/System colour modes (see migrateThemeModes). The
        // device's preference is read only here, only for profiles still on the old "system" value.
        const deviceIsLight = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
        const loaded = migrateThemeModes(stored, deviceIsLight);
        current.current = committed.current = loaded;
        writable.current = true;
        setSettings(loaded);
        if (loaded !== stored) void store.save(loaded).catch(() => {});
      },
      (e) => {
        if (!live) return;
        // Do not save over settings we could not read; changes stay in memory for this visit.
        current.current = committed.current = defaultSettings();
        setSettings(current.current);
        setError(`Your settings could not be loaded (${message(e)}). Changes will not be saved during this visit.`);
      },
    );
    return () => {
      live = false;
    };
  }, [store]);

  const update = useCallback(
    (change: (s: Settings) => Settings) => {
      if (!current.current) return;
      const next = change(current.current);
      current.current = next;
      setSettings(next);
      if (!writable.current) return;
      queue.current = queue.current.then(() =>
        store.save(next).then(
          () => {
            committed.current = next;
            setError("");
          },
          (e) => {
            current.current = committed.current;
            setSettings(committed.current);
            setError(`Couldn't save that change (${message(e)}). Your last saved settings were restored.`);
          },
        ),
      );
    },
    [store],
  );

  const preferences: ProfilePreferences = settings ? activeProfile(settings).preferences : defaultPreferences;
  const effective: EffectiveFeatures = settings ? effectiveFeatures(settings) : { developerMode: false, fluidCalendar: false, thinkAboutIt: false, testProfiles: false };
  return { settings, preferences, effective, update, error, dismissError: () => setError("") };
}
