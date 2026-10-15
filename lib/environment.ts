// Decides which Supabase project this build may talk to. Production deployments must point at the
// production project; previews and local development must point at a different (staging) project.
// Anything missing or contradictory fails closed: no client is created and no request is sent.
export const PRODUCTION_PROJECT_REF = "rpjeqbbvocgwomiavxqh";

export type DeployEnvironment = "production" | "preview" | "development";
export type DataEnvironment = "production" | "staging";
export type EnvironmentInput = { deploy?: string; data?: string; url?: string; key?: string };
export type Environment =
  | { ok: true; deploy: DeployEnvironment; data: DataEnvironment; url: string; key: string; projectRef: string }
  | { ok: false; deploy: DeployEnvironment; reason: string };

export const projectRef = (url: string) => /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(url)?.[1] ?? null;

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
  const missing = [
    !input.url && "NEXT_PUBLIC_SUPABASE_URL",
    !input.key && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    !input.data && "NEXT_PUBLIC_AAA_DATA_ENV",
  ].filter(Boolean);
  if (missing.length) return fail(`Missing ${missing.join(", ")} for the ${deploy} environment.`);
  const ref = projectRef(input.url!);
  if (!ref) return fail("NEXT_PUBLIC_SUPABASE_URL is not a Supabase project URL (https://<project-ref>.supabase.co).");
  if (isSecretKey(input.key!)) return fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is a secret key. Only the publishable (anon) key may be used in the browser.");
  if (input.data !== "production" && input.data !== "staging") return fail('NEXT_PUBLIC_AAA_DATA_ENV must be "production" or "staging".');
  if (input.data === "production" && ref !== PRODUCTION_PROJECT_REF) return fail("NEXT_PUBLIC_AAA_DATA_ENV is production but the URL is not the production project.");
  if (input.data === "staging" && ref === PRODUCTION_PROJECT_REF) return fail("NEXT_PUBLIC_AAA_DATA_ENV is staging but the URL is the production project.");
  if (deploy === "production" && input.data !== "production") return fail("Production deployments must use the production project.");
  if (deploy !== "production" && input.data !== "staging") return fail(`${deploy === "preview" ? "Preview deployments" : "Local development"} must use the staging project, never production.`);
  return { ok: true, deploy, data: input.data, url: input.url!, key: input.key!, projectRef: ref };
}

// Literal process.env references so Next.js inlines them into the browser bundle at build time.
export const environment = resolveEnvironment({
  deploy: process.env.NEXT_PUBLIC_AAA_DEPLOY_ENV,
  data: process.env.NEXT_PUBLIC_AAA_DATA_ENV,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
