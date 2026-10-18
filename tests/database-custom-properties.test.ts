import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import {
  validateDefinition, validateValue, recordProperties, withPropertyValue,
  type DatabaseProperty,
} from "../lib/database-property-model";
import {
  readDatabaseDemo, writeDatabaseDemo, resetDatabaseDemo,
  type StoragePort,
} from "../lib/database-property-store";
import type { PlanningRecord } from "../lib/planning";

const ownerA = "00000000-0000-0000-0000-000000000001";
const ownerB = "00000000-0000-0000-0000-000000000002";
const p = (type: DatabaseProperty["type"], config: DatabaseProperty["config"] = {}): DatabaseProperty => ({
  id: "aaaa0000-0000-4000-8000-000000000001", database_key: "Characters",
  label: "Importance", type, config, position: 0, visible: true, is_system: false, archived_at: null, version: 1,
});
const record: PlanningRecord = {
  thought_id: "11111111-1111-4111-8111-111111111111", kind: "character", sequence_no: 1,
  workspace_id: null, event_id: null, character_id: null, project_id: null, goal_id: null, working_id: null,
  data: {summary: "Preserve existing data", databaseProperties: {}}, version: 1,
};

test("typed value validation preserves canonical data and stable property identity", () => {
  const property = p("select", { options: ["High", "Medium"] });
  assert.equal(validateValue(property,"High"),"");
  assert.match(validateValue(property,"Secret"),/options/);
  assert.equal(validateValue(p("number"),0),"");
  assert.match(validateValue(p("number"),Infinity),/finite/);
  assert.match(validateValue(p("checkbox"),"true"),/true or false/);
  assert.equal(validateValue(p("multi_select",{options:["High","Medium"]}),["High","Medium"]),"");
  assert.match(validateValue(p("multi_select",{options:["High","Medium"]}),["Unknown"]),/options/);
  const changed = withPropertyValue(record,property,"High");
  assert.equal(record.data.summary, "Preserve existing data");
  assert.equal(changed.data.summary, "Preserve existing data");
  assert.deepEqual(recordProperties(changed),{[property.id]:"High"});
  assert.deepEqual(recordProperties(withPropertyValue(changed,property,null)),{});
  assert.match(validateDefinition({label:"Name",type:"text",config:{}},[]),/reserved/);
  assert.match(validateDefinition({label:"importance",type:"text",config:{}},[property]),/already exists/);
  assert.equal(validateDefinition({label:"New Label",type:"text",config:{}},[property]),"");
  assert.equal(property.id, p("number").id);
});

test("isolated demo properties and values survive reload and reset without account networking", () => {
  const map = new Map<string,string>();
  const memory: StoragePort = {
    getItem(key){return map.get(key)??null;},
    setItem(key,value){map.set(key,value);},
    removeItem(key){map.delete(key);},
  };
  const initial = readDatabaseDemo(memory);
  assert.equal(initial.records.length,7);
  assert.equal(initial.thoughts.length,7);
  initial.definitions.push(p("select",{options:["High","Medium"]}));
  initial.records[0] = withPropertyValue(initial.records[0],initial.definitions[0],"High");
  writeDatabaseDemo(initial,memory);
  const reloaded = readDatabaseDemo(memory);
  assert.equal(reloaded.definitions[0].id,p("select").id);
  assert.equal(recordProperties(reloaded.records[0])[p("select").id],"High");
  resetDatabaseDemo(memory);
  assert.deepEqual(readDatabaseDemo(memory).definitions,[]);
});

