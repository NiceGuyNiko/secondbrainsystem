import assert from "node:assert/strict";
import {test} from "node:test";
import {defaultCompanion,parseCompanion,resolveSections,sectionVisible,scopeKey,type CompanionTarget} from "../lib/companion-config";

const target:CompanionTarget={
 id:"michael-id",title:"Michael",kind:"record",databaseId:"characters-id",databaseName:"Characters",
 workspaceId:"nobody-special",workspaceName:"Nobody Special",
 fields:[{id:"name",label:"Name",value:"Michael"},{id:"motivation",label:"Motivation",value:"Strength"},{id:"relation",label:"Connections",value:"Camilla",kind:"relation"}]
};

test("Companion preference parsing preserves safe defaults",()=>{
 assert.deepEqual(parseCompanion(null),defaultCompanion);
 const c=parseCompanion({splitPercent:900,layout:"invalid",primary:"agenda",secondary:"agenda",visibility:"empty"});
 assert.equal(c.splitPercent,75);
 assert.equal(c.layout,"single");
 assert.equal(c.secondary,"context");
 assert.equal(c.visibility,"empty");
});

test("old preview's default Context-first layout migrates only once",()=>{
 const migrated=parseCompanion({primary:"context",secondary:"agenda",layout:"split",splitPercent:52});
 assert.equal(migrated.layout,"single");
 assert.equal(migrated.primary,"agenda");
 assert.equal(migrated.secondary,"context");
 assert.equal(migrated.uiVersion,2);
 const intentional=parseCompanion({...migrated,primary:"context",secondary:"agenda"});
 assert.equal(intentional.primary,"context");
 assert.equal(intentional.secondary,"agenda");
});

test("matching-tool preference allows two simultaneous Agenda panes",()=>{
 const both=parseCompanion({primary:"agenda",secondary:"agenda",matchingTool:"duplicate",layout:"split"});
 assert.equal(both.primary,"agenda");assert.equal(both.secondary,"agenda");
 assert.equal(both.matchingTool,"duplicate");
 const swap=parseCompanion({primary:"agenda",secondary:"agenda",matchingTool:"swap",layout:"split"});
 assert.equal(swap.secondary,"context");
 assert.equal(swap.matchingTool,"swap");
});
test("docked column width is bounded and resize can be disabled",()=>{
 assert.equal(defaultCompanion.resizableColumn,true);
 assert.equal(parseCompanion({widthPx:200}).widthPx,300);
 assert.equal(parseCompanion({widthPx:2000}).widthPx,720);
 assert.equal(parseCompanion({widthPx:475,resizableColumn:false}).widthPx,475);
 assert.equal(parseCompanion({widthPx:475,resizableColumn:false}).resizableColumn,false);
});

test("four-level Context inheritance edits presentation without cloning source fields",()=>{
 const configs={
  [scopeKey("database",target)]:[{id:"overview",title:"Character overview"}],
  [scopeKey("workspace",target)]:[{id:"overview",condition:"nonempty" as const}],
  [scopeKey("record",target)]:[{id:"strength-ideology",title:"Strength ideology",fieldIds:["motivation"],visible:true,condition:"nonempty" as const}],
  [scopeKey("record-workspace",target)]:[{id:"overview",title:"Michael here"}]
 };
 const sections=resolveSections(target,configs);
 assert.equal(sections.find(s=>s.id==="overview")?.title,"Michael here");
 assert.equal(sections.find(s=>s.id==="overview")?.condition,"nonempty");
 assert.equal(sections.find(s=>s.id==="strength-ideology")?.fieldIds[0],"motivation");
 assert.equal(target.fields[1].value,"Strength");
});

test("section visibility is configurable and relation-aware",()=>{
 const empty={id:"empty",title:"Empty",fieldIds:[],visible:true,condition:"nonempty" as const};
 assert.equal(sectionVisible(empty,target,"rules"),false);
 assert.equal(sectionVisible(empty,target,"manual"),true);
 assert.equal(sectionVisible({...empty,condition:"relation"},target,"rules"),true);
 assert.equal(sectionVisible({...empty,visible:false},target,"manual"),false);
});
