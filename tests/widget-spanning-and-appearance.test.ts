import test from "node:test";
import assert from "node:assert/strict";
import {widgetLayoutBands,placeWidget,matchWidgetStackHeight,expandWidgetToSectionWidth,resizeWidgetLane} from "../lib/widget-layout";
import {widgetHeightPx,type PageWidget,type WidgetPageSection} from "../lib/widget-system";
const sec:WidgetPageSection={id:"section",page_id:"page",position:0,title:"World View"};
const item=(id:string,height:number,position:number):PageWidget=>({
  id,definition_id:"master-"+id,kind:"database",page_id:"page",title:id,
  width:12,height:2,position,config:{sectionId:"section",heightPx:height}
});
const target=(targetId:string,edge:"left"|"right"|"above"|"below"|"span-below"|"new-row")=>({sectionId:"section",targetId,edge});

test("A fourth widget spans both right columns under a tall independent left widget",()=>{
  const input=[item("left",720,0),item("middle",240,1),item("right",280,2),item("fourth",340,3)];
  const second=placeWidget(input,[sec],"middle",target("left","right"));
  const third=placeWidget(second,[sec],"right",target("middle","right"));
  const before=widgetLayoutBands(third);
  assert.deepEqual(before[0].lanes.map(l=>l.width),[4,4,4]);
  const result=placeWidget(third,[sec],"fourth",target("middle","span-below"));
  const bands=widgetLayoutBands(result);
  assert.equal(bands.length,1,"the spanning item belongs to the original band");
  assert.deepEqual(bands[0].lanes.map(l=>l.widgets.map(w=>w.id)),[["left"],["middle"],["right"]]);
  assert.equal(bands[0].spans?.[0]?.widgets[0].id,"fourth");
  assert.equal(bands[0].spans?.[0]?.startLane,1);
  assert.equal(bands[0].spans?.[0]?.laneCount,2);
  assert.equal(result.find(w=>w.id==="fourth")?.width,8);
  assert.equal(result.find(w=>w.id==="fourth")?.config.layoutBand,result.find(w=>w.id==="left")?.config.layoutBand);
  assert.equal(result.find(w=>w.id==="left")?.config.heightPx,720);
  assert.equal(result.find(w=>w.id==="middle")?.config.heightPx,240);
  assert.equal(result.find(w=>w.id==="right")?.config.heightPx,280);
});
test("A spanning widget can be moved to a normal full-width row without duplicating its source",()=>{
  const original=[item("a",700,0),item("b",250,1),item("c",250,2),item("d",300,3)];
  const two=placeWidget(original,[sec],"b",target("a","right"));
  const three=placeWidget(two,[sec],"c",target("b","right"));
  const span=placeWidget(three,[sec],"d",target("b","span-below"));
  const full=expandWidgetToSectionWidth(span,[sec],"d");
  assert.equal(widgetLayoutBands(full).length,2);
  assert.equal(widgetLayoutBands(full)[1].lanes[0].width,12);
  assert.equal(full.filter(w=>w.id==="d").length,1);
  assert.equal(full.find(w=>w.id==="d")?.definition_id,"master-d");
});
test("Double-click matching changes the clicked widget's height and nothing else",()=>{
  const input=[item("tall",680,0),item("short",240,1)];
  const stacked=placeWidget(input,[sec],"short",target("tall","below"));
  const expand=matchWidgetStackHeight(stacked,"short");
  assert.equal(widgetHeightPx(expand.find(w=>w.id==="short")!),680);
  assert.equal(widgetHeightPx(expand.find(w=>w.id==="tall")!),680);
  const shrink=matchWidgetStackHeight(stacked,"tall");
  assert.equal(widgetHeightPx(shrink.find(w=>w.id==="tall")!),240);
  assert.equal(widgetHeightPx(shrink.find(w=>w.id==="short")!),240);
  assert.equal(shrink.find(w=>w.id==="tall")?.definition_id,"master-tall");
});
test("Column divider resizing retains individual saved heights",()=>{
  const input=[item("a",700,0),item("b",230,1),item("c",330,2)];
  const two=placeWidget(input,[sec],"b",target("a","right"));
  const three=placeWidget(two,[sec],"c",target("b","right"));
  const changed=resizeWidgetLane(three,[sec],"a",1);
  assert.deepEqual(widgetLayoutBands(changed)[0].lanes.map(l=>l.width),[5,3,4]);
  assert.deepEqual(["a","b","c"].map(id=>widgetHeightPx(changed.find(w=>w.id===id)!)),[700,230,330]);
});
