"use client";

import {useState} from "react";
import {Check,X} from "lucide-react";
import type {WidgetDefinition} from "@/lib/widget-system";
import {canPlaceWidgetRange,widgetColumnRanges,type WidgetDropTarget,type WidgetLayoutBand}
  from "@/lib/widget-layout";

export type WidgetPlacementChoice={
  target:WidgetDropTarget;
  definitionId:string|null;
  heightMode:"preferred"|"match";
};
type Props={
  band:WidgetLayoutBand;
  target:WidgetDropTarget;
  definitions:WidgetDefinition[];
  onCancel:()=>void;
  onConfirm:(choice:WidgetPlacementChoice)=>void;
};

/** The same layout decision is used by all clickable Arrange Mode guides. */
export default function WidgetPlacementChooser({band,target,definitions,onCancel,onConfirm}:Props){
  const count=band.lanes.length;
  const isColumn=target.edge==="left"||target.edge==="right";
  const isSplit=target.edge==="split-span-left"||target.edge==="split-span-right";
  const isRange=target.edge==="span-below";
  const [start,setStart]=useState(target.spanStartLane??0);
  const [span,setSpan]=useState(target.spanLaneCount??count);
  const [source,setSource]=useState("new");
  const [heightMode,setHeightMode]=useState<"preferred"|"match">("preferred");
  const [spanMode,setSpanMode]=useState<"keep"|"expand">(
    target.extendSpanWidgetId?"expand":"keep");
  const [widthMode,setWidthMode]=useState<"equal"|"group"|"25"|"50"|"75">("equal");
  const ranges=widgetColumnRanges(count).map(range=>({start:range.start,span:range.count}));
  const selectedRange=ranges.some(range=>range.start===start&&range.span===span)
    ?{start,span}:{start:0,span:count};
  const sideSpan=band.spans?.find(group=>
    group.widgets.some(widget=>widget.id===target.extendSpanWidgetId));
  const confirm=()=>{
    let resolved={...target};
    if(isRange){
      const lane=band.lanes[selectedRange.start];
      const item=lane?.widgets[lane.widgets.length-1];
      if(!item)return;
      resolved={sectionId:target.sectionId,targetId:item.id,
        edge:selectedRange.span===1?"below":"span-below",
        ...(selectedRange.span>1?{
          spanStartLane:selectedRange.start,spanLaneCount:selectedRange.span
        }:{})};
    }else if(isColumn){
      if(spanMode==="keep")delete resolved.extendSpanWidgetId;
      if(widthMode==="group"&&resolved.extendSpanWidgetId)resolved.preserveGroupWidth=true;
      else if(widthMode==="25"||widthMode==="50"||widthMode==="75")
        resolved.newColumnShare=Number(widthMode)/100;
    }
    onConfirm({target:resolved,definitionId:source==="new"?null:source,heightMode});
  };
  const label=isColumn?"Add a column":isSplit?"Divide a combined widget":
    isRange?"Choose a column range":
    target.edge==="new-row"||target.edge==="new-row-before"?"Add a full-width row":
    "Stack a widget";
  return <div className="aaa-widget-placement-backdrop" onMouseDown={event=>{
    if(event.target===event.currentTarget)onCancel();
  }}>
    <div className="aaa-widget-placement-dialog" role="dialog" aria-modal="true"
      aria-labelledby="aaa-widget-placement-title" onKeyDown={event=>{
        if(event.key==="Escape"){event.stopPropagation();onCancel();}
      }}>
      <header>
        <div><small>ARRANGE MODE</small><h3 id="aaa-widget-placement-title">{label}</h3>
          <p>Choose the region before creating or importing a widget.</p></div>
        <button type="button" onClick={onCancel} aria-label="Close placement chooser"><X size={17}/></button>
      </header>
      {isRange&&<div className="aaa-widget-placement-field">
        <strong>Where should the widget span?</strong>
        <div className="aaa-widget-placement-grid" style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>
          {band.lanes.map((lane,i)=><span key={lane.id}
            className={i>=selectedRange.start&&i<selectedRange.start+selectedRange.span?"selected":""}>
            {i+1}</span>)}
        </div>
        <div className="aaa-widget-placement-ranges">
          {ranges.map(range=><button type="button" key={range.start+"-"+range.span}
            className={range.start===selectedRange.start&&range.span===selectedRange.span?"selected":""}
            aria-pressed={range.start===selectedRange.start&&range.span===selectedRange.span}
            disabled={!canPlaceWidgetRange(band,range.start,range.span)}
            title={!canPlaceWidgetRange(band,range.start,range.span)
              ?"This range overlaps an existing combination. Split it first.":undefined}
            onClick={()=>{setStart(range.start);setSpan(range.span)}}>
            {range.span===1?`Column ${range.start+1}`:`${range.start+1}–${range.start+range.span}`}
          </button>)}
        </div>
        <p>One column stacks vertically. Two or more create a combined widget beneath that range.</p>
        {ranges.some(range=>!canPlaceWidgetRange(band,range.start,range.span))&&
          <p>Unavailable ranges cross an existing combined widget. Divide that widget first to preserve its layout.</p>}
      </div>}
      {isColumn&&<div className="aaa-widget-placement-field">
        <strong>Column widths</strong>
        <div className="aaa-widget-placement-options">
          <label><input type="radio" checked={widthMode==="equal"} onChange={()=>setWidthMode("equal")}/>
            Equal-width columns (default)</label>
          {count===1&&(["25","50","75"] as const).map(value=>
            <label key={value}><input type="radio" checked={widthMode===value}
              onChange={()=>setWidthMode(value)}/> New widget uses {value}%</label>)}
          {sideSpan&&<label><input type="radio" checked={widthMode==="group"}
            onChange={()=>{setWidthMode("group");setSpanMode("expand")}}/>
            Divide the combined group&apos;s current width evenly</label>}
        </div>
        {sideSpan&&<><strong>Neighboring combined widget</strong>
          <div className="aaa-widget-placement-options">
            <label><input type="radio" checked={spanMode==="keep"} onChange={()=>{setSpanMode("keep");if(widthMode==="group")setWidthMode("equal")}}/>
              Keep its original column coverage</label>
            <label><input type="radio" checked={spanMode==="expand"} onChange={()=>setSpanMode("expand")}/>
              Extend it across the new column</label>
          </div></>}
      </div>}
      {isSplit&&<div className="aaa-widget-placement-field">
        <strong>Existing physical columns stay in place</strong>
        <p>The new widget takes the {target.edge==="split-span-left"?"left":"right"} edge column
          of this combined region. The existing widget retains the remaining columns.</p>
      </div>}
      <div className="aaa-widget-placement-field">
        <label htmlFor="aaa-widget-placement-source"><strong>Widget source</strong></label>
        <select id="aaa-widget-placement-source" value={source} onChange={event=>setSource(event.target.value)}>
          <option value="new">Create new reusable widget</option>
          {definitions.map(def=><option key={def.id} value={def.id}>{def.name}</option>)}
        </select>
        <strong>Initial height</strong>
        <div className="aaa-widget-placement-options">
          <label><input type="radio" checked={heightMode==="preferred"}
            onChange={()=>setHeightMode("preferred")}/> Widget&apos;s preferred height</label>
          <label><input type="radio" checked={heightMode==="match"}
            onChange={()=>setHeightMode("match")}/> Match the adjacent widget height</label>
        </div>
      </div>
      <footer>
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="aaa-widget-primary" onClick={confirm}>
          <Check size={15}/> Place widget
        </button>
      </footer>
    </div>
  </div>;
}
