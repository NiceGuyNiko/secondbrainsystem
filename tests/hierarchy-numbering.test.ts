import test from "node:test";
import assert from "node:assert/strict";
import {chronologyAddresses,perspectiveChronologyLabel,type NumberedEvent} from "../lib/db-engine/hierarchy-numbering";

const event=(id:string,parentId:string|null=null,position=0):NumberedEvent=>({id,parentId,position,order:null,sequence:position+1});
test("a new Era inserted before Uprising automatically renumbers its whole subtree",()=>{
  const original=[event("pre",null,0),event("shattering",null,1),event("dark",null,2),event("elysium",null,3),
    event("uprising",null,4),event("war","uprising",0),event("first-moment","war",0)];
  const before=chronologyAddresses(original);
  assert.equal(before.get("uprising"),"5");
  assert.equal(before.get("war"),"5.1");
  assert.equal(before.get("first-moment"),"5.1.1");
  const after=chronologyAddresses([...original.map(row=>row.id==="uprising"?{...row,position:5}:row),event("false-emergence",null,4)]);
  assert.equal(after.get("false-emergence"),"5");
  assert.equal(after.get("uprising"),"6");
  assert.equal(after.get("war"),"6.1");
  assert.equal(after.get("first-moment"),"6.1.1");
  assert.equal(perspectiveChronologyLabel(after,"war","Michael"),"6.1.Michael");
  assert.equal(perspectiveChronologyLabel(after,"first-moment","Cammy"),"6.1.1.Cammy");
});
test("sibling ordering uses explicit chronology property before position, IDs never change",()=>{
  const nodes=[{...event("a"),order:2},{...event("b",null,10),order:1},event("child","a"),event("unassigned",null,20)];
  const positions=chronologyAddresses(nodes);
  assert.deepEqual([...positions.keys()].sort(),["a","b","child","unassigned"].sort());
  assert.equal(positions.get("b"),"1");
  assert.equal(positions.get("a"),"2");
  assert.equal(positions.get("child"),"2.1");
});
