import assert from "node:assert/strict";
import {test} from "node:test";
import {addRecentReference,cloneCompanionView,initialPaneState,referenceForPane} from "../lib/companion-pane-state";
import type {CompanionTarget} from "../lib/companion-config";

const michael:CompanionTarget={
  id:"character-michael",title:"Michael",kind:"record",
  databaseId:"characters",databaseName:"Characters",
  workspaceId:"nobody-special",workspaceName:"Nobody Special",
  fields:[{id:"motivation",label:"Motivation",value:"Strength"}]
};
const alina:CompanionTarget={
  ...michael,id:"character-alina",title:"Alina",
  fields:[{id:"motivation",label:"Motivation",value:"Different goals"}]
};
test("Agenda duplication copies selected day without coupling the two panes",()=>{
  const first=initialPaneState("2026-10-22",true);
  const second=initialPaneState("2026-10-22",true);
  first.agenda.date="2026-10-21";
  const cloned=cloneCompanionView(first,second,"agenda");
  cloned.agenda.date="2026-10-20";
  assert.equal(first.agenda.date,"2026-10-21");
  assert.equal(cloned.agenda.date,"2026-10-20");
});
test("Context pane locks compare different records while main page navigates",()=>{
  const top=initialPaneState("2026-10-22",true);
  const bottom=initialPaneState("2026-10-22",true);
  top.context.locked=michael;
  bottom.context.locked=alina;
  assert.equal(referenceForPane(top.context.locked,alina).title,"Michael");
  assert.equal(referenceForPane(bottom.context.locked,michael).title,"Alina");
  assert.equal(referenceForPane(null,alina).title,"Alina");
});
test("Cloning Context preserves an independent lock and collapsed sections",()=>{
  const source=initialPaneState("2026-10-22",true);
  const recipient=initialPaneState("2026-10-22",true);
  source.context.locked=michael;
  source.context.expanded={identity:false};
  const cloned=cloneCompanionView(source,recipient,"context");
  cloned.context.expanded.identity=true;
  assert.equal(source.context.expanded.identity,false);
  cloned.context.locked!.fields[0].value="Modified cached view";
  assert.equal(source.context.locked!.fields[0].value,"Strength");
});
test("Thoughts duplication preserves reference and filter but not an unsent draft",()=>{
  const source=initialPaneState("2026-10-22",true);
  const recipient=initialPaneState("2026-10-22",true);
  source.thoughts.locked=michael;
  source.thoughts.filter="related";
  source.thoughts.draft="Do not double-submit this draft";
  const cloned=cloneCompanionView(source,recipient,"thoughts");
  assert.equal(cloned.thoughts.locked?.id,"character-michael");
  assert.equal(cloned.thoughts.filter,"related");
  assert.equal(cloned.thoughts.draft,"");
  cloned.thoughts.locked!.fields[0].value="Other cached value";
  assert.equal(source.thoughts.locked?.fields[0].value,"Strength");
});
test("Recent page choices deduplicate and refresh their reference details",()=>{
  const first=addRecentReference([],michael);
  const next=addRecentReference(first,alina);
  const latest=addRecentReference(next,{...michael,title:"Michael updated"});
  assert.deepEqual(latest.map(t=>t.id),["character-michael","character-alina"]);
  assert.equal(latest[0].title,"Michael updated");
});