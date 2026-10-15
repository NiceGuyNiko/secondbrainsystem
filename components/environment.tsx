import { environment } from "@/lib/environment";

export function EnvironmentBadge() {
  if (!environment.ok || environment.data !== "staging") return null;
  return (
    <div className="aaa-environment-badge" role="status" aria-label={`Staging data, Supabase project ${environment.projectRef}`}>
      STAGING DATA · {environment.projectRef}
      {environment.deploy === "development" ? " · local" : ""}
    </div>
  );
}

export function ConfigurationError({ reason }: { reason: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <section className="auth-surface w-full max-w-lg rounded-2xl border p-7" role="alert">
        <h1 className="text-2xl font-bold">This deployment is not configured</h1>
        <p className="mt-3 text-sm">{reason}</p>
        <p className="mt-3 text-sm text-slate-400">
          No connection to any database was made. Set the environment variables for this deployment in Vercel and redeploy. See docs/STAGING-SETUP.md.
        </p>
      </section>
    </main>
  );
}
