import test from "node:test";
import assert from "node:assert/strict";
import {closestPreset,insertPresetWidget,movePresetWidget,presetSizingOf,presetToUnits,
  presetUpdatePreferred,resizePresetDivider,PRESET_WIDTHS} from "../lib/widget-preset-layout";
import {fluidOverlaps,initialFluidRects,fluidSharedBoundaries} from "../lib/widget-fluid-layout";
import type {PageWidget} from "../lib/widget-system";

const widget=(id:string,x:number,y:number,percent:number,extra:Record<string,unknown>={}):PageWidget=>({
  id,page_id:"page",definition_id:"definition-"+id,kind:"database",title:id,
  width:12,height:2,position:0,config:{sectionId:"section",heightPx:280,
    fluidDesktop:{x:presetToUnits(x),y,w:presetToUnits(percent),h:314},...extra}
});
const width=(list:readonly PageWidget[],id:string)=>
  Math.round(initialFluidRects(list)[id].w/12*100);
const noCollision=(list:readonly PageWidget[])=>{
  const positions=initialFluidRects(list);
  for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)
    assert.equal(fluidOverlaps(positions[list[i].id],positions[list[j].id]),false,
      list[i].id+" must not overlap "+list[j].id);
};

test("all eleven requested width presets stay available",()=>{
  assert.deepEqual(PRESET_WIDTHS,[20,25,30,33,40,50,60,67,75,80,100]);
  assert.equal(closestPreset(78),80);
  assert.equal(closestPreset(32.8),33);
});
test("full width table plus 20% rollup projects and saves 80/20",()=>{
  const old=widget("table",0,0,100),incoming=widget("rollup",0,450,20,
    {presetPreferredWidth:20,presetMinWidth:20,presetAllowShrink:false});
  const result=insertPresetWidget([old,incoming],"rollup","table","right");
  assert.equal(result.placed,true);assert.equal(result.newRow,false);
  assert.equal(width(result.items,"table"),80);
  assert.equal(width(result.items,"rollup"),20);
  assert.equal(initialFluidRects(result.items).rollup.x,presetToUnits(80));
  noCollision(result.items);
  assert.equal(result.items[0].definition_id,old.definition_id);
});
test("two 50% widgets compress to 40/40/20",()=>{
  const list=[widget("a",0,0,50),widget("b",50,0,50),
    widget("c",0,420,20,{presetPreferredWidth:20,presetMinWidth:20})];
  const result=insertPresetWidget(list,"c","b","right");
  assert.deepEqual(["a","b","c"].map(id=>width(result.items,id)),[40,40,20]);
  noCollision(result.items);
});
test("a size-locked full page never shrinks; visitor goes below",()=>{
  const original=widget("calendar",0,0,100,{sizeLocked:true});
  const other=widget("chart",0,450,20,{presetPreferredWidth:20});
  const result=insertPresetWidget([original,other],"chart","calendar","right");
  assert.equal(result.newRow,true);
  assert.equal(width(result.items,"calendar"),100);
  assert.equal(initialFluidRects(result.items).chart.y,314+14);
  noCollision(result.items);
});
test("configured refusal to shrink inserts a new row",()=>{
  const list=[widget("full",0,0,100,{presetAllowShrink:false}),
    widget("small",0,420,20,{presetPreferredWidth:20})];
  const result=insertPresetWidget(list,"small","full","left");
  assert.equal(result.newRow,true);assert.equal(width(result.items,"full"),100);
  noCollision(result.items);
});
test("the minimum width is a real capacity constraint",()=>{
  const list=[widget("left",0,0,50,{presetMinWidth:50}),
    widget("right",50,0,50,{presetMinWidth:50}),
    widget("new",0,450,20,{presetPreferredWidth:20})];
  const result=insertPresetWidget(list,"new","right","right");
  assert.equal(result.newRow,true);
  assert.equal(width(result.items,"left"),50);assert.equal(width(result.items,"right"),50);
  noCollision(result.items);
});
test("reorder from right to left preserves linked record IDs",()=>{
  const list=[widget("a",0,0,80,{presetPreferredWidth:80}),
    widget("b",80,0,20,{presetPreferredWidth:20})];
  const result=insertPresetWidget(list,"b","a","left");
  assert.equal(result.newRow,false);
  assert.equal(initialFluidRects(result.items).b.x,0);
  assert.equal(initialFluidRects(result.items).a.x,presetToUnits(20));
  assert.equal(result.items.find(w=>w.id==="a")?.definition_id,"definition-a");
  noCollision(result.items);
});
test("insert beside a neighbor pushes a trailing row below without overlap",()=>{
  const list=[widget("full",0,0,100,{sizeLocked:true}),
    widget("later",0,328,100,{sizeLocked:false}),
    widget("new",0,800,20,{presetPreferredWidth:20})];
  const result=insertPresetWidget(list,"new","full","right");
  assert.equal(result.newRow,true);
  assert.ok(initialFluidRects(result.items).later.y>=328+314+14);
  noCollision(result.items);
});
test("pin on the dragged widget blocks relocation",()=>{
  const pinned=widget("p",0,400,20,{rowPinned:true});
  const list=[widget("full",0,0,100),pinned];
  assert.equal(insertPresetWidget(list,"p","full","right").placed,false);
  assert.deepEqual(movePresetWidget(list,"p",{x:5,y:0,w:4,h:314}),list);
});
test("free move retains configured width, snaps X and source link",()=>{
  const list=[widget("a",0,0,80),widget("b",80,0,20,{presetPreferredWidth:20})];
  const changed=movePresetWidget(list,"b",{x:3.13,y:420,w:9,h:314});
  assert.equal(width(changed,"b"),20);
  assert.equal(initialFluidRects(changed).b.x,3);
  assert.equal(changed[1].definition_id,list[1].definition_id);
  noCollision(changed);
});
test("shared divider snaps 80/20 to 75/25 and 67/33",()=>{
  const list=[widget("a",0,0,80,{presetMinWidth:20}),
    widget("b",80,0,20,{presetMinWidth:20})];
  assert.equal(fluidSharedBoundaries(list).length,1);
  const first=resizePresetDivider(list,"a","b",presetToUnits(-5));
  assert.deepEqual(["a","b"].map(id=>width(first,id)),[75,25]);
  const second=resizePresetDivider(list,"a","b",presetToUnits(-13));
  assert.deepEqual(["a","b"].map(id=>width(second,id)),[67,33]);
  noCollision(second);
});
test("divider cannot resize a locked partner",()=>{
  const list=[widget("a",0,0,80),widget("b",80,0,20,{sizeLocked:true})];
  assert.deepEqual(resizePresetDivider(list,"a","b",presetToUnits(-5)),list);
});
test("connected tall/stacked divider moves all three aligned edges",()=>{
  const tall=widget("tall",0,0,40);
  tall.config.fluidDesktop={x:0,y:0,w:presetToUnits(40),h:642};
  const top=widget("top",40,0,60);
  const bottom=widget("bottom",40,328,60);
  const list=[tall,top,bottom];
  const result=resizePresetDivider(list,"tall","top",presetToUnits(10));
  assert.deepEqual(["tall","top","bottom"].map(id=>width(result,id)),[50,50,50]);
  assert.equal(initialFluidRects(result).bottom.x,presetToUnits(50));
  noCollision(result);
});
test("preferred width and minimum preferences survive in placement config",()=>{
  const original=widget("a",0,0,50,{presetPreferredWidth:50,presetMinWidth:25,presetAllowShrink:false});
  assert.deepEqual(presetSizingOf(original),{preferred:50,minimum:25,allowShrink:false});
  const next=presetUpdatePreferred([original],"a",75)[0];
  assert.equal(next.config.presetPreferredWidth,75);
  assert.equal(width([next],"a"),75);
});
