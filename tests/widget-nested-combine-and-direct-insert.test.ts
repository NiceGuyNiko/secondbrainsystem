import test from "node:test";
import assert from "node:assert/strict";
import {alignedWidgetColumnPairs,placeWidget,widgetLayoutBands,
  widgetVisualHierarchy,widgetVisualTracks,type WidgetDropTarget} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const sec:WidgetPageSection={id:"history",page_id:"library",title:"World History",position:0};
const widget=(id:string,position:number,heightPx=300):PageWidget=>({
  id,kind:"database",definition_id:"master-"+id,page_id:"library",title:id,
  width:12,height:2,position,config:{sectionId:sec.id,heightPx}
});
const target=(id:string,edge:"right"|"below"|"above"|"new-row-before"|"new-row"):WidgetDropTarget=>
  ({sectionId:sec.id,targetId:id,edge});
const combine=(targetId:string,start:number,count:number):WidgetDropTarget=>
  ({sectionId:sec.id,targetId,edge:"span-below",spanStartLane:start,spanLaneCount:count});
const makeFour=(additional=2)=>{
  let items=Array.from({length:4+additional},(_,index)=>widget("w"+index,index));
  for(let index=1;index<4;index++)
    items=placeWidget(items,[sec],"w"+index,target("w"+(index-1),"right"));
  assert.deepEqual(widgetLayoutBands(items)[0].lanes.map(x=>x.width),[3,3,3,3]);
  return items;
};
const band=(items:PageWidget[])=>widgetLayoutBands(items)[0];

