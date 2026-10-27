import {fluidCanvasHeight,fluidOverlaps,fluidSharedBoundaries,fluidDropTargetAtPoint,initialFluidRects,placeFluidWidget,resizeFluidSharedBoundary,FLUID_GAP,type FluidWidgetRect} from "./widget-fluid-layout";
import {widgetRowPinned,widgetSizeLocked} from "./widget-formation";
import {widgetSectionId,type PageWidget} from "./widget-system";

/** Snap points deliberately match the Widget Studio's discrete design sizes. */
export const PRESET_WIDTHS=[20,25,30,33,40,50,60,67,75,80,100] as const;
export type PresetWidth=typeof PRESET_WIDTHS[number];
const EPS=.055;
const round=(n:number)=>Math.round(n*1000)/1000;
export const presetToUnits=(width:number)=>round(width*12/100);
const toPercent=(rect:FluidWidgetRect)=>rect.w/12*100;
export function closestPreset(value:number):PresetWidth {
  return PRESET_WIDTHS.reduce((best,current)=>
    Math.abs(current-value)<Math.abs(best-value)?current:best,PRESET_WIDTHS[0]);
}
export type PresetSizing={preferred:number;minimum:number;allowShrink:boolean};
export function presetSizingOf(widget:PageWidget,rect?:FluidWidgetRect):PresetSizing {
  const current=closestPreset(rect?toPercent(rect):Number(widget.config.layoutWidth??widget.width)/12*100);
  const preferred=PRESET_WIDTHS.includes(widget.config.presetPreferredWidth as PresetWidth)
    ?Number(widget.config.presetPreferredWidth):current;
  const defaultMinimum=preferred>=80?40:preferred>=50?33:20;
  const stored=PRESET_WIDTHS.includes(widget.config.presetMinWidth as PresetWidth)
    ?Number(widget.config.presetMinWidth):defaultMinimum;
  return {preferred,minimum:Math.min(stored,preferred),allowShrink:widget.config.presetAllowShrink!==false};
}
function patchRects(items:readonly PageWidget[],updates:Record<string,FluidWidgetRect>):PageWidget[] {
  return items.map(item=>updates[item.id]
    ?{...item,config:{...item.config,fluidDesktop:updates[item.id]}}:item);
}
function options(widget:PageWidget,current:number,min:number,canShrink:boolean):number[]{
  if(widgetSizeLocked(widget)||!canShrink)return [current];
  const values=PRESET_WIDTHS.filter(n=>n>=min-EPS&&n<=current+EPS);
  return values.length?values.slice().reverse():[current];
}
/** Preset insertion targets the actual widget under the cursor, independent
 * of the cursor's Y within the card. Vertical stacking is a drop into blank
 * canvas space, not an accidental effect of hovering the bottom of a widget.
 * The center band is reserved for explicit same-row swaps. */
export function presetDropTargetAtPoint(positions:Record<string,FluidWidgetRect>,
  canvas:{left:number;top:number;width:number},pointer:{x:number;y:number},
  excluded:readonly string[]=[]):{id:string;intent:"left"|"right"|"replace"}|null{
  const hit=fluidDropTargetAtPoint(positions,canvas,pointer,excluded);
  if(!hit)return null;
  const r=positions[hit.id];
  const left=canvas.left+r.x/12*canvas.width+(r.x>0?7:0);
  const width=r.w/12*canvas.width-(r.x>0?7:0)-(r.x+r.w<11.999?7:0);
  const proportion=(pointer.x-left)/Math.max(1,width);
  return {id:hit.id,intent:proportion<.44?"left":proportion>.56?"right":"replace"};
}

export type PresetPlacement={
  items:PageWidget[];
  placed:boolean;
  newRow:boolean;
  reason:"fit"|"row-full"|"pinned"|"invalid"|"blocked";
};
/** A row uses shared top coordinates, not an arbitrary vertical overlap:
 * stacked widgets to the side of a tall card must remain independent. */
