import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { environment, type Environment } from "./environment";
import { createDemoClient, DemoDatabase, type DemoStorage } from "./demo/client";
import { demoSeed } from "./demo/seed";
import { installDemoNetworkGuard } from "./demo/network-guard";

// When configuration is invalid the app renders a configuration error instead of the workspace,
// so this placeholder is never used; it exists to make any accidental use fail loudly.
const unavailable = (reason: string) =>
  new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(`Supabase is not configured: ${reason}`);
    },
  });

// Chooses the data client for an environment. Demo Mode never creates a real Supabase client,
// so no request can reach any Supabase project. Exported for tests.
export function clientFor(env: Environment, deps: { storage: DemoStorage | null; create: typeof createClient }) {
  if (!env.ok) return { client: unavailable(env.reason), demo: null };
  if (env.data === "demo") {
    const demo = new DemoDatabase(deps.storage, () => demoSeed());
    return { client: createDemoClient(demo), demo };
  }
  return { client: deps.create(env.url, env.key), demo: null };
}

const browser = typeof window !== "undefined";
const browserStorage = () => {
  try {
    return browser ? window.localStorage : null;
  } catch {
    return null;
  }
};
if (browser && environment.ok && environment.data === "demo") installDemoNetworkGuard();

const selected = clientFor(environment, { storage: browserStorage(), create: createClient });
export const demoDatabase = selected.demo;
export const supabase: SupabaseClient = selected.client;
