import {widgetSectionId,widgetHeightPx,type PageWidget,type WidgetPageSection} from "@/lib/widget-system";
import {widgetBandLocked,widgetBandIdentity,widgetRowPinned,widgetSizeLocked} from "@/lib/widget-formation";
import {defaultWidgetFormationPreferences,type WidgetFormationPreferences} from "@/lib/widget-layout-preferences";

// Layout identity is stored on the placement, not on the database or master
// widget. Bands are horizontal rows, lanes are columns within each band, and
// widgets in the same lane stack vertically. They survive reload and sync.
export type WidgetDropEdge="left"|"right"|"above"|"below"|"replace"|"span-below"|"new-row"|"new-row-before"|"section-end"|"split-span-left"|"split-span-right"|"lower-adjacent-left"|"lower-adjacent-right"|"reorder";
export type WidgetDropTarget={
  sectionId:string;targetId:string|null;edge:WidgetDropEdge;
  spanStartLane?:number;spanLaneCount?:number;
  /** The optional proportion assigned to a newly inserted physical column. */
  newColumnShare?:number;
  /** Split the existing combined region evenly, leaving outside widths alone. */
  preserveGroupWidth?:boolean;
  /** Add the inserted physical lane to an existing merged area. Used when
   * clicking an edge beside a merged widget instead of creating a gap. */
  extendSpanWidgetId?:string;
};
/** A card is never replaced by a drop. Its middle stacks above/below, its
 * sides insert columns, and its narrow bottom edge inserts a full-width row. */
export function widgetDropEdgeAtPoint(width:number,height:number,x:number,y:number,wasNewRow=false):WidgetDropEdge{
  if(height-y>=0&&height-y<=(wasNewRow?38:27))return "new-row";
  if(x/Math.max(1,width)<.22)return "left";
  if(x/Math.max(1,width)>.78)return "right";
  return y/Math.max(1,height)<.5?"above":"below";
}
export type WidgetLayoutLane={id:string;width:number;widgets:PageWidget[]};
export type WidgetLayoutSpan={startLane:number;laneCount:number;widgets:PageWidget[]};
export type WidgetLayoutBand={id:string;lanes:WidgetLayoutLane[];spans?:WidgetLayoutSpan[]};

export const MAX_WIDGET_COLUMNS=4;
export const WIDGET_EDITOR_FOOTER_PX=34;
/** Edit controls live inside the same saved visual footprint as View mode. */
export function widgetFootprintHeight(item:PageWidget,editing:boolean,collapsed=false):number|null{
  if(editing&&collapsed)return 58;
  return item.config.fitContent===true?null:widgetHeightPx(item)+WIDGET_EDITOR_FOOTER_PX;
}
const MIN_WIDTH=2;
// Fractions are essential for 33% + three equal children of the other 67%.
// Persist a small, stable precision rather than rounding back to 12 integers.
const safeWidth=(value:number)=>Math.max(MIN_WIDTH,Math.min(12,Math.round(value*1000)/1000));
const bandId=(item:PageWidget)=>typeof item.config.layoutBand==="string"?item.config.layoutBand:"band-"+item.id;
const laneId=(item:PageWidget)=>typeof item.config.layoutLane==="string"?item.config.layoutLane:"lane-"+item.id;
const rebalance=(band:WidgetLayoutBand)=>{
  // Adding/removing a column redistributes the available width once, on drop.
  // Deliberately never run this as part of a drag-over preview.
  const lanes=band.lanes;
  if(!lanes.length)return;
  const each=12/lanes.length;
  lanes.forEach(lane=>{lane.width=each});
};

