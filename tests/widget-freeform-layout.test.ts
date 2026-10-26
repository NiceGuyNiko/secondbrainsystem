import test from "node:test";
import assert from "node:assert/strict";
import {initialFluidRects,fluidCanvasHeight,fluidOverlaps,placeFluidWidget,
  resizeFluidWidget,fluidPointerRect,insertFluidBeside,alignFluidWidgetEdge,
  fluidInsertionIntent,fluidDropTargetAtPoint,liftFluidIntoVacancy,preferVacantSnap,fluidGroupId,setFluidGroup,
  fluidSharedBoundaries,resizeFluidSharedBoundary} from "../lib/widget-fluid-layout";
import {placeWidget} from "../lib/widget-layout";
import type {PageWidget,WidgetPageSection} from "../lib/widget-system";

const section:WidgetPageSection={id:"history",page_id:"library",title:"World History",position:0};
const w=(id:string,position:number):PageWidget=>({id,page_id:"library",definition_id:"source-"+id,
  kind:"database",title:id,width:12,height:2,position,config:{sectionId:"history",heightPx:280}});
const pair=()=>placeWidget([w("eras",0),w("moments",1)],[section],"moments",
  {sectionId:"history",targetId:"eras",edge:"right"});
const rect=(items:PageWidget[],id:string)=>initialFluidRects(items)[id];

