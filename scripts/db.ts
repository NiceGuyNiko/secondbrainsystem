// Local Supabase commands. Every command targets the local Docker stack only.
//   npm run db:start   start local Supabase (first run downloads images and applies all migrations)
//   npm run db:stop    stop it (data is kept)
//   npm run db:status  show local URLs
//   npm run db:env     write the local URL and publishable key into .env.local (keys are never printed)
//   npm run db:migrate apply new migration files to the running local database
//   npm run db:reset   rebuild the LOCAL database from migrations (erases local data only)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { assertLocalOnly, SUPABASE_CLI } from "./db-guard";
import { localApi } from "../lib/environment";

const commands: Record<string, string[]> = {
  start: ["start"],
  stop: ["stop"],
  status: ["status"],
  migrate: ["migration", "up", "--local"],
  reset: ["db", "reset", "--local"],
};
const cli = (args: string[], capture = false) =>
  spawnSync("npx", ["--yes", SUPABASE_CLI, ...args], { stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8", shell: process.platform === "win32" });

const command = process.argv[2] ?? "";
assertLocalOnly();

if (command === "env") {
  const result = cli(["status", "-o", "env"], true);
  if (result.status !== 0) process.exit(result.status ?? 1);
  const values = Object.fromEntries([...result.stdout.matchAll(/^([A-Z_]+)="?([^"\r\n]*)"?$/gm)].map((m) => [m[1], m[2]]));
  const url = values.API_URL, key = values.PUBLISHABLE_KEY || values.ANON_KEY;
  if (!url || !localApi(url) || !key) {
    console.error("\n✖ Local Supabase is not running or did not report a local API URL and publishable key. Run npm run db:start first.\n");
    process.exit(1);
  }
  const wanted: Record<string, string> = { NEXT_PUBLIC_AAA_DATA_ENV: "local", NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key };
  const kept = (existsSync(".env.local") ? readFileSync(".env.local", "utf8").split(/\r?\n/) : []).filter((line) => line && !Object.keys(wanted).some((k) => line.startsWith(k + "=")));
  writeFileSync(".env.local", [...kept, ...Object.entries(wanted).map(([k, v]) => `${k}=${v}`)].join("\n") + "\n");
  console.log(`Wrote local settings to .env.local (data: local, API: ${url}). The publishable key was not printed.`);
} else if (commands[command]) {
  process.exit(cli(commands[command]).status ?? 1);
} else {
  console.error(`Usage: tsx scripts/db.ts <${[...Object.keys(commands), "env"].join("|")}>`);
  process.exit(1);
}