const shareNewColumn=(band:WidgetLayoutBand,newLane:WidgetLayoutLane,share:number)=>{
  const existing=band.lanes.filter(lane=>lane!==newLane);
  if(!existing.length)return;
  const desired=Math.max(MIN_WIDTH,Math.min(12-existing.length*MIN_WIDTH,12*share));
  const available=12-desired-existing.length*MIN_WIDTH;
  const original=existing.map(lane=>Math.max(MIN_WIDTH,lane.width));
  const total=original.reduce((sum,width)=>sum+width,0);
  let used=0;
  existing.forEach((lane,index)=>{
    lane.width=index===existing.length-1?12-desired-used:
      MIN_WIDTH+available*original[index]/total;
    used+=lane.width;
  });
  newLane.width=desired;
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
    if(!lane){lane={id:laneId(item),width:safeWidth(Number(item.config.layoutWidth??item.width)),widgets:[]};band.lanes.push(lane)}
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

/** Move an occupied column between its peers, shifting every intervening
 * column one position instead of making an extra column. The width of each
 * visible slot stays put while its widget changes. Merged spans are left
 * intact and require a separate explicit rearrangement operation. */
export function reorderWidgetColumn(
  items:readonly PageWidget[],sections:readonly WidgetPageSection[],movingId:string,overId:string
):PageWidget[]{
  if(movingId===overId)return [...items];
  const group=new Map<string,WidgetLayoutBand[]>();
  for(const sectionId of new Set(["",...sections.map(s=>s.id),...items.map(widgetSectionId)]))
    group.set(sectionId,mutableBands(items.filter(w=>widgetSectionId(w)===sectionId)));
  for(const bands of group.values())for(const band of bands){
    const source=band.lanes.findIndex(l=>l.widgets.some(w=>w.id===movingId));
    const destination=band.lanes.findIndex(l=>l.widgets.some(w=>w.id===overId));
    if(source<0||destination<0)continue;
    if(source===destination||band.spans?.length)return [...items];
    const widths=band.lanes.map(l=>l.width);
    if((band.lanes[source].widgets.some(widgetSizeLocked)||band.lanes[destination].widgets.some(widgetSizeLocked))&&
      Math.abs(widths[source]-widths[destination])>.001)return [...items];
    const [moving]=band.lanes.splice(source,1);
    band.lanes.splice(destination,0,moving);
    band.lanes.forEach((lane,index)=>{lane.width=widths[index]});
    return publish(sections,items,group);
  }
  return [...items];
}

/** Two adjacent lanes can receive a shared spanning widget when their visible
 * bottom edges line up. A single-column stack is still a separate drop zone.
 * Conflicting/overlapping existing spans cannot be nested in a flex row, so
 * these candidates are omitted until the conflicting group is moved.
 */
/** Nested groups are supported: a 2+3 span can later combine with column 1
 * (physical lanes 1+2+3) or with column 4 (physical 2+3+4).
 * A group owns the combined width and displays its span beneath its children.
 */
export type WidgetVisualNode=
  |{kind:"lane";startLane:number;laneCount:1;width:number;lane:WidgetLayoutLane}
  |{kind:"group";startLane:number;laneCount:number;width:number;span:WidgetLayoutSpan;children:WidgetVisualNode[]};
export type WidgetVisualTrack={startLane:number;laneCount:number;width:number;endPx:number;targetId:string};
export type WidgetAlignedPair={startLane:number;laneCount:number;targetId:string;endPx:number;width:number;visualIndex:number};

const intervalEnd=(span:WidgetLayoutSpan)=>span.startLane+span.laneCount;
const containsSpan=(outer:WidgetLayoutSpan,inner:WidgetLayoutSpan)=>
  outer!==inner&&outer.startLane<=inner.startLane&&intervalEnd(outer)>=intervalEnd(inner);
const conflictingSpans=(a:WidgetLayoutSpan,b:WidgetLayoutSpan)=>{
  if(intervalEnd(a)<=b.startLane||intervalEnd(b)<=a.startLane)return false;
  return !containsSpan(a,b)&&!containsSpan(b,a)&&!(a.startLane===b.startLane&&a.laneCount===b.laneCount);
};
/** All contiguous selections exposed by the single purple range guide. */
export function widgetColumnRanges(count:number):{start:number;count:number}[]{
  const valid=Math.max(0,Math.min(MAX_WIDGET_COLUMNS,Math.floor(count)));
  return Array.from({length:valid},(_,start)=>
    Array.from({length:valid-start},(_,offset)=>({start,count:offset+1}))).flat();
}
/** Existing nested spans are safe only for identical, contained or containing
 * ranges. A sideways overlap needs a separate row-layout operation instead. */
export function canPlaceWidgetRange(band:WidgetLayoutBand,start:number,count:number):boolean{
  if(count===1)return start>=0&&start<band.lanes.length&&
    !(band.spans??[]).some(span=>start>=span.startLane&&start<intervalEnd(span));
  if(count<2||start<0||start+count>band.lanes.length)return false;
  const proposed:WidgetLayoutSpan={startLane:start,laneCount:count,widgets:[]};
  return !(band.spans??[]).some(span=>conflictingSpans(span,proposed));
}
export function widgetVisualHierarchy(band:WidgetLayoutBand):WidgetVisualNode[]{
  const spans=band.spans??[];
  const build=(start:number,end:number,excluded?:WidgetLayoutSpan):WidgetVisualNode[]=>{
    const candidates=spans.filter(s=>s!==excluded&&s.startLane>=start&&
      intervalEnd(s)<=end&&s.laneCount>=2);
    const parents=candidates.filter(s=>!candidates.some(other=>containsSpan(other,s)))
      .sort((a,b)=>a.startLane-b.startLane||b.laneCount-a.laneCount);
    const nodes:WidgetVisualNode[]=[];
    for(let i=start;i<end;){
      const group=parents.find(s=>s.startLane===i);
      if(group){
        nodes.push({kind:"group",startLane:i,laneCount:group.laneCount,
          width:band.lanes.slice(i,intervalEnd(group)).reduce((sum,l)=>sum+l.width,0),
          span:group,children:build(i,intervalEnd(group),group)});
        i=intervalEnd(group);
      }else{
        const lane=band.lanes[i];
        if(lane)nodes.push({kind:"lane",startLane:i,laneCount:1,width:lane.width,lane});
        i++;
      }
    }
    return nodes;
  };
  return build(0,band.lanes.length);
}
export function widgetVisualTracks(
  band:WidgetLayoutBand,heightOf:(widget:PageWidget)=>number=widgetHeightPx,gap=14
):WidgetVisualTrack[]{
  const height=(widgets:readonly PageWidget[])=>
    widgets.reduce((sum,w)=>sum+heightOf(w),0)+Math.max(0,widgets.length-1)*gap;
  const heightOfNode=(node:WidgetVisualNode):number=>node.kind==="lane"
    ?height(node.lane.widgets)
    :Math.max(0,...node.children.map(heightOfNode))+gap+height(node.span.widgets);
  const firstId=(node:WidgetVisualNode):string=>node.kind==="lane"
    ?node.lane.widgets[0]?.id??""
    :node.children.map(firstId).find(Boolean)??node.span.widgets[0]?.id??"";
  return widgetVisualHierarchy(band).map(node=>({
    startLane:node.startLane,laneCount:node.laneCount,
    width:node.width,endPx:heightOfNode(node),targetId:firstId(node)
  }));
}
/** Compare the current *visual* columns, including previously merged groups.
 * Equal bottom edges produce a shared Combine bar, but each candidate retains
 * the underlying physical lane interval for durable storage.
 */
export function alignedWidgetColumnPairs(
  band:WidgetLayoutBand,
  heightOf:(widget:PageWidget)=>number=widgetHeightPx,
  gap=14,tolerancePx=12
):WidgetAlignedPair[]{
  const tracks=widgetVisualTracks(band,heightOf,gap),result:WidgetAlignedPair[]=[];
  for(let i=0;i<tracks.length-1;i++){
    const a=tracks[i],b=tracks[i+1];
    if(!a.targetId||!b.targetId||Math.abs(a.endPx-b.endPx)>tolerancePx)continue;
    result.push({startLane:a.startLane,laneCount:a.laneCount+b.laneCount,
      targetId:a.targetId,endPx:Math.max(a.endPx,b.endPx),
      width:a.width+b.width,visualIndex:i});
  }
  return result;
}

const mutableBands=(items:readonly PageWidget[])=>widgetLayoutBands(items).map(b=>({
  ...b,
  lanes:b.lanes.map(l=>({...l,widgets:[...l.widgets]})),
  spans:b.spans?.map(s=>({...s,widgets:[...s.widgets]}))
}));

/** Removing a placement also removes its physical lane when that lane is empty.
 * Repair span anchors by lane identity, then distribute the vacated width.
 * Otherwise the UI keeps a 25% ghost column after deleting one of four. */
export function removeWidgetAndCompactLayout(
  items:readonly PageWidget[],sections:readonly WidgetPageSection[],id:string,fillGaps=true
):PageWidget[]{
  if(!items.some(w=>w.id===id))return [...items];
  const remaining=items.filter(w=>w.id!==id);
  const grouped=new Map<string,WidgetLayoutBand[]>();
  for(const sectionId of new Set(["",...sections.map(s=>s.id),...items.map(widgetSectionId)])){
    const bands=mutableBands(items.filter(w=>widgetSectionId(w)===sectionId));
    const cleaned:WidgetLayoutBand[]=[];
    for(const band of bands){
      const anchors=(band.spans??[]).map(span=>({span,ids:band.lanes
        .slice(span.startLane,span.startLane+span.laneCount).map(lane=>lane.id)}));
      for(const lane of band.lanes)lane.widgets=lane.widgets.filter(w=>w.id!==id);
      band.lanes=band.lanes.filter(lane=>lane.widgets.length>0);
      for(const {span,ids} of anchors){
        span.widgets=span.widgets.filter(w=>w.id!==id);
        if(!span.widgets.length)continue;
        const indices=ids.map(laneId=>band.lanes.findIndex(lane=>lane.id===laneId)).filter(index=>index>=0);
        if(indices.length>=2&&indices[indices.length-1]-indices[0]+1===indices.length){
          span.startLane=indices[0];span.laneCount=indices.length;
        }else{
          // A merged widget cannot remain attached to a deleted lane; keep
          // its record in the nearest surviving lane rather than losing it.
          const lane=band.lanes[Math.max(0,indices[0]??0)];
          if(lane)lane.widgets.push(...span.widgets);
          else band.lanes.push({id:"lane-"+span.widgets[0].id,width:12,widgets:[...span.widgets]});
          span.widgets=[];
        }
      }
      band.spans=band.spans?.filter(span=>span.widgets.length>0);
      if(!band.lanes.length)continue;
      if(fillGaps){
        const total=band.lanes.reduce((sum,lane)=>sum+lane.width,0);
        let consumed=0;
        band.lanes.forEach((lane,index)=>{
          lane.width=index===band.lanes.length-1?Math.round((12-consumed)*1000)/1000
            :Math.round((lane.width/total*12)*1000)/1000;
          consumed+=lane.width;
        });
      }
      cleaned.push(band);
    }
    grouped.set(sectionId,cleaned);
  }
  return publish(sections,remaining,grouped);
}

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
        config.layoutWidth=Math.round(lane.width*1000)/1000;
        // aaa_page_widgets.width is an integer for compatibility with the
        // existing schema; precise proportions are kept in config.layoutWidth.
        result.push({...widget,config,width:Math.max(3,Math.min(12,Math.round(lane.width))),position:result.length});
      }
      for(const span of band.spans??[])for(const widget of span.widgets){
        const width=band.lanes.slice(span.startLane,span.startLane+span.laneCount)
          .reduce((sum,lane)=>sum+lane.width,0);
        const config:Record<string,unknown>={...widget.config,layoutBand:band.id,layoutLane:"span-"+widget.id,
          layoutSpanStart:span.startLane,layoutSpanCount:span.laneCount};
        if(sectionId)config.sectionId=sectionId;else delete config.sectionId;
        config.layoutWidth=Math.round((width||12)*1000)/1000;
        result.push({...widget,config,width:Math.max(3,Math.min(12,Math.round(width||12))),position:result.length});
      }
    }
  }
  return result;
}

