import test from "node:test";
import assert from "node:assert/strict";
import {
  databasePropertyStore, readDatabaseDemo, resetDatabaseDemo,
  type StoragePort,
} from "../lib/database-property-store";
import { recordProperties } from "../lib/database-property-model";

const port = (): StoragePort => {
  const map = new Map<string,string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key,value) => void map.set(key,value),
    removeItem: (key) => void map.delete(key),
  };
};

test("Phase 2 Companion and inline cells save to the exact same canonical browser record", async () => {
  const savedWindow=Object.getOwnPropertyDescriptor(globalThis,"window");
  const memory=port();
  Object.defineProperty(globalThis,"window",{configurable:true,value:{localStorage:memory}});
  try {
    resetDatabaseDemo(memory);
    const state=readDatabaseDemo(memory);
    const event=state.records.find(r=>r.kind==="event")!;
    const source=state.thoughts.find(t=>t.id===event.thought_id)!;
    const updated=await databasePropertyStore.saveBuiltin(event,"summary","Edited directly in the Events table");
    assert.equal(updated.thought_id,event.thought_id);
    assert.equal(updated.version,event.version+1);
    assert.equal(updated.data.summary,"Edited directly in the Events table");
    assert.equal(readDatabaseDemo(memory).records.find(r=>r.thought_id===event.thought_id)?.data.summary,"Edited directly in the Events table");
    await assert.rejects(databasePropertyStore.saveBuiltin(event,"summary","stale change"),/changed elsewhere/);

    const renamed=await databasePropertyStore.renameRecord(updated,source,"The New Signal");
    assert.equal(renamed.id,event.thought_id);
    assert.equal(readDatabaseDemo(memory).thoughts.find(t=>t.id===event.thought_id)?.title,"The New Signal");
    await assert.rejects(databasePropertyStore.renameRecord(updated,source,"Stale Name"),/changed elsewhere/);
    await assert.rejects(databasePropertyStore.saveBuiltin(updated,"status","made-up"),/valid story status/);

    const prop=await databasePropertyStore.create("Events",{label:"Tension",type:"number",visible:true,config:{}},[]);
    const newRecord=await databasePropertyStore.saveValue(updated,prop,9);
    assert.equal(recordProperties(readDatabaseDemo(memory).records.find(r=>r.thought_id===event.thought_id)!)[prop.id],9);
    await assert.rejects(databasePropertyStore.saveValue(updated,prop,11),/changed elsewhere/);
    await assert.rejects(databasePropertyStore.saveValue(newRecord,{...prop,database_key:"Characters"},7),/different databases/);

    const edited=await databasePropertyStore.saveBuiltin(newRecord,"status","canon");
    assert.equal(recordProperties(edited)[prop.id],9,"built-in edits preserve custom property values");
    assert.equal(edited.data.summary,"Edited directly in the Events table");

    const char=readDatabaseDemo(memory).records.find(r=>r.kind==="character")!;
    const label = await databasePropertyStore.create("Characters",{label:"Vow",type:"number",visible:true,config:{}},[]);
    const other=await databasePropertyStore.saveValue(char,label,3);
    assert.equal(other.kind,"character");
    assert.equal(recordProperties(readDatabaseDemo(memory).records.find(r=>r.thought_id===event.thought_id)!)[prop.id],9,
      "editing Character does not mutate Event");

    resetDatabaseDemo(memory);
    assert.equal(readDatabaseDemo(memory).records.find(r=>r.kind==="event")?.data.summary,"A fictional meeting during the autumn celebration.");
  } finally {
    if(savedWindow)Object.defineProperty(globalThis,"window",savedWindow);
    else Reflect.deleteProperty(globalThis,"window");
  }
});
