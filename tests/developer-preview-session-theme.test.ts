import test from "node:test";
import assert from "node:assert/strict";
import {clientFor} from "../lib/supabase";
import {resolveEnvironment} from "../lib/environment";
import {makeStagingSlate,stagingSlateKey,isStagingSlateReady} from "../lib/settings/staging";
import {
  defaultSettings,activeProfile,createProfile,updateAccount,updateActivePreferences,switchProfile,
} from "../lib/settings/model";

test("Staging account changes to Slate once without changing profile IDs or developer settings",()=>{
 let original=updateAccount(defaultSettings(),{developerMode:true,testProfilesEnabled:true});
 original=updateActivePreferences(original,p=>({
  clock:"24-hour",sidebarCollapsed:true,
  appearance:{...p.appearance,preset:"midnight-forest",primaryAccentOverride:"#123456"},
 }));
 const one=createProfile(original,"Character tester");
 original=one.settings;
 original=switchProfile(original,one.id);
 original=updateActivePreferences(original,p=>({
  appearance:{...p.appearance,preset:"blue-hour",highlightAccentOverride:"#ABCDEF"},
 }));
 const staging=makeStagingSlate(original);
 assert.deepEqual(staging.account,original.account,"account and active profile unchanged");
 assert.deepEqual(staging.profiles.map(p=>p.id),original.profiles.map(p=>p.id));
 assert.equal(activeProfile(staging).name,"Character tester");
 assert.equal(isStagingSlateReady(staging),true);
 for(const p of staging.profiles){
  assert.equal(p.preferences.appearance.preset,"slate");
  assert.equal(p.preferences.appearance.primaryAccentOverride,null);
  assert.equal(p.preferences.appearance.highlightAccentOverride,null);
  assert.equal(p.preferences.themeMode,"manual");
 }
 assert.equal(staging.profiles[0].preferences.clock,"24-hour");
 assert.equal(staging.profiles[0].preferences.sidebarCollapsed,true);
 assert.equal(original.profiles[0].preferences.appearance.preset,"midnight-forest",
  "staging conversion does not mutate original settings");
 assert.notEqual(stagingSlateKey("account-a"),stagingSlateKey("account-b"),
  "one-time appearance initialization is account-scoped");
});

test("Authenticated staging client explicitly enables persistent session and refresh",()=>{
 const env=resolveEnvironment({
  deploy:"preview",data:"staging",
  url:"https://hxfkazgqtjlmduqxfgpp.supabase.co",
  key:"sb_publishable_public_only",
 });
 assert.equal(env.ok,true);
 let args:unknown[]=[];
 const fake=((...input:unknown[])=>{args=input;return {auth:{}}}) as never;
 clientFor(env,{storage:null,create:fake});
 assert.equal(args[0],"https://hxfkazgqtjlmduqxfgpp.supabase.co");
 assert.deepEqual(args[2],{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 assert.ok(!JSON.stringify(args[2]).includes("storageKey"),
  "keep the current Supabase storage key so previously signed-in users stay signed in");
});
