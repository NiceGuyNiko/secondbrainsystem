import {widgetHeightPx,widgetSectionId,type PageWidget} from "@/lib/widget-system";
import {widgetLayoutBands,widgetFootprintHeight,WIDGET_EDITOR_FOOTER_PX} from "@/lib/widget-layout";
import {widgetSizeLocked,widgetRowPinned} from "@/lib/widget-formation";

/** Desktop widget coordinates. Horizontal dimensions are twelfths of the
 * section's available width; vertical positions are CSS pixels. Unlike lanes,
 * these rectangles have no implicit shared width or row membership. */
export type FluidWidgetRect={x:number;y:number;w:number;h:number};
export type FluidWidgetPlacement={id:string;rect:FluidWidgetRect};
export const FLUID_GAP=14;
const MIN_W=2;
const MIN_H=194;
const round=(n:number)=>Math.round(n*1000)/1000;
const finite=(value:unknown)=>typeof value==="number"&&Number.isFinite(value);
export function fluidRectOf(widget:PageWidget):FluidWidgetRect|null{
  const data=widget.config.fluidDesktop;
  if(!data||typeof data!=="object"||Array.isArray(data))return null;
  const r=data as Record<string,unknown>;
  if(!finite(r.x)||!finite(r.y)||!finite(r.w)||!finite(r.h))return null;
  const x=Math.max(0,Math.min(12-MIN_W,r.x as number));
  return {x,y:Math.max(0,r.y as number),w:Math.max(MIN_W,Math.min(12-x,r.w as number)),
    h:Math.max(MIN_H,r.h as number)};
}
export function clampFluidRect(input:FluidWidgetRect):FluidWidgetRect{
  const w=Math.max(MIN_W,Math.min(12,round(input.w)));
  return {x:round(Math.max(0,Math.min(12-w,input.x))),y:Math.max(0,Math.round(input.y)),
    w,h:Math.max(MIN_H,Math.round(input.h))};
}
const hOf=(w:PageWidget)=>widgetFootprintHeight(w,false)??widgetHeightPx(w)+WIDGET_EDITOR_FOOTER_PX;

/** Preserve every legacy lane, stack, and span when first entering free layout.
 * No database write happens until a drag/resize is committed. */
export function initialFluidRects(items:readonly PageWidget[]):Record<string,FluidWidgetRect>{
  const result:Record<string,FluidWidgetRect>={};
  for(const sectionId of new Set(items.map(widgetSectionId))){
  let bandTop=0;
  for(const band of widgetLayoutBands(items.filter(item=>widgetSectionId(item)===sectionId))){
    let x=0;
    const xStarts:number[]=[],laneBottoms:number[]=[];
    for(const lane of band.lanes){
      xStarts.push(x);
      let top=bandTop;
      for(const widget of lane.widgets){
        const h=hOf(widget);
        result[widget.id]={x:round(x),y:top,w:round(lane.width),h};
        top+=h+FLUID_GAP;
      }
      laneBottoms.push(top-FLUID_GAP);
      x+=lane.width;
    }
    for(const span of band.spans??[]){
      const xStart=xStarts[span.startLane]??0;
      const w=band.lanes.slice(span.startLane,span.startLane+span.laneCount)
        .reduce((total,lane)=>total+lane.width,0);
      let top=Math.max(bandTop,...laneBottoms.slice(span.startLane,span.startLane+span.laneCount))+FLUID_GAP;
      for(const widget of span.widgets){
        const h=hOf(widget);
        result[widget.id]={x:round(xStart),y:top,w:round(w),h};
        top+=h+FLUID_GAP;
      }
      for(let i=span.startLane;i<span.startLane+span.laneCount;i++)
        laneBottoms[i]=Math.max(laneBottoms[i]??0,top-FLUID_GAP);
    }
    bandTop=Math.max(bandTop,...laneBottoms)+32;
  }
  }
  // Positions in the explicit fluid layout always take precedence; if a page
  // contains old and new placements, undisturbed legacy widgets stay intact.
  for(const widget of items){const saved=fluidRectOf(widget);if(saved)result[widget.id]=saved}
  return result;
}
export function fluidCanvasHeight(rects:Record<string,FluidWidgetRect>):number{
  return Math.max(50,...Object.values(rects).map(r=>r.y+r.h+FLUID_GAP));
}
export function fluidOverlaps(a:FluidWidgetRect,b:FluidWidgetRect,gap=FLUID_GAP):boolean{
  // A small breathing gap prevents borders from visually touching.
  const eps=.001;
  return a.x<b.x+b.w-eps&&a.x+a.w>b.x+eps&&
    a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
}

/** Move a single widget to precisely the requested freeform position. Other
 * widgets retain their X and size; only real collisions cascade downwards. */
