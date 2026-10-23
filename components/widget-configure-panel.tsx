"use client";
import {useEffect,useState} from "react";
import {Check,Database,Plus,Save,Settings2,Trash2,X} from "lucide-react";
import type {WidgetConfigureTarget,WidgetConfig} from "@/lib/widget-system";

export default function WidgetConfigurePanel({selection,onClose,onEditDatabase}:{selection:WidgetConfigureTarget;onClose:()=>void;onEditDatabase?:(id:string)=>void}){
  const [name,setName]=useState(selection.title);
  const [message,setMessage]=useState("");
  const [creatingSource,setCreatingSource]=useState(false);
  const [sourceName,setSourceName]=useState("");
  const [savingSource,setSavingSource]=useState(false);
  useEffect(()=>{setName(selection.title);setMessage("")},[selection.id,selection.title]);
  const cfg=selection.config;
  const fields=[{id:"name",name:"Name"},{id:"creation",name:"Record ID"},
    ...selection.properties.filter(p=>p.database_id===selection.databaseId).map(p=>({id:p.id,name:p.name}))];
  const props=selection.properties.filter(p=>p.database_id===selection.databaseId);
  const savedViews=selection.views.filter(v=>v.database_id===selection.databaseId);
  const change=(patch:Partial<WidgetConfig>)=>selection.onConfig(patch);
  return <div className="aaa-widget-config" aria-label="Configure widget">
    <div className="aaa-widget-config-head"><span><Settings2 size={17}/> Configure</span><button onClick={onClose} aria-label="Close widget configuration">Done <Check size={15}/></button></div>
    <p className="aaa-widget-config-sub">{selection.kind==="instance"?"Page-specific view. Changes stay on this page until you save them to the master widget.":"Master widget. Changes apply to all instances without a local override."}</p>
    <label className="aaa-widget-field">Widget name
      <input value={name} maxLength={100} onChange={e=>setName(e.target.value)} onBlur={()=>{if(name.trim()&&name.trim()!==selection.title)selection.onRename(name.trim())}} onKeyDown={e=>{if(e.key==="Enter"){e.currentTarget.blur()}}}/>
    </label>
    <div className="aaa-widget-config-group"><strong>Data source &amp; view</strong>
      <label className="aaa-widget-field">Database
        <select value={selection.databaseId??""} onChange={e=>selection.onSource(e.target.value||null,null)}>
          <option value="">Choose a database</option>
          {selection.databases.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label className="aaa-widget-field">Saved database view
        <select value={selection.viewId??""} onChange={e=>selection.onSource(selection.databaseId,e.target.value||null)}>
          <option value="">All records</option>
          {savedViews.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </label>
      <div className="aaa-widget-config-source-actions">
        {selection.databaseId&&<button type="button" onClick={()=>onEditDatabase?.(selection.databaseId!)}><Database size={14}/> Edit database properties</button>}
        {selection.onCreateDatabase&&<button type="button" onClick={()=>setCreatingSource(true)}><Plus size={14}/> Create new database</button>}
      </div>
      {creatingSource&&<form className="aaa-widget-create-row aaa-widget-config-new-source" onSubmit={async e=>{
        e.preventDefault();const trimmed=sourceName.trim();if(!trimmed||!selection.onCreateDatabase||savingSource)return;
        setSavingSource(true);setMessage("");
        try{const id=await selection.onCreateDatabase(trimmed);setCreatingSource(false);setSourceName("");onEditDatabase?.(id);setMessage(`Created ${trimmed}. Edit its properties in the second Context panel.`)}
        catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setSavingSource(false)}
      }}>
        <input autoFocus aria-label="New database name for widget" value={sourceName} placeholder="New database name…" onChange={e=>setSourceName(e.target.value)}/>
        <button type="submit" disabled={!sourceName.trim()||savingSource}><Check size={14}/> Create and connect</button>
        <button type="button" onClick={()=>setCreatingSource(false)} aria-label="Cancel database creation"><X size={14}/></button>
      </form>}
      <label className="aaa-widget-field">Display style
        <select value={cfg.renderer} onChange={e=>change({renderer:e.target.value as WidgetConfig["renderer"]})}>
          <option value="table">Table</option><option value="list">List</option>
          <option value="cards">Cards</option><option value="timeline">Timeline</option>
        </select>
      </label>
    </div>
    <div className="aaa-widget-config-group"><strong>Filter records</strong>
      <div className="aaa-widget-inline"><span>Match</span><select aria-label="Filter combination" value={cfg.filterMode} onChange={e=>change({filterMode:e.target.value as "all"|"any"})}><option value="all">All conditions (AND)</option><option value="any">Any condition (OR)</option></select></div>
      {cfg.filters.map(f=><div className="aaa-widget-rule" key={f.id}>
        <select aria-label="Filter property" value={f.field} onChange={e=>change({filters:cfg.filters.map(x=>x.id===f.id?{...x,field:e.target.value}:x)})}>{fields.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <select aria-label="Filter operator" value={f.operator} onChange={e=>change({filters:cfg.filters.map(x=>x.id===f.id?{...x,operator:e.target.value as typeof f.operator}:x)})}>
          <option value="is">Is</option><option value="is_not">Is not</option><option value="contains">Contains</option><option value="does_not_contain">Does not contain</option><option value="is_empty">Is empty</option><option value="is_not_empty">Is not empty</option>
        </select>
        {!f.operator.includes("empty")&&<input aria-label="Filter value" value={f.value} placeholder="Value" onChange={e=>change({filters:cfg.filters.map(x=>x.id===f.id?{...x,value:e.target.value}:x)})}/>}
        <button aria-label="Remove filter" onClick={()=>change({filters:cfg.filters.filter(x=>x.id!==f.id)})}><Trash2 size={15}/></button>
      </div>)}
      <button className="aaa-widget-add-rule" onClick={()=>change({filters:[...cfg.filters,{id:crypto.randomUUID(),field:"name",operator:"contains",value:""}]})}><Plus size={14}/> Add filter</button>
      <label className="aaa-widget-field">Contextual scope (optional)
        <select value={cfg.scopeField} onChange={e=>change({scopeField:e.target.value,scopeValue:""})}>
          <option value="">All records</option>{fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      {cfg.scopeField&&<input className="aaa-widget-input" aria-label="Scope value" placeholder="Only records matching…" value={cfg.scopeValue} onChange={e=>change({scopeValue:e.target.value})}/>}
    </div>
    <div className="aaa-widget-config-group"><strong>Sort</strong>
      {cfg.sorts.map(s=><div className="aaa-widget-rule" key={s.id}>
        <select aria-label="Sort property" value={s.field} onChange={e=>change({sorts:cfg.sorts.map(x=>x.id===s.id?{...x,field:e.target.value}:x)})}>{fields.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <select aria-label="Sort direction" value={s.direction} onChange={e=>change({sorts:cfg.sorts.map(x=>x.id===s.id?{...x,direction:e.target.value as "asc"|"desc"}:x)})}><option value="asc">Ascending</option><option value="desc">Descending</option></select>
        <button aria-label="Remove sort" onClick={()=>change({sorts:cfg.sorts.filter(x=>x.id!==s.id)})}><Trash2 size={15}/></button>
      </div>)}
      <button className="aaa-widget-add-rule" onClick={()=>change({sorts:[...cfg.sorts,{id:crypto.randomUUID(),field:"name",direction:"asc"}]})}><Plus size={14}/> Add sort</button>
    </div>
    <div className="aaa-widget-config-group"><strong>Properties</strong>
      <p>Choose which columns appear. None selected means the default set.</p>
      <div className="aaa-widget-property-options">{props.map(prop=><label key={prop.id}><input type="checkbox" checked={cfg.visibleProperties.includes(prop.id)} onChange={e=>change({visibleProperties:e.target.checked?[...cfg.visibleProperties,prop.id]:cfg.visibleProperties.filter(id=>id!==prop.id)})}/>{prop.name}</label>)}</div>
      {!!cfg.visibleProperties.length&&<button className="aaa-widget-add-rule" onClick={()=>change({visibleProperties:[]})}>Restore default columns</button>}
    </div>
    <div className="aaa-widget-config-group"><strong>Appearance &amp; size</strong>
      <div className="aaa-widget-config-pair"><label className="aaa-widget-field">Density<select value={cfg.density} onChange={e=>change({density:e.target.value as WidgetConfig["density"]})}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
      <label className="aaa-widget-field">Accent<select value={cfg.color} onChange={e=>change({color:e.target.value as WidgetConfig["color"]})}><option value="theme">Theme</option><option value="gold">Gold</option><option value="blue">Blue</option><option value="green">Green</option></select></label></div>
      {selection.onSize&&<div className="aaa-widget-config-pair"><label className="aaa-widget-field">Width<select value={selection.width??6} onChange={e=>selection.onSize?.(Number(e.target.value),selection.height??2)}>
        {[3,4,6,8,9,12].map(x=><option key={x} value={x}>{x===12?"Full · 100%":x===3?"Small · 25%":x===4?"Third · 33%":x===6?"Medium · 50%":x===8?"Wide · 67%":"Large · 75%"}</option>)}
        {![3,4,6,8,9,12].includes(selection.width??6)&&<option value={selection.width}>{Math.round((selection.width??6)/12*100)}% custom</option>}
      </select></label><label className="aaa-widget-field">Height (px)
        <input type="number" min={160} max={1200} step={8} value={selection.heightPx??280} onChange={e=>selection.onHeightPx?.(Number(e.target.value))} />
      </label></div>}
      {selection.onHeightPx&&<p>Width snaps to useful column sizes. Drag the corner for fluid height and width adjustments; neighboring stacks keep their own heights.</p>}
      {selection.synced&&<p className="aaa-widget-sync-notice">Widget Sync is on. Configuration changes here update every member of this sync group. Position, section, width and height stay local to each page.</p>}
    </div>
    <div className="aaa-widget-config-group"><strong>Interaction</strong>
      {([["showTitle","Show widget title"],["showDatabase","Show database name under title"],["showViewTag","Show connected-view label"],["editable","Allow record editing"],["allowCreate","Allow new records"],["exposeFilters","Show filter controls in Use mode"],["exposeSorts","Show sort controls in Use mode"]] as const).map(([key,label])=><label className="aaa-widget-switch" key={key}><span>{label}</span><input type="checkbox" checked={cfg[key]} onChange={e=>change({[key]:e.target.checked})}/></label>)}
      <label className="aaa-widget-field">Open records
        <select value={cfg.openBehavior} onChange={e=>change({openBehavior:e.target.value as WidgetConfig["openBehavior"]})}><option value="detail">Quick detail</option><option value="source">Original database page</option></select>
      </label>
    </div>
    {selection.onSaveToDefinition&&<button className="aaa-widget-save-master" onClick={()=>{selection.onSaveToDefinition?.();setMessage("Saved this view to the reusable widget.")}}><Save size={15}/> Save view to main widget</button>}
    {message&&<p role="status" className="aaa-widget-config-sub">{message}</p>}
  </div>;
}
