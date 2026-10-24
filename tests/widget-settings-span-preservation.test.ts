import test from "node:test";
import assert from "node:assert/strict";
import {activeProfile,defaultSettings,parsePreferences,updateActivePreferences} from "../lib/settings/model";
import {placeWidget,widgetLayoutBands} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

test("Blend and bottom widget controls are saved profile preferences",()=>{
  const original=defaultSettings();
  assert.equal(activeProfile(original).preferences.widgetStyle,"classic");
  assert.equal(activeProfile(original).preferences.widgetHeaderPosition,"top");
  const updated=updateActivePreferences(original,()=>({widgetStyle:"blend",widgetHeaderPosition:"bottom"}));
  const parsed=parsePreferences(JSON.parse(JSON.stringify(activeProfile(updated).preferences)));
  assert.equal(parsed.widgetStyle,"blend");
  assert.equal(parsed.widgetHeaderPosition,"bottom");
  assert.equal(activeProfile(original).preferences.widgetHeaderPosition,"top");
  assert.equal(parsePreferences({widgetStyle:"unknown",widgetHeaderPosition:"invalid"}).widgetHeaderPosition,"top");
});
const section:WidgetPageSection={id:"s",page_id:"p",title:"Planning",position:0};
const w=(id:string,position:number):PageWidget=>({
  id,kind:"database",definition_id:"master-"+id,title:id,page_id:"p",
  width:12,height:2,position,config:{sectionId:"s",heightPx:400}
});
const target=(id:string,edge:"left"|"right"|"span-below"|"new-row")=>({sectionId:"s",targetId:id,edge});
test("Removing a column next to a 67% span preserves every widget and source",()=>{
  const input=[w("a",0),w("b",1),w("c",2),w("d",3)];
  let layout=placeWidget(input,[section],"b",target("a","right"));
  layout=placeWidget(layout,[section],"c",target("b","right"));
  layout=placeWidget(layout,[section],"d",target("b","span-below"));
  assert.equal(widgetLayoutBands(layout)[0].spans?.[0]?.widgets[0].id,"d");
  const rearranged=placeWidget(layout,[section],"c",target("b","new-row"));
  const all=widgetLayoutBands(rearranged).flatMap(band=>[
    ...band.lanes.flatMap(lane=>lane.widgets),
    ...(band.spans??[]).flatMap(span=>span.widgets)
  ]);
  assert.deepEqual(all.map(item=>item.id).sort(),["a","b","c","d"]);
  assert.equal(all.find(item=>item.id==="d")?.definition_id,"master-d");
  assert.equal(all.find(item=>item.id==="d")?.width,12);
});