export function placeFluidWidget(items:readonly PageWidget[],id:string,target:FluidWidgetRect):PageWidget[]{
  const source=items.find(w=>w.id===id);
  if(!source||widgetRowPinned(source))return [...items];
  const positions=initialFluidRects(items);
  positions[id]=clampFluidRect(target);
  const queue=[id];
  let steps=0;
  while(queue.length&&steps++<items.length*items.length+1){
    const currentId=queue.shift()!,current=positions[currentId];
    for(const other of items){
      if(other.id===currentId||other.id===id||widgetSectionId(other)!==widgetSectionId(source))continue;
      const rect=positions[other.id];
      if(!rect||!fluidOverlaps(current,rect))continue;
      if(widgetRowPinned(other))return [...items];
      const nextY=Math.ceil(current.y+current.h+FLUID_GAP);
      if(nextY>rect.y){positions[other.id]={...rect,y:nextY};queue.push(other.id)}
    }
  }
  return items.map(item=>{
    const rect=positions[item.id];if(!rect)return item;
    return {...item,config:{...item.config,fluidDesktop:rect}};
  });
}

/** Resize only the selected rectangle. The left edge moves the X origin,
 * while bottom corners change both width and height. No shared-lane resizing. */
export function resizeFluidWidget(items:readonly PageWidget[],id:string,
  change:{left?:number;right?:number;top?:number;bottom?:number}):PageWidget[]{
  const selected=items.find(w=>w.id===id);
  if(!selected||widgetSizeLocked(selected))return [...items];
  const rect=initialFluidRects(items)[id];if(!rect)return [...items];
  const left=change.left??0,right=change.right??0,top=change.top??0,bottom=change.bottom??0;
  const rightBound=rect.x+rect.w;
  let x=left?Math.max(0,Math.min(rightBound-MIN_W,rect.x+left)):rect.x;
  let w=left?rightBound-x:rect.w+right;
  // Growing a horizontal edge must not push its same-row neighbor below it.
  // Clamp at that neighbor's edge instead; moving a whole widget, or extending
  // its bottom into an occupied row, still uses the normal collision cascade.
  const peerRects=Object.entries(initialFluidRects(items))
    .filter(([peerId])=>peerId!==id)
    .map(([,peerRect])=>peerRect)
    .filter(peer=>rect.y<peer.y+peer.h&&rect.y+rect.h>peer.y);
  if(left<0){
    const leftLimit=Math.max(0,...peerRects
      .filter(peer=>peer.x+peer.w<=rect.x+.001)
      .map(peer=>peer.x+peer.w));
    x=Math.max(x,leftLimit);
    w=rightBound-x;
  }
  if(right>0){
    const rightLimit=Math.min(12,...peerRects
      .filter(peer=>peer.x>=rightBound-.001)
      .map(peer=>peer.x));
    w=Math.min(w,rightLimit-rect.x);
  }
  let nextY=rect.y,nextHeight=rect.h+bottom;
  if(top){
    const oldBottom=rect.y+rect.h;
    const minimumY=Math.max(0,...Object.entries(initialFluidRects(items))
      .filter(([peerId])=>peerId!==id).map(([,peer])=>peer)
      .filter(peer=>peer.x<rect.x+rect.w&&peer.x+peer.w>rect.x&&peer.y+peer.h<=rect.y+.001)
      .map(peer=>peer.y+peer.h+FLUID_GAP));
    nextY=Math.max(minimumY,Math.min(oldBottom-MIN_H,rect.y+top));
    nextHeight=oldBottom-nextY+bottom;
  }
  const next=clampFluidRect({x,y:nextY,w:Math.max(MIN_W,Math.min(12-x,w)),h:nextHeight});
  const changed=placeFluidWidget(items,id,next);
  if(changed===items||changed.every((w,i)=>w===items[i]))return [...items];
  return changed.map(w=>w.id===id?{...w,config:{...w.config,fitContent:false,
    heightPx:Math.max(160,Math.min(1200,next.h-WIDGET_EDITOR_FOOTER_PX))}}:w);
}

/** Insert beside a widget only when the pair can share the same horizontal
 * region. This is an intentional drop operation, never a side-resize side
 * effect. A locked target stays the exact same size. */
