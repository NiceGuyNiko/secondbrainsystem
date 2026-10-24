import test from "node:test";
import assert from "node:assert/strict";
import {placeWidget,widgetLayoutBands} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"world",title:"World History",position:0};
const widget=(id:string,width:number,position:number):PageWidget=>({
  id,page_id:"world",definition_id:id,kind:"database",title:id,
  config:{sectionId:"history"},width,height:2,position
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
