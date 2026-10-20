import test from "node:test";
import assert from "node:assert/strict";
import {toChronologyNodes,sortedNodes} from "../components/db-chronology-tree";

test("Events hierarchy supports eras, major events, moments, and standalone moments",()=>{
 const events:Array<{record_id:string;sequence_no:number;values_json:Record<string,string|number|boolean|null>}>=[
  {record_id:"era",sequence_no:2,values_json:{scale:"Era",order:1}},
  {record_id:"blackout",sequence_no:4,values_json:{scale:"Major Event",order:3}},
  {record_id:"otto",sequence_no:7,values_json:{scale:"Moment",order:1}},
  {record_id:"private-meeting",sequence_no:9,values_json:{scale:"Moment"}},
  {record_id:"unlinked",sequence_no:11,values_json:{}},
 ];
 const edges=[
  {property_id:"parent",source_record_id:"blackout",target_record_id:"era"},
  {property_id:"parent",source_record_id:"otto",target_record_id:"blackout"},
 ];
 const nodes=toChronologyNodes(events,edges,"scale","parent","order");
 assert.deepEqual(nodes.find(n=>n.id==="era")?.tier,"Era");
 assert.deepEqual(nodes.find(n=>n.id==="blackout")?.parentId,"era");
 assert.deepEqual(nodes.find(n=>n.id==="otto")?.parentId,"blackout");
 assert.deepEqual(nodes.find(n=>n.id==="private-meeting")?.parentId,null,
  "a Moment without a larger parent stays visible at the root");
 assert.deepEqual(nodes.find(n=>n.id==="private-meeting")?.tier,"Moment");
 assert.deepEqual(nodes.find(n=>n.id==="unlinked")?.tier,"Major Event",
  "unspecified scale is safe and remains visible");
 assert.deepEqual(sortedNodes(nodes).map(n=>n.id).slice(0,3),["era","otto","blackout"]);
});
test("unknown parent never hides an event from the chronology",()=>{
 const nodes=toChronologyNodes([{record_id:"m",sequence_no:1,values_json:{}}],[
  {property_id:"parent",source_record_id:"m",target_record_id:"archived-or-other-owner"}
 ],"scale","parent");
 assert.equal(nodes[0].parentId,null);
});
