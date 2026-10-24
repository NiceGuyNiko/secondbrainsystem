import test from "node:test";
import assert from "node:assert/strict";
import {expandWidgetToSectionWidth,placeWidget,resizeWidgetLane,widgetLayoutBands} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";
const section:WidgetPageSection={id:"writing",page_id:"library",title:"Writing",position:0};
const w=(id:string,width:number,position:number,heightPx=400):PageWidget=>({
  id,page_id:"library",definition_id:"master-"+id,kind:"database",title:id,
  config:{sectionId:"writing",heightPx},width,height:2,position
});
test("vertical divider resizes adjacent columns without altering independent heights",()=>{
  const original=[w("left",12,0,630),w("right",12,1,240)];
  const sideBySide=placeWidget(original,[section],"right",{sectionId:"writing",targetId:"left",edge:"right"});
  const resized=resizeWidgetLane(sideBySide,[section],"left",1);
  const lanes=widgetLayoutBands(resized)[0].lanes;
  assert.deepEqual(lanes.map(l=>l.width),[7,5]);
  assert.deepEqual(lanes.map(l=>l.widgets[0].config.heightPx),[630,240]);
});
test("double-click triangle extracts a widget to its own full-width row",()=>{
  const original=[w("left",12,0),w("right",12,1)];
  const sideBySide=placeWidget(original,[section],"right",{sectionId:"writing",targetId:"left",edge:"right"});
  const expanded=expandWidgetToSectionWidth(sideBySide,[section],"right");
  const bands=widgetLayoutBands(expanded);
  assert.equal(bands.length,2);
  assert.equal(bands[0].lanes[0].widgets[0].id,"left");
  assert.equal(bands[0].lanes[0].width,12);
  assert.equal(bands[1].lanes[0].widgets[0].id,"right");
  assert.equal(bands[1].lanes[0].width,12);
  assert.deepEqual(expanded.find(x=>x.id==="right")?.config.heightPx,400);
  assert.equal(expanded.find(x=>x.id==="right")?.definition_id,"master-right");
});
test("double-click on an already isolated widget expands width without deleting records",()=>{
  const existing=[w("only",6,0)];
  const result=expandWidgetToSectionWidth(existing,[section],"only",false);
  assert.equal(result.length,1);
  assert.equal(result[0].width,12);
  assert.equal(result[0].config.heightPx,400);
});
test("full-row divider creates new band while stacking remains in the same column",()=>{
  const original=[w("a",12,0),w("b",12,1),w("c",12,2)];
  const twoColumns=placeWidget(original,[section],"b",{sectionId:"writing",targetId:"a",edge:"right"});
  const row=placeWidget(twoColumns,[section],"c",{sectionId:"writing",targetId:"a",edge:"new-row"});
  assert.equal(widgetLayoutBands(row).length,2);
  const stacked=placeWidget(twoColumns,[section],"c",{sectionId:"writing",targetId:"a",edge:"below"});
  assert.equal(widgetLayoutBands(stacked).length,1);
  assert.deepEqual(widgetLayoutBands(stacked)[0].lanes[0].widgets.map(x=>x.id),["a","c"]);
});
