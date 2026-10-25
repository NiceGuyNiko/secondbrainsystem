import test from "node:test";
import assert from "node:assert/strict";
import {magneticSnapWidth,setWidgetRowLock,widgetBandIdentity,widgetRowOccupancy} from "../lib/widget-formation";
import {placeWidget,resizeWidgetHeight,resizeWidgetLane,reorderWidgetColumn,widgetLayoutBands} from "../lib/widget-layout";
import {defaultWidgetFormationPreferences,type WidgetFormationPreferences} from "../lib/widget-layout-preferences";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"library",title:"World History",position:0};
const make=(id:string,position:number):PageWidget=>({
  id,definition_id:"source-"+id,page_id:"library",kind:"database",title:id,
  position,width:12,height:2,config:{sectionId:section.id,heightPx:320,renderer:"table"}
});
const at=(id:string,edge:"right"|"left"|"below"|"new-row"|"replace")=>({
  sectionId:section.id,targetId:id,edge
});
const bands=(items:PageWidget[])=>widgetLayoutBands(items);
const prefs=(patch:Partial<WidgetFormationPreferences>={}):WidgetFormationPreferences=>({
  ...defaultWidgetFormationPreferences,...patch
});
const two=()=>{
  const [a,b]=[make("a",0),make("b",1)];
  return placeWidget([a,b],[section],"b",at("a","right"));
};

