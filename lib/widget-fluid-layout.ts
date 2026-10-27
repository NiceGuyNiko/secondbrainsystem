import {widgetHeightPx,widgetSectionId,type PageWidget} from "@/lib/widget-system";
import {widgetLayoutBands,widgetFootprintHeight,WIDGET_EDITOR_FOOTER_PX} from "@/lib/widget-layout";
import {widgetSizeLocked,widgetRowPinned} from "@/lib/widget-formation";

/** Desktop widget coordinates. Horizontal dimensions are twelfths of the
 * section's available width; vertical positions are CSS pixels. Unlike lanes,
 * these rectangles have no implicit shared width or row membership. */
export type FluidWidgetRect={x:number;y:number;w:number;h:number};
export type FluidWidgetPlacement={id:string;rect:FluidWidgetRect};
export type FluidInsertionIntent="above"|"below"|"left"|"right"|"replace";
export type FluidSharedBoundary={leftId:string;rightId:string;x:number;top:number;height:number;leftIds?:string[];rightIds?:string[]};
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

/** Only exactly adjacent cards get a shared divider. Merely passing near a
 * neighboring edge never automatically links their sizes. */
export function fluidSharedBoundaries(items:readonly PageWidget[]):FluidSharedBoundary[]{
  const positions=initialFluidRects(items),edges:FluidSharedBoundary[]=[];
  for(const left of items)for(const right of items){
    if(left.id===right.id||widgetSectionId(left)!==widgetSectionId(right))continue;
    const a=positions[left.id],b=positions[right.id];
    if(Math.abs(a.x+a.w-b.x)>.002)continue;
    const top=Math.max(a.y,b.y),bottom=Math.min(a.y+a.h,b.y+b.h);
    if(bottom-top<32)continue;
    edges.push({leftId:left.id,rightId:right.id,x:b.x,top,height:bottom-top});
  }
  // Connected vertical segments act as one divider, even beside a stack.
  const groups:{x:number;top:number;bottom:number;leftIds:Set<string>;rightIds:Set<string>}[]=[];
  for(const edge of edges.sort((a,b)=>a.x-b.x||a.top-b.top)){
    const bottom=edge.top+edge.height;
    const matching=groups.filter(group=>Math.abs(group.x-edge.x)<.002&&
      edge.top<=group.bottom+FLUID_GAP+2&&bottom>=group.top-FLUID_GAP-2&&
      (group.leftIds.has(edge.leftId)||group.rightIds.has(edge.rightId)));
    if(!matching.length){
      groups.push({x:edge.x,top:edge.top,bottom,leftIds:new Set([edge.leftId]),
        rightIds:new Set([edge.rightId])});
      continue;
    }
    const primary=matching[0];
    primary.top=Math.min(primary.top,edge.top);
    primary.bottom=Math.max(primary.bottom,bottom);
    primary.leftIds.add(edge.leftId);primary.rightIds.add(edge.rightId);
    for(const other of matching.slice(1)){
      primary.top=Math.min(primary.top,other.top);primary.bottom=Math.max(primary.bottom,other.bottom);
      for(const id of other.leftIds)primary.leftIds.add(id);
      for(const id of other.rightIds)primary.rightIds.add(id);
      groups.splice(groups.indexOf(other),1);
    }
  }
  return groups.map(group=>{
    const leftIds=[...group.leftIds],rightIds=[...group.rightIds];
    return {leftId:leftIds[0],rightId:rightIds[0],x:group.x,top:group.top,
      height:group.bottom-group.top,
      ...(leftIds.length>1?{leftIds}:{}),...(rightIds.length>1?{rightIds}:{})};
  });
}

/** Resize a genuine shared boundary without changing the pair's total width.
 * The original right edge of the pair stays fixed, as do both widget heights.
 * Locks and other occupants prevent unsafe changes. */
