import test from "node:test";
import assert from "node:assert/strict";
import {canInsertWidgetColumn,placeWidget,widgetLayoutBands,MAX_WIDGET_COLUMNS} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"library",title:"World History",position:0};
const widget=(id:string,position:number):PageWidget=>({
  id,kind:"database",definition_id:"master-"+id,title:id,page_id:"library",
  width:12,height:2,position,config:{sectionId:"history",heightPx:320}
});
const drop=(id:string,edge:"left"|"right"|"below"|"new-row")=>({sectionId:"history",targetId:id,edge});

test("left outer insertion creates a column before the row without expanding its footprint",()=>{
  const source=[widget("World Eras",0),widget("Historical Events",1),widget("new",2)];
  const two=placeWidget(source,[section],"Historical Events",drop("World Eras","right"));
  const result=placeWidget(two,[section],"new",drop("World Eras","left"));
  const band=widgetLayoutBands(result)[0];
  assert.deepEqual(band.lanes.map(l=>l.widgets.map(w=>w.id)),[["new"],["World Eras"],["Historical Events"]]);
  assert.deepEqual(band.lanes.map(l=>l.width),[4,4,4]);
  assert.equal(band.lanes.reduce((width,lane)=>width+lane.width,0),12);
  assert.equal(canInsertWidgetColumn(band),true);
});
test("right outer insertion adds a fourth column inside the same row",()=>{
  const source=[widget("a",0),widget("b",1),widget("c",2),widget("d",3)];
  let layout=placeWidget(source,[section],"b",drop("a","right"));
  layout=placeWidget(layout,[section],"c",drop("b","right"));
  layout=placeWidget(layout,[section],"d",drop("c","right"));
  const band=widgetLayoutBands(layout)[0];
  assert.deepEqual(band.lanes.map(l=>l.widgets[0].id),["a","b","c","d"]);
  assert.deepEqual(band.lanes.map(l=>l.width),[3,3,3,3]);
  assert.equal(band.lanes.reduce((n,l)=>n+l.width,0),12);
  assert.equal(MAX_WIDGET_COLUMNS,4);
  assert.equal(canInsertWidgetColumn(band),false);
});
test("dropping between two columns inserts in the middle rather than stacking",()=>{
  const source=[widget("a",0),widget("b",1),widget("new",2)];
  const two=placeWidget(source,[section],"b",drop("a","right"));
  const result=placeWidget(two,[section],"new",drop("a","right"));
  const band=widgetLayoutBands(result)[0];
  assert.deepEqual(band.lanes.map(l=>l.widgets[0].id),["a","new","b"]);
  assert.equal(result.find(x=>x.id==="new")?.definition_id,"master-new");
});
test("at the four-column cap additional insertions stack without overflowing",()=>{
  const source=[widget("a",0),widget("b",1),widget("c",2),widget("d",3),widget("fifth",4)];
  let layout=placeWidget(source,[section],"b",drop("a","right"));
  layout=placeWidget(layout,[section],"c",drop("b","right"));
  layout=placeWidget(layout,[section],"d",drop("c","right"));
  layout=placeWidget(layout,[section],"fifth",drop("a","left"));
  const band=widgetLayoutBands(layout)[0];
  assert.equal(band.lanes.length,4);
  assert.equal(band.lanes.reduce((n,l)=>n+l.width,0),12);
  assert.deepEqual(band.lanes[0].widgets.map(w=>w.id),["fifth","a"]);
  assert.equal(layout.filter(w=>w.id==="fifth").length,1);
});
test("short stack vs long row targets still have distinct layout semantics",()=>{
  const source=[widget("a",0),widget("b",1),widget("c",2)];
  const cols=placeWidget(source,[section],"b",drop("a","right"));
  const stack=placeWidget(cols,[section],"c",drop("a","below"));
  assert.equal(widgetLayoutBands(stack).length,1);
  assert.deepEqual(widgetLayoutBands(stack)[0].lanes[0].widgets.map(w=>w.id),["a","c"]);
  const row=placeWidget(cols,[section],"c",drop("a","new-row"));
  assert.equal(widgetLayoutBands(row).length,2);
  assert.equal(widgetLayoutBands(row)[1].lanes[0].width,12);
});
