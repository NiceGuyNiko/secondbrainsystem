import test from "node:test";
import assert from "node:assert/strict";
import {
  alignedWidgetColumnPairs,placeWidget,widgetLayoutBands,type WidgetDropTarget
} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"library",title:"World History",position:0};
const widget=(id:string,position:number,heightPx=300):PageWidget=>({
  id,kind:"database",definition_id:"master-"+id,page_id:"library",title:id,
  width:12,height:2,position,config:{sectionId:"history",heightPx}
});
const drop=(targetId:string,edge:"left"|"right"|"below"|"new-row")=>({
  sectionId:"history",targetId,edge
});
const span=(targetId:string,startLane:number):WidgetDropTarget=>({
  sectionId:"history",targetId,edge:"span-below",spanStartLane:startLane
});
function columns(count:number,extra=1){
  const input=Array.from({length:count+extra},(_,i)=>widget("w"+i,i));
  let result=input;
  for(let i=1;i<count;i++){
    result=placeWidget(result,[section],"w"+i,drop("w"+(i-1),"right"));
  }
  assert.equal(widgetLayoutBands(result)[0].lanes.length,count);
  return result;
}
const primary=(items:readonly PageWidget[])=>widgetLayoutBands(items)[0];

test("a shared Stack guide appears for BOTH columns when their actual bottoms align",()=>{
  const current=columns(2);
  const matches=alignedWidgetColumnPairs(primary(current),w=>w.config.heightPx as number+34);
  assert.deepEqual(matches.map(x=>x.startLane),[0]);
  assert.equal(matches[0].width,12);
});
test("aligned columns 1+2 and 2+3 each receive their own line",()=>{
  const current=columns(3);
  assert.deepEqual(alignedWidgetColumnPairs(primary(current),w=>(w.config.heightPx as number)+34)
    .map(x=>x.startLane),[0,1]);
});
test("all three 4-column pairs (1+2, 2+3, 3+4) are eligible when aligned",()=>{
  const current=columns(4);
  assert.deepEqual(alignedWidgetColumnPairs(primary(current),w=>(w.config.heightPx as number)+34)
    .map(x=>x.startLane),[0,1,2]);
});
test("unaligned ends do not suggest a shared line, but a single-lane Stack is unaffected",()=>{
  const current=columns(3);
  const changed=current.map(w=>w.id==="w1"?{...w,config:{...w.config,heightPx:430}}:w);
  assert.deepEqual(alignedWidgetColumnPairs(primary(changed),w=>(w.config.heightPx as number)+34),[]);
  const stacked=placeWidget(changed,[section],"w3",drop("w1","below"));
  assert.deepEqual(primary(stacked).lanes[1].widgets.map(w=>w.id),["w1","w3"]);
});
for(const count of [2,3,4] as const){
  for(let start=0;start<count-1;start++){
    test(`drop on shared line ${start+1}+${start+2} of ${count} columns preserves the row and spans exactly that pair`,()=>{
      const current=columns(count);
      const mover="w"+count;
      const after=placeWidget(current,[section],mover,span("w"+start,start));
      const band=primary(after);
      assert.equal(widgetLayoutBands(after).length,1);
      assert.equal(band.lanes.length,count);
      assert.equal(band.spans?.length,1);
      assert.equal(band.spans?.[0].startLane,start);
      assert.equal(band.spans?.[0].laneCount,2);
      assert.deepEqual(band.spans?.[0].widgets.map(w=>w.id),[mover]);
      assert.equal(after.find(w=>w.id===mover)?.width,band.lanes[start].width+band.lanes[start+1].width);
      assert.equal(after.find(w=>w.id===mover)?.definition_id,"master-"+mover);
    });
  }
}
test("inserting a column before a shared pair rebases its span instead of shifting it to the wrong neighbors",()=>{
  const current=columns(3,2);
  const withSpan=placeWidget(current,[section],"w3",span("w1",1));
  const inserted=placeWidget(withSpan,[section],"w4",drop("w0","left"));
  const band=primary(inserted);
  assert.deepEqual(band.lanes.map(l=>l.widgets[0].id),["w4","w0","w1","w2"]);
  assert.equal(band.spans?.[0].startLane,2);
  assert.equal(band.spans?.[0].widgets[0].id,"w3");
  assert.equal(inserted.find(w=>w.id==="w3")?.width,6);
});
test("moving an unrelated left column out retains the original two right-side span anchors",()=>{
  const current=columns(3);
  const withSpan=placeWidget(current,[section],"w3",span("w1",1));
  const moved=placeWidget(withSpan,[section],"w0",drop("w1","new-row"));
  const band=primary(moved);
  assert.equal(band.lanes.length,2);
  assert.equal(band.spans?.[0].startLane,0);
  assert.equal(band.spans?.[0].widgets[0].id,"w3");
  assert.deepEqual(moved.map(w=>w.id).sort(),["w0","w1","w2","w3"]);
});
test("a conflicting overlapping span is placed safely in a new band without erasing its source",()=>{
  const current=columns(3,2);
  const first=placeWidget(current,[section],"w3",span("w0",0));
  const second=placeWidget(first,[section],"w4",span("w1",1));
  const bands=widgetLayoutBands(second);
  assert.equal(bands.length,2);
  assert.equal(bands[0].spans?.[0].startLane,0);
  assert.equal(bands[1].lanes[0].widgets[0].id,"w4");
  assert.deepEqual(second.map(w=>w.id).sort(),["w0","w1","w2","w3","w4"]);
});
test("widget heights, database sources, and one-widget-per-record identities survive shared stacking",()=>{
  const current=columns(4);
  const after=placeWidget(current,[section],"w4",span("w2",2));
  assert.equal(new Set(after.map(w=>w.id)).size,5);
  for(const w of after){
    assert.equal(w.config.heightPx,300);
    assert.equal(w.definition_id,"master-"+w.id);
  }
});
