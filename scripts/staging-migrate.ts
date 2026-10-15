// Applies repository migrations to the STAGING project only.
//   npm run staging:migrate            → dry run: lists migrations that would be applied
//   npm run staging:migrate -- --apply → applies them
// Refuses to run unless the Supabase CLI is linked to the staging project named in .env.staging.local.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PRODUCTION_PROJECT_REF, projectRef } from "../lib/environment";

const CLI = "supabase@2.121.0";
const stop = (message: string): never => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};

const staging = projectRef(process.env.STAGING_SUPABASE_URL ?? "") ?? stop("STAGING_SUPABASE_URL in .env.staging.local is missing or not a Supabase project URL.");
if (staging === PRODUCTION_PROJECT_REF) stop("STAGING_SUPABASE_URL points at the production project. Refusing.");

const linkFile = "supabase/.temp/project-ref";
if (!existsSync(linkFile)) stop(`The Supabase CLI is not linked. Run this yourself (it asks for the staging database password):\n  npx ${CLI} link --project-ref ${staging}`);
const linked = readFileSync(linkFile, "utf8").trim();
if (linked === PRODUCTION_PROJECT_REF) stop(`The CLI is linked to PRODUCTION. Re-link to staging first:\n  npx ${CLI} link --project-ref ${staging}`);
if (linked !== staging) stop(`The CLI is linked to ${linked}, not the staging project ${staging}.`);

const apply = process.argv.includes("--apply");
console.log(`Staging project ${staging} — ${apply ? "APPLYING migrations" : "dry run (add -- --apply to apply)"}`);
const result = spawnSync("npx", ["--yes", CLI, "db", "push", ...(apply ? [] : ["--dry-run"])], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(result.status ?? 1);
