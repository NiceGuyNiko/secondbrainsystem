import test from "node:test";
import assert from "node:assert/strict";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {WORLD_DATABASE_TEMPLATES,worldDbKey} from "../lib/db-engine/worldbuilding-templates";

test("worldbuilding templates: identities, typed relations, status and hierarchy are generic",()=>{
 const names=WORLD_DATABASE_TEMPLATES.map(d=>d.name);
 assert.deepEqual(names,["Characters","Events","Groups","Locations","Power Systems","Abilities","Perspectives","Lore"]);
 assert.equal(new Set(names.map(worldDbKey)).size,8);
 for(const d of WORLD_DATABASE_TEMPLATES){
  assert.ok(d.properties.find(p=>p.name==="Development status"&&p.type==="select"));
  for(const p of d.properties){
   if(p.type==="relation")assert.ok(names.includes(p.target??""),d.name+"."+p.name+" targets unknown database");
  }
 }
 const characters=WORLD_DATABASE_TEMPLATES.find(d=>d.name==="Characters")!;
 assert.equal(characters.properties.find(p=>p.name==="Abilities")?.target,"Abilities");
 assert.equal(characters.properties.find(p=>p.name==="Abilities")?.multi,true);
 const abilities=WORLD_DATABASE_TEMPLATES.find(d=>d.name==="Abilities")!;
 assert.equal(abilities.properties.find(p=>p.name==="Power system")?.target,"Power Systems");
 assert.equal(abilities.properties.find(p=>p.name==="Power system")?.multi,false);
 for(const [database,property] of [["Events","Parent event"],["Locations","Parent location"]]){
  const prop=WORLD_DATABASE_TEMPLATES.find(d=>d.name===database)?.properties.find(p=>p.name===property);
  assert.equal(prop?.target,database);
  assert.equal(prop?.hierarchy,true);
  assert.equal(prop?.multi,false);
 }
 const lore=WORLD_DATABASE_TEMPLATES.find(d=>d.name==="Lore")!;
 assert.ok(lore.properties.find(p=>p.name==="Lore kind")?.options?.includes("Artifact"));
 assert.ok(!names.includes("Artifacts"),"Artifact is initially a Lore category, not a compulsory database");
 assert.ok(!names.includes("Concepts"),"Concept is an editorial status in any database");
 assert.ok(!names.includes("Major Events"),"Major Event is an Events scale, not a duplicate database");
 assert.ok(!names.includes("Dots"),"Dot implementation is outside the database engine");
});

test("SQL enforces acyclic nested Events and Locations relationships",async()=>{
 const db=new PGlite();
 const user="00000000-0000-0000-0000-000000000001";
 try{
  await db.exec("create role anon; create role authenticated; create schema auth;"+
    "create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);"+
    "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;"+
    "grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;"+
    "insert into auth.users(id) values('"+user+"');");
  for(const path of readdirSync("supabase/migrations").filter(x=>x.endsWith(".sql")).sort())
    await db.exec(readFileSync("supabase/migrations/"+path,"utf8"));
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  for(const name of ["Events","Locations"]){
   const top=crypto.randomUUID(),a=crypto.randomUUID(),b=crypto.randomUUID(),c=crypto.randomUUID();
   await db.query("select public.db_create_database($1,$2,'acceptance')",[top,name]);
   for(const [id,label] of [[a,"A"],[b,"B"],[c,"C"]])
    await db.query("select public.db_create_record($1,$2,$3)",[id,top,label]);
   const p=await db.query<{id:string}>(
    "insert into public.db_properties(database_id,name,type,config) values ($1,'Parent','relation',$2::jsonb) returning id",
    [top,JSON.stringify({target_database_id:top,multi:false,hierarchy:true})]);
   const pid=p.rows[0].id;
   await db.query("select public.db_link($1,$2,$3)",[pid,a,b]);
   await db.query("select public.db_link($1,$2,$3)",[pid,b,c]);
   await assert.rejects(db.query("select public.db_link($1,$2,$3)",[pid,c,a]),/Hierarchy cycle/i);
   await assert.rejects(db.query("select public.db_link($1,$2,$3)",[pid,a,c]),/only one target/i);
   const count=await db.query<{n:number}>("select count(*)::int as n from public.db_relations where property_id=$1",[pid]);
   assert.equal(count.rows[0].n,2);
  }
 }finally{await db.close()}
});
