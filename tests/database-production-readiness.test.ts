import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {readdirSync,readFileSync} from "node:fs";
import {classifyDatabaseEngineProbe} from "../lib/db-engine/production-readiness";

test("production remains on legacy UI until the final authenticated readiness marker responds true",()=>{
 assert.equal(classifyDatabaseEngineProbe(undefined,{code:"PGRST202",message:"Could not find the function public.db_engine_ready"}),"missing");
 assert.equal(classifyDatabaseEngineProbe(false,null),"missing");
 assert.equal(classifyDatabaseEngineProbe(null,{code:"42501",message:"permission denied"}),"error");
 assert.equal(classifyDatabaseEngineProbe(null,{code:"PGRST202",message:"Other RPC missing"}),"error");
 assert.equal(classifyDatabaseEngineProbe(true,null),"ready");
});
test("readiness marker follows the complete migration chain and requires signed-in user",async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create schema auth;"+
   "create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);"+
   "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;"+
   "grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;"+
   "insert into auth.users(id) values('00000000-0000-0000-0000-000000000001');");
  for(const file of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort())
   await db.exec(readFileSync("supabase/migrations/"+file,"utf8"));
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",["00000000-0000-0000-0000-000000000001"]);
  const active=await db.query<{db_engine_ready:boolean}>("select public.db_engine_ready()");
  assert.equal(active.rows[0].db_engine_ready,true);
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  const signedOut=await db.query<{db_engine_ready:boolean}>("select public.db_engine_ready()");
  assert.equal(signedOut.rows[0].db_engine_ready,false);
 }finally{await db.close()}
});
