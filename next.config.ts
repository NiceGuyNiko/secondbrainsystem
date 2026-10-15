import type { NextConfig } from "next";
import { resolveEnvironment } from "./lib/environment";

// VERCEL_ENV is "production" or "preview" on Vercel and unset locally.
const deploy = process.env.VERCEL_ENV ?? "development";
const environment = resolveEnvironment({
  deploy,
  data: process.env.NEXT_PUBLIC_AAA_DATA_ENV,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
// Fail the build rather than ship a deployment that could reach the wrong database.
// A failed Vercel build leaves the previous deployment in place.
if (!environment.ok) throw new Error(`[All About Action] Refusing to build: ${environment.reason}`);

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_AAA_DEPLOY_ENV: deploy },
};
export default nextConfig;
