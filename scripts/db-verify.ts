// Checks permissions and read/write behaviour against a NON-production Supabase stack with two users.
//   npm run db:verify   (uses the settings in .env.local; refuses production)
// Local: creates two throwaway users itself (local sign-ups need no email confirmation).
// Hosted staging (when one exists): uses STAGING_TEST_USER_{A,B}_{EMAIL,PASSWORD} from the environment.
// Creates clearly tagged thoughts/tasks and archives them afterwards.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveEnvironment } from "../lib/environment";
import { assertLocalOnly } from "./db-guard";

const stop = (message: string): never => {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
};
assertLocalOnly();
const target = resolveEnvironment({
  deploy: "development",
  data: process.env.NEXT_PUBLIC_AAA_DATA_ENV,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
if (!target.ok) stop(`.env.local is not a safe target: ${target.reason}`);
const { url, key, data, label } = target as Extract<typeof target, { ok: true }>;

const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const results: { check: string; ok: boolean; detail: string }[] = [];
async function check(name: string, fn: () => Promise<string | void>) {
  try {
    results.push({ check: name, ok: true, detail: (await fn()) || "" });
  } catch (e) {
    results.push({ check: name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}
const must = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
async function signIn(c: SupabaseClient, user: "A" | "B") {
  if (data === "local") {
    const email = `verify-${user.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@example.test`;
    const { data: signUp, error } = await c.auth.signUp({ email, password: crypto.randomUUID(), options: { data: { display_name: `Verify ${user}` } } });
    if (error || !signUp.session || !signUp.user) throw new Error(`Local user ${user} could not sign up: ${error?.message ?? "no session (is email confirmation disabled locally?)"}`);
    return signUp.user.id;
  }
  const email = process.env[`STAGING_TEST_USER_${user}_EMAIL`], password = process.env[`STAGING_TEST_USER_${user}_PASSWORD`];
  if (!email || !password) throw new Error(`Missing STAGING_TEST_USER_${user}_EMAIL/PASSWORD`);
  const { data: session, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !session.user) throw new Error(`User ${user} could not sign in: ${error?.message}`);
  return session.user.id;
}
async function archive(c: SupabaseClient, id: string) {
  const row = must(await c.from("user_items").select("title,content").eq("id", id).single()) as { title: string; content: unknown };
  const { version } = must(await c.from("thought_details").select("version").eq("thought_id", id).single()) as { version: number };
  must(await c.rpc("save_thought", { p_id: id, p_title: row.title, p_content: row.content, p_version: version, p_parent: null, p_position: 0, p_archive: new Date().toISOString() }));
}

async function main() {
  console.log(`Target: ${data} data · ${label}\n`);
  const anon = client(), a = client(), b = client();
  await check("Anonymous visitors cannot read app tables", async () => {
    for (const table of ["profiles", "user_items", "thought_details", "planning_records"]) {
      const { data: rows, error } = await anon.from(table).select("*").limit(1);
      if (!error && rows?.length) throw new Error(`${table} returned rows to an anonymous visitor`);
    }
  });
  let userA = "";
  await check("Test users A and B can sign in", async () => {
    userA = await signIn(a, "A");
    await signIn(b, "B");
  });
  await check("User A has a profile row (signup trigger)", async () => {
    const rows = must(await a.from("profiles").select("id").eq("id", userA)) as unknown[];
    if (rows.length !== 1) throw new Error("No profile row for user A");
  });
  const tag = `[db-verify ${new Date().toISOString()}]`;
  const thought = crypto.randomUUID(), task = crypto.randomUUID(), other = crypto.randomUUID();
  await check("User A creates a thought", async () => void must(await a.rpc("create_thought", { p_id: thought, p_title: tag, p_content: { blocks: [] } })));
  await check("User A reads the thought back", async () => {
    const rows = must(await a.from("user_items").select("title").eq("id", thought)) as { title: string }[];
    if (rows[0]?.title !== tag) throw new Error("Thought not readable by its owner");
  });
  await check("User A creates and completes a planning task", async () => {
    must(await a.rpc("create_planning_record", { p_id: task, p_title: `${tag} task`, p_kind: "task" }));
    must(await a.rpc("set_planning_task_completion", { p_id: task, p_done: true, p_version: 1 }));
  });
  await check("User B cannot see user A's records", async () => {
    for (const [table, column] of [["user_items", "id"], ["thought_details", "thought_id"], ["planning_records", "thought_id"]]) {
      const rows = must(await b.from(table).select(column).in(column, [thought, task])) as unknown[];
      if (rows.length) throw new Error(`${table} leaked to user B`);
    }
  });
  await check("User B cannot change user A's thought", async () => {
    await b.from("user_items").update({ title: "changed by B" }).eq("id", thought);
    const rows = must(await a.from("user_items").select("title").eq("id", thought)) as { title: string }[];
    if (rows[0]?.title !== tag) throw new Error("User B changed user A's thought");
  });
  await check("User B cannot connect to user A's thought", async () => {
    must(await b.rpc("create_thought", { p_id: other, p_title: `${tag} B`, p_content: { blocks: [] } }));
    const { error } = await b.from("thought_connections").insert({ source_id: other, target_id: thought, type: "relates_to" });
    if (!error) throw new Error("Cross-account connection was accepted");
  });
  await check("Clean-up: archive the tagged test records", async () => {
    await archive(a, thought);
    await archive(a, task);
    await archive(b, other);
  });

  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.check}${r.detail ? ` — ${r.detail}` : ""}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}
void main();
