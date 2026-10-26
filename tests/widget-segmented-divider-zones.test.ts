import test from "node:test";
import assert from "node:assert/strict";
import {expandWidgetIntoVacantLane,placeWidget,widgetLayoutBands} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"library",title:"World History",position:0};
const make=(id:string,position:number):PageWidget=>({
  id,title:id,kind:"database",definition_id:"source-"+id,
  page_id:"library",width:12,height:2,position,
  config:{sectionId:section.id,heightPx:id==="lower"?320:260}
});

function tLayout(){
  let rows=["left","upperB","upperC","lower","new"].map(make);
  rows=placeWidget(rows,[section],"upperB",{sectionId:section.id,targetId:"left",edge:"right"});
  rows=placeWidget(rows,[section],"upperC",{sectionId:section.id,targetId:"upperB",edge:"right"});
  rows=placeWidget(rows,[section],"lower",{sectionId:section.id,targetId:"upperB",
    edge:"span-below",spanStartLane:1,spanLaneCount:2});
  return rows;
}

test("zone 1 inserts an upper column inside B+C without widening or moving the lower widget",()=>{
  const original=tLayout();
  const before=widgetLayoutBands(original)[0];
  const outsideWidth=before.lanes[0].width;
  const lowerWidth=original.find(w=>w.id==="lower")?.width;
  const inserted=placeWidget(original,[section],"new",{
    sectionId:section.id,targetId:"upperB",edge:"right",
    extendSpanWidgetId:"lower",preserveGroupWidth:true
  });
  const band=widgetLayoutBands(inserted)[0];
  assert.deepEqual(band.lanes.map(lane=>lane.widgets[0].id),["left","upperB","new","upperC"]);
  assert.equal(band.lanes[0].width,outsideWidth);
  assert.equal(band.spans?.[0].startLane,1);
  assert.equal(band.spans?.[0].laneCount,3);
  assert.equal(inserted.find(w=>w.id==="lower")?.width,lowerWidth);
});

test("zone 3 adds a lower-left widget under A, without creating an upper fourth column",()=>{
  const original=tLayout();
  const widths=widgetLayoutBands(original)[0].lanes.map(lane=>lane.width);
  const inserted=placeWidget(original,[section],"new",{
    sectionId:section.id,targetId:"lower",edge:"lower-adjacent-left"
  });
  const band=widgetLayoutBands(inserted)[0];
  assert.deepEqual(band.lanes.map(lane=>lane.widgets.map(w=>w.id)),[
    ["left","new"],["upperB"],["upperC"]
  ]);
  assert.deepEqual(band.lanes.map(lane=>lane.width),widths);
  assert.deepEqual(band.spans?.[0].widgets.map(w=>w.id),["lower"]);
  assert.equal(inserted.find(w=>w.id==="new")?.config.heightPx,320);
});

test("zone 4 can expand the lower widget only into a vacant adjacent lane",()=>{
  const original=tLayout();
  const grown=expandWidgetIntoVacantLane(original,"lower","left");
  const lower=grown.find(w=>w.id==="lower");
  assert.equal(lower?.config.layoutSpanStart,0);
  assert.equal(lower?.config.layoutSpanCount,3);
  assert.equal(lower?.width,12);
  assert.deepEqual(widgetLayoutBands(grown)[0].lanes.map(lane=>lane.widgets[0].id),
    ["left","upperB","upperC"]);

  const occupied=placeWidget(original,[section],"new",{
    sectionId:section.id,targetId:"lower",edge:"lower-adjacent-left"
  });
  const blocked=expandWidgetIntoVacantLane(occupied,"lower","left");
  assert.equal(blocked.find(w=>w.id==="lower")?.config.layoutSpanStart,1);
  assert.equal(blocked.find(w=>w.id==="lower")?.config.layoutSpanCount,2);
});
