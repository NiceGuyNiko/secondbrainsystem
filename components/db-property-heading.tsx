"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
export type EditableProperty={
 id:string;database_id:string;name:string;type:string;version:number;
 archived_at?:string|null;
 config:{options?:string[];target_database_id?:string;multi?:boolean};
};
type Props={property:EditableProperty;onRefresh:()=>Promise<void>;onError:(message:string)=>void;onSaved:(message:string)=>void};
const errText=(error:unknown)=>error instanceof Error?error.message:String(error);
/** Notion-like property heading: click to rename or archive, without deleting values. */
export function DatabasePropertyHeading({property,onRefresh,onError,onSaved}:Props){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState(property.name);
 const [busy,setBusy]=useState(false);
 useEffect(()=>setDraft(property.name),[property.name,property.id]);
 const rename=async()=>{
  const name=draft.trim();
  if(!name||name.length>80){onError("Property names need 1–80 characters.");return;}
  if(name===property.name){setOpen(false);return;}
  setBusy(true);
  try {
   const {data,error}=await supabase.from("db_properties").update({name}).eq("id",property.id)
    .eq("database_id",property.database_id).eq("version",property.version).select("id").maybeSingle();
   if(error)throw error;
   if(!data)throw new Error("The property changed elsewhere. Reload and try again.");
   await onRefresh();onSaved("Property renamed; existing values and links preserved.");setOpen(false);
  }catch(e){onError(errText(e))}finally{setBusy(false)}
 };
 const archive=async()=>{
  if(!window.confirm("Remove the “"+property.name+"” column from this database? All saved values and relationships remain stored and the column can be restored later."))return;
  setBusy(true);
  try{
   const {data,error}=await supabase.from("db_properties").update({archived_at:new Date().toISOString()})
    .eq("id",property.id).eq("database_id",property.database_id).eq("version",property.version)
    .select("id").maybeSingle();
   if(error)throw error;
   if(!data)throw new Error("The property changed elsewhere. Reload and try again.");
   await onRefresh();onSaved("Column removed from view. Values are preserved; restore it from Properties.");setOpen(false);
  }catch(e){onError(errText(e))}finally{setBusy(false)}
 };
 return <div className="db-notion-heading">
  <button type="button" className="db-notion-heading-trigger" aria-label={"Edit property "+property.name}
   aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
   <span>{property.name}</span><span aria-hidden="true">⌄</span>
  </button>
  <small>{property.type}</small>
  {open&&<div className="db-notion-property-menu" role="group" aria-label={"Manage "+property.name}>
   <label>Property name
    <input aria-label={"Rename "+property.name} value={draft} maxLength={80}
      onChange={e=>setDraft(e.target.value)}
      onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void rename();}if(e.key==="Escape")setOpen(false)}}/>
   </label>
   <p>{property.type==="relation"?"Relation target is preserved on rename.":"Changing the name doesn't change values."}</p>
   <div className="db-notion-property-actions">
    <button type="button" disabled={busy} onClick={()=>void rename()}>Save name</button>
    <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button>
   </div>
   <button type="button" className="db-notion-property-remove" disabled={busy} onClick={()=>void archive()}>
    Remove column (reversible)
   </button>
  </div>}
 </div>;
}
export function RestoreDatabaseProperties({archived,dbId,onRefresh,onError,onSaved}:{
 archived:EditableProperty[];dbId:string;onRefresh:()=>Promise<void>;onError:(message:string)=>void;onSaved:(message:string)=>void;
}){
 const list=archived.filter(p=>p.database_id===dbId);
 if(!list.length)return null;
 return <div className="db-notion-archived">
  <strong>Removed columns ({list.length})</strong>
  {list.map(p=><div key={p.id}><span>{p.name} · {p.type}</span>
    <button type="button" onClick={()=>void(async()=>{
      const {data,error}=await supabase.from("db_properties").update({archived_at:null})
        .eq("id",p.id).eq("database_id",dbId).eq("version",p.version).select("id").maybeSingle();
      if(error){onError(error.message);return;}
      if(!data){onError("The column changed elsewhere. Reload to retry.");return;}
      try{await onRefresh();onSaved("Column restored with its saved values.");}catch(e){onError(errText(e))}
    })()}>Restore</button></div>)}
 </div>;
}