test("additive Phase 2 SQL validates metadata, scalar values and owner RLS", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create schema auth;" +
      "create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);" +
      "create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;" +
      "grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;" +
      "insert into auth.users(id) values('"+ownerA+"'),('"+ownerB+"');"
    );
    for(const filename of readdirSync("supabase/migrations").filter(f=>f.endsWith(".sql")).sort())
      await db.exec(readFileSync("supabase/migrations/"+filename,"utf8"));
    await db.exec("set role authenticated; select set_config('request.jwt.claim.sub','"+ownerA+"',false);");
    const workspaceId=crypto.randomUUID();
    await db.query("select public.create_planning_record($1,'Fictional Workspace','workspace')",[workspaceId]);
    const id=crypto.randomUUID();
    await db.query("select public.create_planning_record($1,'Fictional Character','character',$2)",[id,workspaceId]);
    const created=await db.query<{id:string;version:number}>(
      "insert into database_property_definitions(database_key,label,type,config) values('Characters','Importance','select',$1) returning id,version",
      [JSON.stringify({options:["High","Low"]})],
    );
    const propId=created.rows[0].id;
    assert.equal(created.rows[0].version,1);
    await db.query("select public.save_planning_record($1,1,$2)",[id,JSON.stringify({summary:"Original summary",databaseProperties:{[propId]:"High"}})]);
    const persisted=await db.query<{data:{summary:string;databaseProperties:Record<string,string>}}> ("select data from planning_records where thought_id=$1",[id]);
    assert.equal(persisted.rows[0].data.summary,"Original summary");
    assert.equal(persisted.rows[0].data.databaseProperties[propId],"High");
    await assert.rejects(db.query("update planning_records set data=$2 where thought_id=$1",[id,JSON.stringify({databaseProperties:{[propId]:"Unknown"}})]));
    await assert.rejects(db.query("update database_property_definitions set type='number' where id=$1",[propId]));
    await db.query("update database_property_definitions set label='Story Significance' where id=$1",[propId]);
    const renamed=await db.query<{version:number;label:string}>("select version,label from database_property_definitions where id=$1",[propId]);
    assert.equal(renamed.rows[0].version,2);
    assert.equal(renamed.rows[0].label,"Story Significance");
    assert.equal((await db.query<{data:{databaseProperties:Record<string,string>}}>("select data from planning_records where thought_id=$1",[id])).rows[0].data.databaseProperties[propId],"High");
    await assert.rejects(db.query("insert into database_property_definitions(database_key,label,type) values('Characters','name','text')"));
    await assert.rejects(db.query("insert into database_property_definitions(database_key,label,type,config) values('Characters','Bad Rollup','rollup',$1)",[JSON.stringify({relation_path:["a","b","c","d"]})]));
    await db.query("insert into database_property_definitions(database_key,label,type,config) values('Characters','Related Characters','relation',$1)",[JSON.stringify({target_databases:["Characters"],cardinality:"many"})]);
    await db.query("insert into database_property_definitions(database_key,label,type,config) values('Characters','Derived Power','rollup',$1)",[JSON.stringify({relation_path:[],target_property_id:"name",calculation:"show_original",filters:[]})]);
    await db.exec("select set_config('request.jwt.claim.sub','"+ownerB+"',false);");
    assert.equal((await db.query("select * from database_property_definitions")).rows.length,0);
    const crossWrite=await db.query("update planning_records set data=$2 where thought_id=$1 returning thought_id",[id,JSON.stringify({databaseProperties:{[propId]:"Low"}})]);
    assert.equal(crossWrite.rows.length,0,"Owner B cannot update Owner A's canonical record");
    await db.query("insert into database_property_definitions(database_key,label,type,config) values('Characters','Other Account','text',$1)",["{}"]);
    assert.equal((await db.query("select * from database_property_definitions")).rows.length,1,"Owner B sees only their own definitions");
    await db.exec("select set_config('request.jwt.claim.sub','"+ownerA+"',false);");
    assert.equal((await db.query("select * from database_property_definitions")).rows.length,3,"Owner A cannot see Owner B's definition");
    assert.equal((await db.query<{data:{databaseProperties:Record<string,string>}}>("select data from planning_records where thought_id=$1",[id])).rows[0].data.databaseProperties[propId],"High");
  } finally {
    await db.close();
  }
});
