import type {PageWidget} from "@/lib/widget-system";

/** Layout flags stay on placements, never on canonical database records. */
export function widgetSizeLocked(widget:PageWidget){return widget.config.sizeLocked===true}
export function widgetRowPinned(widget:PageWidget){return widget.config.rowPinned===true}
export function widgetRowLocked(widget:PageWidget){return widget.config.rowLocked===true}
export const widgetBandIdentity=(widget:PageWidget)=>typeof widget.config.layoutBand==="string"
  ?widget.config.layoutBand:"band-"+widget.id;

/** A whole row is locked if any one of its placements carries the flag.
 * Row controls set all members; this fallback covers partially saved rows. */
export function widgetBandLocked(widgets:readonly PageWidget[]):boolean{
  return widgets.some(widgetRowLocked);
}

export function setWidgetRowLock(items:readonly PageWidget[],widgetId:string,locked:boolean):PageWidget[]{
  const selected=items.find(w=>w.id===widgetId);
  if(!selected)return [...items];
  const band=widgetBandIdentity(selected);
  return items.map(w=>widgetBandIdentity(w)===band&&
    (w.config.sectionId??"")===(selected.config.sectionId??"")
    ?{...w,config:{...w.config,rowLocked:locked}}:w);
}

/** Magnetic alignment uses a pixel tolerance, but stores widths as stable
 * grid units so reloading does not accumulate fractional drift. */
export function magneticSnapWidth(width:number,alignmentWidths:readonly number[],
  unitPx:number,distancePx:number):{width:number;snapped:boolean}{
  if(!(unitPx>0)||distancePx<0)return {width,snapped:false};
  let closest=width,delta=Infinity;
  for(const mark of alignmentWidths){
    const distance=Math.abs(width-mark)*unitPx;
    if(distance<=distancePx&&distance<delta){closest=mark;delta=distance}
  }
  return {width:closest,snapped:delta!==Infinity};
}

export function widgetRowOccupancy(widgets:readonly PageWidget[],bandId:string):number{
  const lanes=new Map<string,number>();
  for(const widget of widgets){
    if(widgetBandIdentity(widget)!==bandId||typeof widget.config.layoutSpanStart==="number")continue;
    const id=typeof widget.config.layoutLane==="string"?widget.config.layoutLane:"lane-"+widget.id;
    lanes.set(id,Math.max(lanes.get(id)??0,Number(widget.config.layoutWidth??widget.width)));
  }
  return Math.min(100,Math.round([...lanes.values()].reduce((sum,w)=>sum+w,0)/12*100));
}
