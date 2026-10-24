import test from "node:test";
import assert from "node:assert/strict";
import { apiReferences, checkRepository, contractProblems, releaseReadinessQuery, sqlInventory } from "../scripts/check-schema-contract.mjs";

test("every source-controlled Supabase table/RPC reference has a migration definition and table RLS", () => {
  const result = checkRepository();
  assert.deepEqual(result.problems, []);
  for (const name of ["aaa_library_pages", "aaa_page_widgets", "aaa_page_sections", "aaa_widget_definitions"])
    assert.ok(result.requiredTables.includes(name), `${name} is in the live release contract`);
  assert.ok(result.requiredFunctions.includes("db_delete_database"));
});

test("future database calls fail if the migration or RLS has not been added", () => {
  const refs = apiReferences('await client.from("new_asset_table").select("id"); await client.rpc("new_asset_rpc");', "components/new-asset.tsx");
  assert.deepEqual(contractProblems(refs, sqlInventory("")), [
    "components/new-asset.tsx: table new_asset_table has no source-controlled CREATE TABLE",
    "components/new-asset.tsx: RPC new_asset_rpc has no source-controlled CREATE FUNCTION",
  ]);
  const missingRls = sqlInventory("create table public.new_asset_table(id uuid); create function public.new_asset_rpc() returns void language sql as $$ select null $$;");
  assert.deepEqual(contractProblems(refs, missingRls), ["components/new-asset.tsx: table new_asset_table has no source-controlled ENABLE ROW LEVEL SECURITY"]);
});

test("Demo Mode settings exceptions cannot silently spread into production UI", () => {
  const inventory = sqlInventory("");
  const demo = apiReferences('client.from("test_profiles");', "lib/settings/store.ts");
  const live = apiReferences('client.from("test_profiles");', "components/new-asset.tsx");
  assert.deepEqual(contractProblems(demo, inventory), []);
  assert.match(contractProblems(live, inventory)[0], /test_profiles has no source-controlled CREATE TABLE/);
  assert.match(contractProblems(apiReferences("client.from(variable);", "components/new-asset.tsx"), inventory)[0], /unreviewed dynamic/);
});

test("remote readiness SQL is read-only and derived from actual client dependencies", () => {
  const query = releaseReadinessQuery(["aaa_page_sections"], ["db_delete_database"]);
  assert.match(query, /to_regclass\('public\.' \|\| name\)/);
  assert.match(query, /'aaa_page_sections'/);
  assert.match(query, /'db_delete_database'/);
  assert.doesNotMatch(query, /\b(insert|update|delete|alter|drop)\s+(into|table|from|function)/i);
});