export function insertPresetWidget(items:readonly PageWidget[],movingId:string,targetId:string,
  side:"left"|"right",intelligentShrink=true):PresetPlacement {
  const moving=items.find(w=>w.id===movingId),target=items.find(w=>w.id===targetId);
  const unchanged=()=>({items:[...items],placed:false,newRow:false,reason:"invalid" as const});
  if(!moving||!target||moving.id===target.id||
     widgetSectionId(moving)!==widgetSectionId(target)||widgetRowPinned(moving))return unchanged();
  const rects=initialFluidRects(items),targetRect=rects[targetId],movingRect=rects[movingId];
  if(!targetRect||!movingRect)return unchanged();
  const row=items.filter(item=>item.id!==movingId&&widgetSectionId(item)===widgetSectionId(target)&&
    Math.abs(rects[item.id].y-targetRect.y)<1)
    .sort((a,b)=>rects[a.id].x-rects[b.id].x);
  const at=row.findIndex(item=>item.id===targetId);
  if(at<0)return unchanged();
  row.splice(at+(side==="right"?1:0),0,moving);
  // The hovered card owns first refusal on resizing. Only shrink other
  // unlocked cards when the hovered card alone cannot make enough space.
  const widthOf=(item:PageWidget)=>item.id===movingId
    ?(PRESET_WIDTHS.includes(item.config.presetPreferredWidth as PresetWidth)
      ?Number(item.config.presetPreferredWidth):closestPreset(toPercent(rects[item.id])))
    :closestPreset(toPercent(rects[item.id]));
  const widths=row.map(widthOf);
  const choices=row.map((item,i)=>{
    const sizing=presetSizingOf(item,rects[item.id]);
    return options(item,widths[i],sizing.minimum,
      item.id!==movingId&&intelligentShrink&&sizing.allowShrink);
  });
  const targetOrder=row.findIndex(item=>item.id===targetId);
  const movingOldInRow=Math.abs(movingRect.y-targetRect.y)<1;
  const leftMost=Math.min(...row.filter(item=>item.id!==movingId||movingOldInRow)
    .map(item=>rects[item.id].x));
  const rowIds=new Set(row.map(item=>item.id));
  const outsiders=items.filter(item=>!rowIds.has(item.id)&&
    widgetSectionId(item)===widgetSectionId(target));
  const evaluate=(choice:number[]):Record<string,FluidWidgetRect>|null=>{
    if(choice.reduce((sum,width)=>sum+width,0)>100+EPS)return null;
    const proposed:Record<string,FluidWidgetRect>={};
    let cursor=leftMost;
    for(let i=0;i<row.length;i++){
      const old=rects[row[i].id],w=presetToUnits(choice[i]);
      proposed[row[i].id]={...old,x:round(cursor),y:targetRect.y,w};
      cursor=round(cursor+w);
    }
    if(cursor>12+EPS)return null;
    if(row.some(item=>widgetRowPinned(item)&&
      (Math.abs(proposed[item.id].x-rects[item.id].x)>.001||
       Math.abs(proposed[item.id].y-rects[item.id].y)>.001)))return null;
    // Keep lower rows in place unless the newly joined card actually
    // overlaps them. Then move only colliding, unlocked widgets downwards.
    // This prevents a valid side drop being treated as a vertical insertion.
    const adjusted={...proposed};
    const settled:FluidWidgetRect[]=Object.values(proposed);
    const below=[...outsiders].sort((a,b)=>rects[a.id].y-rects[b.id].y||
      rects[a.id].x-rects[b.id].x);
    for(const item of below){
      const original=rects[item.id];
      let projected={...original};
      for(let pass=0;pass<=items.length;pass++){
        const colliding=settled.filter(placed=>fluidOverlaps(projected,placed));
        if(!colliding.length)break;
        if(widgetRowPinned(item)||original.y<targetRect.y-1)return null;
        const y=Math.max(...colliding.map(placed=>placed.y+placed.h+FLUID_GAP));
        if(y<=projected.y||pass===items.length)return null;
        projected={...projected,y};
      }
      adjusted[item.id]=projected;
      settled.push(projected);
    }
    return adjusted;
  };
  let winner:Record<string,FluidWidgetRect>|null=null;
  let bestScore=Infinity;
  const visit=(index:number,current:number[],total:number)=>{
    if(index===row.length){
      const candidate=evaluate(current);
      if(!candidate)return;
      let othersShrink=0,hoveredShrink=0,distanceCost=0;
      for(let i=0;i<row.length;i++){
        if(row[i].id===movingId)continue;
        const difference=Math.max(0,widths[i]-current[i]);
        if(row[i].id===targetId)hoveredShrink+=difference;
        else{
          othersShrink+=difference;
          distanceCost+=difference*Math.abs(i-targetOrder);
        }
      }
      const score=othersShrink*100000+hoveredShrink*100+distanceCost;
      if(score<bestScore){bestScore=score;winner=candidate}
      return;
    }
    for(const width of choices[index]){
      if(total+width>100+EPS)continue;
      current.push(width);visit(index+1,current,total+width);current.pop();
    }
  };
  // Five preset columns maximum, with pruning at 100% occupancy.
  if(row.length<=5)visit(0,[],0);
  if(winner)return {items:patchRects(items,winner),placed:true,newRow:false,reason:"fit"};
  // A full-width / locked row is non-destructively preserved. Insert immediately
  // below it, shifting later movable rows. Pinned later rows force end-of-section.
  const bottom=Math.max(...row.filter(item=>item.id!==movingId).map(item=>
    rects[item.id].y+rects[item.id].h));
  const nextY=bottom+FLUID_GAP;
  const following=items.filter(item=>item.id!==movingId&&
    widgetSectionId(item)===widgetSectionId(target)&&rects[item.id].y>=nextY-1);
  const y=following.some(widgetRowPinned)
    ?fluidCanvasHeight(rects)+FLUID_GAP:nextY;
  const result:Record<string,FluidWidgetRect>={};
  if(y===nextY)for(const item of following)result[item.id]={...rects[item.id],
    y:rects[item.id].y+movingRect.h+FLUID_GAP};
  const width=presetToUnits(presetSizingOf(moving,movingRect).preferred);
  result[movingId]={...movingRect,x:0,y,w:width};
  const valid=items.filter(item=>widgetSectionId(item)===widgetSectionId(target)&&item.id!==movingId)
    .every(item=>!fluidOverlaps(result[movingId],result[item.id]??rects[item.id]));
  if(!valid){
    result[movingId]={...movingRect,x:0,y:fluidCanvasHeight(rects)+FLUID_GAP,w:width};
  }
  return {items:patchRects(items,result),placed:true,newRow:true,reason:"row-full"};
}
/** A drag into free space retains the widget's design width and moves the same
 * source record; no copy or new database record is created. */
