import {widgetSectionId,type PageWidget,type WidgetPageSection} from "@/lib/widget-system";

// Layout identity is stored on the placement, not on the database or master
// widget. Bands are horizontal rows, lanes are columns within each band, and
// widgets in the same lane stack vertically. They survive reload and sync.
export type WidgetDropEdge="left"|"right"|"above"|"below"|"new-row"|"section-end";
export type WidgetDropTarget={sectionId:string;targetId:string|null;edge:WidgetDropEdge};
export type WidgetLayoutLane={id:string;width:number;widgets:PageWidget[]};
export type WidgetLayoutBand={id:string;lanes:WidgetLayoutLane[]};

const MIN_WIDTH=2;
const safeWidth=(value:number)=>Math.max(MIN_WIDTH,Math.min(12,Math.round(value)));
const bandId=(item:PageWidget)=>typeof item.config.layoutBand==="string"?item.config.layoutBand:"band-"+item.id;
const laneId=(item:PageWidget)=>typeof item.config.layoutLane==="string"?item.config.layoutLane:"lane-"+item.id;
const rebalance=(band:WidgetLayoutBand)=>{
  // Adding/removing a column redistributes the available width once, on drop.
  // Deliberately never run this as part of a drag-over preview.
  const lanes=band.lanes;
  if(!lanes.length)return;
  const each=Math.floor(12/lanes.length);
  lanes.forEach((lane,index)=>{lane.width=each+(index<12%lanes.length?1:0)});
};

// Preserve existing column proportions when a sibling leaves the row.
// The 12-slot layout snaps to useful percentages without stretching heights.
const fillBand=(band:WidgetLayoutBand)=>{
  const lanes=band.lanes;
  if(!lanes.length)return;
  if(lanes.length===1){lanes[0].width=12;return}
  const weights=lanes.map(lane=>Math.max(MIN_WIDTH,lane.width));
  const total=weights.reduce((sum,width)=>sum+width,0);
  const remaining=12-MIN_WIDTH*lanes.length;
  const quotas=weights.map(weight=>weight/total*remaining);
  const additions=quotas.map(Math.floor);
  let left=remaining-additions.reduce((sum,value)=>sum+value,0);
  const order=quotas.map((value,index)=>({index,remainder:value-additions[index]}))
    .sort((a,b)=>b.remainder-a.remainder||a.index-b.index);
  for(let i=0;i<left;i++)additions[order[i].index]++;
  lanes.forEach((lane,index)=>{lane.width=MIN_WIDTH+additions[index]});
};

export function widgetLayoutBands(items:readonly PageWidget[]):WidgetLayoutBand[]{
  const bands:WidgetLayoutBand[]=[];
  for(const item of [...items].sort((a,b)=>a.position-b.position)){
    const explicit=typeof item.config.layoutBand==="string"&&typeof item.config.layoutLane==="string";
    let band=explicit?bands.find(b=>b.id===bandId(item)):undefined;
    if(!band&&!explicit){
      const candidate=bands[bands.length-1];
      if(candidate&&candidate.id.startsWith("band-")&&candidate.lanes.every(l=>l.id.startsWith("lane-"))&&
        candidate.lanes.reduce((n,l)=>n+l.width,0)+safeWidth(item.width)<=12)band=candidate;
    }
    if(!band){band={id:bandId(item),lanes:[]};bands.push(band)}
    let lane=band.lanes.find(l=>l.id===laneId(item));
    if(!lane){lane={id:laneId(item),width:safeWidth(item.width),widgets:[]};band.lanes.push(lane)}
    lane.widgets.push(item);
  }
  return bands;
}

const mutableBands=(items:readonly PageWidget[])=>widgetLayoutBands(items).map(b=>({...b,lanes:b.lanes.map(l=>({...l,widgets:[...l.widgets]}))}));

function publish(sections:readonly WidgetPageSection[],all:readonly PageWidget[],bySection:Map<string,WidgetLayoutBand[]>):PageWidget[]{
  const sectionIds=["",...sections.map(section=>section.id)];
  const inOrder=[...new Set([...sectionIds,...all.map(widgetSectionId)])];
  const result:PageWidget[]=[];
  for(const sectionId of inOrder){
    const bands=bySection.get(sectionId)??[];
    for(const band of bands)for(const lane of band.lanes){
      for(const widget of lane.widgets){
        const config:Record<string,unknown>={...widget.config,layoutBand:band.id,layoutLane:lane.id};
        if(sectionId)config.sectionId=sectionId;else delete config.sectionId;
        result.push({...widget,config,width:lane.width,position:result.length});
      }
    }
  }
  return result;
}

