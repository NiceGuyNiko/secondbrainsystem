import { environment } from "@/lib/environment";

export const nonProductionLabel =
  environment.ok && environment.data !== "production" ? (environment.data === "local" ? "Local" : "Staging") : null;

export function EnvironmentBadge() {
  if (!environment.ok || !nonProductionLabel) return null;
  const text = `${nonProductionLabel.toUpperCase()} DATA · ${environment.label}`;
  return (
    <div className="aaa-environment-badge" role="status" aria-label={`${nonProductionLabel} data, ${environment.label}`}>
      {text}
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
          No connection to any database was made. See docs/LOCAL-DEVELOPMENT.md.
        </p>
      </section>
    </main>
  );
}