export function resizeFluidSharedBoundary(items:readonly PageWidget[],leftId:string,rightId:string,
  requestedDelta:number):PageWidget[]{
  const boundary=fluidSharedBoundaries(items).find(edge=>
    (edge.leftIds??[edge.leftId]).includes(leftId)&&
    (edge.rightIds??[edge.rightId]).includes(rightId));
  if(!boundary)return [...items];
  const leftIds=new Set(boundary.leftIds??[boundary.leftId]);
  const rightIds=new Set(boundary.rightIds??[boundary.rightId]);
  const ids=new Set([...leftIds,...rightIds]);
  const participants=items.filter(item=>ids.has(item.id));
  if(participants.length!==ids.size||participants.some(widgetSizeLocked))return [...items];
  const positions=initialFluidRects(items);
  const minDelta=Math.max(...[...leftIds].map(id=>MIN_W-positions[id].w));
  const maxDelta=Math.min(...[...rightIds].map(id=>positions[id].w-MIN_W));
  const delta=Math.max(minDelta,Math.min(maxDelta,round(requestedDelta)));
  if(Math.abs(delta)<.001)return [...items];
  const updates=new Map<string,FluidWidgetRect>();
  for(const id of leftIds){const r=positions[id];updates.set(id,clampFluidRect({...r,w:r.w+delta}))}
  for(const id of rightIds){const r=positions[id];updates.set(id,clampFluidRect({...r,x:r.x+delta,w:r.w-delta}))}
  for(const [id,next] of updates){
    const section=widgetSectionId(items.find(item=>item.id===id)!);
    for(const other of items){
      if(ids.has(other.id)||widgetSectionId(other)!==section)continue;
      if(fluidOverlaps(next,positions[other.id]))return [...items];
    }
  }
  return items.map(item=>updates.has(item.id)?{...item,config:{...item.config,fluidDesktop:updates.get(item.id)!}}:item);
}

/** The usable insertion strips reach well into the card, rather than being
 * thin, hard-to-hit borders. Its small center remains an explicit replacement
 * target. The same classifier is used for card and 14px gutter drops. */
export function fluidInsertionIntent(bounds:{left:number;top:number;width:number;height:number},
  pointer:{x:number;y:number}):FluidInsertionIntent{
  const x=Math.max(0,Math.min(bounds.width,pointer.x-bounds.left));
  const y=Math.max(0,Math.min(bounds.height,pointer.y-bounds.top));
  const side=Math.min(110,bounds.width*.39);
  const vertical=Math.min(120,bounds.height*.30);
  const edges:[FluidInsertionIntent,number][]=[
    ["left",x/side],["right",(bounds.width-x)/side],
    ["above",y/vertical],["below",(bounds.height-y)/vertical]];
  return edges.filter(([,distance])=>distance<=1)
    .sort((a,b)=>a[1]-b[1])[0]?.[0]??"replace";
}

/** Hit-test against the saved rectangles, not the animated preview DOM. When
 * nearby cards move in a live preview, the drop target must not oscillate
 * because its actual DOM bounding box just changed under the cursor. */
export function fluidDropTargetAtPoint(positions:Record<string,FluidWidgetRect>,
  canvas:{left:number;top:number;width:number},pointer:{x:number;y:number},
  excluded:readonly string[]=[]):{id:string;intent:FluidInsertionIntent}|null{
  const blocked=new Set(excluded);
  const candidates=Object.entries(positions).filter(([id])=>!blocked.has(id))
    .map(([id,r])=>{
      const left=canvas.left+r.x/12*canvas.width+(r.x>0?7:0);
      const width=r.w/12*canvas.width-(r.x>0?7:0)-(r.x+r.w<11.999?7:0);
      const b={left,top:canvas.top+r.y,width,height:r.h};
      const dx=Math.max(0,b.left-pointer.x,pointer.x-(b.left+b.width));
      const dy=Math.max(0,b.top-pointer.y,pointer.y-(b.top+b.height));
      return {id,b,distance:Math.hypot(dx,dy)};
    })
    .sort((a,b)=>a.distance-b.distance);
  const closest=candidates.find(item=>item.distance<=22);
  return closest?{id:closest.id,intent:fluidInsertionIntent(closest.b,pointer)}:null;
}

/** A group is a persistent relationship between page widgets, never a new
 * master definition or a shared database record. */
export function fluidGroupId(widget:PageWidget):string|null{
  return typeof widget.config.fluidGroupId==="string"&&widget.config.fluidGroupId.length>0
    ?widget.config.fluidGroupId:null;
}

export function setFluidGroup(items:readonly PageWidget[],ids:readonly string[],groupId:string|null):PageWidget[]{
  const chosen=new Set(ids);
  if(groupId){
    const members=items.filter(item=>chosen.has(item.id));
    if(members.length<2||new Set(members.map(widgetSectionId)).size!==1)return [...items];
  }
  return items.map(item=>chosen.has(item.id)?{...item,config:{...item.config,
    fluidGroupId:groupId??undefined}}:item);
}

/** Move a single widget to precisely the requested freeform position. Other
 * widgets retain their X and size; only real collisions cascade downwards. */
