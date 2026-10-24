"use client";
import {useMemo,useState} from "react";
import {ChevronDown,ChevronRight,CalendarDays,Flag,Dot,Users,ArrowUpRight} from "lucide-react";
import {chronologyAddresses,perspectiveChronologyLabel} from "@/lib/db-engine/hierarchy-numbering";
type EventRow={record_id:string;sequence_no:number;position?:number;values_json:Record<string,string|number|boolean|null>};
type Edge={source_record_id:string;target_record_id:string;property_id:string};
type Pair={record_id:string;character_id:string;event_id:string};
export type ChronologyNode={id:string;parentId:string|null;tier:"Era"|"Major Event"|"Moment";order:number|null;sequence:number;position?:number};
export function toChronologyNodes(events:readonly EventRow[],edges:readonly Edge[],scaleId?:string,parentId?:string,orderId?:string):ChronologyNode[]{
 const validIds=new Set(events.map(e=>e.record_id));
 return events.map(e=>{
  const raw=scaleId?e.values_json[scaleId]:null;
  const tier=raw==="Era"?"Era":raw==="Moment"?"Moment":"Major Event";
  const parent=parentId?edges.find(l=>l.property_id===parentId&&l.source_record_id===e.record_id)?.target_record_id:null;
  const order=orderId?e.values_json[orderId]:null;
  return {id:e.record_id,parentId:parent&&validIds.has(parent)?parent:null,tier,
   order:typeof order==="number"&&Number.isFinite(order)?order:null,sequence:e.sequence_no,position:e.position};
 });
}
export function sortedNodes(nodes:readonly ChronologyNode[]):ChronologyNode[]{
 return [...nodes].sort((a,b)=>{
  if(a.order!==null&&b.order!==null&&a.order!==b.order)return a.order-b.order;
  if(a.order!==null&&b.order===null)return -1;
  if(b.order!==null&&a.order===null)return 1;
  return (a.position??a.sequence)-(b.position??b.sequence)||a.sequence-b.sequence;
 });
}
export default function EventChronologyTree({events,links,pairs,scalePropertyId,parentPropertyId,orderPropertyId,label,onOpenEvent,onOpenPerspective}:{
 events:EventRow[];links:Edge[];pairs:Pair[];
 scalePropertyId?:string;parentPropertyId?:string;orderPropertyId?:string;
 label:(id:string)=>string;onOpenEvent:(id:string)=>void;onOpenPerspective:(id:string)=>void;
}){
 const nodes=useMemo(()=>toChronologyNodes(events,links,scalePropertyId,parentPropertyId,orderPropertyId),
  [events,links,scalePropertyId,parentPropertyId,orderPropertyId]);
 const addresses=useMemo(()=>chronologyAddresses(nodes),[nodes]);
 const [expanded,setExpanded]=useState<string[]>([]);
 const [showUnassigned,setShowUnassigned]=useState(true);
 const has=(id:string)=>expanded.includes(id);
 const toggle=(id:string)=>setExpanded(a=>a.includes(id)?a.filter(v=>v!==id):[...a,id]);
 const childrenFor=(id:string)=>sortedNodes(nodes.filter(e=>e.parentId===id));
 const render=(node:ChronologyNode,depth:number,ancestors:string[]):React.ReactNode=>{
  if(ancestors.includes(node.id))return null;
  const kids=childrenFor(node.id);
  const snapshots=pairs.filter(p=>p.event_id===node.id);
  const canExpand=kids.length>0||snapshots.length>0;
  const open=has(node.id);
  const Icon=node.tier==="Era"?CalendarDays:node.tier==="Major Event"?Flag:Dot;
  return <div key={node.id} className="db-chrono-entry" style={{paddingLeft:Math.min(depth,5)*16}}>
   <div className="db-chrono-item">
    <button className="db-chrono-toggle" disabled={!canExpand} aria-expanded={canExpand?open:undefined}
     aria-label={(open?"Collapse ":"Expand ")+label(node.id)} onClick={()=>toggle(node.id)}>
     {canExpand?open?<ChevronDown size={15}/>:<ChevronRight size={15}/>:<span className="db-chrono-tiny"/>}
    </button>
    <Icon size={15} className="db-chrono-icon"/>
    <button className="db-chrono-name" type="button" onClick={()=>canExpand?toggle(node.id):onOpenEvent(node.id)}>
     <span className="db-chrono-address">{addresses.get(node.id)}</span> {label(node.id)}</button>
    <small>{node.tier}</small>
    {node.order!==null&&<small>#{node.order}</small>}
    <button className="db-chrono-open" type="button" aria-label={"Open "+label(node.id)}
     onClick={()=>onOpenEvent(node.id)}><ArrowUpRight size={14}/></button>
   </div>
   {canExpand&&open&&<div className="db-chrono-children">
     {kids.map(child=>render(child,depth+1,[...ancestors,node.id]))}
     {!!snapshots.length&&<div className="db-chrono-snapshots" style={{paddingLeft:Math.min(depth+1,5)*16}}>
      <div className="db-chrono-subheading"><Users size={13}/> Character Perspectives</div>
      {snapshots.map(p=><button type="button" className="db-chrono-snapshot" key={p.record_id}
       onClick={()=>onOpenPerspective(p.record_id)}>
       <span><span className="db-chrono-address">{perspectiveChronologyLabel(addresses,p.event_id,label(p.character_id))}</span> · {label(p.character_id)} during {label(p.event_id)}</span><ArrowUpRight size={13}/></button>)}
     </div>}
   </div>}
  </div>;
 };
 const roots=sortedNodes(nodes.filter(n=>!n.parentId));
 const eras=roots.filter(n=>n.tier==="Era");
 const loose=roots.filter(n=>n.tier!=="Era");
 return <section className="db-chrono">
  <header><div><span className="db-lab-kicker">WORLD HISTORY</span><h3>Chronology</h3>
   <p>Explore eras, major events, moments and each character’s perspective. Parent links are optional.</p></div>
   <span className="db-chrono-counter">{events.length} events</span>
  </header>
  <div className="db-chrono-section"><span className="db-chrono-section-title">Eras</span>
   {eras.length?eras.map(n=>render(n,0,[])):<p className="db-chrono-empty">No Eras yet. Give an event the Era scale when you are ready.</p>}
  </div>
  {!!loose.length&&<div className="db-chrono-section">
   <button className="db-chrono-section-toggle" type="button" aria-expanded={showUnassigned}
    onClick={()=>setShowUnassigned(v=>!v)}>
    {showUnassigned?<ChevronDown size={15}/>:<ChevronRight size={15}/>}
    Standalone / not yet grouped <span>{loose.length}</span></button>
   {showUnassigned&&loose.map(n=>render(n,0,[]))}
  </div>}
  <p className="db-chrono-hint">Hierarchy numbers recalculate automatically from each Event’s Scale, Parent event, Chronology order and position. Move an Era or Event to renumber its descendants; permanent IDs never change.</p>
 </section>;
}