test("legacy side-by-side widgets migrate to independent, non-overlapping rectangles",()=>{
  const positioned=initialFluidRects(pair());
  assert.equal(positioned.eras.x,0);
  assert.equal(positioned.moments.x,6);
  assert.equal(positioned.eras.w,6);
  assert.equal(positioned.moments.w,6);
  assert.equal(positioned.eras.y,positioned.moments.y);
  assert.equal(fluidOverlaps(positioned.eras,positioned.moments),false);
});
test("stacked widgets can resize independently, including their left and bottom corners",()=>{
  const original=placeWidget([...pair(),w("events",2)],[section],"events",
    {sectionId:"history",targetId:"eras",edge:"below"});
  const eras=rect(original,"eras"),events=rect(original,"events");
  const changed=resizeFluidWidget(original,"events",{right:2,bottom:80});
  assert.deepEqual(rect(changed,"eras"),eras);
  assert.equal(rect(changed,"events").w,events.w+2);
  assert.equal(rect(changed,"events").h,events.h+80);
  const left=resizeFluidWidget(changed,"events",{left:-1,bottom:-40});
  assert.equal(rect(left,"events").x,Math.max(0,events.x-1));
  assert.equal(rect(left,"events").h,events.h+40);
  assert.equal(left.find(item=>item.id==="events")?.definition_id,"source-events");
});
test("moving a widget into empty right-hand space keeps its width and does not stack on the left",()=>{
  const original=pair();
  const moved=placeFluidWidget(original,"moments",{x:8,y:340,w:4,h:314});
  assert.deepEqual(rect(moved,"moments"),{x:8,y:340,w:4,h:314});
  assert.deepEqual(rect(moved,"eras"),rect(original,"eras"));
  assert.equal(fluidOverlaps(rect(moved,"eras"),rect(moved,"moments")),false);
});
test("side resizing stops at an occupied same-row edge instead of dropping the neighbor",()=>{
  const original=pair();
  const neighborBefore=rect(original,"moments");
  const bigger=resizeFluidWidget(original,"eras",{right:5});
  assert.deepEqual(rect(bigger,"moments"),neighborBefore);
  assert.equal(rect(bigger,"eras").w,6);
  const smaller=resizeFluidWidget(original,"eras",{right:-2});
  assert.equal(rect(smaller,"eras").w,4);
  assert.deepEqual(rect(smaller,"moments"),neighborBefore);
});
test("only physically obstructed widgets move downward, keeping their own X and width",()=>{
  const original=pair();
  const first=rect(original,"eras"),other=rect(original,"moments");
  const moved=placeFluidWidget(original,"eras",{x:5,y:0,w:7,h:first.h});
  assert.equal(rect(moved,"eras").w,7);
  assert.equal(rect(moved,"moments").x,other.x);
  assert.equal(rect(moved,"moments").w,other.w);
  assert.ok(rect(moved,"moments").y>=first.h+14);
  assert.equal(fluidOverlaps(rect(moved,"eras"),rect(moved,"moments")),false);
});
test("size locking prevents resizing and row pinning prevents displacement",()=>{
  const original=pair();
  const frozen=original.map(item=>item.id==="eras"?{...item,config:{...item.config,sizeLocked:true}}:item);
  assert.deepEqual(resizeFluidWidget(frozen,"eras",{right:3}),frozen);
  const pinned=original.map(item=>item.id==="moments"?{...item,config:{...item.config,rowPinned:true}}:item);
  const blocked=placeFluidWidget(pinned,"eras",{x:5,y:0,w:7,h:314});
  assert.deepEqual(blocked,pinned);
});
test("pointer targeting supports free space, optional magnetic guides, and a stable canvas height",()=>{
  const size={w:3,h:314},viewport={left:100,top:200,width:1200};
  const point=fluidPointerRect({x:970,y:520},viewport,size,{x:0,y:0});
  assert.equal(point.x,8.75);
  assert.equal(point.y,320);
  const magnetic=fluidPointerRect({x:699,y:520},viewport,size,{x:0,y:0},[{x:6,y:320,w:3,h:314}],14);
  assert.equal(magnetic.x,6);
  assert.ok(fluidCanvasHeight({a:point})>600);
});
test("top-edge resizing preserves the bottom edge and respects the widget immediately above",()=>{
  const lower={...w("lower",1),config:{sectionId:"history",heightPx:280,
    fluidDesktop:{x:0,y:340,w:6,h:316}}};
  const upper={...w("upper",0),config:{sectionId:"history",heightPx:280,
    fluidDesktop:{x:0,y:0,w:6,h:312}}};
  const before=rect([upper,lower],"lower");
  const shrunk=resizeFluidWidget([upper,lower],"lower",{top:48});
  assert.equal(rect(shrunk,"lower").y,before.y+48);
  assert.equal(rect(shrunk,"lower").y+rect(shrunk,"lower").h,before.y+before.h);
  const grown=resizeFluidWidget([upper,lower],"lower",{top:-100});
  assert.equal(rect(grown,"lower").y,326);
  assert.deepEqual(rect(grown,"upper"),rect([upper,lower],"upper"));
});
test("intentional side insertion fits an unlocked pair without displacing it vertically",()=>{
  const large={...w("eras",0),config:{sectionId:"history",heightPx:280,
    fluidDesktop:{x:0,y:0,w:12,h:314}}};
  const visitor={...w("events",1),config:{sectionId:"history",heightPx:280,
    fluidDesktop:{x:0,y:400,w:6,h:314}}};
  const result=insertFluidBeside([large,visitor],"events","eras","right");
  assert.equal(result.placed,true);
  assert.deepEqual(rect(result.items,"eras"),{x:0,y:0,w:6,h:314});
  assert.deepEqual(rect(result.items,"events"),{x:6,y:0,w:6,h:314});
  assert.equal(fluidOverlaps(rect(result.items,"eras"),rect(result.items,"events")),false);
  assert.equal(result.items.find(item=>item.id==="eras")?.definition_id,"source-eras");
});
test("size locks block side fitting when the available row is full",()=>{
  const locked={...w("eras",0),config:{sectionId:"history",sizeLocked:true,
    fluidDesktop:{x:0,y:0,w:12,h:314}}};
  const incoming={...w("events",1),config:{sectionId:"history",
    fluidDesktop:{x:0,y:400,w:6,h:314}}};
  const result=insertFluidBeside([locked,incoming],"events","eras","right");
  assert.equal(result.placed,false);
  assert.deepEqual(result.items,[locked,incoming]);
});
test("double-click alignment matches the adjacent widget's bottom edge",()=>{
  const short={...w("short",0),config:{sectionId:"history",
    fluidDesktop:{x:0,y:0,w:6,h:250}}};
  const tall={...w("tall",1),config:{sectionId:"history",
    fluidDesktop:{x:6,y:0,w:6,h:402}}};
  const next=alignFluidWidgetEdge([short,tall],"short","bottom");
  assert.equal(rect(next,"short").h,402);
  assert.deepEqual(rect(next,"tall"),rect([short,tall],"tall"));
});
test("magnetic dragging can align its trailing right and bottom edges, not only its origin",()=>{
  const peer={x:6,y:350,w:3,h:250};
  const aligned=fluidPointerRect({x:403,y:400},{left:100,top:100,width:1200},
    {w:3,h:236},{x:0,y:0},[peer],16);
  assert.equal(aligned.x,3,"the dragged widget's right edge should meet the neighbor's left");
  const bottom=fluidPointerRect({x:201,y:458},{left:100,top:100,width:1200},
    {w:3,h:236},{x:0,y:0},[peer],16);
  assert.equal(bottom.y,364,"bottom-to-bottom alignment should be available");
});
test("gutter and broad side drop zones are reachable without replacing a widget",()=>{
  const b={left:100,top:100,width:240,height:300};
  assert.equal(fluidInsertionIntent(b,{x:113,y:245}),"left");
  assert.equal(fluidInsertionIntent(b,{x:180,y:245}),"left");
  assert.equal(fluidInsertionIntent(b,{x:310,y:245}),"right");
  assert.equal(fluidInsertionIntent(b,{x:220,y:110}),"above");
  assert.equal(fluidInsertionIntent(b,{x:220,y:386}),"below");
  assert.equal(fluidInsertionIntent(b,{x:220,y:245}),"replace");
});
test("a nearly occupied gap pulls the incoming widget up without pushing the next card down",()=>{
  const next={x:0,y:600,w:6,h:320};
  const near={x:0,y:320,w:6,h:300};
  const lifted=liftFluidIntoVacancy(near,[next]);
  assert.deepEqual(lifted,{...near,y:286});
  assert.equal(fluidOverlaps(lifted,next),false);
  assert.deepEqual(liftFluidIntoVacancy({x:8,y:320,w:4,h:300},[next]),
    {x:8,y:320,w:4,h:300},"free adjacent space should not rise");
  assert.deepEqual(liftFluidIntoVacancy({x:0,y:850,w:6,h:300},[next]),
    {x:0,y:850,w:6,h:300},"distant requested drops should not jump to the top");
});
test("dragging a group maintains each member's independent size and relative alignment",()=>{
  const a={...w("a",0),config:{sectionId:"history",fluidDesktop:{x:0,y:0,w:3,h:260}}};
  const b={...w("b",1),config:{sectionId:"history",fluidDesktop:{x:3,y:0,w:5,h:410}}};
  const c={...w("c",2),config:{sectionId:"history",fluidDesktop:{x:8,y:0,w:4,h:310}}};
  const grouped=setFluidGroup([a,b,c],["a","b","c"],"grp-1");
  assert.equal(grouped.every(item=>fluidGroupId(item)==="grp-1"),true);
  const moved=placeFluidWidget(grouped,"b",{x:3,y:520,w:5,h:410});
  assert.deepEqual(["a","b","c"].map(id=>rect(moved,id).y),[520,520,520]);
  assert.deepEqual(["a","b","c"].map(id=>rect(moved,id).w),[3,5,4]);
  assert.deepEqual(["a","b","c"].map(id=>rect(moved,id).h),[260,410,310]);
  assert.equal(moved.every(item=>fluidGroupId(item)==="grp-1"),true);
  assert.equal(setFluidGroup(moved,["a","b","c"],null).every(item=>!fluidGroupId(item)),true);
});
test("inserting above one group member displaces its entire row, never only that column",()=>{
  const group=[
    {...w("a",0),config:{sectionId:"history",fluidDesktop:{x:0,y:0,w:4,h:300}}},
    {...w("b",1),config:{sectionId:"history",fluidDesktop:{x:4,y:0,w:4,h:300}}},
    {...w("c",2),config:{sectionId:"history",fluidDesktop:{x:8,y:0,w:4,h:300}}}
  ];
  const incoming={...w("top",3),config:{sectionId:"history",fluidDesktop:{x:0,y:420,w:3,h:200}}};
  const grouped=setFluidGroup([...group,incoming],["a","b","c"],"linked-row");
  const inserted=placeFluidWidget(grouped,"top",{x:0,y:0,w:3,h:200});
  assert.equal(rect(inserted,"top").y,0);
  assert.deepEqual(["a","b","c"].map(id=>rect(inserted,id).y),[214,214,214]);
  assert.equal(inserted.find(item=>item.id==="b")?.definition_id,"source-b");
  assert.ok(["a","b","c"].every(id=>!fluidOverlaps(rect(inserted,"top"),rect(inserted,id))));
});
test("a pinned member blocks moving its whole group without disturbing the layout",()=>{
  const items=setFluidGroup([
    {...w("a",0),config:{sectionId:"history",fluidDesktop:{x:0,y:0,w:6,h:250}}},
    {...w("b",1),config:{sectionId:"history",rowPinned:true,
      fluidDesktop:{x:6,y:0,w:6,h:250}}}
  ],["a","b"],"pinned-group");
  assert.deepEqual(placeFluidWidget(items,"a",{x:0,y:350,w:6,h:250}),items);
});
test("a shared purple divider is generated only for physically adjacent widgets",()=>{
  const left={...w("left",0),config:{sectionId:"history",
    fluidDesktop:{x:0,y:0,w:4,h:320}}};
  const right={...w("right",1),config:{sectionId:"history",
    fluidDesktop:{x:4,y:0,w:8,h:420}}};
  const pair=[left,right];
  assert.deepEqual(fluidSharedBoundaries(pair),[
    {leftId:"left",rightId:"right",x:4,top:0,height:320}]);
  const detached={...right,config:{...right.config,fluidDesktop:{x:4.25,y:0,w:7.75,h:420}}};
  assert.deepEqual(fluidSharedBoundaries([left,detached]),[],
    "proximity alone must not silently synchronize column widths");
});
test("dragging a shared divider resizes both neighbors while preserving their total width",()=>{
  const left={...w("left",0),config:{sectionId:"history",
    fluidDesktop:{x:0,y:0,w:4,h:320}}};
  const right={...w("right",1),config:{sectionId:"history",
    fluidDesktop:{x:4,y:0,w:8,h:420}}};
  const grown=resizeFluidSharedBoundary([left,right],"left","right",1.5);
  assert.deepEqual(rect(grown,"left"),{x:0,y:0,w:5.5,h:320});
  assert.deepEqual(rect(grown,"right"),{x:5.5,y:0,w:6.5,h:420});
  const shrunk=resizeFluidSharedBoundary([left,right],"left","right",-8);
  assert.equal(rect(shrunk,"left").w,2);
  assert.equal(rect(shrunk,"right").w,10);
  assert.deepEqual(resizeFluidSharedBoundary([left,{...right,config:{...right.config,sizeLocked:true}}],
    "left","right",1),[left,{...right,config:{...right.config,sizeLocked:true}}]);
});
test("target hit-testing remains stable when neighboring cards are visually projected elsewhere",()=>{
  const saved={eras:{x:0,y:0,w:6,h:320},events:{x:6,y:0,w:6,h:320}};
  const canvas={left:100,top:100,width:1200};
  const hit=fluidDropTargetAtPoint(saved,canvas,{x:727,y:250});
  assert.deepEqual(hit,{id:"events",intent:"left"});
  assert.deepEqual(fluidDropTargetAtPoint(saved,canvas,{x:115,y:250},["eras"]),null);
  // During an animation the events DOM card could move to x=9; the original
  // hit map still returns the same insertion target at the same pointer.
  assert.deepEqual(fluidDropTargetAtPoint(saved,canvas,{x:727,y:250}),hit);
});
test("replacement moves the displaced widget in the projected arrangement",()=>{
  const pair=[
    {...w("eras",0),config:{sectionId:"history",fluidDesktop:{x:0,y:0,w:6,h:314}}},
    {...w("events",1),config:{sectionId:"history",fluidDesktop:{x:6,y:0,w:6,h:314}}},
    {...w("perspectives",2),config:{sectionId:"history",fluidDesktop:{x:0,y:450,w:6,h:314}}}
  ];
  const projected=placeFluidWidget(pair,"perspectives",{x:6,y:0,w:6,h:314});
  assert.deepEqual(rect(projected,"perspectives"),{x:6,y:0,w:6,h:314});
  assert.deepEqual(rect(projected,"events"),{x:6,y:328,w:6,h:314});
  assert.deepEqual(rect(projected,"eras"),rect(pair,"eras"));
});
test("bottom resizing stops at the next widget instead of cascading it downward",()=>{
  const top={...w("top",0),config:{sectionId:"history",
    fluidDesktop:{x:0,y:0,w:6,h:300}}};
  const below={...w("below",1),config:{sectionId:"history",
    fluidDesktop:{x:0,y:350,w:6,h:300}}};
  const sized=resizeFluidWidget([top,below],"top",{bottom:120});
  assert.equal(rect(sized,"top").h,336);
  assert.deepEqual(rect(sized,"below"),rect([top,below],"below"));
});
test("double-click chooses a nearby alignment instead of jumping to a distant widget",()=>{
  const a={...w("a",0),config:{sectionId:"history",
    fluidDesktop:{x:0,y:0,w:4,h:270}}};
  const b={...w("b",1),config:{sectionId:"history",
    fluidDesktop:{x:4,y:0,w:4,h:360}}};
  const distant={...w("c",2),config:{sectionId:"history",
    fluidDesktop:{x:8,y:700,w:4,h:400}}};
  assert.equal(rect(alignFluidWidgetEdge([a,b,distant],"a","bottom"),"a").h,360);
  const alreadyAligned={...a,config:{...a.config,fluidDesktop:{x:0,y:0,w:4,h:360}}};
  assert.equal(rect(alignFluidWidgetEdge([alreadyAligned,b,distant],"a","bottom"),"a").h,360,
    "a second click must not jump to a far-away card");
});
test("magnetic alignment never creates a collision when the unsnapped gap was free",()=>{
  const neighbor={x:5,y:0,w:4,h:314};
  const raw={x:1,y:0,w:3.8,h:314};
  const snapped={x:1.3,y:0,w:3.8,h:314};
  assert.deepEqual(preferVacantSnap(raw,snapped,[neighbor]),raw);
  const safe={x:1,y:330,w:4,h:314};
  assert.deepEqual(preferVacantSnap(raw,safe,[neighbor]),safe);
});

