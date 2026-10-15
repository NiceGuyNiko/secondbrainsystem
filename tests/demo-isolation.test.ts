import test from "node:test";
import assert from "node:assert/strict";
import { resolveEnvironment, PRODUCTION_PROJECT_REF } from "../lib/environment";
import { clientFor } from "../lib/supabase";
import { installDemoNetworkGuard, isSupabaseHost, networkGuard } from "../lib/demo/network-guard";

const prodUrl = `https://${PRODUCTION_PROJECT_REF}.supabase.co`;

test("Demo Mode never creates a real Supabase client, even with production values present", () => {
  let created = 0;
  const create = (() => {
    created++;
    return {};
  }) as never;
  for (const deploy of ["preview", undefined]) {
    const { demo } = clientFor(resolveEnvironment({ deploy, url: prodUrl, key: "sb_publishable_x" }), { storage: null, create });
    assert.ok(demo, "demo database selected");
  }
  assert.equal(created, 0);
  clientFor(resolveEnvironment({ deploy: "production", data: "production", url: prodUrl, key: "sb_publishable_x" }), { storage: null, create });
  assert.equal(created, 1, "production still creates its client");
});

test("The Demo Mode network guard blocks every route to Supabase hosts", async () => {
  assert.equal(isSupabaseHost(prodUrl + "/rest/v1/user_items"), true);
  assert.equal(isSupabaseHost("wss://abc.supabase.co/realtime/v1"), true);
  assert.equal(isSupabaseHost("https://evil-supabase.co.example.com"), false);
  assert.equal(isSupabaseHost("/api/x"), false);

  const calls: string[] = [];
  class FakeSocket { constructor(public url: string) { calls.push("ws " + url); } }
  class FakeXhr { open(method: string, url: string) { calls.push("xhr " + url); } }
  const w = {
    location: { href: "https://preview.example.com/" },
    fetch: async (input: string) => (calls.push("fetch " + input), new Response("ok")),
    XMLHttpRequest: FakeXhr,
    WebSocket: FakeSocket,
    EventSource: FakeSocket,
    navigator: { sendBeacon: (url: string) => (calls.push("beacon " + url), true) },
  } as unknown as Window & typeof globalThis;
  installDemoNetworkGuard(w);

  await assert.rejects(w.fetch(prodUrl + "/auth/v1/token"));
  assert.throws(() => new w.XMLHttpRequest().open("GET", prodUrl + "/rest/v1/"));
  assert.throws(() => new w.WebSocket("wss://" + PRODUCTION_PROJECT_REF + ".supabase.co/realtime/v1/websocket"));
  assert.equal(w.navigator.sendBeacon(prodUrl + "/x"), false);
  assert.equal(calls.length, 0, "nothing reached the underlying network functions");
  assert.equal(networkGuard.blocked, 4);

  await w.fetch("/_next/static/chunk.js");
  new w.WebSocket("wss://preview.example.com/hmr");
  assert.deepEqual(calls, ["fetch /_next/static/chunk.js", "ws wss://preview.example.com/hmr"], "other requests are unaffected");
});
