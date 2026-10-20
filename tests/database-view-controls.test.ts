import test from "node:test";
import assert from "node:assert/strict";
import {applyViewRules,readViewConfig} from "../lib/db-engine/view-operators";
import {canCreateOption,optionMatches} from "../lib/db-engine/select-options";

const rows=[
 {record_id:"a",sequence_no:1,values_json:{status:"Active",priority:1}},
 {record_id:"b",sequence_no:2,values_json:{status:"Dormant",priority:3}},
 {record_id:"c",sequence_no:3,values_json:{status:"Active",priority:2}},
];
const ctx={
 name:(id:string)=>({a:"Writing",b:"Health",c:"Finances"}[id as "a"|"b"|"c"]??""),
 relationTargets:(id:string,prop:string)=>prop==="projects"?(id==="a"?["Novel","Character Concepts"]:id==="b"?["Fitness"] : []):[],
};
test("search select options while always permitting custom labels not already used",()=>{
 assert.deepEqual(optionMatches(["P1","P2","P3"],"P"),["P1","P2","P3"]);
 assert.deepEqual(optionMatches(["Canon","Concept","Developing"],"c"),["Canon","Concept"]);
 assert.equal(canCreateOption(["P1","P2"],"P"),true,"partial search may also create new option");
 assert.equal(canCreateOption(["P1","P2"],"p1"),false,"case-insensitive duplicates not created");
 assert.equal(canCreateOption(["P1"]," P4 "),true);
 assert.equal(canCreateOption(["P1"],""),false);
 assert.equal(canCreateOption(Array(60).fill("filled"),"extra"),false);
});
test("multiple view filters AND/OR apply to same persisted record set",()=>{
 const and=readViewConfig({filterMode:"all",filters:[
  {id:"a",field:"status",operator:"is",value:"Active"},
  {id:"b",field:"priority",operator:"is",value:"2"},
 ],sorts:[]});
 assert.deepEqual(applyViewRules(rows,and,ctx).map(r=>r.record_id),["c"]);
 const or={...and,filterMode:"any" as const};
 assert.deepEqual(applyViewRules(rows,or,ctx).map(r=>r.record_id),["a","c"]);
 const link=readViewConfig({filters:[{id:"1",field:"projects",operator:"contains",value:"character"}]});
 assert.deepEqual(applyViewRules(rows,link,ctx).map(r=>r.record_id),["a"]);
 const noValue=readViewConfig({filters:[{id:"1",field:"projects",operator:"is_empty"}]});
 assert.deepEqual(applyViewRules(rows,noValue,ctx).map(r=>r.record_id),["c"]);
});
test("multi-sort honors priority of sort rows and deterministic creation tie-breaks",()=>{
 const config=readViewConfig({sorts:[
  {id:"s1",field:"status",direction:"asc"},
  {id:"s2",field:"priority",direction:"desc"},
 ]});
 assert.deepEqual(applyViewRules(rows,config,ctx).map(r=>r.record_id),["c","a","b"]);
 assert.deepEqual(applyViewRules(rows,readViewConfig({}),ctx,"fina").map(r=>r.record_id),["c"]);
 assert.deepEqual(readViewConfig({filters:[{field:123}],sorts:[null,{}]}).filters,[]);
});
