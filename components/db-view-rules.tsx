"use client";
import {useEffect,useRef,useState} from "react";
import {Filter,ArrowDownUp,Plus,X} from "lucide-react";
import {type ViewFilter,type ViewSort,type QueryMode} from "@/lib/db-engine/view-operators";
type Field={id:string;name:string;type:string;options?:string[]};
type Props={fields:Field[];filters:ViewFilter[];filterMode:QueryMode;sorts:ViewSort[];onFilters:(filters:ViewFilter[],mode:QueryMode)=>void;onSorts:(sorts:ViewSort[])=>void};
const ops=[["contains","Contains"],["does_not_contain","Does not contain"],["is","Is"],["is_not","Is not"],["is_empty","Is empty"],["is_not_empty","Is not empty"]] as const;
function PickerSelect({fields,value,onChange}:{fields:Field[];value:string;onChange:(value:string)=>void}){
 return <select aria-label="Filter or sort property" value={value} onChange={e=>onChange(e.target.value)}>{fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>;
}
export default function ViewRulesMenu({fields,filters,filterMode,sorts,onFilters,onSorts}:Props){
 const [panel,setPanel]=useState<"filter"|"sort"|null>(null);
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!panel)return;
  const close=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setPanel(null)};
  const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")setPanel(null)};
  document.addEventListener("pointerdown",close);document.addEventListener("keydown",escape);
  return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",escape)};
 },[panel]);
 const addFilter=()=>onFilters([...filters,{id:crypto.randomUUID(),field:"name",operator:"contains",value:""}],filterMode);
 const addSort=()=>onSorts([...sorts,{id:crypto.randomUUID(),field:"name",direction:"asc"}]);
 const editFilter=(id:string,patch:Partial<ViewFilter>)=>onFilters(filters.map(f=>f.id===id?{...f,...patch}:f),filterMode);
 const editSort=(id:string,patch:Partial<ViewSort>)=>onSorts(sorts.map(s=>s.id===id?{...s,...patch}:s));
 return <div className="db-rules-root" ref={root}>
  <div className="db-rules-actions">
   <button className={"db-rules-trigger "+(filters.length?"active":"")} type="button" aria-expanded={panel==="filter"} onClick={()=>setPanel(x=>x==="filter"?null:"filter")}><Filter size={14}/> Filter{filters.length?" · "+filters.length:""}</button>
   <button className={"db-rules-trigger "+(sorts.length?"active":"")} type="button" aria-expanded={panel==="sort"} onClick={()=>setPanel(x=>x==="sort"?null:"sort")}><ArrowDownUp size={14}/> Sort{sorts.length?" · "+sorts.length:""}</button>
  </div>
  {panel&&<section className="db-rules-popover" aria-label={panel==="filter"?"Filter records":"Sort records"}>
   <header><strong>{panel==="filter"?"Filter records":"Sort records"}</strong><button aria-label="Close menu" type="button" onClick={()=>setPanel(null)}><X size={15}/></button></header>
   {panel==="filter"?<>
    {filters.length>1&&<div className="db-rules-mode"><span>Match</span><select aria-label="Filter combination" value={filterMode} onChange={e=>onFilters(filters,e.target.value as QueryMode)}><option value="all">All conditions (AND)</option><option value="any">Any condition (OR)</option></select></div>}
    {filters.map(f=>{
     const meta=fields.find(x=>x.id===f.field);
     return <div className="db-rule-line" key={f.id}>
      <PickerSelect fields={fields} value={f.field} onChange={field=>editFilter(f.id,{field,value:""})}/>
      <select aria-label="Filter operator" value={f.operator} onChange={e=>editFilter(f.id,{operator:e.target.value as ViewFilter["operator"]})}>{ops.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      {f.operator!=="is_empty"&&f.operator!=="is_not_empty"&&(meta?.type==="select"&&meta.options?.length?
       <select aria-label="Filter value" value={f.value} onChange={e=>editFilter(f.id,{value:e.target.value})}><option value="">Choose…</option>{meta.options.map(o=><option key={o} value={o}>{o}</option>)}</select>
       :<input aria-label="Filter value" placeholder="Value…" value={f.value} onChange={e=>editFilter(f.id,{value:e.target.value})}/>)}
      <button type="button" aria-label="Remove filter" onClick={()=>onFilters(filters.filter(x=>x.id!==f.id),filterMode)}><X size={15}/></button>
     </div>;
    })}
    <button type="button" className="db-rules-add" onClick={addFilter}><Plus size={14}/> Add filter</button>
    {!!filters.length&&<button type="button" className="db-rules-clear" onClick={()=>onFilters([],"all")}>Clear filters</button>}
   </>:<>
    {sorts.map((s,i)=><div className="db-rule-line" key={s.id}>
      <span className="db-rules-index">{i+1}</span><PickerSelect fields={fields} value={s.field} onChange={field=>editSort(s.id,{field})}/>
      <select aria-label="Sort direction" value={s.direction} onChange={e=>editSort(s.id,{direction:e.target.value as ViewSort["direction"]})}><option value="asc">Ascending</option><option value="desc">Descending</option></select>
      <button type="button" aria-label="Move sort up" disabled={i===0} onClick={()=>{const copy=[...sorts];[copy[i-1],copy[i]]=[copy[i],copy[i-1]];onSorts(copy)}}>↑</button>
      <button type="button" aria-label="Remove sort" onClick={()=>onSorts(sorts.filter(x=>x.id!==s.id))}><X size={15}/></button>
    </div>)}
    <button type="button" className="db-rules-add" onClick={addSort}><Plus size={14}/> Add sort</button>
    {!!sorts.length&&<button type="button" className="db-rules-clear" onClick={()=>onSorts([])}>Clear sorts</button>}
   </>}
  </section>}
 </div>;
}