export function placeFluidWidget(items:readonly PageWidget[],id:string,target:FluidWidgetRect):PageWidget[]{
  const source=items.find(w=>w.id===id);
  if(!source||widgetRowPinned(source))return [...items];
  const positions=initialFluidRects(items);
  const group=fluidGroupId(source);
  const moving=items.filter(item=>item.id===id||group!==null&&fluidGroupId(item)===group&&
    widgetSectionId(item)===widgetSectionId(source));
  if(moving.some(widgetRowPinned))return [...items];
  const movingIds=new Set(moving.map(item=>item.id));
  const anchor=positions[id];
  const minX=Math.min(...moving.map(item=>positions[item.id].x));
  const requested=clampFluidRect(target);
  const maxX=Math.max(...moving.map(item=>positions[item.id].x+
    (item.id===id?requested.w:positions[item.id].w)));
  const dx=Math.max(-minX,Math.min(12-maxX,requested.x-anchor.x));
  const dy=Math.max(-Math.min(...moving.map(item=>positions[item.id].y)),requested.y-anchor.y);
  for(const member of moving){
    const old=positions[member.id];
    positions[member.id]=clampFluidRect({...old,x:old.x+dx,y:old.y+dy,
      ...(member.id===id?{w:requested.w,h:requested.h}:{})});
  }
  const queue=moving.map(item=>item.id);
  let steps=0;
  while(queue.length&&steps++<items.length*items.length*4+1){
    const currentId=queue.shift()!,current=positions[currentId];
    for(const other of items){
      if(other.id===currentId||movingIds.has(other.id)||widgetSectionId(other)!==widgetSectionId(source))continue;
      const rect=positions[other.id];
      if(!rect||!fluidOverlaps(current,rect))continue;
      const linked=fluidGroupId(other);
      const displaced=items.filter(item=>item.id===other.id||linked!==null&&
        fluidGroupId(item)===linked&&widgetSectionId(item)===widgetSectionId(source));
      if(displaced.some(widgetRowPinned))return [...items];
      const shift=Math.ceil(current.y+current.h+FLUID_GAP-rect.y);
      if(shift>0)for(const member of displaced){
        positions[member.id]={...positions[member.id],y:positions[member.id].y+shift};
        if(!queue.includes(member.id))queue.push(member.id);
      }
    }
  }
  if(queue.length)return [...items];
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
  // Ordinary bottom-edge resizing stops at the next card in this column.
  // Deliberate widget relocation still uses collision displacement, but
  // simply aiming for a nearby bottom alignment must not push a row away.
  if(bottom>0){
    const bottomBound=Math.min(Infinity,...Object.entries(initialFluidRects(items))
      .filter(([peerId])=>peerId!==id).map(([,peer])=>peer)
      .filter(peer=>peer.x<rect.x+w&&peer.x+peer.w>x&&peer.y>=rect.y+rect.h-.001)
      .map(peer=>peer.y-FLUID_GAP));
    if(Number.isFinite(bottomBound))nextHeight=Math.min(nextHeight,bottomBound-nextY);
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
  if(!source||!target||source.id===target.id||
    widgetSectionId(source)!==widgetSectionId(target)||
    widgetRowPinned(source)||widgetRowPinned(target))return {items:[...items],placed:false};
  const positions=initialFluidRects(items),targetRect=positions[targetId];
  // Reordering moves the widget and its original width, not its column slot.
  const peers=items.filter(item=>item.id!==movingId&&
    widgetSectionId(item)===widgetSectionId(target)&&
    Math.abs(positions[item.id].y-targetRect.y)<=4)
    .sort((a,b)=>positions[a.id].x-positions[b.id].x);
  const order=peers.map(item=>item.id),targetIndex=order.indexOf(targetId);
  order.splice(targetIndex+(side==="right"?1:0),0,movingId);
  const total=order.reduce((sum,id)=>sum+positions[id].w,0);
  // A single unlocked full-width neighbor can give the incoming widget room
  // without moving it to a different row. Legacy multi-neighbor rows retain
  // their original no-shrink contract; opt-in preset layout handles them.
  const shrinkSingle=total>12+.001&&peers.length===1&&!widgetSizeLocked(target);
  const shrunkWidth=12-positions[movingId].w;
  if(total>12+.001&&(!shrinkSingle||shrunkWidth<MIN_W))
    return {items:[...items],placed:false};
  const adjustedTotal=shrinkSingle?12:total;
  const leftMost=Math.min(...peers.map(item=>positions[item.id].x));
  let x=Math.max(0,Math.min(leftMost,12-adjustedTotal));
  const proposed=new Map<string,FluidWidgetRect>();
  for(const id of order){
    const r=positions[id];
    const w=shrinkSingle&&id===targetId?shrunkWidth:r.w;
    proposed.set(id,clampFluidRect({...r,x,y:targetRect.y,w}));
    x+=w;
  }
  for(const [,next] of proposed){
    for(const other of items){
      if(proposed.has(other.id)||widgetSectionId(other)!==widgetSectionId(target))continue;
      if(fluidOverlaps(next,positions[other.id]))return {items:[...items],placed:false};
    }
  }
  return {placed:true,items:items.map(item=>proposed.has(item.id)
    ?{...item,config:{...item.config,fluidDesktop:proposed.get(item.id)!}}:item)};
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
    const nearest=(current:number,edges:number[])=>edges
      .filter(value=>Math.abs(value-current)>.04&&Math.abs(value-current)<=4)
      .sort((a,b)=>Math.abs(a-current)-Math.abs(b-current))[0];
    if(edge==="left"){
      const candidate=nearest(r.x,[0,...peerEdges]);
      if(candidate===undefined)return [...items];
      return resizeFluidWidget(items,id,{left:candidate-r.x});
    }
    const candidate=nearest(r.x+r.w,[...peerEdges,12]);
    if(candidate===undefined)return [...items];
    return resizeFluidWidget(items,id,{right:candidate-r.x-r.w});
  }
  const aligned=peers.filter(p=>p.x<r.x+r.w&&p.x+p.w>r.x ||
    Math.abs(p.x+p.w-r.x)<.05||Math.abs(p.x-r.x-r.w)<.05);
  if(edge==="top"){
    const candidate=[0,...aligned.map(p=>p.y),...aligned.map(p=>p.y+p.h+FLUID_GAP)]
      .filter(y=>Math.abs(y-r.y)>4&&Math.abs(y-r.y)<=Math.max(140,r.h*.65))
      .sort((a,b)=>Math.abs(a-r.y)-Math.abs(b-r.y))[0];
    if(candidate===undefined)return [...items];
    return resizeFluidWidget(items,id,{top:candidate-r.y});
  }
  const boundaries=aligned.flatMap(p=>[p.y+p.h,p.y-FLUID_GAP])
    .filter(y=>Math.abs(y-(r.y+r.h))>4&&Math.abs(y-(r.y+r.h))<=Math.max(140,r.h*.65));
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
    // Match *either* edge of the dragged rectangle to either neighboring
    // edge. Snapping only its upper-left corner misses most side-by-side fits.
    const xEdges=[0,12-size.w,...existing.flatMap(r=>
      [r.x,r.x+r.w,r.x-size.w,r.x+r.w-size.w])]
      .filter(edge=>edge>=0&&edge+size.w<=12+.001);
    const yEdges=[0,...existing.flatMap(r=>
      [r.y,r.y+r.h+FLUID_GAP,r.y-size.h-FLUID_GAP,r.y+r.h-size.h])]
      .filter(edge=>edge>=0);
    const snappedX=xEdges.filter(edge=>Math.abs(edge-x)*unit<=snapPx)
      .sort((a,b)=>Math.abs(a-x)-Math.abs(b-x))[0];
    const snappedY=yEdges.filter(edge=>Math.abs(edge-y)<=snapPx)
      .sort((a,b)=>Math.abs(a-y)-Math.abs(b-y))[0];
    if(snappedX!==undefined)x=snappedX;
    if(snappedY!==undefined)y=snappedY;
  }
  return clampFluidRect({x,y,w:size.w,h:size.h});
}