/** Pure preview of a drop; persistence happens only after mouse release. */
export function placeWidget(items:readonly PageWidget[],sections:readonly WidgetPageSection[],id:string,target:WidgetDropTarget,fillGaps=true,
  formation:WidgetFormationPreferences=defaultWidgetFormationPreferences):PageWidget[]{
  const moving=items.find(w=>w.id===id);
  if(!moving)return [...items];
  const sameSection=items.filter(w=>widgetSectionId(w)===widgetSectionId(moving));
  const sourceBand=widgetLayoutBands(sameSection).find(b=>b.id===widgetBandIdentity(moving));
  const targetWidget=items.find(w=>w.id===target.targetId);
  const targetBand=targetWidget?widgetLayoutBands(items.filter(w=>widgetSectionId(w)===widgetSectionId(targetWidget)))
    .find(b=>b.id===widgetBandIdentity(targetWidget)):undefined;
  // Locked rows cannot lose members; independently pinned placements may not
  // leave their current row either. Reorder within that row is still valid.
  if((widgetRowPinned(moving)||(sourceBand&&widgetBandLocked([...sourceBand.lanes.flatMap(l=>l.widgets),
      ...(sourceBand.spans??[]).flatMap(s=>s.widgets)])))&&
    (!targetBand||targetBand.id!==sourceBand?.id||target.sectionId!==widgetSectionId(moving)))return [...items];
  if(targetBand&&widgetBandLocked([...targetBand.lanes.flatMap(l=>l.widgets),
      ...(targetBand.spans??[]).flatMap(s=>s.widgets)])&&
    sourceBand?.id!==targetBand.id&&!["replace","new-row","new-row-before"].includes(target.edge))return [...items];
  const group=new Map<string,WidgetLayoutBand[]>();
  for(const sectionId of new Set(["",...sections.map(s=>s.id),...items.map(widgetSectionId),target.sectionId])){
    group.set(sectionId,mutableBands(items.filter(w=>widgetSectionId(w)===sectionId)));
  }
  // Track lane identities through column insertion and removal. Index-only
  // span references otherwise jump to the wrong pair whenever an earlier
  // column is inserted or moved out of the row.
  const spanAnchors=new Map<WidgetLayoutSpan,string[]>();
  for(const bands of group.values())for(const band of bands)
    for(const span of band.spans??[])
      spanAnchors.set(span,band.lanes.slice(span.startLane,span.startLane+span.laneCount).map(l=>l.id));
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
  if(destinationBand&&destinationLane&&target.edge==="span-below"&&destinationBand.lanes.length>=2){
    // A shared Stack target is tied to the specific neighboring pair:
    // 1+2, 2+3 or 3+4. Legacy targets without an index still select
    // the last two columns, preserving existing 67% arrangements.
    const startLane=Number.isInteger(target.spanStartLane)
      ?target.spanStartLane!:destinationBand.lanes.length-2;
    const laneCount=Number.isInteger(target.spanLaneCount)?target.spanLaneCount!:2;
    const hasRoom=startLane>=0&&laneCount>=2&&laneCount<=MAX_WIDGET_COLUMNS&&
      startLane+laneCount<=destinationBand.lanes.length;
    const proposal:WidgetLayoutSpan={startLane,laneCount,widgets:[moving]};
    const overlaps=destinationBand.spans?.some(s=>conflictingSpans(s,proposal));
    if(hasRoom&&!overlaps){
      if(!destinationBand.spans)destinationBand.spans=[];
      let span=destinationBand.spans.find(s=>s.startLane===startLane&&s.laneCount===laneCount);
      if(!span){span={startLane,laneCount,widgets:[]};destinationBand.spans.push(span)}
      span.widgets.push(moving);
    }else{
      // A conflicting span cannot be rendered as another adjacent flex
      // cluster. Preserve the widget as a new full-width band instead.
      destination.splice(destination.indexOf(destinationBand)+1,0,{
        id:uniqueBandId(destination,id),lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]
      });
    }
  }else if(destinationBand&&destinationSpan&&
    (target.edge==="split-span-left"||target.edge==="split-span-right")){
    // Splitting D below B+C must NOT invent a fifth physical column.
    // The inserted widget occupies one edge track of D's existing range;
    // D retains its identity and the remaining contiguous track(s).
    const fromLeft=target.edge==="split-span-left";
    const first=destinationSpan.startLane;
    const last=first+destinationSpan.laneCount-1;
    const splitIndex=fromLeft?first:last;
    const remainingStart=fromLeft?first+1:first;
    const remainingCount=destinationSpan.laneCount-1;
    const splitLane=destinationBand.lanes[splitIndex];
    const survivor=destinationBand.lanes[remainingStart];
    const nestedConflict=(destinationBand.spans??[]).some(span=>span!==destinationSpan&&
      span.startLane>=first&&span.startLane+span.laneCount<=last+1);
    if(splitLane&&survivor&&remainingCount>=1&&!nestedConflict){
      splitLane.widgets.push(moving);
      if(remainingCount===1){
        survivor.widgets.push(...destinationSpan.widgets);
        destinationBand.spans=destinationBand.spans?.filter(span=>span!==destinationSpan);
      }else{
        destinationSpan.startLane=remainingStart;
        destinationSpan.laneCount=remainingCount;
        spanAnchors.set(destinationSpan,destinationBand.lanes
          .slice(remainingStart,remainingStart+remainingCount).map(lane=>lane.id));
      }
    }else{
      // No record is discarded when a nested area cannot safely be split.
      destination.splice(destination.indexOf(destinationBand)+1,0,{
        id:uniqueBandId(destination,id),lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]
      });
    }
  }else if(destinationBand&&destinationSpan&&
    (target.edge==="lower-adjacent-left"||target.edge==="lower-adjacent-right")){
    // A lower merged row has its OWN neighboring empty space. Fill that
    // space beneath the upper widget in the adjacent physical lane; do not
    // add a fourth column to the upper row or split the merged widget.
    const side=target.edge==="lower-adjacent-left"?-1:1;
    const next=side===-1?destinationSpan.startLane-1:
      destinationSpan.startLane+destinationSpan.laneCount;
    const adjacent=destinationBand.lanes[next];
    if(adjacent){
      const sameHeight=destinationSpan.widgets.find(w=>w.id===target.targetId);
      const height=sameHeight?widgetHeightPx(sameHeight):widgetHeightPx(moving);
      adjacent.widgets.push({...moving,config:{...moving.config,fitContent:false,heightPx:height}});
    }else{
      destination.splice(destination.indexOf(destinationBand)+1,0,{
        id:uniqueBandId(destination,id),lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]
      });
    }
  }else if(destinationSpan&&(target.edge==="above"||target.edge==="below")){
    const idx=destinationSpan.widgets.findIndex(w=>w.id===target.targetId);
    destinationSpan.widgets.splice(idx+(target.edge==="below"?1:0),0,moving);
  }else if(destinationBand&&(target.edge==="new-row"||target.edge==="new-row-before")){
    // Separate full-width bands are distinct from in-column stacking.
    // The first section's top guide inserts BEFORE its first band.
    destination.splice(destination.indexOf(destinationBand)+(target.edge==="new-row"?1:0),0,{
      id:uniqueBandId(destination,id),lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]
    });
  }else if(destinationBand&&destinationLane&&target.targetId&&target.targetId!==id&&target.edge==="replace"){
    const targetIndex=destinationLane.widgets.findIndex(w=>w.id===target.targetId);
    const displaced=destinationLane.widgets[targetIndex];
    // Replacing a size-locked widget would relocate its fixed footprint.
    // Reject the change, leaving both data connections untouched.
    if(widgetSizeLocked(displaced)||widgetBandLocked(destinationBand.lanes.flatMap(l=>l.widgets)))return [...items];
    destinationLane.widgets.splice(targetIndex,1,moving);
    if(formation.displacement==="same-column"){
      destinationLane.widgets.splice(targetIndex+1,0,displaced);
    }else{
      destination.splice(destination.indexOf(destinationBand)+1,0,{
        id:uniqueBandId(destination,displaced.id),
        lanes:[{id:"lane-"+displaced.id,width:12,widgets:[displaced]}]
      });
    }
  }else if(destinationBand&&destinationLane&&target.targetId&&target.targetId!==id&&target.edge!=="section-end"){
    const laneIndex=destinationBand.lanes.indexOf(destinationLane);
    if(target.edge==="left"||target.edge==="right"){
      const lockedLanes=destinationBand.lanes.filter(lane=>lane.widgets.some(widgetSizeLocked));
      const lockedWidth=lockedLanes.reduce((sum,lane)=>sum+lane.width,0);
      const freeLanes=destinationBand.lanes.filter(lane=>!lockedLanes.includes(lane));
      const enoughWidth=12-lockedWidth>=MIN_WIDTH*(freeLanes.length+1)-.001;
      if(canInsertWidgetColumn(destinationBand)&&enoughWidth&&
        !widgetBandLocked(destinationBand.lanes.flatMap(lane=>lane.widgets))){
        const insertionIndex=laneIndex+(target.edge==="right"?1:0);
        const newLane:WidgetLayoutLane={id:"lane-"+id,width:3,widgets:[moving]};
        // If insertion comes from the edge of a combined lower widget, keep
        // that lower widget attached to its expanded physical columns.
        // Without this, the top gains a fourth column while the bottom
        // unexpectedly stays attached only to the original two.
        const affectedSpan=target.extendSpanWidgetId
          ?destinationBand.spans?.find(span=>
            span.widgets.some(w=>w.id===target.extendSpanWidgetId))
          :undefined;
        const originalSpanIds=affectedSpan?spanAnchors.get(affectedSpan)??[]:[];
        const originalSpanWidth=destinationBand.lanes
          .filter(lane=>originalSpanIds.includes(lane.id))
          .reduce((sum,lane)=>sum+lane.width,0);
        if(affectedSpan){
          const identities=spanAnchors.get(affectedSpan);
          if(identities?.length&&insertionIndex>=affectedSpan.startLane&&
            insertionIndex<=affectedSpan.startLane+affectedSpan.laneCount){
            const at=insertionIndex-affectedSpan.startLane;
            spanAnchors.set(affectedSpan,[...identities.slice(0,at),newLane.id,...identities.slice(at)]);
            affectedSpan.laneCount+=1;
          }
        }
        destinationBand.lanes.splice(insertionIndex,0,newLane);
        if(target.preserveGroupWidth&&affectedSpan&&
          originalSpanWidth/Math.max(1,(spanAnchors.get(affectedSpan)?.length??0))>=MIN_WIDTH){
          const ids=spanAnchors.get(affectedSpan)??[];
          const shared=originalSpanWidth/ids.length;
          destinationBand.lanes.filter(lane=>ids.includes(lane.id))
            .forEach(lane=>{lane.width=shared});
        }else if(typeof target.newColumnShare==="number"&&Number.isFinite(target.newColumnShare))
          shareNewColumn(destinationBand,newLane,target.newColumnShare);
        else if(lockedLanes.length){
          // Only unlocked neighbors donate space; a 75% size lock stays 75%.
          const newWidth=freeLanes.length===0?12-lockedWidth:MIN_WIDTH;
          const available=12-lockedWidth-newWidth;
          const unlockedTotal=freeLanes.reduce((sum,lane)=>sum+lane.width,0)||1;
          freeLanes.forEach(lane=>{lane.width=available*lane.width/unlockedTotal});
          newLane.width=newWidth;
        }else rebalance(destinationBand);
      }else if(!canInsertWidgetColumn(destinationBand)){
        // Preserve the existing four-column cap behavior: a fifth card may
        // stack vertically without taking any additional horizontal space.
        destinationLane.widgets.splice(target.edge==="left"?0:destinationLane.widgets.length,0,moving);
      }else{
        // A size-locked row has no free horizontal capacity. Do not squeeze
        // the locked card or automatically redistribute its neighbors.
        return [...items];
      }
    }else{
      const targetIndex=destinationLane.widgets.findIndex(w=>w.id===target.targetId);
      destinationLane.widgets.splice(targetIndex+(target.edge==="below"?1:0),0,moving);
    }
  }else{
    destination.push({id:uniqueBandId(destination,id),lanes:[{id:"lane-"+id,width:12,widgets:[moving]}]});
  }
  // Rebase every span onto the SAME TWO lane identities after a reorder.
  // Only if the source pair no longer exists side by side do we extract
  // its contents into full-width rows rather than lose data or overlap.
  for(const bands of group.values()){
    for(let bi=0;bi<bands.length;bi++){
      const band=bands[bi];
      const invalid:WidgetLayoutSpan[]=[];
      const validated:WidgetLayoutSpan[]=[];
      for(const span of [...(band.spans??[])].sort((a,b)=>b.laneCount-a.laneCount)){
        const anchor=spanAnchors.get(span);
        if(anchor){
          const locations=anchor.map(id=>band.lanes.findIndex(l=>l.id===id));
          if(locations.every((index,i)=>index>=0&&(i===0||index===locations[i-1]+1)))
            span.startLane=locations[0];
          else{invalid.push(span);continue}
        }
        if(span.laneCount<2||span.laneCount>MAX_WIDGET_COLUMNS||span.startLane<0||
          span.startLane+span.laneCount>band.lanes.length||
          validated.some(other=>conflictingSpans(other,span))){
          invalid.push(span);continue;
        }
        validated.push(span);
      }
      if(!invalid.length)continue;
      band.spans=(band.spans??[]).filter(span=>!invalid.includes(span));
      let inserted=0;
      for(const span of invalid)for(const widget of span.widgets){
        bands.splice(bi+1+inserted,0,{
          id:uniqueBandId(bands,widget.id),
          lanes:[{id:"lane-"+widget.id,width:12,widgets:[widget]}]
        });
        inserted++;
      }
      bi+=inserted;
    }
  }
  // Existing columns regain available width if an entire lane was moved away.
  // Don't overwrite the widths of a destination band that was only stacked.
  for(const bands of group.values())for(const band of bands){
    const width=band.lanes.reduce((sum,l)=>sum+l.width,0);
    // Three equal children of a 67% group produce repeating decimals. They
    // are complete columns, not a gap that should be snapped to integer slots.
    if(band===destinationBand&&Math.abs(width-12)<.005)continue;
    if(fillGaps&&Math.abs(width-12)>=.005&&
      !widgetBandLocked(band.lanes.flatMap(lane=>lane.widgets))&&
      !band.lanes.some(lane=>lane.widgets.some(widgetSizeLocked)))fillBand(band);
  }
  group.set(target.sectionId,destination);
  return publish(sections,items,group);
}

