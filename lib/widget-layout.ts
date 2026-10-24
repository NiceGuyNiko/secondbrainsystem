import {widgetSectionId,widgetHeightPx,type PageWidget,type WidgetPageSection} from "@/lib/widget-system";

// Layout identity is stored on the placement, not on the database or master
// widget. Bands are horizontal rows, lanes are columns within each band, and
// widgets in the same lane stack vertically. They survive reload and sync.
export type WidgetDropEdge="left"|"right"|"above"|"below"|"span-below"|"new-row"|"section-end";
export type WidgetDropTarget={sectionId:string;targetId:string|null;edge:WidgetDropEdge};
export type WidgetLayoutLane={id:string;width:number;widgets:PageWidget[]};
export type WidgetLayoutSpan={startLane:number;laneCount:number;widgets:PageWidget[]};
export type WidgetLayoutBand={id:string;lanes:WidgetLayoutLane[];spans?:WidgetLayoutSpan[]};

export const MAX_WIDGET_COLUMNS=4;
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
  const left=remaining-additions.reduce((sum,value)=>sum+value,0);
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
    // Spanning widgets are owned by their original band, but occupy a lower
    // row underneath two adjacent columns (e.g. 33/33 + 67 under columns 2+3).
    const start=item.config.layoutSpanStart;
    const count=item.config.layoutSpanCount;
    if(explicit&&Number.isInteger(start)&&Number.isInteger(count)&&
       typeof start==="number"&&typeof count==="number"&&start>=0&&count>=2){
      if(!band.spans)band.spans=[];
      let span=band.spans.find(s=>s.startLane===start&&s.laneCount===count);
      if(!span){span={startLane:start,laneCount:count,widgets:[]};band.spans.push(span)}
      span.widgets.push(item);
      continue;
    }
    let lane=band.lanes.find(l=>l.id===laneId(item));
    if(!lane){lane={id:laneId(item),width:safeWidth(item.width),widgets:[]};band.lanes.push(lane)}
    lane.widgets.push(item);
  }
  return bands;
}

/** Insertion targets exist at both outer edges and between columns only until
 * the band reaches its four-column maximum. Widths are redistributed WITHIN
 * the existing full-width band; the canvas itself never widens. */
export function canInsertWidgetColumn(band:WidgetLayoutBand):boolean{
  return band.lanes.length>0&&band.lanes.length<MAX_WIDGET_COLUMNS;
}

const mutableBands=(items:readonly PageWidget[])=>widgetLayoutBands(items).map(b=>({
  ...b,
  lanes:b.lanes.map(l=>({...l,widgets:[...l.widgets]})),
  spans:b.spans?.map(s=>({...s,widgets:[...s.widgets]}))
}));

/** Every band needs its own durable ID even when the dragged widget was
 * originally the ID source for a row that still contains sibling widgets. */
const uniqueBandId=(bands:readonly WidgetLayoutBand[],widgetId:string)=>{
  const base="band-"+widgetId;
  if(!bands.some(b=>b.id===base))return base;
  let suffix=2;
  while(bands.some(b=>b.id===base+"-"+suffix))suffix++;
  return base+"-"+suffix;
};

