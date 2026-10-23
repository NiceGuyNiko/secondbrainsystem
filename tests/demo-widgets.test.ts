import test from "node:test";
import assert from "node:assert/strict";
import {DemoDatabase,createDemoClient,DEMO_STORAGE_KEY} from "../lib/demo/client";
import {demoSeed} from "../lib/demo/seed";
import {defaultSettings,parsePreferences,primaryOf,updateActivePreferences} from "../lib/settings/model";
import {makeDemoWidgetPreview} from "../lib/settings/demo-preview";
import {widgetSectionId} from "../lib/widget-system";

const memory=()=>{const values=new Map<string,string>();return {values,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{values.delete(key)}}};
test("developer fixtures provide linked world, character, book and goals pages using canonical records",()=>{
  const seed=demoSeed(new Date(2026,9,23));
  assert.deepEqual((seed.aaa_library_pages??[]).map(p=>p.title),["World View","Character Atlas","Book One Studio","Goals Overview"]);
  assert.ok((seed.db_databases??[]).some(db=>db.name==="Projects"));
  assert.ok((seed.db_databases??[]).some(db=>db.name==="Vision Goals"));
  assert.ok((seed.aaa_widget_definitions??[]).length>=10);
  assert.ok((seed.db_relations??[]).length>=12);
  assert.equal(new Set((seed.db_records??[]).map(r=>r.record_id)).size,seed.db_records.length);
  const ids=new Set((seed.aaa_widget_definitions??[]).map(d=>d.id));
  for(const placement of seed.aaa_page_widgets??[])assert.ok(ids.has(placement.definition_id),"every page widget references a reusable master");
  const sections=new Map((seed.aaa_page_sections??[]).map(s=>[s.id,s]));
  assert.equal(sections.size,8,"two sample sections per page");
  for(const placement of seed.aaa_page_widgets??[]){
    const section=sections.get(widgetSectionId(placement as never));
    assert.equal(section?.page_id,placement.page_id,"every placement belongs to a section on its own page");
  }
});
test("developer demo widgets and new databases save and reload without Supabase",async()=>{
  const storage=memory(),db=new DemoDatabase(storage,demoSeed),client=createDemoClient(db);
  const page=(await client.from("aaa_library_pages").select("id,title").eq("title","World View").single()).data as {id:string};
  const master=(await client.from("aaa_widget_definitions").insert({name:"Sample report",config:{renderer:"cards"}}).select("id,name").single()).data as {id:string};
  const instance=(await client.from("aaa_page_widgets").insert({page_id:page.id,definition_id:master.id,kind:"database",position:4}).select("id,definition_id").single()).data as {id:string;definition_id:string};
  assert.equal(instance.definition_id,master.id);
  const section=(await client.from("aaa_page_sections").select("id,title").eq("page_id",page.id).order("position").limit(1).single()).data as {id:string};
  assert.equal((await client.from("aaa_page_sections").update({title:"My World History"}).eq("id",section.id)).error,null);
  const freshDbId=crypto.randomUUID();
  assert.equal((await client.rpc("db_create_database",{p_id:freshDbId,p_name:"Writing Experiments"})).error,null);
  const recordId=crypto.randomUUID();
  assert.equal((await client.rpc("db_create_record",{p_id:recordId,p_database_id:freshDbId,p_name:"First thought"})).error,null);
  assert.equal((await client.rpc("db_set_value",{p_record_id:recordId,p_version:1,p_property_id:crypto.randomUUID(),p_value:"In progress"})).data,2);
  assert.ok(storage.values.get(DEMO_STORAGE_KEY)?.includes("Writing Experiments"));
  const reloaded=new DemoDatabase(storage,demoSeed);
  assert.ok(reloaded.rows("aaa_page_widgets").some(w=>w.id===instance.id));
  assert.ok(reloaded.rows("aaa_page_sections").some(s=>s.id===section.id&&s.title==="My World History"));
  assert.ok(reloaded.rows("db_records").some(r=>r.record_id===recordId));
});
test("older demo browsers gain widget examples without losing their original data",()=>{
  const storage=memory(),old=demoSeed(new Date(2026,9,23));
  for(const key of Object.keys(old))if(key.startsWith("aaa_")||key.startsWith("db_"))delete old[key];
  const marker={id:crypto.randomUUID(),item_type:"thought",title:"Keep my old note"};
  old.user_items.push(marker);
  storage.setItem(DEMO_STORAGE_KEY,JSON.stringify({version:1,tables:old}));
  const migrated=new DemoDatabase(storage,demoSeed);
  assert.ok(migrated.rows("user_items").some(row=>row.id===marker.id));
  assert.ok(migrated.rows("aaa_library_pages").some(page=>page.title==="Goals Overview"));
  assert.ok(migrated.rows("db_records").length>10);
  assert.equal(new DemoDatabase(storage,demoSeed).rows("aaa_library_pages").length,4,"reload does not duplicate fixture pages");
});
test("old widget previews acquire sections without replacing their saved page/widget IDs",()=>{
  const storage=memory(),old=demoSeed(new Date(2026,9,23));
  delete old.aaa_page_sections;
  const originalPageId=old.aaa_library_pages[0].id;
  const originalWidgetId=old.aaa_page_widgets[0].id;
  storage.setItem(DEMO_STORAGE_KEY,JSON.stringify({version:1,tables:old}));
  const migrated=new DemoDatabase(storage,demoSeed);
  assert.equal(migrated.rows("aaa_library_pages")[0].id,originalPageId);
  assert.equal(migrated.rows("aaa_page_widgets")[0].id,originalWidgetId);
  const sections=new Map(migrated.rows("aaa_page_sections").map(section=>[section.id,section]));
  for(const widget of migrated.rows("aaa_page_widgets")){
    const sectionId=(widget.config as {sectionId?:string}).sectionId;
    assert.equal(sections.get(sectionId)?.page_id,widget.page_id);
  }
  assert.equal(new DemoDatabase(storage,demoSeed).rows("aaa_page_sections").length,8,"reload does not duplicate sections");
});
test("studio style is per profile and developer Darkest Night bootstraps once",()=>{
  const initial=defaultSettings();
  assert.equal(primaryOf(initial).preferences.widgetStyle,"classic");
  const preview=makeDemoWidgetPreview(initial);
  assert.equal(primaryOf(preview).preferences.widgetStyle,"studio");
  assert.equal(primaryOf(preview).preferences.appearance.preset,"darkest-night");
  assert.equal(preview.account.developerMode,true);
  const classic=updateActivePreferences(preview,()=>({widgetStyle:"classic"}));
  assert.equal(primaryOf(classic).preferences.widgetStyle,"classic");
  assert.equal(parsePreferences({widgetStyle:"invalid"}).widgetStyle,"classic");
});
