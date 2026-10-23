"use client";
import {useState} from "react";
import {Check,Database,Plus,X} from "lucide-react";
import {numberFormatOf,NUMBER_DISPLAY_OPTIONS} from "@/lib/db-property-format";
import type {WidgetConfigureTarget} from "@/lib/widget-system";

const types=["text","number","date","checkbox","select","relation"];

export default function WidgetDatabaseEditorPanel({target,databaseId,onClose}:{target:WidgetConfigureTarget;databaseId:string;onClose:()=>void}){
  const [propertyName,setPropertyName]=useState("");
  const [propertyType,setPropertyType]=useState("text");
  const [creating,setCreating]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const database=target.databases.find(db=>db.id===databaseId);
  const props=target.properties.filter(p=>p.database_id===databaseId).sort((a,b)=>a.position-b.position);
  const save=async(op:()=>Promise<void>)=>{
    setSaving(true);setError("");
    try{await op()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setSaving(false)}
  };
  return <section className="aaa-widget-db-editor" aria-label="Edit source database properties">
    <header><div><span><Database size={14}/> SOURCE DATABASE</span><strong>{database?.name||"New database"}</strong><small>Canonical properties · edits affect all views</small></div>
      <button onClick={onClose} aria-label="Close database property editor"><X size={16}/></button></header>
    <p>You&apos;re editing the original database structure. Properties created here are available immediately in this widget and every other view of this database.</p>
    {error&&<div className="aaa-widget-alert" role="alert">{error}</div>}
    <div className="aaa-widget-db-editor-heading"><strong>Properties ({props.length})</strong>
      <button onClick={()=>setCreating(true)}><Plus size={14}/> Add property</button></div>
    {creating&&<form className="aaa-widget-db-editor-create" onSubmit={e=>{e.preventDefault();if(!propertyName.trim()||!target.onAddProperty)return;
      void save(async()=>{await target.onAddProperty!(databaseId,propertyName.trim(),propertyType);setPropertyName("");setCreating(false)})}}>
      <input autoFocus aria-label="New source property name" placeholder="Property name…" value={propertyName} onChange={e=>setPropertyName(e.target.value)}/>
      <select aria-label="New source property type" value={propertyType} onChange={e=>setPropertyType(e.target.value)}>{types.map(type=><option key={type}>{type}</option>)}</select>
      <button type="submit" disabled={!propertyName.trim()||saving}><Check size={14}/> Add</button>
      <button type="button" onClick={()=>setCreating(false)} aria-label="Cancel property"><X size={14}/></button>
    </form>}
    <div className="aaa-widget-db-editor-fields">{props.map(field=><div key={field.id}>
      <input aria-label={`Rename property ${field.name}`} defaultValue={field.name} key={field.id+field.name}
        onBlur={e=>{const name=e.target.value.trim();if(name&&name!==field.name&&target.onUpdateProperty)void save(()=>target.onUpdateProperty!(field.id,{name}))}}/>
      <select aria-label={`Type of property ${field.name}`} value={field.type} disabled={saving}
        onChange={e=>{if(target.onUpdateProperty)void save(()=>target.onUpdateProperty!(field.id,{type:e.target.value}))}}>{types.map(type=><option key={type}>{type}</option>)}</select>

      {field.type==="number"&&<label className="aaa-widget-db-property-format">Display
        <select aria-label={`Display format for ${field.name}`} value={numberFormatOf(field)} disabled={saving}
          onChange={e=>{if(target.onUpdateProperty)void save(()=>target.onUpdateProperty!(field.id,{config:{...field.config,numberFormat:e.target.value}}))}}>
          {NUMBER_DISPLAY_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>}
      {field.type==="date"&&<label className="aaa-widget-db-property-format">Date display
        <select aria-label={`Date display for ${field.name}`} value={typeof field.config.dateFormat==="string"?field.config.dateFormat:"iso"} disabled={saving}
          onChange={e=>{if(target.onUpdateProperty)void save(()=>target.onUpdateProperty!(field.id,{config:{...field.config,dateFormat:e.target.value}}))}}>
          <option value="iso">ISO</option><option value="short">Short date</option><option value="long">Long date</option>
        </select>
      </label>}
      {field.type==="checkbox"&&<label className="aaa-widget-db-property-format">Checkbox display
        <select aria-label={`Checkbox display for ${field.name}`} value={typeof field.config.checkboxFormat==="string"?field.config.checkboxFormat:"yes-no"} disabled={saving}
          onChange={e=>{if(target.onUpdateProperty)void save(()=>target.onUpdateProperty!(field.id,{config:{...field.config,checkboxFormat:e.target.value}}))}}>
          <option value="yes-no">Yes / No</option><option value="done">Done / Not done</option><option value="icon">✓ / ○</option>
        </select>
      </label>}
    </div>)}{!props.length&&<p>No properties yet. Add one to start designing your database.</p>}</div>
  </section>;
}
