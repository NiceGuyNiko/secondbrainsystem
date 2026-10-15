// Safety checks run before any Supabase CLI command started from this repository.
// The repository's database scripts only ever target the LOCAL Supabase stack; these checks make sure
// nothing in the CLI's link state or environment could redirect a command to the production project.
import { existsSync, readFileSync } from "node:fs";
import { PRODUCTION_PROJECT_REF } from "../lib/environment";

export const SUPABASE_CLI = "supabase@2.121.0";
export const LINK_FILE = "supabase/.temp/project-ref";
const REDIRECTING_VARIABLES = ["SUPABASE_DB_URL", "DATABASE_URL", "SUPABASE_PROJECT_ID", "SUPABASE_PROJECT_REF"];
const isLocalAddress = (value: string) => /^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)(:\d+)?\//.test(value);

export function cliProblems(linkedRef: string | null, env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  if (linkedRef === PRODUCTION_PROJECT_REF)
    problems.push(`This folder is linked to the PRODUCTION project. Remove the link first:\n    npx ${SUPABASE_CLI} unlink`);
  for (const name of REDIRECTING_VARIABLES) {
    const value = env[name];
    if (!value) continue;
    if (value.includes(PRODUCTION_PROJECT_REF)) problems.push(`${name} refers to the PRODUCTION project. Unset it.`);
    else if (!(name.endsWith("_URL") && isLocalAddress(value))) problems.push(`${name} is set and could redirect the Supabase CLI. Unset it for local development.`);
  }
  return problems;
}

export function assertLocalOnly() {
  const linked = existsSync(LINK_FILE) ? readFileSync(LINK_FILE, "utf8").trim() || null : null;
  const problems = cliProblems(linked, process.env);
  if (problems.length) {
    console.error(`\n✖ Refusing to run:\n  - ${problems.join("\n  - ")}\n`);
    process.exit(1);
  }
}
