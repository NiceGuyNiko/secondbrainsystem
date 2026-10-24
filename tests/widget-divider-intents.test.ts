import test from "node:test";
import assert from "node:assert/strict";
import {expandWidgetToSectionWidth,matchWidgetAdjacentHeight,placeWidget,toggleWidgetContentFit,widgetLayoutBands} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";
const section:WidgetPageSection={id:"history",page_id:"world",title:"World History",position:0};
const widget=(id:string,heightPx:number,position:number):PageWidget=>({
  id,kind:"database",definition_id:"definition-"+id,page_id:"world",title:id,
  width:12,height:2,position,config:{sectionId:"history",heightPx}
});
const drop=(targetId:string,edge:"right"|"below"|"new-row")=>({sectionId:"history",targetId,edge});

test("triangle double-click toggles content fitting without changing a row or column",()=>{
  const initial=[widget("a",280,0),widget("b",440,1)];
  const split=placeWidget(initial,[section],"b",drop("a","right"));
  const widths=widgetLayoutBands(split)[0].lanes.map(lane=>lane.width);
  const fit=toggleWidgetContentFit(split,"a");
  assert.equal(fit.find(w=>w.id==="a")?.config.fitContent,true);
  assert.deepEqual(widgetLayoutBands(fit)[0].lanes.map(lane=>lane.width),widths);
  assert.equal(fit.find(w=>w.id==="a")?.config.heightPx,280);
  assert.equal(fit.find(w=>w.id==="a")?.definition_id,"definition-a");
  const restore=toggleWidgetContentFit(fit,"a");
  assert.equal(restore.find(w=>w.id==="a")?.config.fitContent,false);
  assert.deepEqual(restore.map(w=>w.position),split.map(w=>w.position));
});

test("bottom-divider double-click matches two widgets in a single column",()=>{
  const initial=[widget("small",216,0),widget("large",592,1)];
  const column=placeWidget(initial,[section],"large",drop("small","below"));
  const expanded=matchWidgetAdjacentHeight(column,"small",14,34);
  assert.equal(expanded.find(w=>w.id==="small")?.config.heightPx,592);
  const reduced=matchWidgetAdjacentHeight(column,"large",14,34);
  assert.equal(reduced.find(w=>w.id==="large")?.config.heightPx,216);
});

test("bottom-divider double-click equalizes the height of columns with different stack counts",()=>{
  const initial=[widget("left-top",272,0),widget("right",648,1),widget("left-bottom",224,2)];
  let layout=placeWidget(initial,[section],"right",drop("left-top","right"));
  layout=placeWidget(layout,[section],"left-bottom",drop("left-top","below"));
  assert.deepEqual(widgetLayoutBands(layout)[0].lanes.map(l=>l.widgets.map(w=>w.id)),
    [["left-top","left-bottom"],["right"]]);
  const expandBottom=matchWidgetAdjacentHeight(layout,"left-bottom",14,34);
  assert.equal(expandBottom.find(w=>w.id==="left-bottom")?.config.heightPx,328);
  assert.equal(expandBottom.find(w=>w.id==="left-top")?.config.heightPx,272);
  assert.equal(expandBottom.find(w=>w.id==="right")?.config.heightPx,648);
  const shrinkRight=matchWidgetAdjacentHeight(layout,"right",14,34);
  assert.equal(shrinkRight.find(w=>w.id==="right")?.config.heightPx,544);
});

test("full-width command stays independent from fitting intrinsic content",()=>{
  const start=[widget("a",280,0),widget("b",360,1)];
  const split=placeWidget(start,[section],"b",drop("a","right"));
  const fit=toggleWidgetContentFit(split,"b");
  const full=expandWidgetToSectionWidth(fit,[section],"b");
  assert.deepEqual(widgetLayoutBands(full).map(b=>b.lanes.map(l=>l.width)),[[12],[12]]);
  assert.equal(full.find(w=>w.id==="b")?.config.fitContent,true);
  assert.equal(full.find(w=>w.id==="b")?.definition_id,"definition-b");
});
