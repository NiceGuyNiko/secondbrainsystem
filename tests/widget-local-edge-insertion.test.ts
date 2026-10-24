import test from "node:test";
import assert from "node:assert/strict";
import {placeWidget,widgetLayoutBands,canInsertWidgetColumn} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"library",title:"World History",position:0};
const make=(id:string,position:number):PageWidget=>({
  id,title:id,kind:"database",definition_id:"master-"+id,
  page_id:"library",width:12,height:2,position,
  config:{sectionId:"history",heightPx:280}
});
const drop=(targetId:string,edge:"left"|"right"|"span-below",extra:Record<string,unknown>={})=>
  ({sectionId:"history",targetId,edge,...extra});
const layout=()=>{
  const initial=["eras","events","tall","merged","new"].map((name,i)=>make(name,i));
  let result=placeWidget(initial,[section],"events",drop("eras","right"));
  result=placeWidget(result,[section],"tall",drop("events","right"));
  result=placeWidget(result,[section],"merged",drop("eras","span-below",{spanStartLane:0,spanLaneCount:2}));
  return result;
};
test("local edge insertion beside a merged lower widget adds a physical fourth column",()=>{
  const initial=layout();
  assert.deepEqual(widgetLayoutBands(initial)[0].lanes.map(l=>l.widgets[0].id),["eras","events","tall"]);
  assert.equal(widgetLayoutBands(initial)[0].spans?.[0].laneCount,2);
  const modified=placeWidget(initial,[section],"new",drop("events","right",{extendSpanWidgetId:"merged"}));
  const first=widgetLayoutBands(modified)[0];
  assert.deepEqual(first.lanes.map(l=>l.widgets[0].id),["eras","events","new","tall"]);
  assert.equal(first.spans?.[0].startLane,0);
  assert.equal(first.spans?.[0].laneCount,3);
  assert.deepEqual(first.spans?.[0].widgets.map(w=>w.id),["merged"]);
  assert.equal(modified.find(w=>w.id==="merged")?.width,9);
  assert.equal(canInsertWidgetColumn(first),false);
});
test("left edge insertion preserves the merged widget across its expanded three-column footprint",()=>{
  const initial=layout();
  const modified=placeWidget(initial,[section],"new",drop("eras","left",{extendSpanWidgetId:"merged"}));
  const first=widgetLayoutBands(modified)[0];
  assert.deepEqual(first.lanes.map(l=>l.widgets[0].id),["new","eras","events","tall"]);
  assert.equal(first.spans?.[0].startLane,0);
  assert.equal(first.spans?.[0].laneCount,3);
  assert.equal(modified.find(w=>w.id==="merged")?.width,9);
});
test("clicking the side of an unrelated column does not alter the merged group's anchors",()=>{
  const initial=layout();
  const modified=placeWidget(initial,[section],"new",drop("tall","right"));
  const first=widgetLayoutBands(modified)[0];
  assert.deepEqual(first.lanes.map(l=>l.widgets[0].id),["eras","events","tall","new"]);
  assert.equal(first.spans?.[0].laneCount,2);
  assert.equal(modified.find(w=>w.id==="merged")?.width,6);
});
test("at four physical columns, a fifth widget stacks without duplicating or moving the merged widget",()=>{
  const initial=layout();
  const withFourth=placeWidget(initial,[section],"new",drop("events","right",{extendSpanWidgetId:"merged"}));
  const fifth=make("fifth",withFourth.length);
  const outcome=placeWidget([...withFourth,fifth],[section],"fifth",drop("eras","left",{extendSpanWidgetId:"merged"}));
  const bands=widgetLayoutBands(outcome),main=bands[0];
  assert.equal(main.lanes.length,4);
  assert.equal(main.spans?.[0].laneCount,3);
  assert.equal(outcome.filter(w=>w.id==="merged").length,1);
  assert.equal(outcome.filter(w=>w.id==="fifth").length,1);
  assert.deepEqual(outcome.map(w=>w.id).sort(),["eras","events","fifth","merged","new","tall"]);
});
test("no change to underlying reusable database sources or saved display heights",()=>{
  const initial=layout();
  const modified=placeWidget(initial,[section],"new",drop("events","right",{extendSpanWidgetId:"merged"}));
  for(const item of modified){
    assert.equal(item.definition_id,"master-"+item.id);
    assert.equal(item.config.heightPx,280);
  }
});