export function insertFluidBeside(items:readonly PageWidget[],movingId:string,
  targetId:string,side:"left"|"right"):{items:PageWidget[];placed:boolean}{
  const source=items.find(item=>item.id===movingId);
  const target=items.find(item=>item.id===targetId);
  if(!source||!target||source.id===target.id||widgetSectionId(source)!==widgetSectionId(target)||
    widgetRowPinned(source)||widgetRowPinned(target))return {items:[...items],placed:false};
  const positions=initialFluidRects(items),a=positions[movingId],b=positions[targetId];
  const otherRects=items.filter(item=>item.id!==movingId&&item.id!==targetId&&
    widgetSectionId(item)===widgetSectionId(target))
    .map(item=>positions[item.id])
    .filter(peer=>peer.y<b.y+b.h&&peer.y+peer.h>b.y);
  const leftLimit=Math.max(0,...otherRects.filter(peer=>peer.x+peer.w<=b.x+.001).map(peer=>peer.x+peer.w));
  const rightLimit=Math.min(12,...otherRects.filter(peer=>peer.x>=b.x+b.w-.001).map(peer=>peer.x));
  const available=rightLimit-leftLimit;
  let sourceW=a.w,targetW=b.w;
  if(sourceW+targetW>available+.001){
    let overflow=sourceW+targetW-available;
    if(!widgetSizeLocked(target)){
      const reduction=Math.min(overflow,targetW-MIN_W);
      targetW-=reduction;overflow-=reduction;
    }
    if(overflow>.001&&!widgetSizeLocked(source)){
      const reduction=Math.min(overflow,sourceW-MIN_W);
      sourceW-=reduction;overflow-=reduction;
    }
    if(overflow>.001)return {items:[...items],placed:false};
  }
  const pairWidth=sourceW+targetW;
  let pairX=side==="left"?Math.min(b.x,12-pairWidth):b.x;
  // If there is already enough vacant space, retain the target's X and width.
  if(side==="left"&&b.x-sourceW>=leftLimit)pairX=b.x-sourceW;
  else if(side==="right"&&b.x+pairWidth>rightLimit)pairX=rightLimit-pairWidth;
  pairX=Math.max(leftLimit,Math.min(rightLimit-pairWidth,pairX));
  const targetRect=clampFluidRect({...b,x:side==="left"?pairX+sourceW:pairX,w:targetW});
  const sourceRect=clampFluidRect({...a,x:side==="left"?pairX:pairX+targetW,y:b.y,w:sourceW});
  const prepared=items.map(item=>item.id===targetId
    ?{...item,config:{...item.config,fluidDesktop:targetRect}}
    :item.id===movingId?{...item,config:{...item.config,fluidDesktop:sourceRect}}:item);
  const resolved=placeFluidWidget(prepared,movingId,sourceRect);
  if(resolved.some(item=>item.id===movingId&&
    JSON.stringify(fluidRectOf(item))!==JSON.stringify(sourceRect)))return {items:[...items],placed:false};
  return {items:resolved,placed:true};
}

/** Explicit handle double-click: align to the closest relevant neighboring
 * boundary, while respecting occupied space and independent size locks. */
export function alignFluidWidgetEdge(items:readonly PageWidget[],id:string,
  edge:"left"|"right"|"top"|"bottom"):PageWidget[]{
  const selected=items.find(item=>item.id===id);
  if(!selected||widgetSizeLocked(selected))return [...items];
  const positions=initialFluidRects(items),r=positions[id];
  const peers=items.filter(item=>item.id!==id&&widgetSectionId(item)===widgetSectionId(selected))
    .map(item=>positions[item.id]);
  if(edge==="left"||edge==="right"){
    const peerEdges=peers.filter(p=>p.y<r.y+r.h&&p.y+p.h>r.y)
      .flatMap(p=>[p.x,p.x+p.w]);
    if(edge==="left"){
      const candidate=Math.max(0,...peerEdges.filter(x=>x<r.x-.001));
      return resizeFluidWidget(items,id,{left:candidate-r.x});
    }
    const candidate=Math.min(12,...peerEdges.filter(x=>x>r.x+r.w+.001));
    return resizeFluidWidget(items,id,{right:candidate-r.x-r.w});
  }
  const aligned=peers.filter(p=>p.x<r.x+r.w&&p.x+p.w>r.x ||
    Math.abs(p.y-r.y)<50);
  if(edge==="top"){
    const candidate=Math.max(0,...aligned.map(p=>p.y).filter(y=>y<r.y-.001));
    return resizeFluidWidget(items,id,{top:candidate-r.y});
  }
  const boundaries=aligned.map(p=>p.y+p.h).filter(y=>Math.abs(y-(r.y+r.h))>4);
  const candidate=boundaries.sort((a,b)=>Math.abs(a-(r.y+r.h))-Math.abs(b-(r.y+r.h)))[0];
  return candidate===undefined?[...items]:resizeFluidWidget(items,id,{bottom:candidate-r.y-r.h});
}

/** Match the pointer to a horizontal placement without forcing artificial
 * rows. The optional alignment guides snap to nearby widget boundaries. */
export function fluidPointerRect(pointer:{x:number;y:number},origin:{left:number;top:number;width:number},
  size:{w:number;h:number},anchor:{x:number;y:number}={x:16,y:16},
  existing:readonly FluidWidgetRect[]=[],snapPx=0):FluidWidgetRect{
  const unit=origin.width/12;
  let x=Math.round(((pointer.x-origin.left-anchor.x)/unit)*4)/4;
  let y=Math.max(0,Math.round(pointer.y-origin.top-anchor.y));
  if(snapPx>0){
    const xEdges=existing.flatMap(r=>[r.x,r.x+r.w]);
    const yEdges=existing.flatMap(r=>[r.y,r.y+r.h,r.y+r.h+FLUID_GAP]);
    const snappedX=xEdges.filter(edge=>Math.abs(edge-x)*unit<=snapPx)
      .sort((a,b)=>Math.abs(a-x)-Math.abs(b-x))[0];
    const snappedY=yEdges.filter(edge=>Math.abs(edge-y)<=snapPx)
      .sort((a,b)=>Math.abs(a-y)-Math.abs(b-y))[0];
    if(snappedX!==undefined)x=snappedX;
    if(snappedY!==undefined)y=snappedY;
  }
  return clampFluidRect({x,y,w:size.w,h:size.h});
}
