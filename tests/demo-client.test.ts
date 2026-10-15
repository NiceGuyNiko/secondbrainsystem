import test from "node:test";
import assert from "node:assert/strict";
import { createDemoClient, DemoDatabase, DEMO_STORAGE_KEY, DEMO_USER_ID, type DemoStorage } from "../lib/demo/client";
import { demoSeed } from "../lib/demo/seed";

const memoryStorage = (): DemoStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const setup = () => {
  const storage = memoryStorage();
  const db = new DemoDatabase(storage, () => demoSeed(new Date(2026, 9, 15, 9)));
  return { storage, db, client: createDemoClient(db) };
};

test("Demo user is signed in automatically and real sign-in is disabled", async () => {
  const { client } = setup();
  assert.equal((await client.auth.getSession()).data.session?.user.id, DEMO_USER_ID);
  const { data } = await client.from("profiles").select("username,display_name").eq("id", DEMO_USER_ID).single();
  assert.equal((data as { display_name: string }).display_name, "Demo");
  assert.ok((await client.auth.signInWithPassword({ email: "x@y.z", password: "secret" })).error);
});

test("Calendar queries, inserts, updates and deletes behave like the database", async () => {
  const { client, db, storage } = setup();
  const blocks = (await client.from("user_items").select("*").eq("item_type", "block").order("created_at", { ascending: true })).data as { title: string; content: { date: string } }[];
  assert.ok(blocks.length >= 8);
  assert.ok(blocks.some((b) => b.content.date === "2026-10-15"), "events exist on the seed day");
  const categories = await client.from("user_items").select("id,content").eq("user_id", DEMO_USER_ID).eq("item_type", "resource").eq("title", "__calendar_categories__").limit(1);
  assert.equal((categories.data as unknown[]).length, 1);

  const inserted = await client.from("user_items").insert({ title: "New", item_type: "block", content: { title: "New", date: "2026-10-16" } }).select("id").single();
  const id = (inserted.data as { id: string }).id;
  assert.match(id, /^[0-9a-f-]{36}$/);
  await client.from("user_items").update({ content: { title: "New", date: "2026-10-17" } }).eq("id", id);
  assert.equal(((await client.from("user_items").select("content").eq("id", id).single()).data as { content: { date: string } }).content.date, "2026-10-17");
  assert.ok(storage.data.get(DEMO_STORAGE_KEY)?.includes("2026-10-17"), "changes persist to browser storage");
  await client.from("user_items").delete().eq("id", id);
  assert.ok((await client.from("user_items").select("content").eq("id", id).single()).error, "single() errors when no row");
  assert.equal(new DemoDatabase(storage, () => ({})).rows("user_items").length, db.rows("user_items").length, "reload restores saved data");
});

test("Thought services work and enforce the same rules as the database", async () => {
  const { client } = setup();
  const a = crypto.randomUUID(), b = crypto.randomUUID(), c = crypto.randomUUID();
  assert.equal((await client.rpc("create_thought", { p_id: a, p_title: "A", p_content: { blocks: [] } })).error, null);
  await client.rpc("create_thought", { p_id: b, p_title: "B", p_content: {} });
  await client.rpc("create_thought_collection", { p_id: c, p_title: "Set", p_members: [a, b] });
  assert.equal(((await client.from("thought_memberships").select("*").eq("collection_id", c)).data as unknown[]).length, 2);
  assert.equal((await client.rpc("save_thought", { p_id: a, p_title: "A2", p_content: {}, p_version: 1, p_parent: b, p_position: 0, p_archive: null })).error, null);
  assert.ok((await client.rpc("save_thought", { p_id: a, p_title: "stale", p_content: {}, p_version: 1, p_parent: null, p_position: 0, p_archive: null })).error, "stale version rejected");
  assert.ok((await client.rpc("save_thought", { p_id: b, p_title: "B", p_content: {}, p_version: 1, p_parent: a, p_position: 0, p_archive: null })).error, "cycle rejected");
  assert.equal((await client.from("thought_connections").insert({ source_id: b, target_id: a, type: "relates_to" })).error, null);
  assert.ok((await client.from("thought_connections").insert({ source_id: b, target_id: a, type: "relates_to" })).error, "duplicate edge rejected");
  assert.match((await client.rpc("create_planning_record", { p_id: a })).error?.message ?? "", /not available in Demo Mode/);
});

test("Reset restores the original sample data", async () => {
  const { client, db } = setup();
  await client.from("user_items").delete().eq("item_type", "block");
  assert.equal(db.rows("user_items").filter((r) => r.item_type === "block").length, 0);
  db.reset();
  assert.ok(db.rows("user_items").filter((r) => r.item_type === "block").length >= 8);
});