test("magnetic edges connect inside the configured pixel threshold, not beyond it",()=>{
  assert.deepEqual(magneticSnapWidth(5.87,[6,9],100,14),{width:6,snapped:true});
  assert.deepEqual(magneticSnapWidth(5.82,[6,9],100,14),{width:5.82,snapped:false});
});
test("magnetically linked lanes resize their shared boundary together",()=>{
  const result=resizeWidgetLane(two(),[section],"a",1,true,prefs());
  assert.deepEqual(bands(result)[0].lanes.map(l=>l.width),[7,5]);
});
test("without snapping, a resized lane leaves its neighbor unchanged and can free space",()=>{
  const result=resizeWidgetLane(two(),[section],"a",-2,true,prefs({magneticSnapping:false}));
  assert.deepEqual(bands(result)[0].lanes.map(l=>l.width),[4,6]);
  assert.equal(widgetRowOccupancy(result,widgetBandIdentity(result[0])),83);
});
test("row locking persists membership and synchronizes resizing even with magnets off",()=>{
  const source=setWidgetRowLock(two(),"a",true);
  const changed=resizeWidgetLane(source,[section],"a",-1,false,prefs({magneticSnapping:false}));
  assert.deepEqual(bands(changed)[0].lanes.map(l=>l.width),[5,7]);
  assert.equal(changed.every(w=>w.config.rowLocked===true),true);
  const withThird=[...changed,make("c",2)];
  const blocked=placeWidget(withThird,[section],"a",at("c","new-row"),true,prefs());
  assert.deepEqual(blocked,withThird);
  assert.deepEqual(JSON.parse(JSON.stringify(changed)).map((w:PageWidget)=>w.config.rowLocked),[true,true]);
});
test("width lock at 75 percent remains exact when an unlocked neighbor holds 25 percent",()=>{
  const wide=resizeWidgetLane(two(),[section],"a",3);
  const frozen=wide.map(w=>w.id==="a"?{...w,config:{...w.config,sizeLocked:true}}:w);
  assert.deepEqual(bands(frozen)[0].lanes.map(l=>l.width),[9,3]);
  assert.deepEqual(resizeWidgetLane(frozen,[section],"a",-2),frozen);
  assert.deepEqual(resizeWidgetLane(frozen,[section],"b",1),frozen);
});
test("a third physical occupant cannot compress a fully allocated 75/25 locked row",()=>{
  const wide=resizeWidgetLane(two(),[section],"a",3);
  const locked=wide.map(w=>w.id==="a"?{...w,config:{...w.config,sizeLocked:true}}:w);
  const attempted=placeWidget([...locked,make("third",2)],[section],"third",at("b","right"));
  assert.equal(bands(attempted)[0].lanes.length,2);
  assert.deepEqual(bands(attempted)[0].lanes.map(l=>l.width),[9,3]);
  assert.equal(attempted.filter(w=>w.id==="third").length,1);
});
test("replacing a widget keeps displaced data and original source identities in its column",()=>{
  const original=[...two(),{...make("replacement",2),config:{...make("replacement",2).config,filters:[{field:"name",operator:"is",value:"Era"}]}}];
  const replaced=placeWidget(original,[section],"replacement",at("b","replace"),true,prefs({displacement:"same-column"}));
  assert.deepEqual(bands(replaced)[0].lanes[1].widgets.map(w=>w.id),["replacement","b"]);
  assert.equal(replaced.find(w=>w.id==="b")?.definition_id,"source-b");
  assert.deepEqual(replaced.find(w=>w.id==="replacement")?.config.filters,[{field:"name",operator:"is",value:"Era"}]);
});
test("next-row displacement creates a distinct full-width row and never deletes the old widget",()=>{
  const original=[...two(),make("replacement",2)];
  const result=placeWidget(original,[section],"replacement",at("b","replace"),true,prefs({displacement:"next-row"}));
  assert.equal(bands(result).length,2);
  assert.deepEqual(bands(result)[0].lanes[1].widgets.map(w=>w.id),["replacement"]);
  assert.equal(bands(result)[1].lanes[0].widgets[0].id,"b");
  assert.equal(bands(result)[1].lanes[0].width,12);
});
test("locked target cannot be displaced and locked widths cannot swap into smaller slots",()=>{
  const locked=two().map(w=>w.id==="b"?{...w,config:{...w.config,sizeLocked:true}}:w);
  const blocked=placeWidget([...locked,make("replacement",2)],[section],"replacement",at("b","replace"));
  assert.equal(bands(blocked)[0].lanes[1].widgets[0].id,"b");
  const wide=resizeWidgetLane(two(),[section],"a",3);
  const frozen=wide.map(w=>w.id==="a"?{...w,config:{...w.config,sizeLocked:true}}:w);
  assert.deepEqual(reorderWidgetColumn(frozen,[section],"a","b"),frozen);
});
test("shrinking with Fill Freed Space disabled keeps the next stacked widget stationary",()=>{
  const stacked=placeWidget([...two(),make("c",2)],[section],"c",at("a","below"));
  const next=resizeWidgetHeight(stacked,[section],"a",240,prefs({fillFreedSpace:"off"}));
  assert.equal(next.find(w=>w.id==="c")?.config.layoutOffsetPx,80);
  assert.equal(bands(next)[0].lanes[0].widgets.map(w=>w.id).join(","),"a,c");
});
test("Column Rise keeps lane membership, Left-to-Right Reflow fills across lanes",()=>{
  let arranged=placeWidget([...two(),make("c",2)],[section],"c",at("a","below"));
  arranged=placeWidget([...arranged,make("d",3)],[section],"d",at("b","below"));
  const column=resizeWidgetHeight(arranged,[section],"a",240,prefs({fillFreedSpace:"column-rise"}));
  const reflow=resizeWidgetHeight(arranged,[section],"a",240,prefs({fillFreedSpace:"left-to-right"}));
  assert.deepEqual(bands(column)[0].lanes.map(l=>l.widgets.map(w=>w.id)),[["a","c"],["b","d"]]);
  assert.deepEqual(bands(reflow)[0].lanes.map(l=>l.widgets.map(w=>w.id)),[["a","b","c"],["d"]]);
});
test("size lock blocks height changes and save/reload preserves placement metadata",()=>{
  const fixed=two().map(w=>w.id==="a"?{...w,config:{...w.config,sizeLocked:true,rowPinned:true}}:w);
  assert.deepEqual(resizeWidgetHeight(fixed,[section],"a",160),fixed);
  const loaded=JSON.parse(JSON.stringify(fixed)) as PageWidget[];
  assert.deepEqual(bands(loaded).map(b=>b.lanes.map(l=>l.width)),[[6,6]]);
  assert.equal(loaded[0].config.rowPinned,true);
  assert.equal(loaded[0].config.sizeLocked,true);
});
