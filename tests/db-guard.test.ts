import test from "node:test";
import assert from "node:assert/strict";
import { cliProblems } from "../scripts/db-guard";
import { PRODUCTION_PROJECT_REF } from "../lib/environment";

test("Database scripts refuse a folder previously linked to production", () => {
  assert.match(cliProblems(PRODUCTION_PROJECT_REF, {}).join(), /linked to the PRODUCTION project/);
  assert.deepEqual(cliProblems(null, {}), []);
  assert.deepEqual(cliProblems("abcdefghijklmnopqrst", {}), [], "a non-production link does not affect local commands");
});

test("Database scripts refuse variables that could redirect the CLI", () => {
  assert.equal(cliProblems(null, { SUPABASE_DB_URL: `postgresql://postgres:x@db.${PRODUCTION_PROJECT_REF}.supabase.co:5432/postgres` }).length, 1);
  assert.equal(cliProblems(null, { DATABASE_URL: "postgresql://postgres:x@example.com:5432/postgres" }).length, 1);
  assert.equal(cliProblems(null, { SUPABASE_PROJECT_ID: "anything" }).length, 1);
  assert.deepEqual(cliProblems(null, { SUPABASE_DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" }), []);
});