/** Expand a lower widget into an EMPTY adjacent slot, preserving upper-row
 * column widths. The neighboring column may have its upper widget, but not a
 * second lower widget that would overlap the expanded area. */
export function expandWidgetIntoVacantLane(
  items:readonly PageWidget[],id:string,side:"left"|"right"
):PageWidget[]{
  const widget=items.find(item=>item.id===id);
  if(!widget||widgetSizeLocked(widget))return [...items];
  const band=widgetLayoutBands(items.filter(item=>widgetSectionId(item)===widgetSectionId(widget)))
    .find(b=>b.lanes.some(lane=>lane.widgets.some(item=>item.id===id))||
      b.spans?.some(span=>span.widgets.some(item=>item.id===id)));
  if(!band)return [...items];
  const start=widget.config.layoutSpanStart;
  const count=widget.config.layoutSpanCount;
  const isSpan=typeof start==="number"&&typeof count==="number"&&count>=2;
  const currentStart=isSpan?start:band.lanes.findIndex(lane=>lane.widgets.some(item=>item.id===id));
  const currentCount=isSpan?count:1;
  const ownLane=band.lanes[currentStart];
  if(currentStart<0||(!isSpan&&ownLane.widgets[0]?.id===id))return [...items];
  const neighborIndex=side==="left"?currentStart-1:currentStart+currentCount;
  const neighbor=band.lanes[neighborIndex];
  if(!neighbor||neighbor.widgets.length!==1)return [...items];
  const nextStart=Math.min(currentStart,neighborIndex);
  const nextCount=currentCount+1;
  if(!canPlaceWidgetRange(band,nextStart,nextCount))return [...items];
  const width=band.lanes.slice(nextStart,nextStart+nextCount).reduce((total,lane)=>total+lane.width,0);
  return items.map(item=>item.id===id?{
    ...item,width,config:{...item.config,layoutBand:band.id,
      layoutSpanStart:nextStart,layoutSpanCount:nextCount}
  }:item);
}

