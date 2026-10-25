import test from "node:test";
import assert from "node:assert/strict";
import {placeWidget,removeWidgetAndCompactLayout,widgetFootprintHeight,widgetDropEdgeAtPoint,widgetLayoutBands} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"world",title:"World History",position:0};
const widget=(id:string,width:number,position:number):PageWidget=>({
  id,page_id:"world",definition_id:id,kind:"database",title:id,
  config:{sectionId:"history"},width,height:2,position
});

test("dropping on a widget never replaces it: middle stacks, sides insert, bottom creates a row",()=>{
  assert.equal(widgetDropEdgeAtPoint(400,300,200,75),"above");
  assert.equal(widgetDropEdgeAtPoint(400,300,200,220),"below");
  assert.equal(widgetDropEdgeAtPoint(400,300,12,140),"left");
  assert.equal(widgetDropEdgeAtPoint(400,300,386,140),"right");
  assert.equal(widgetDropEdgeAtPoint(400,300,200,290),"new-row");
});

test("near-bottom column stack and lower full-width row are distinct drops",()=>{
  const original=[widget("a",6,0),widget("b",6,1),widget("c",12,2)];
  const thirds=placeWidget(original,[section],"c",{sectionId:"history",targetId:"b",edge:"left"});
  const stacked=placeWidget(thirds,[section],"c",{sectionId:"history",targetId:"b",edge:"below"});
  assert.equal(widgetLayoutBands(stacked).length,1);
  assert.deepEqual(widgetLayoutBands(stacked)[0].lanes.map(l=>l.widgets.map(w=>w.id)),[["a"],["b","c"]]);
  const fullRow=placeWidget(thirds,[section],"c",{sectionId:"history",targetId:"b",edge:"new-row"});
  const bands=widgetLayoutBands(fullRow);
  assert.equal(bands.length,2);
  assert.deepEqual(bands[0].lanes.map(l=>l.width),[6,6]);
  assert.deepEqual(bands[1].lanes.map(l=>l.width),[12]);
  assert.equal(bands[1].lanes[0].widgets[0].id,"c");
});

test("gap fill enabled is default; opting out preserves empty lane space",()=>{
  const original=[widget("a",6,0),widget("b",6,1),widget("c",12,2)];
  const thirds=placeWidget(original,[section],"c",{sectionId:"history",targetId:"b",edge:"left"});
  const target={sectionId:"history",targetId:"b",edge:"new-row" as const};
  const auto=widgetLayoutBands(placeWidget(thirds,[section],"c",target));
  const manual=widgetLayoutBands(placeWidget(thirds,[section],"c",target,false));
  assert.deepEqual(auto[0].lanes.map(l=>l.width),[6,6]);
  assert.deepEqual(manual[0].lanes.map(l=>l.width),[4,4]);
  assert.deepEqual(manual[1].lanes.map(l=>l.width),[12]);
});

test("deleting a column compacts the remaining lanes without a ghost fourth track",()=>{
  const four=["a","b","c","d"].map((id,i)=>({...widget(id,3,i),
    config:{sectionId:"history",layoutBand:"shared",layoutLane:"lane-"+id}}));
  const three=removeWidgetAndCompactLayout(four,[section],"c");
  const [band]=widgetLayoutBands(three);
  assert.deepEqual(band.lanes.map(lane=>lane.widgets.map(w=>w.id)),[["a"],["b"],["d"]]);
  assert.deepEqual(band.lanes.map(lane=>lane.width),[4,4,4]);
  assert.equal(three.length,3);
  assert.equal(three.find(w=>w.id==="d")?.config.layoutLane,"lane-d");
});

test("deleting one stacked widget preserves its sibling lane and three-column widths",()=>{
  const four=[widget("a",4,0),widget("b",4,1),widget("c",4,2),widget("d",4,3)]
    .map((w,i)=>({...w,config:{sectionId:"history",layoutBand:"shared",layoutLane:i===3?"lane-a":"lane-"+w.id}}));
  const remaining=removeWidgetAndCompactLayout(four,[section],"a");
  const lanes=widgetLayoutBands(remaining)[0].lanes;
  assert.deepEqual(lanes.map(l=>l.widgets.map(w=>w.id)),[["d"],["b"],["c"]]);
  assert.deepEqual(lanes.map(l=>l.width),[4,4,4]);
});

test("View and Edit keep identical fixed-height widget footprints",()=>{
  const short=widget("short",4,0);
  const tall={...widget("tall",4,1),config:{sectionId:"history",heightPx:608}};
  for(const item of [short,tall])
    assert.equal(widgetFootprintHeight(item,true),widgetFootprintHeight(item,false));
  assert.equal(widgetFootprintHeight(short,true,true),58);
});
