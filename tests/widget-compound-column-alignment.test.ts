import test from "node:test";
import assert from "node:assert/strict";
import {matchWidgetAdjacentHeight,placeWidget,widgetLayoutBands} from "../lib/widget-layout";
import {widgetHeightPx,type PageWidget,type WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"world",page_id:"library",title:"World History",position:0};
const make=(id:string,position:number,heightPx:number):PageWidget=>({
  id,title:id,kind:"database",definition_id:"master-"+id,page_id:"library",
  width:12,height:2,position,config:{sectionId:"world",heightPx}
});
const target=(id:string,edge:"right"|"span-below")=>({
  sectionId:"world",targetId:id,edge
});
function fourWidgetGroup(left=752,middle=304,right=280,lower=304){
  const items=[
    make("World Eras",0,left),make("Story Moments",1,middle),
    make("Historical Events",2,right),make("Project Goals",3,lower)
  ];
  let result=placeWidget(items,[section],"Story Moments",target("World Eras","right"));
  result=placeWidget(result,[section],"Historical Events",target("Story Moments","right"));
  result=placeWidget(result,[section],"Project Goals",target("Story Moments","span-below"));
  assert.deepEqual(widgetLayoutBands(result)[0].lanes.map(l=>l.width),[4,4,4]);
  assert.equal(widgetLayoutBands(result)[0].spans?.[0]?.widgets[0].id,"Project Goals");
  return result;
}
const height=(items:readonly PageWidget[],id:string)=>widgetHeightPx(items.find(w=>w.id===id)!);
const rightHeight=(items:readonly PageWidget[],chrome=34,gap=14)=>
  Math.max(height(items,"Story Moments")+chrome,height(items,"Historical Events")+chrome)+
    gap+height(items,"Project Goals")+chrome;
const leftHeight=(items:readonly PageWidget[],chrome=34)=>height(items,"World Eras")+chrome;

test("double-clicking the fourth spanning widget matches the bottom of the tall left column",()=>{
  const before=fourWidgetGroup();
  const aligned=matchWidgetAdjacentHeight(before,"Project Goals",14,34);
  assert.equal(height(aligned,"Project Goals"),400);
  assert.equal(rightHeight(aligned),leftHeight(aligned));
  assert.equal(height(aligned,"World Eras"),752);
  assert.equal(height(aligned,"Story Moments"),304);
  assert.equal(height(aligned,"Historical Events"),280);
  assert.equal(aligned.find(w=>w.id==="Project Goals")?.definition_id,"master-Project Goals");
  assert.equal(widgetLayoutBands(aligned).length,1);
});
test("when a span cannot shrink below minimum, left neighbor grows to finish at the same base",()=>{
  const before=fourWidgetGroup(320,304,280,300);
  const aligned=matchWidgetAdjacentHeight(before,"Project Goals",14,34);
  assert.equal(height(aligned,"Project Goals"),160);
  assert.equal(height(aligned,"World Eras"),512);
  assert.equal(rightHeight(aligned),leftHeight(aligned));
});
test("double-clicking Story Moments matches Historical Events above and rebalances the lower span",()=>{
  const before=fourWidgetGroup(752,224,304,304);
  const aligned=matchWidgetAdjacentHeight(before,"Story Moments",14,34);
  assert.equal(height(aligned,"Story Moments"),304);
  assert.equal(height(aligned,"Project Goals"),400);
  assert.equal(rightHeight(aligned),leftHeight(aligned));
});
test("double-clicking left column compares against the entire compound right side",()=>{
  const before=fourWidgetGroup(752,304,280,304);
  const aligned=matchWidgetAdjacentHeight(before,"World Eras",14,34);
  assert.equal(height(aligned,"World Eras"),656);
  assert.equal(rightHeight(aligned),leftHeight(aligned));
  assert.equal(height(aligned,"Project Goals"),304);
});
test("subsequent matches remain stable and do not silently change widths or widget IDs",()=>{
  const before=fourWidgetGroup(760,216,320,320);
  const aligned=matchWidgetAdjacentHeight(before,"Historical Events",14,34);
  const again=matchWidgetAdjacentHeight(aligned,"Project Goals",14,34);
  assert.equal(rightHeight(again),leftHeight(again));
  assert.deepEqual(again.map(w=>w.id).sort(),before.map(w=>w.id).sort());
  assert.deepEqual(again.map(w=>w.width),before.map(w=>w.width));
  assert.deepEqual(widgetLayoutBands(again)[0].spans?.[0]?.widgets.map(w=>w.id),["Project Goals"]);
});