/** A lane divider conserves the combined width of its adjacent columns. */
export function resizeWidgetLane(items:readonly PageWidget[],sections:readonly WidgetPageSection[],id:string,delta:number,fillGaps=true,
  formation:WidgetFormationPreferences=defaultWidgetFormationPreferences):PageWidget[]{
  const widget=items.find(w=>w.id===id);if(!widget||!delta||widgetSizeLocked(widget))return [...items];
  const group=new Map<string,WidgetLayoutBand[]>();
  for(const sectionId of new Set(["",...sections.map(s=>s.id),...items.map(widgetSectionId)]))
    group.set(sectionId,mutableBands(items.filter(w=>widgetSectionId(w)===sectionId)));
  const bands=group.get(widgetSectionId(widget))??[];
  const band=bands.find(b=>b.lanes.some(l=>l.widgets.some(w=>w.id===id)));
  const lane=band?.lanes.find(l=>l.widgets.some(w=>w.id===id));
  if(!band||!lane)return [...items];
  const index=band.lanes.indexOf(lane);
  const rowLocked=widgetBandLocked(band.lanes.flatMap(l=>l.widgets));
  const neighbor=band.lanes[index+1]??band.lanes[index-1];
  const occupied=band.lanes.reduce((total,current)=>total+current.width,0);
  // Magnetized boundaries synchronize only while physically touching.
  // An intentionally freed gap must not suddenly consume a neighbor's width.
  const mustShare=rowLocked||(formation.magneticSnapping&&Math.abs(12-occupied)<.005);
  if(mustShare&&neighbor&&!neighbor.widgets.some(widgetSizeLocked)){
    const adjusted=Math.max(MIN_WIDTH-lane.width,Math.min(neighbor.width-MIN_WIDTH,delta));
    lane.width+=adjusted;neighbor.width-=adjusted;
  }else if(!mustShare&&!rowLocked){
    // Independent resize leaves the opposite edge untouched and retains
    // empty capacity, rather than changing a neighboring widget's size.
    const remaining=12-band.lanes.reduce((sum,current)=>sum+current.width,0);
    lane.width=Math.max(MIN_WIDTH,Math.min(12,lane.width+Math.max(MIN_WIDTH-lane.width,Math.min(delta,remaining))));
  }
  if(Math.abs(lane.width-Number(widget.config.layoutWidth??widget.width))<.001)return [...items];
  return publish(sections,items,group);
}

