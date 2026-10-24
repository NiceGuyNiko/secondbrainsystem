import test from "node:test";
import assert from "node:assert/strict";
import {activeProfile,defaultSettings,parsePreferences,updateActivePreferences} from "../lib/settings/model";
import {applyWidgetDoubleClickAction,widgetDoubleClickDescription,placeWidget,widgetLayoutBands} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"s",page_id:"p",title:"World History",position:0};
const w=(id:string,position:number,heightPx:number):PageWidget=>({
  id,kind:"database",definition_id:"master-"+id,page_id:"p",title:id,
  width:12,height:2,position,config:{sectionId:"s",heightPx}
});

test("old profiles receive documented independent double click defaults",()=>{
  const defaults=defaultSettings();
  assert.equal(activeProfile(defaults).preferences.widgetCornerDoubleClick,"fit-content");
  assert.equal(activeProfile(defaults).preferences.widgetBottomDoubleClick,"match-height");
  const old={...activeProfile(defaults).preferences};
  delete (old as Partial<typeof old>).widgetCornerDoubleClick;
  delete (old as Partial<typeof old>).widgetBottomDoubleClick;
  const parsed=parsePreferences(old);
  assert.equal(parsed.widgetCornerDoubleClick,"fit-content");
  assert.equal(parsed.widgetBottomDoubleClick,"match-height");
  assert.equal(parsePreferences({widgetCornerDoubleClick:"bad",widgetBottomDoubleClick:"bad"}).widgetCornerDoubleClick,"fit-content");
});
test("double-click choices persist independently by profile",()=>{
  const before=defaultSettings();
  const after=updateActivePreferences(before,()=>({
    widgetCornerDoubleClick:"full-width",widgetBottomDoubleClick:"none"
  }));
  assert.equal(activeProfile(after).preferences.widgetCornerDoubleClick,"full-width");
  assert.equal(activeProfile(after).preferences.widgetBottomDoubleClick,"none");
  assert.equal(activeProfile(before).preferences.widgetCornerDoubleClick,"fit-content");
  const read=parsePreferences(JSON.parse(JSON.stringify(activeProfile(after).preferences)));
  assert.equal(read.widgetCornerDoubleClick,"full-width");
  assert.equal(read.widgetBottomDoubleClick,"none");
});

test("each configured gesture applies its chosen action without mutating another widget",()=>{
  const initial=[w("a",0,260),w("b",1,400)];
  const split=placeWidget(initial,[section],"b",{sectionId:"s",targetId:"a",edge:"right"});
  const none=applyWidgetDoubleClickAction(split,[section],"a","none");
  assert.deepEqual(none,split);
  const fitted=applyWidgetDoubleClickAction(split,[section],"a","fit-content");
  assert.equal(fitted.find(x=>x.id==="a")?.config.fitContent,true);
  assert.equal(fitted.find(x=>x.id==="b")?.config.fitContent,undefined);
  const matched=applyWidgetDoubleClickAction(split,[section],"a","match-height");
  assert.equal(matched.find(x=>x.id==="a")?.config.heightPx,400);
  const full=applyWidgetDoubleClickAction(split,[section],"a","full-width");
  assert.equal(widgetLayoutBands(full).length,2);
  assert.equal(full.find(x=>x.id==="a")?.definition_id,"master-a");
  assert.match(widgetDoubleClickDescription("fit-content"),/height/);
});
