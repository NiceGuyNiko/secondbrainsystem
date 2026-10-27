import {fluidCanvasHeight,fluidOverlaps,fluidSharedBoundaries,initialFluidRects,placeFluidWidget,resizeFluidSharedBoundary,FLUID_GAP,type FluidWidgetRect} from "./widget-fluid-layout";
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
export type PresetPlacement={
  items:PageWidget[];
  placed:boolean;
  newRow:boolean;
  reason:"fit"|"row-full"|"pinned"|"invalid"|"blocked";
};
/** A row uses shared top coordinates, not an arbitrary vertical overlap:
 * stacked widgets to the side of a tall card must remain independent. */
export function insertPresetWidget(items:readonly PageWidget[],movingId:string,targetId:string,
  side:"left"|"right"):PresetPlacement {
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
  const choices=row.map(item=>{
    const r=rects[item.id];
    const sizing=presetSizingOf(item,r);
    const current=item.id===movingId?sizing.preferred:closestPreset(toPercent(r));
    return options(item,current,sizing.minimum,item.id===movingId?false:sizing.allowShrink);
  });
  let winner:number[]|null=null,bestScore=-Infinity;
  const evaluate=(choice:number[])=>{
    const occupied=choice.reduce((sum,width)=>sum+width,0);
    if(occupied>100+EPS)return;
    const changed=row.some((item,i)=>item.id!==movingId&&
      (widgetSizeLocked(item)||item.config.presetAllowShrink===false)&&
      Math.abs(choice[i]-toPercent(rects[item.id]))>EPS);
    if(changed)return;
    const score=occupied*100-choice.reduce((sum,n,i)=>sum+
      (row[i].id===movingId?0:Math.max(0,toPercent(rects[row[i].id])-n))*2,0);
    if(score>bestScore){bestScore=score;winner=[...choice]}
  };
  const visit=(index:number,current:number[],total:number)=>{
    if(index===row.length){evaluate(current);return}
    for(const width of choices[index]){
      if(total+width>100+EPS)continue;
      current.push(width);visit(index+1,current,total+width);current.pop();
    }
  };
  // Five columns of >=20% is the physical maximum.
  if(row.length<=5)visit(0,[],0);
  if(winner){
    const proposed:Record<string,FluidWidgetRect>={};
    let cursor=0;
    for(let i=0;i<row.length;i++){
      const width=presetToUnits(winner[i]);
      const old=rects[row[i].id];
      proposed[row[i].id]={...old,x:round(cursor),y:targetRect.y,w:width};
      cursor=round(cursor+width);
    }
    // A tall or offset neighbor may occupy the proposed new horizontal area.
    const rowIds=new Set(row.map(w=>w.id));
    const outsiders=items.filter(w=>widgetSectionId(w)===widgetSectionId(target)&&!rowIds.has(w.id));
    const collision=row.some(item=>outsiders.some(other=>
      fluidOverlaps(proposed[item.id],rects[other.id])&&other.id!==movingId));
    if(!collision)return {items:patchRects(items,proposed),placed:true,newRow:false,reason:"fit"};
  }
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