/** Height changes never mutate a data source. With gap filling disabled the
 * next stacked card receives a persisted spacer, so it stays in place. */
export function resizeWidgetHeight(items:readonly PageWidget[],sections:readonly WidgetPageSection[],
  id:string,pixels:number,formation:WidgetFormationPreferences=defaultWidgetFormationPreferences):PageWidget[]{
  const selected=items.find(w=>w.id===id);
  if(!selected||widgetSizeLocked(selected))return [...items];
  const previous=widgetHeightPx(selected);
  const height=Math.max(160,Math.min(1200,Math.round(pixels/8)*8));
  if(height===previous)return [...items];
  let next=items.map(w=>w.id===id?{...w,config:{...w.config,fitContent:false,heightPx:height}}:w);
  if(height>=previous)return next;
  const band=widgetLayoutBands(items.filter(w=>widgetSectionId(w)===widgetSectionId(selected)))
    .find(b=>b.id===widgetBandIdentity(selected));
  const ownLane=band?.lanes.find(l=>l.widgets.some(w=>w.id===id));
  const index=ownLane?.widgets.findIndex(w=>w.id===id)??-1;
  if(formation.fillFreedSpace==="off"){
    const after=ownLane?.widgets[index+1];
    if(after)next=next.map(w=>w.id===after.id?{...w,config:{...w.config,
      layoutOffsetPx:Math.max(0,Number(w.config.layoutOffsetPx??0)+previous-height)}}:w);
  }else if(formation.fillFreedSpace==="left-to-right"&&band&&ownLane&&
    !widgetBandLocked(band.lanes.flatMap(l=>l.widgets))){
    const right=band.lanes.slice(band.lanes.indexOf(ownLane)+1)
      .find(l=>l.widgets.length>1&&l.widgets.some(w=>!widgetSizeLocked(w)&&!widgetRowPinned(w)));
    const candidate=right?.widgets.find(w=>!widgetSizeLocked(w)&&!widgetRowPinned(w));
    if(candidate)next=placeWidget(next,sections,candidate.id,
      {sectionId:widgetSectionId(selected),targetId:id,edge:"below"},false,formation);
  }
  return next;
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
  if(!widget||widgetSizeLocked(widget)||widgetRowPinned(widget)||widget.config.rowLocked===true)return [...items];
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
  if(items.some(widget=>widget.id===id&&widgetSizeLocked(widget)))return [...items];
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
