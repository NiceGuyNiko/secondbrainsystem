import test from "node:test";
import assert from "node:assert/strict";
import { resolveEnvironment, PRODUCTION_PROJECT_REF } from "../lib/environment";

const prodUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;
const stagingUrl = "https://abcdefghijklmnopqrst.supabase.co";
const localUrl = "http://127.0.0.1:54321";
const key = "sb_publishable_example";
const jwt = (role: string) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, "")}.y`;

test("Each deployment connects only to its own data", () => {
  const prod = resolveEnvironment({ deploy: "production", data: "production", url: prodUrl, key });
  assert.equal(prod.ok && prod.label, PRODUCTION_PROJECT_REF);
  const preview = resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key });
  assert.equal(preview.ok && preview.data, "staging");
  const local = resolveEnvironment({ data: "local", url: localUrl, key });
  assert.equal(local.ok && local.label, "127.0.0.1:54321");
  assert.equal(resolveEnvironment({ data: "local", url: "http://localhost:54321/", key }).ok, true);
  assert.equal(resolveEnvironment({ data: "staging", url: stagingUrl, key }).ok, true, "local development may also use a hosted staging project");
});

test("Previews and local development never reach production", () => {
  for (const deploy of ["preview", undefined]) {
    assert.equal(resolveEnvironment({ deploy, data: "production", url: prodUrl, key }).ok, false);
    assert.equal(resolveEnvironment({ deploy, data: "staging", url: prodUrl, key }).ok, false, "staging label on production URL");
    assert.equal(resolveEnvironment({ deploy, data: "local", url: prodUrl, key }).ok, false, "local label on production URL");
  }
  assert.equal(resolveEnvironment({ deploy: "production", data: "staging", url: stagingUrl, key }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "production", data: "production", url: stagingUrl, key }).ok, false);
});

test("Local data is only for local development on this machine", () => {
  assert.equal(resolveEnvironment({ deploy: "preview", data: "local", url: localUrl, key }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "production", data: "local", url: localUrl, key }).ok, false);
  assert.equal(resolveEnvironment({ data: "local", url: "http://192.168.1.20:54321", key }).ok, false);
  assert.equal(resolveEnvironment({ data: "local", url: "https://127.0.0.1:54321", key }).ok, false);
  assert.equal(resolveEnvironment({ data: "local", url: stagingUrl, key }).ok, false);
  assert.equal(resolveEnvironment({ data: "local", url: localUrl, key: jwt("service_role") }).ok, false);
});

test("Previews and local development default to Demo Mode, which never uses Supabase settings", () => {
  for (const deploy of ["preview", undefined]) {
    const demo = resolveEnvironment({ deploy });
    assert.equal(demo.ok && demo.data, "demo");
    const ignored = resolveEnvironment({ deploy, url: prodUrl, key });
    assert.ok(ignored.ok && ignored.data === "demo" && ignored.url === "" && ignored.key === "", "production values present without a data setting are ignored");
    const explicit = resolveEnvironment({ deploy, data: "demo", url: prodUrl, key });
    assert.ok(explicit.ok && explicit.data === "demo" && explicit.url === "");
  }
});

test("Production never falls back to Demo Mode or anything else", () => {
  const none = resolveEnvironment({ deploy: "production" });
  assert.equal(none.ok, false);
  assert.match(!none.ok ? none.reason : "", /NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.*NEXT_PUBLIC_AAA_DATA_ENV.*production/);
  assert.equal(resolveEnvironment({ deploy: "production", data: "demo" }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "production", url: prodUrl, key }).ok, false, "data setting is required in production");
});

test("Invalid configuration fails closed without exposing values", () => {
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: "https://example.com", key }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "stage", url: stagingUrl, key }).ok, false);
  const secret = resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key: "sb_secret_abc" });
  assert.equal(secret.ok, false);
  assert.doesNotMatch(!secret.ok ? secret.reason : "", /sb_secret_abc/);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key: jwt("service_role") }).ok, false);
  assert.equal(resolveEnvironment({ deploy: "preview", data: "staging", url: stagingUrl, key: jwt("anon") }).ok, true);
});