/** Do not turn an otherwise vacant drop into a collision merely because a
 * nearby edge is inside the magnetic threshold. Explicit center replacement
 * remains available independently of this free-space preference. */
export function preferVacantSnap(raw:FluidWidgetRect,snapped:FluidWidgetRect,
  neighbors:readonly FluidWidgetRect[]):FluidWidgetRect{
  const occupied=(candidate:FluidWidgetRect)=>neighbors.some(peer=>fluidOverlaps(candidate,peer));
  return occupied(snapped)&&!occupied(raw)?raw:snapped;
}

/** If a free-position drop only clips the next widget, use the nearest open
 * space directly above it instead of needlessly cascading that next widget
 * downward. Never lift farther than the user's local drag context, and leave
 * explicit insertion/replacement targets untouched. */
export function liftFluidIntoVacancy(target:FluidWidgetRect,peers:readonly FluidWidgetRect[]):FluidWidgetRect{
  const initial=clampFluidRect(target);
  let candidate=initial;
  const maxLift=Math.max(100,initial.h*.65);
  for(let pass=0;pass<=peers.length;pass++){
    const colliding=peers.filter(peer=>fluidOverlaps(candidate,peer));
    if(!colliding.length)return candidate;
    const nextY=Math.floor(Math.min(...colliding.map(peer=>peer.y-candidate.h-FLUID_GAP)));
    if(nextY<0||initial.y-nextY>maxLift)return initial;
    candidate={...candidate,y:nextY};
  }
  return initial;
}
