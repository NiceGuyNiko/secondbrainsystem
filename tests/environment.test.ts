import test from "node:test";
import assert from "node:assert/strict";
import { resolveEnvironment, PRODUCTION_PROJECT_REF } from "../lib/environment";

const prodUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const stagingUrl = "https://abcdefghijklmnopqrst.supabase.co";
const key = "sb_publishable_example";
const jwt = (role: string) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, "")}.y`;

test("Each deployment connects only to its own project", () => {
  const prod = resolveEnvironment({ deploy: "production", data: "production", url: prodUrl, key });
  assert.equal(prod.ok && prod.projectRef, PRODUCTION_PROJECT_REF);
  const preview = resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key });
  assert.equal(preview.ok && preview.data, "staging");
  assert.equal(resolveEnvironment({ data: "staging", url: stagingUrl, key }).ok, true, "local development uses staging");
});

test("Previews and local development never reach production", () => {
  for (const deploy of ["preview", undefined]) {
    assert.equal(resolveEnvironment({ deploy, data: "production", url: prodUrl, key }).ok, false);
    assert.equal(resolveEnvironment({ deploy, data: "staging", url: prodUrl, key }).ok, false, "staging label on production URL");
  }
  assert.equal(resolveEnvironment({ deploy: "production", data: "staging", url: stagingUrl, key }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "production", data: "production", url: stagingUrl, key }).ok, false);
});

test("Missing or invalid configuration fails closed without exposing values", () => {
  const none = resolveEnvironment({ deploy: "preview" });
  assert.equal(none.ok, false);
  assert.match(!none.ok ? none.reason : "", /NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.*NEXT_PUBLIC_AAA_DATA_ENV.*preview/);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: "https://example.com", key }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "stage", url: stagingUrl, key }).ok, false);
  const secret = resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key: "sb_secret_abc" });
  assert.equal(secret.ok, false);
  assert.doesNotMatch(!secret.ok ? secret.reason : "", /sb_secret_abc/);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key: jwt("service_role") }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key: jwt("anon") }).ok, true);
});