function publish(sections:readonly WidgetPageSection[],all:readonly PageWidget[],bySection:Map<string,WidgetLayoutBand[]>):PageWidget[]{
  const sectionIds=["",...sections.map(section=>section.id)];
  const inOrder=[...new Set([...sectionIds,...all.map(widgetSectionId)])];
  const result:PageWidget[]=[];
  for(const sectionId of inOrder){
    const bands=bySection.get(sectionId)??[];
    for(const band of bands){
      for(const lane of band.lanes)for(const widget of lane.widgets){
        const config:Record<string,unknown>={...widget.config,layoutBand:band.id,layoutLane:lane.id};
        delete config.layoutSpanStart;delete config.layoutSpanCount;
        if(sectionId)config.sectionId=sectionId;else delete config.sectionId;
        result.push({...widget,config,width:lane.width,position:result.length});
      }
      for(const span of band.spans??[])for(const widget of span.widgets){
        const width=band.lanes.slice(span.startLane,span.startLane+span.laneCount)
          .reduce((sum,lane)=>sum+lane.width,0);
        const config:Record<string,unknown>={...widget.config,layoutBand:band.id,layoutLane:"span-"+widget.id,
          layoutSpanStart:span.startLane,layoutSpanCount:span.laneCount};
        if(sectionId)config.sectionId=sectionId;else delete config.sectionId;
        result.push({...widget,config,width:width||12,position:result.length});
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
    const spans=bands[bi].spans??[];
    for(let si=spans.length-1;si>=0;si--){
      spans[si].widgets=spans[si].widgets.filter(w=>w.id!==id);
      if(!spans[si].widgets.length)spans.splice(si,1);
    }
    for(let li=bands[bi].lanes.length-1;li>=0;li--){
      const lane=bands[bi].lanes[li];lane.widgets=lane.widgets.filter(w=>w.id!==id);
      if(!lane.widgets.length)bands[bi].lanes.splice(li,1);
    }
    if(!bands[bi].lanes.length&&!(bands[bi].spans?.length))bands.splice(bi,1);
  }
  const destination=group.get(target.sectionId)??[];
  const destinationBand=destination.find(b=>b.lanes.some(l=>l.widgets.some(w=>w.id===target.targetId))||
    b.spans?.some(s=>s.widgets.some(w=>w.id===target.targetId)));
  const destinationLane=destinationBand?.lanes.find(l=>l.widgets.some(w=>w.id===target.targetId));
  const destinationSpan=destinationBand?.spans?.find(s=>s.widgets.some(w=>w.id===target.targetId));
  if(destinationBand&&destinationLane&&target.edge==="span-below"&&destinationBand.lanes.length>=3){
    // The persistent 67%-width divider below columns 2+3 is an explicit
    // nested target. Its widgets stay attached to this SAME row and grow
    // under both columns, not merely under the second column.
    const startLane=destinationBand.lanes.length-2;
    const laneCount=2;
    if(!destinationBand.spans)destinationBand.spans=[];
    let span=destinationBand.spans.find(s=>s.startLane===startLane&&s.laneCount===laneCount);
    if(!span){span={startLane,laneCount,widgets:[]};destinationBand.spans.push(span)}
    span.widgets.push(moving);
  }else if(destinationSpan&&(target.edge==="above"||target.edge==="below")){
    const idx=destinationSpan.widgets.findIndex(w=>w.id===target.targetId);
    destinationSpan.widgets.splice(idx+(target.edge==="below"?1:0),0,moving);
  }else if(destinationBand&&target.edge==="new-row"){
    // Insert a full-width band immediately after the hovered band, not at the
    // end of the section. It is intentionally distinct from stacking below.
    destination.splice(destination.indexOf(destinationBand)+1,0,{
      id:uniqueBandId(destination,id),lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]
    });
  }else if(destinationBand&&destinationLane&&target.targetId&&target.targetId!==id&&target.edge!=="section-end"){
    const laneIndex=destinationBand.lanes.indexOf(destinationLane);
    if(target.edge==="left"||target.edge==="right"){
      if(canInsertWidgetColumn(destinationBand)){
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
    destination.push({id:uniqueBandId(destination,id),lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]});
  }
  // A spanning group references its pair of adjacent columns. If a later
  // rearrangement removes or inserts columns, preserve every spanning widget
  // as a visible full-width row rather than leaving an orphaned invisible
  // layout item with an out-of-range column reference.
  for(const bands of group.values()){
    for(let bi=0;bi<bands.length;bi++){
      const band=bands[bi];
      const invalid=(band.spans??[]).filter(span=>
        band.lanes.length<3||span.startLane!==band.lanes.length-2||span.laneCount!==2);
      if(!invalid.length)continue;
      band.spans=(band.spans??[]).filter(span=>!invalid.includes(span));
      let inserted=0;
      for(const span of invalid)for(const widget of span.widgets){
        bands.splice(bi+1+inserted,0,{
          id:"band-"+widget.id,lanes:[{id:"lane-"+widget.id,width:12,widgets:[widget]}]
        });
        inserted++;
      }
      bi+=inserted;
    }
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

/**
 * Expand a widget to the full section width without changing its source record
 * or discarding sibling widgets. When it shares a row, extract it into its own
 * full-width band immediately beneath that row. This is the double-click
 * shortcut for the triangular resize handle.
 */
export function expandWidgetToSectionWidth(
  items:readonly PageWidget[],sections:readonly WidgetPageSection[],id:string,fillGaps=true
):PageWidget[]{
  const widget=items.find(item=>item.id===id);
  if(!widget)return [...items];
  const sameSection=items.filter(item=>widgetSectionId(item)===widgetSectionId(widget));
  const band=widgetLayoutBands(sameSection).find(row=>
    row.lanes.some(lane=>lane.widgets.some(w=>w.id===id))||
    row.spans?.some(span=>span.widgets.some(w=>w.id===id)));
  if(!band)return [...items];
  const other=[...band.lanes.flatMap(lane=>lane.widgets),
    ...(band.spans??[]).flatMap(span=>span.widgets)].find(item=>item.id!==id);
  if(other){
    return placeWidget(items,sections,id,{
      sectionId:widgetSectionId(widget),targetId:other.id,edge:"new-row"
    },fillGaps);
  }
  // A lone widget has no neighbor to swap against. Preserve its placement
  // identity while explicitly setting its width to the complete 12-unit row.
  return items.map(item=>item.id===id?{...item,width:12}:item);
}


/**
 * When exactly two widgets share a vertical lane, a double-click on the
 * smaller matches the taller widget; a double-click on the taller matches the
 * smaller. This changes only the clicked widget's display height.
 */
export function matchWidgetStackHeight(items:readonly PageWidget[],id:string):PageWidget[]{
  const own=items.find(item=>item.id===id);
  if(!own)return [...items];
  const band=widgetLayoutBands(items.filter(item=>widgetSectionId(item)===widgetSectionId(own)))
    .find(row=>row.lanes.some(lane=>lane.widgets.some(item=>item.id===id))||
      row.spans?.some(span=>span.widgets.some(item=>item.id===id)));
  const lane=band?.lanes.find(lane=>lane.widgets.some(item=>item.id===id));
  const stack=lane?.widgets??band?.spans?.find(span=>span.widgets.some(item=>item.id===id))?.widgets??[];
  if(stack.length!==2)return [...items];
  const peer=stack.find(item=>item.id!==id);
  if(!peer)return [...items];
  const height=widgetHeightPx(peer);
  return items.map(item=>item.id===id?{
    ...item,config:{...item.config,heightPx:height}
  }:item);
}

/**
 * Double-clicking the corner triangle toggles between its saved fixed height
 * and intrinsic content height. It does NOT change width or layout placement.
 * The renderer makes the body overflow-visible when fitContent is enabled.
 */
export function toggleWidgetContentFit(items:readonly PageWidget[],id:string):PageWidget[]{
  return items.map(item=>item.id===id
    ?{...item,config:{...item.config,fitContent:item.config.fitContent!==true}}
    :item);
}

/**
 * The bottom-edge divider matches the height of the adjacent column, rather
 * than stretching the widget to the full section width.
 *
 * For two items in a single standalone stack, it matches the other item
 * directly. In multi-column bands, it adjusts the clicked widget so its
 * column's total height matches its closest neighboring column's total
 * height, accounting for the vertical gaps and the other stacked widgets.
 */
export function matchWidgetAdjacentHeight(
  items:readonly PageWidget[],id:string,gap=14,chromeHeight=0
):PageWidget[]{
  const item=items.find(w=>w.id===id);
  if(!item)return [...items];
  const band=widgetLayoutBands(items.filter(w=>widgetSectionId(w)===widgetSectionId(item)))
    .find(row=>row.lanes.some(l=>l.widgets.some(w=>w.id===id))||
      row.spans?.some(s=>s.widgets.some(w=>w.id===id)));
  if(!band)return [...items];

  // Heights compare the actual blocks: each displayed widget includes the
  // Arrange chrome (if any), and stacked widgets have a single gap between
  // them. Insertion/drag guides are overlays, never part of the measured row.
  const displayedHeight=(w:PageWidget)=>widgetHeightPx(w)+chromeHeight;
  const laneTotal=(widgets:readonly PageWidget[])=>
    widgets.reduce((sum,w)=>sum+displayedHeight(w),0)+Math.max(0,widgets.length-1)*gap;
  const limit=(height:number)=>Math.max(160,Math.min(1200,Math.round(height)));
  const setHeight=(source:readonly PageWidget[],widgetId:string,desired:number):PageWidget[]=>
    source.map(w=>w.id===widgetId?{...w,config:{...w.config,
      fitContent:false,heightPx:limit(desired)}}:w);

  const laneIndex=band.lanes.findIndex(l=>l.widgets.some(w=>w.id===id));
  const span=band.spans?.find(s=>s.widgets.some(w=>w.id===id));

  // A band can have a tall independent left column, two shorter columns
  // above, and one 67% span below the right pair. Their visual bottom edges
  // are related:
  //
  //  left total = max(middle total, right total) + gap + lower span total
  //
  // Double-clicking any participant preserves this relationship, rather
  // than comparing the lower span only to the upper lanes independently.
  const grouped=band.spans?.find(s=>
    s.startLane>=1&&s.laneCount>=2&&
    s.startLane+s.laneCount<=band.lanes.length&&s.widgets.length>0);
  if(grouped){
    const inside=band.lanes.slice(grouped.startLane,grouped.startLane+grouped.laneCount);
    const outside=band.lanes[grouped.startLane-1];
    const upperIndex=band.lanes.findIndex((lane,index)=>
      index>=grouped.startLane&&index<grouped.startLane+grouped.laneCount&&
      lane.widgets.some(w=>w.id===id));
    const inSpan=grouped.widgets.some(w=>w.id===id);
    const inOutside=!!outside?.widgets.some(w=>w.id===id);
    if(outside&&(inSpan||inOutside||upperIndex>=0)){
      const upperHeight=(widgets:readonly PageWidget[])=>
        Math.max(...inside.map(l=>laneTotal(l.widgets.map(w=>widgets.find(candidate=>candidate.id===w.id)??w))));
      const spanHeight=(widgets:readonly PageWidget[])=>
        laneTotal(grouped.widgets.map(w=>widgets.find(candidate=>candidate.id===w.id)??w));
      const outsideHeight=(widgets:readonly PageWidget[])=>
        laneTotal(outside.widgets.map(w=>widgets.find(candidate=>candidate.id===w.id)??w));
      const fullRightHeight=(widgets:readonly PageWidget[])=>
        upperHeight(widgets)+gap+spanHeight(widgets);
      // Prefer resizing the clicked lower span. If it hits the minimum or
      // maximum height, resize the last widget in the independent left lane
      // by the remainder so the pair of columns still finish together.
      const synchronizeBottom=(widgets:readonly PageWidget[],anchorId:string):PageWidget[]=>{
        const delta=outsideHeight(widgets)-fullRightHeight(widgets);
        if(!delta)return [...widgets];
        const anchor=widgets.find(w=>w.id===anchorId);
        if(!anchor)return [...widgets];
        const desired=widgetHeightPx(anchor)+delta;
        const next=setHeight(widgets,anchorId,desired);
        const applied=widgetHeightPx(next.find(w=>w.id===anchorId)!)-widgetHeightPx(anchor);
        const remainder=delta-applied;
        if(!remainder)return next;
        const leftAnchor=outside.widgets[outside.widgets.length-1];
        const leftCurrent=next.find(w=>w.id===leftAnchor.id);
        // A shorter right group cannot force a span below the minimum.
        // Instead grow the neighboring left column to the minimum-aligned
        // height. This is intentionally the only secondary adjustment.
        return leftCurrent?setHeight(next,leftAnchor.id,widgetHeightPx(leftCurrent)-remainder):next;
      };

      if(inSpan){
        // A fourth widget below middle+right compares against the complete
        // left column, not either short upper widget.
        return synchronizeBottom(items,id);
      }
      if(inOutside){
        // The left column compares against the whole compound right group.
        const current=laneTotal(outside.widgets);
        const desired=widgetHeightPx(item)+fullRightHeight(items)-current;
        const matched=setHeight(items,id,desired);
        return synchronizeBottom(matched,grouped.widgets[grouped.widgets.length-1].id);
      }
      if(upperIndex>=0){
        // First equalize the two upper columns, then re-align the entire
        // compound group (upper pair + lower span) with World Eras on the left.
        const currentLane=band.lanes[upperIndex];
        const siblings=inside.filter(lane=>lane.id!==currentLane.id);
        const neighbor=siblings.sort((a,b)=>
          Math.abs(laneTotal(a.widgets)-laneTotal(currentLane.widgets))-
          Math.abs(laneTotal(b.widgets)-laneTotal(currentLane.widgets)))[0];
        const target=neighbor
          ?widgetHeightPx(item)+laneTotal(neighbor.widgets)-laneTotal(currentLane.widgets)
          :widgetHeightPx(item);
        const matched=setHeight(items,id,target);
        return synchronizeBottom(matched,grouped.widgets[grouped.widgets.length-1].id);
      }
    }
  }

  // Non-spanning rows keep the previous intuitive nearest-neighbor behavior.
  const stack=laneIndex>=0?band.lanes[laneIndex].widgets:span?.widgets??[];
  if(!stack.length)return [...items];
  const peers=laneIndex>=0
    ?[band.lanes[laneIndex-1],band.lanes[laneIndex+1]]
      .filter((lane):lane is WidgetLayoutLane=>!!lane)
    :band.lanes;
  const adjacent=peers
    .sort((a,b)=>Math.abs(laneTotal(a.widgets)-laneTotal(stack))-
      Math.abs(laneTotal(b.widgets)-laneTotal(stack)))[0];
  const directlyStacked=stack.length===2?stack.find(w=>w.id!==id):undefined;
  const targetHeight=!adjacent&&directlyStacked
    ?widgetHeightPx(directlyStacked)
    :adjacent
      ?laneTotal(adjacent.widgets)-(laneTotal(stack)-displayedHeight(item))-chromeHeight
      :null;
  if(targetHeight===null||!Number.isFinite(targetHeight))return [...items];
  // Keep the historic 8px snap on ordinary lanes; spanning groups use exact
  // pixels so their two bottom edges do not drift 4px apart.
  return setHeight(items,id,Math.round(targetHeight/8)*8);
}

/**
 * The two widget resize affordances are independently configurable per profile.
 * "none" deliberately leaves source and layout records unchanged.
 */
export type WidgetDoubleClickAction="fit-content"|"match-height"|"full-width"|"none";

export function applyWidgetDoubleClickAction(
  items:readonly PageWidget[],
  sections:readonly WidgetPageSection[],
  id:string,
  action:WidgetDoubleClickAction,
  fillGaps=true,
  gap=14,
  chromeHeight=0
):PageWidget[]{
  switch(action){
    case "fit-content":return toggleWidgetContentFit(items,id);
    case "match-height":return matchWidgetAdjacentHeight(items,id,gap,chromeHeight);
    case "full-width":return expandWidgetToSectionWidth(items,sections,id,fillGaps);
    default:return [...items];
  }
}

export function widgetDoubleClickDescription(action:WidgetDoubleClickAction):string{
  switch(action){
    case "fit-content":return "fit the widget contents to their full height";
    case "match-height":return "match the neighboring column or stacked widget height";
    case "full-width":return "move this widget into its own full-width row";
    default:return "do nothing";
  }
}
