import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const ownerA="00000000-0000-0000-0000-000000000001";
const ownerB="00000000-0000-0000-0000-000000000002";
const id=()=>crypto.randomUUID();

test("additive normalized db engine: atomic Thought pages, typed values, owner isolation, relations and versions", async () => {
  const db=new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;" +
      "create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);" +
      "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;" +
      "grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;" +
      "insert into auth.users(id) values('"+ownerA+"'),('"+ownerB+"');"
    );
    for (const file of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort())
      await db.exec(readFileSync("supabase/migrations/"+file,"utf8"));
    await db.exec("set role authenticated;");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ownerA]);
    const characters=id(),events=id(),michael=id(),blackout=id();
    await db.query("select public.db_create_database($1,'Characters','acceptance')",[characters]);
    await db.query("select public.db_create_database($1,'Events','acceptance')",[events]);
    await db.query("select public.db_create_record($1,$2,'Michael')",[michael,characters]);
    await db.query("select public.db_create_record($1,$2,'Blackout')",[blackout,events]);
    const named=await db.query<{title:string}>("select title from public.user_items where id=$1",[michael]);
    assert.equal(named.rows[0].title,"Michael");
    const p=await db.query<{id:string}>(
      "insert into public.db_properties(database_id,name,type,config) values($1,'Status','select',$2) returning id",
      [characters,JSON.stringify({options:["Idea","Developing","Canon"]})]);
    const status=p.rows[0].id;
    const t=await db.query<{id:string}>(
      "insert into public.db_properties(database_id,name,type) values($1,'Strength','number') returning id",
      [characters]);
    const strength=t.rows[0].id;
    const relation=await db.query<{id:string}>(
      "insert into public.db_properties(database_id,name,type,config) values($1,'Present At','relation',$2) returning id",
      [characters,JSON.stringify({target_database_id:events,multi:true})]);
    const link=relation.rows[0].id;
    const seq=await db.query<{sequence_no:number,version:number}>(
      "select sequence_no,version from public.db_records where record_id=$1",[michael]);
    assert.equal(Number(seq.rows[0].sequence_no),1);
    assert.equal(seq.rows[0].version,1);
    const saved=await db.query<{db_set_value:number}>(
      "select public.db_set_value($1,1,$2,$3::jsonb)",[michael,status,JSON.stringify("Canon")]);
    assert.equal(saved.rows[0].db_set_value,2);
    await assert.rejects(db.query(
      "select public.db_set_value($1,1,$2,$3::jsonb)",[michael,status,JSON.stringify("Idea")]),/reload|changed/i);
    await assert.rejects(db.query(
      "select public.db_set_value($1,2,$2,$3::jsonb)",[michael,status,JSON.stringify("Invalid")]),/permitted/i);
    await db.query("select public.db_set_value($1,2,$2,$3::jsonb)",[michael,strength,"7"]);
    const values=await db.query<{values_json:Record<string,unknown>,version:number}>(
      "select values_json,version from public.db_records where record_id=$1",[michael]);
    assert.equal(values.rows[0].values_json[status],"Canon");
    assert.equal(values.rows[0].values_json[strength],7);
    assert.equal(values.rows[0].version,3);
    await db.query("select public.db_link($1,$2,$3)",[link,michael,blackout]);
    await db.query("select public.db_link($1,$2,$3)",[link,michael,blackout]);
    const links=await db.query<{count:string}>("select count(*)::text as count from public.db_relations");
    assert.equal(links.rows[0].count,"1","idempotent link does not make duplicate edges");
    await assert.rejects(db.query("select public.db_link($1,$2,$3)",[link,blackout,michael]),/source|target|Invalid/i);
    const view=await db.query<{layout:string}>("select layout from public.db_views where database_id=$1",[characters]);
    assert.equal(view.rows[0].layout,"table");
    // Change JWT subject without changing the authenticated DB role. RLS must isolate both metadata and records.
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ownerB]);
    const hidden=await db.query("select * from public.db_records");
    assert.equal(hidden.rows.length,0);
    await assert.rejects(db.query("select public.db_create_record($1,$2,'Unauthorized')",[id(),characters]),/unavailable/i);
    await assert.rejects(db.query("select public.db_link($1,$2,$3)",[link,michael,blackout]),/unavailable/i);
    assert.equal((await db.query("select * from public.db_databases")).rows.length,0);
  } finally { await db.close(); }
});
