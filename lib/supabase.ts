import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { environment } from "./environment";

// When configuration is invalid the app renders a configuration error instead of the workspace,
// so this placeholder is never used; it exists to make any accidental use fail loudly.
const unavailable = (reason: string) =>
  new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(`Supabase is not configured: ${reason}`);
    },
  });

export const supabase: SupabaseClient = environment.ok
  ? createClient(environment.url, environment.key)
  : unavailable(environment.reason);