test("multiple aligned pair options share the same y-coordinate, never stacked rows",()=>{
  const items=makeFour();
  const candidates=alignedWidgetColumnPairs(band(items),w=>w.config.heightPx as number);
  assert.deepEqual(candidates.map(p=>p.visualIndex),[0,1,2]);
  assert.deepEqual(candidates.map(p=>p.endPx),[300,300,300]);
});
test("a 2+3 merge creates three visual tracks without losing the original four lane IDs",()=>{
  const items=placeWidget(makeFour(),[sec],"w4",combine("w1",1,2));
  const group=band(items);
  assert.equal(group.lanes.length,4);
  assert.equal(group.spans?.[0].startLane,1);
  assert.equal(group.spans?.[0].laneCount,2);
  assert.deepEqual(widgetVisualHierarchy(group).map(node=>node.kind),["lane","group","lane"]);
  const tracks=widgetVisualTracks(group,w=>w.config.heightPx as number);
  assert.deepEqual(tracks.map(t=>t.laneCount),[1,2,1]);
  assert.deepEqual(tracks.map(t=>t.width),[3,6,3]);
  assert.equal(tracks[1].endPx,614);
});
test("the next visual three-column row combines left + merged middle, or merged middle + right",()=>{
  const items=placeWidget(makeFour(),[sec],"w4",combine("w1",1,2)).map(w=>
    w.id==="w0"||w.id==="w3"?{...w,config:{...w.config,heightPx:614}}:w);
  const choices=alignedWidgetColumnPairs(band(items),w=>w.config.heightPx as number);
  assert.deepEqual(choices.map(c=>({visual:c.visualIndex,start:c.startLane,count:c.laneCount})),[
    {visual:0,start:0,count:3},{visual:1,start:1,count:3}
  ]);
  assert.deepEqual(choices.map(c=>c.endPx),[614,614]);
});
test("left + combined 2+3 creates nested 1+2+3 while preserving child span",()=>{
  const starting=placeWidget(makeFour(),[sec],"w4",combine("w1",1,2));
  const result=placeWidget(starting,[sec],"w5",combine("w0",0,3));
  const spans=band(result).spans??[];
  assert.equal(widgetLayoutBands(result).length,1);
  assert.deepEqual(spans.map(s=>[s.startLane,s.laneCount]).sort((a,b)=>a[1]-b[1]),[[1,2],[0,3]]);
  const tree=widgetVisualHierarchy(band(result));
  assert.equal(tree.length,2);
  assert.equal(tree[0].kind,"group");
  if(tree[0].kind==="group"){
    assert.equal(tree[0].laneCount,3);
    assert.equal(tree[0].children[1].kind,"group");
  }
  assert.equal(result.find(w=>w.id==="w5")?.width,9);
  assert.deepEqual(result.map(w=>w.id).sort(),starting.map(w=>w.id).sort());
});
test("combined 2+3 + right creates nested 2+3+4",()=>{
  const starting=placeWidget(makeFour(),[sec],"w4",combine("w1",1,2));
  const result=placeWidget(starting,[sec],"w5",combine("w1",1,3));
  const root=widgetVisualHierarchy(band(result));
  assert.equal(root.length,2);
  assert.equal(root[1].kind,"group");
  if(root[1].kind==="group"){
    assert.equal(root[1].laneCount,3);
    assert.equal(root[1].children[0].kind,"group");
  }
  assert.equal(result.find(w=>w.id==="w5")?.width,9);
});
test("nested 1+2+3 can combine again with fourth into a full-width nested group",()=>{
  let items=makeFour(3);
  items=placeWidget(items,[sec],"w4",combine("w1",1,2));
  items=placeWidget(items,[sec],"w5",combine("w0",0,3));
  items=placeWidget(items,[sec],"w6",combine("w0",0,4));
  assert.equal(band(items).spans?.length,3);
  const root=widgetVisualHierarchy(band(items));
  assert.equal(root.length,1);
  assert.equal(root[0].laneCount,4);
  assert.equal(items.find(w=>w.id==="w6")?.width,12);
  assert.equal(new Set(items.map(w=>w.id)).size,7);
});
test("partially overlapping combinations are prevented without dropping source records",()=>{
  let items=makeFour(3);
  items=placeWidget(items,[sec],"w4",combine("w1",1,2));
  items=placeWidget(items,[sec],"w5",combine("w0",0,3));
  items=placeWidget(items,[sec],"w6",combine("w1",1,3));
  assert.equal(widgetLayoutBands(items).length,2);
  assert.equal(items.find(w=>w.id==="w6")?.width,12);
  assert.equal(items.find(w=>w.id==="w6")?.definition_id,"master-w6");
});
test("adding a new row above the first row places it before existing bands",()=>{
  const items=makeFour(1);
  const result=placeWidget(items,[sec],"w4",target("w0","new-row-before"));
  const bands=widgetLayoutBands(result);
  assert.equal(bands.length,2);
  assert.deepEqual(bands[0].lanes.flatMap(l=>l.widgets.map(w=>w.id)),["w4"]);
  assert.deepEqual(bands[1].lanes.map(l=>l.widgets[0].id),["w0","w1","w2","w3"]);
});
test("stack above a particular lane inserts without changing the other columns",()=>{
  const items=makeFour(1);
  const result=placeWidget(items,[sec],"w4",target("w2","above"));
  assert.deepEqual(band(result).lanes[2].widgets.map(w=>w.id),["w4","w2"]);
  assert.equal(band(result).lanes[0].width,3);
  assert.equal(band(result).lanes[3].width,3);
});
test("stacking into the same combined group reuses its existing span and original database sources",()=>{
  let items=makeFour(3);
  items=placeWidget(items,[sec],"w4",combine("w1",1,2));
  items=placeWidget(items,[sec],"w5",combine("w1",1,2));
  items=placeWidget(items,[sec],"w6",combine("w0",0,3));
  const result=band(items);
  assert.equal(result.spans?.length,2);
  assert.deepEqual(result.spans?.find(s=>s.startLane===1&&s.laneCount===2)?.widgets.map(w=>w.id),["w4","w5"]);
  assert.equal(items.length,7);
  assert.ok(items.every(w=>w.definition_id==="master-"+w.id));
});
