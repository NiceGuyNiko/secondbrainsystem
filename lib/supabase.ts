import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { environment } from "./environment";
import { createDemoClient, DemoDatabase } from "./demo/client";
import { demoSeed } from "./demo/seed";

// When configuration is invalid the app renders a configuration error instead of the workspace,
// so this placeholder is never used; it exists to make any accidental use fail loudly.
const unavailable = (reason: string) =>
  new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(`Supabase is not configured: ${reason}`);
    },
  });

const browserStorage = () => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

// Demo Mode never creates a real Supabase client, so no request can reach any Supabase project.
export const demoDatabase = environment.ok && environment.data === "demo" ? new DemoDatabase(browserStorage(), () => demoSeed()) : null;

export const supabase: SupabaseClient = !environment.ok
  ? unavailable(environment.reason)
  : demoDatabase
    ? createDemoClient(demoDatabase)
    : createClient(environment.url, environment.key);
