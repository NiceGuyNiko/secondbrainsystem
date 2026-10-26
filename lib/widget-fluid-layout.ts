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
  return {x:round(Math.max(0,Math.min(12-w,input.x))),y:Math.max(0,Math.round(input.y/4)*4),
    w,h:Math.max(MIN_H,Math.round(input.h/4)*4)};
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
      const nextY=Math.round((current.y+current.h+FLUID_GAP)/4)*4;
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
  change:{left?:number;right?:number;bottom?:number}):PageWidget[]{
  const selected=items.find(w=>w.id===id);
  if(!selected||widgetSizeLocked(selected))return [...items];
  const rect=initialFluidRects(items)[id];if(!rect)return [...items];
  const left=change.left??0,right=change.right??0,bottom=change.bottom??0;
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
  const next=clampFluidRect({x,y:rect.y,w:Math.max(MIN_W,Math.min(12-x,w)),h:rect.h+bottom});
  const changed=placeFluidWidget(items,id,next);
  if(changed===items||changed.every((w,i)=>w===items[i]))return [...items];
  return changed.map(w=>w.id===id?{...w,config:{...w.config,fitContent:false,
    heightPx:Math.max(160,Math.min(1200,next.h-WIDGET_EDITOR_FOOTER_PX))}}:w);
}

/** Match the pointer to a horizontal placement without forcing artificial
 * rows. The optional alignment guides snap to nearby widget boundaries. */
export function fluidPointerRect(pointer:{x:number;y:number},origin:{left:number;top:number;width:number},
  size:{w:number;h:number},anchor:{x:number;y:number}={x:16,y:16},
  existing:readonly FluidWidgetRect[]=[],snapPx=0):FluidWidgetRect{
  const unit=origin.width/12;
  let x=Math.round(((pointer.x-origin.left-anchor.x)/unit)*4)/4;
  let y=Math.max(0,Math.round((pointer.y-origin.top-anchor.y)/4)*4);
  if(snapPx>0){
    const xEdges=existing.flatMap(r=>[r.x,r.x+r.w]);
    const yEdges=existing.flatMap(r=>[r.y,r.y+r.h+FLUID_GAP]);
    const snappedX=xEdges.find(edge=>Math.abs(edge-x)*unit<=snapPx);
    const snappedY=yEdges.find(edge=>Math.abs(edge-y)<=snapPx);
    if(snappedX!==undefined)x=snappedX;
    if(snappedY!==undefined)y=snappedY;
  }
  return clampFluidRect({x,y,w:size.w,h:size.h});
}