test("reordering 25% and 75% cards keeps their widths and data links",()=>{
  const a={...w("moments",0),config:{sectionId:"history",fluidDesktop:{x:0,y:0,w:3,h:314}}};
  const b={...w("eras",1),config:{sectionId:"history",fluidDesktop:{x:3,y:0,w:9,h:314}}};
  const result=insertFluidBeside([a,b],"eras","moments","left");
  assert.equal(result.placed,true);
  assert.deepEqual(rect(result.items,"eras"),{x:0,y:0,w:9,h:314});
  assert.deepEqual(rect(result.items,"moments"),{x:9,y:0,w:3,h:314});
  assert.equal(result.items.find(item=>item.id==="eras")?.definition_id,"source-eras");
});
test("side insertion cannot squeeze three widgets into a full row",()=>{
  const a={...w("a",0),config:{sectionId:"history",fluidDesktop:{x:0,y:0,w:9,h:314}}};
  const b={...w("b",1),config:{sectionId:"history",fluidDesktop:{x:9,y:0,w:3,h:314}}};
  const c={...w("c",2),config:{sectionId:"history",fluidDesktop:{x:0,y:400,w:4,h:314}}};
  const original=[a,b,c],result=insertFluidBeside(original,"c","b","right");
  assert.equal(result.placed,false);assert.deepEqual(result.items,original);
});
test("a continuous divider resizes a tall widget against two stacked neighbors",()=>{
  const left={...w("left",0),config:{sectionId:"history",fluidDesktop:{x:0,y:0,w:4,h:650}}};
  const upper={...w("upper",1),config:{sectionId:"history",fluidDesktop:{x:4,y:0,w:8,h:310}}};
  const lower={...w("lower",2),config:{sectionId:"history",fluidDesktop:{x:4,y:324,w:8,h:326}}};
  const items=[left,upper,lower];
  assert.deepEqual(fluidSharedBoundaries(items),[{
    leftId:"left",rightId:"upper",rightIds:["upper","lower"],x:4,top:0,height:650
  }]);
  const resized=resizeFluidSharedBoundary(items,"left","upper",1);
  assert.deepEqual(rect(resized,"left"),{x:0,y:0,w:5,h:650});
  assert.deepEqual(rect(resized,"upper"),{x:5,y:0,w:7,h:310});
  assert.deepEqual(rect(resized,"lower"),{x:5,y:324,w:7,h:326});
});
