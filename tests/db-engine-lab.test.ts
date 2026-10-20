import test from "node:test";
import assert from "node:assert/strict";
import {
  archiveRecord, checkIntegrity, createDatabase, createProperty, createRecord,
  editLab, freshLab, linkRecord, loadLab, renameRecord, saveLab, setValue, unlinkRecord, visibleRecords,
  type LabState,
} from "../lib/db-engine/lab";

function memoryStore() {
  const map = new Map<string,string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
  };
}
test("independent engine: Notion-style Character properties, Events and links persist across reload", () => {
  const store = memoryStore();
  let lab = loadLab(store);
  const charDb = lab.databases.find(d => d.name === "Characters")!;
  const eventDb = lab.databases.find(d => d.name === "Events")!;
  const character = createRecord(lab,charDb.id,"Michael");
  const event = createRecord(lab,eventDb.id,"Blackout");
  const species = createProperty(lab,charDb.id,"Species","select",{options:["Atheon","Human"]});
  const motivation = createProperty(lab,charDb.id,"Motivation","long_text");
  const strength = createProperty(lab,charDb.id,"Strength","number");
  const present = createProperty(lab,charDb.id,"Present At","relation",{targetDatabaseId:eventDb.id,multi:true});
  setValue(lab,character.id,species.id,"Atheon");
  setValue(lab,character.id,motivation.id,"Protect his friends");
  setValue(lab,character.id,strength.id,7);
  linkRecord(lab,character.id,present.id,event.id);
  assert.throws(()=>setValue(lab,character.id,species.id,"Unknown"),/Unknown select option/);
  assert.throws(()=>setValue(lab,character.id,strength.id,"really strong"),/finite number/);
  assert.throws(()=>linkRecord(lab,event.id,present.id,character.id),/Invalid relation property/);
  saveLab(lab,store);
  lab = loadLab(store);
  assert.equal(lab.records.find(r=>r.id===character.id)?.values[species.id],"Atheon");
  assert.equal(lab.links.filter(l=>l.sourceId===character.id && l.targetId===event.id).length,1);
  assert.equal(checkIntegrity(lab),true);
  renameRecord(lab,character.id,"Michael (Book 1)");
  assert.equal(visibleRecords(lab,charDb.id,"book 1","name",false)[0].id,character.id);
  const second = createRecord(lab,charDb.id,"Camilla");
  assert.equal(second.sequenceNo,2);
  archiveRecord(lab,character.id);
  assert.equal(visibleRecords(lab,charDb.id,"",null,false).length,1);
  assert.equal(lab.links.length,0,"archiving removes active links in demo");
});
test("engine records live outside legacy planning and databases can be created without a fixed category", () => {
  const state = freshLab();
  const custom = createDatabase(state,"Magic Systems");
  const p = createProperty(state,custom.id,"Cost","number");
  const r = createRecord(state,custom.id,"Amygdala expansion");
  setValue(state,r.id,p.id,0);
  assert.equal(state.records.find(x=>x.id===r.id)?.values[p.id],0);
  assert.equal(state.views.some(v=>v.databaseId===custom.id),true);
  assert.throws(()=>createDatabase(state,"magic systems"),/already exists/);
  assert.throws(()=>createProperty(state,custom.id,"Name","text"),/built-in/);
  assert.throws(()=>createProperty(state,custom.id,"Cost","text"),/already exists/);
  const another=editLab(state,draft=>{setValue(draft,r.id,p.id,2);});
  assert.equal(state.records.find(x=>x.id===r.id)?.values[p.id],0,"edits are immutable");
  assert.equal(another.records.find(x=>x.id===r.id)?.values[p.id],2);
});
test("relation cardinality and target validity are enforced", () => {
  const s: LabState = freshLab();
  const db1=s.databases[0].id,db2=s.databases[1].id;
  const c=createRecord(s,db1,"Alice");
  const first=createRecord(s,db2,"Event One");
  const second=createRecord(s,db2,"Event Two");
  const relation=createProperty(s,db1,"Main Event","relation",{targetDatabaseId:db2,multi:false});
  linkRecord(s,c.id,relation.id,first.id);
  assert.throws(()=>linkRecord(s,c.id,relation.id,second.id),/only one/);
  unlinkRecord(s,c.id,relation.id,first.id);
  linkRecord(s,c.id,relation.id,second.id);
  assert.equal(s.links[0].targetId,second.id);
  assert.throws(()=>linkRecord(s,c.id,relation.id,c.id),/target.*configured database/i);
});