/** Same-row center-drop swaps visual order and preserves each widget's source. */
export function swapPresetWidgets(items:readonly PageWidget[],firstId:string,secondId:string):PageWidget[] {
  const first=items.find(w=>w.id===firstId),second=items.find(w=>w.id===secondId);
  if(!first||!second||first.id===second.id||widgetRowPinned(first)||widgetRowPinned(second)||
     widgetSectionId(first)!==widgetSectionId(second))return [...items];
  const rects=initialFluidRects(items),a=rects[firstId],b=rects[secondId];
  if(Math.abs(a.y-b.y)>1)return [...items];
  const row=items.filter(w=>widgetSectionId(w)===widgetSectionId(first)&&
    Math.abs(rects[w.id].y-a.y)<1).sort((x,y)=>rects[x.id].x-rects[y.id].x);
  const i=row.findIndex(w=>w.id===firstId),j=row.findIndex(w=>w.id===secondId);
  if(i<0||j<0)return [...items];
  [row[i],row[j]]=[row[j],row[i]];
  let x=Math.min(...row.map(w=>rects[w.id].x));
  const changes:Record<string,FluidWidgetRect>={};
  for(const item of row){
    changes[item.id]={...rects[item.id],x:round(x)};
    x+=rects[item.id].w;
  }
  if(row.some(item=>widgetRowPinned(item)&&Math.abs(changes[item.id].x-rects[item.id].x)>.001))
    return [...items];
  const rowIds=new Set(row.map(w=>w.id));
  if(row.some(item=>items.some(other=>!rowIds.has(other.id)&&
    widgetSectionId(other)===widgetSectionId(item)&&
    fluidOverlaps(changes[item.id],rects[other.id]))))return [...items];
  return patchRects(items,changes);
}

export function movePresetWidget(items:readonly PageWidget[],id:string,rect:FluidWidgetRect):PageWidget[] {
  const widget=items.find(item=>item.id===id);
  if(!widget||widgetRowPinned(widget))return [...items];
  const original=initialFluidRects(items)[id];
  const design=presetSizingOf(widget,original);
  const width=presetToUnits(design.preferred);
  const x=round(Math.max(0,Math.min(12-width,Math.round(rect.x/0.6)*0.6)));
  return placeFluidWidget(items,id,{...rect,x,w:width});
}
/** Snap a real shared boundary to a compatible 100%-based pair, including
 * linked tall/stacked edges. Locks, per-widget minima and collisions apply. */
export function resizePresetDivider(items:readonly PageWidget[],leftId:string,rightId:string,
  requestedDeltaUnits:number):PageWidget[] {
  const bound=fluidSharedBoundaries(items).find(b=>
    (b.leftIds??[b.leftId]).includes(leftId)&&(b.rightIds??[b.rightId]).includes(rightId));
  if(!bound)return [...items];
  const leftIds=bound.leftIds??[bound.leftId],rightIds=bound.rightIds??[bound.rightId];
  const positions=initialFluidRects(items);
  const left=positions[leftId],right=positions[rightId];
  const sum=round(toPercent(left)+toPercent(right));
  let best:{left:number;right:number;distance:number}|null=null;
  for(const l of PRESET_WIDTHS)for(const r of PRESET_WIDTHS){
    if(Math.abs(l+r-sum)>0.65)continue;
    const delta=presetToUnits(l)-left.w;
    const allowed=[...leftIds,...rightIds].every(id=>{
      const item=items.find(w=>w.id===id)!;
      const next=leftIds.includes(id)?l:r;
      const rules=presetSizingOf(item,positions[id]);
      return !widgetSizeLocked(item)&&next>=rules.minimum-EPS;
    });
    if(!allowed)continue;
    const distance=Math.abs(delta-requestedDeltaUnits);
    if(!best||distance<best.distance)best={left:l,right:r,distance};
  }
  return best?resizeFluidSharedBoundary(items,leftId,rightId,presetToUnits(best.left)-left.w):[...items];
}
export function presetUpdatePreferred(items:readonly PageWidget[],id:string,width:number):PageWidget[]{
  const target=items.find(w=>w.id===id);
  if(!target||widgetSizeLocked(target)||!PRESET_WIDTHS.includes(width as PresetWidth))return [...items];
  const current=initialFluidRects(items)[id];
  const next=placeFluidWidget(items,id,{...current,x:round(Math.min(current.x,12-presetToUnits(width))),w:presetToUnits(width)});
  return next.map(w=>w.id===id?{...w,config:{...w.config,presetPreferredWidth:width}}:w);
}
