// Decides which Supabase project this build may talk to.
//   production deployment → the production project only
//   preview deployment    → a hosted non-production (staging) project only
//   local development     → local Supabase on this machine, or a hosted staging project
//   preview / local with no data setting → Demo Mode: browser-only sample data, no Supabase client at all
// Anything contradictory fails closed: no client is created and no request is sent.
// Production never falls back to anything: it must be configured explicitly.
export const PRODUCTION_PROJECT_REF = "rpjeqbbvocgwomiavxqh";

export type DeployEnvironment = "production" | "preview" | "development";
export type DataEnvironment = "production" | "staging" | "local" | "demo";
export type EnvironmentInput = { deploy?: string; data?: string; url?: string; key?: string };
export type Environment =
  | { ok: true; deploy: DeployEnvironment; data: DataEnvironment; url: string; key: string; label: string }
  | { ok: false; deploy: DeployEnvironment; reason: string };

export const projectRef = (url: string) => /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url)?.[1] ?? null;
export const localApi = (url: string) => /^http:\/\/(127\.0\.0\.1|localhost):(\d{2,5})\/?$/.exec(url)?.slice(1, 3).join(":") ?? null;

function isSecretKey(key: string) {
  if (key.startsWith("sb_secret_")) return true;
  const payload = key.split(".")[1];
  if (!payload) return false;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.role === "service_role";
  } catch {
    return false;
  }
}

export function resolveEnvironment(input: EnvironmentInput): Environment {
  const deploy: DeployEnvironment = input.deploy === "production" || input.deploy === "preview" ? input.deploy : "development";
  const fail = (reason: string): Environment => ({ ok: false, deploy, reason });
  // Demo Mode needs no URL or key; any that are present are ignored and never used.
  if (deploy !== "production" && (!input.data || input.data === "demo"))
    return { ok: true, deploy, data: "demo", url: "", key: "", label: deploy === "preview" ? "preview" : "local" };
  if (input.data === "demo") return fail("Production deployments cannot use Demo Mode.");
  const missing = [
    !input.url && "NEXT_PUBLIC_SUPABASE_URL",
    !input.key && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    !input.data && "NEXT_PUBLIC_AAA_DATA_ENV",
  ].filter(Boolean);
  if (missing.length) return fail(`Missing ${missing.join(", ")} for the ${deploy} environment.`);
  if (input.data !== "production" && input.data !== "staging" && input.data !== "local") return fail('NEXT_PUBLIC_AAA_DATA_ENV must be "production", "staging" or "local".');
  if (isSecretKey(input.key!)) return fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a secret key. Only the publishable (anon) key may be used in the browser.");
  const ok = (label: string): Environment => ({ ok: true, deploy, data: input.data as DataEnvironment, url: input.url!, key: input.key!, label });

  if (input.data === "local") {
    const local = localApi(input.url!);
    if (!local) return fail("Local data must use the local Supabase API (http://127.0.0.1:<port>).");
    if (deploy !== "development") return fail("Deployed builds cannot use local data.");
    return ok(local);
  }
  const ref = projectRef(input.url!);
  if (!ref) return fail("NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL (https://<project-ref>.supabase.co).");
  if (input.data === "production" && ref !== PRODUCTION_PROJECT_REF) return fail("NEXT_PUBLIC_AAA_DATA_ENV is production but the URL is not the production project.");
  if (input.data === "staging" && ref === PRODUCTION_PROJECT_REF) return fail("NEXT_PUBLIC_AAA_DATA_ENV is staging but the URL is the production project.");
  if (deploy === "production" && input.data !== "production") return fail("Production deployments must use the production project.");
  if (deploy !== "production" && input.data === "production") return fail(`${deploy === "preview" ? "Preview deployments" : "Local development"} must never use the production project.`);
  return ok(ref);
}

// Literal process.env references so Next.js inlines them into the browser bundle at build time.
export const environment = resolveEnvironment({
  deploy: process.env.NEXT_PUBLIC_AAA_DEPLOY_ENV,
  data: process.env.NEXT_PUBLIC_AAA_DATA_ENV,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