/** Pure preview of a drop; persistence happens only after mouse release. */
export function placeWidget(items:readonly PageWidget[],sections:readonly WidgetPageSection[],id:string,target:WidgetDropTarget,fillGaps=true):PageWidget[]{
  const moving=items.find(w=>w.id===id);
  if(!moving)return [...items];
  const group=new Map<string,WidgetLayoutBand[]>();
  for(const sectionId of new Set(["",...sections.map(s=>s.id),...items.map(widgetSectionId),target.sectionId])){
    group.set(sectionId,mutableBands(items.filter(w=>widgetSectionId(w)===sectionId)));
  }
  for(const bands of group.values())for(let bi=bands.length-1;bi>=0;bi--){
    for(let li=bands[bi].lanes.length-1;li>=0;li--){
      const lane=bands[bi].lanes[li];lane.widgets=lane.widgets.filter(w=>w.id!==id);
      if(!lane.widgets.length)bands[bi].lanes.splice(li,1);
    }
    if(!bands[bi].lanes.length)bands.splice(bi,1);
  }
  const destination=group.get(target.sectionId)??[];
  const destinationBand=destination.find(b=>b.lanes.some(l=>l.widgets.some(w=>w.id===target.targetId)));
  const destinationLane=destinationBand?.lanes.find(l=>l.widgets.some(w=>w.id===target.targetId));
  if(destinationBand&&target.edge==="new-row"){
    // Insert a full-width band immediately after the hovered band, not at the
    // end of the section. It is intentionally distinct from stacking below.
    destination.splice(destination.indexOf(destinationBand)+1,0,{
      id:"band-"+id,lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]
    });
  }else if(destinationBand&&destinationLane&&target.targetId&&target.targetId!==id&&target.edge!=="section-end"){
    const laneIndex=destinationBand.lanes.indexOf(destinationLane);
    if(target.edge==="left"||target.edge==="right"){
      if(destinationBand.lanes.length<4){
        destinationBand.lanes.splice(laneIndex+(target.edge==="right"?1:0),0,{id:"lane-"+id,width:3,widgets:[moving]});
        rebalance(destinationBand);
      }else{
        // Four columns are the smallest usable snap. Stack rather than overflow.
        destinationLane.widgets.splice(target.edge==="left"?0:destinationLane.widgets.length,0,moving);
      }
    }else{
      const targetIndex=destinationLane.widgets.findIndex(w=>w.id===target.targetId);
      destinationLane.widgets.splice(targetIndex+(target.edge==="below"?1:0),0,moving);
    }
  }else{
    destination.push({id:"band-"+id,lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]});
  }
  // Existing columns regain available width if an entire lane was moved away.
  // Don't overwrite the widths of a destination band that was only stacked.
  for(const bands of group.values())for(const band of bands){
    if(band===destinationBand&&band.lanes.reduce((sum,l)=>sum+l.width,0)===12)continue;
    if(fillGaps&&band.lanes.reduce((sum,l)=>sum+l.width,0)!==12)fillBand(band);
  }
  group.set(target.sectionId,destination);
  return publish(sections,items,group);
}

/** A lane divider conserves the combined width of its adjacent columns. */
export function resizeWidgetLane(items:readonly PageWidget[],sections:readonly WidgetPageSection[],id:string,delta:number,fillGaps=true):PageWidget[]{
  const widget=items.find(w=>w.id===id);if(!widget||!delta)return [...items];
  const group=new Map<string,WidgetLayoutBand[]>();
  for(const sectionId of new Set(["",...sections.map(s=>s.id),...items.map(widgetSectionId)]))
    group.set(sectionId,mutableBands(items.filter(w=>widgetSectionId(w)===sectionId)));
  const bands=group.get(widgetSectionId(widget))??[];
  const band=bands.find(b=>b.lanes.some(l=>l.widgets.some(w=>w.id===id)));
  const lane=band?.lanes.find(l=>l.widgets.some(w=>w.id===id));
  if(!band||!lane)return [...items];
  const index=band.lanes.indexOf(lane);
  const neighbor=band.lanes[index+1];
  if(neighbor){
    const adjusted=Math.max(MIN_WIDTH-lane.width,Math.min(neighbor.width-MIN_WIDTH,delta));
    lane.width+=adjusted;neighbor.width-=adjusted;
  }else if(index>0){
    const previous=band.lanes[index-1];
    const adjusted=Math.max(MIN_WIDTH-lane.width,Math.min(previous.width-MIN_WIDTH,delta));
    lane.width+=adjusted;previous.width-=adjusted;
  }else if(!fillGaps){
    const remaining=12-band.lanes.reduce((n,l)=>n+l.width,0);
    lane.width=safeWidth(Math.min(12,lane.width+Math.max(-lane.width+MIN_WIDTH,Math.min(delta,remaining))));
  }
  return publish(sections,items,group);
}
