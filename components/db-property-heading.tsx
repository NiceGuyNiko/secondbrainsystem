"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {supabase} from "@/lib/supabase";
export type EditableProperty={
 id:string;database_id:string;name:string;type:string;version:number;
 archived_at?:string|null;
 config:{options?:string[];target_database_id?:string;multi?:boolean};
};
type Props={property:EditableProperty;onRefresh:()=>Promise<void>;onError:(message:string)=>void;onSaved:(message:string)=>void};
const errText=(error:unknown)=>error instanceof Error?error.message:String(error);
/** A floating, click-away-safe property menu. It never changes table row height. */
export function DatabasePropertyHeading({property,onRefresh,onError,onSaved}:Props){
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState(property.name);
 const [busy,setBusy]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null);
 const [place,setPlace]=useState({left:8,top:8});
 useEffect(()=>setDraft(property.name),[property.name,property.id]);
 useEffect(()=>{
  if(!open)return;
  const position=()=>{
   const r=trigger.current?.getBoundingClientRect();
   if(!r)return;
   const width=264, height=254, margin=8;
   const left=Math.max(margin,Math.min(r.left,window.innerWidth-width-margin));
   const below=r.bottom+6;
   const top=below+height>window.innerHeight-margin&&r.top>height+margin
      ?r.top-height-6:Math.max(margin,Math.min(below,window.innerHeight-height-margin));
   setPlace({left,top});
  };
  position();
  window.addEventListener("resize",position);
  // Capture scrolls from the table or any scrolling ancestor.
  window.addEventListener("scroll",position,true);
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();setOpen(false)}};
  document.addEventListener("keydown",key);
  return()=>{
   window.removeEventListener("resize",position);
   window.removeEventListener("scroll",position,true);
   document.removeEventListener("keydown",key);
  };
 },[open]);
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
  if(!window.confirm("Remove “"+property.name+"” from this database? It will STAY removed, including when templates are reapplied. Values remain stored until you explicitly restore the property."))return;
  setBusy(true);
  try{
   const {data,error}=await supabase.from("db_properties").update({archived_at:new Date().toISOString()})
    .eq("id",property.id).eq("database_id",property.database_id).eq("version",property.version)
    .select("id").maybeSingle();
   if(error)throw error;
   if(!data)throw new Error("The property changed elsewhere. Reload and try again.");
   await onRefresh();onSaved("Property removed. It will not be re-created by template setup.");setOpen(false);
  }catch(e){onError(errText(e))}finally{setBusy(false)}
 };
 const swallowPointer=(e:React.PointerEvent)=>{e.preventDefault();e.stopPropagation();};
 const dismiss=(e:React.MouseEvent)=>{
  e.preventDefault();e.stopPropagation();
  // Close on the completed click, rather than pointerdown. Keeping the
  // backdrop mounted until click completes prevents click-through.
  if(!busy)setOpen(false);
 };
 return <div className="db-notion-heading">
  <button ref={trigger} type="button" className="db-notion-heading-trigger"
   aria-label={"Edit property "+property.name} aria-expanded={open}
   onClick={e=>{e.stopPropagation();setOpen(v=>!v)}}>
   <span>{property.name}</span><span aria-hidden="true">⌄</span>
  </button>
  {open&&typeof document!=="undefined"&&createPortal(
   <div className="db-notion-overlay" onPointerDown={swallowPointer} onClick={dismiss}
     onContextMenu={dismiss} aria-label="Close property menu">
     <div role="dialog" aria-modal="true" className="db-notion-property-menu"
       aria-label={"Manage "+property.name} style={{position:"fixed",left:place.left,top:place.top}}
       onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
       <label>Property name
         <input autoFocus aria-label={"Rename "+property.name} value={draft} maxLength={80}
          onChange={e=>setDraft(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void rename()}}}/>
       </label>
       <p>{property.type==="relation"?"Changing the label keeps existing links.":"Changing the label keeps existing values."}</p>
       <div className="db-notion-property-actions">
        <button type="button" disabled={busy} onClick={()=>void rename()}>Save name</button>
        <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button>
       </div>
       <button type="button" className="db-notion-property-remove" disabled={busy}
         onClick={()=>void archive()}>Delete property</button>
      </div>
    </div>,document.body)}
 </div>;
}
export function RestoreDatabaseProperties({archived,dbId,onRefresh,onError,onSaved}:{
 archived:EditableProperty[];dbId:string;onRefresh:()=>Promise<void>;onError:(message:string)=>void;onSaved:(message:string)=>void;
}){
 const list=archived.filter(p=>p.database_id===dbId);
 if(!list.length)return null;
 return <details className="db-notion-archived">
  <summary>Removed properties ({list.length}) · restore only if needed</summary>
  {list.map(p=><div key={p.id}><span>{p.name}</span>
    <button type="button" onClick={()=>void(async()=>{
      const {data,error}=await supabase.from("db_properties").update({archived_at:null})
        .eq("id",p.id).eq("database_id",dbId).eq("version",p.version).select("id").maybeSingle();
      if(error){onError(error.message);return;}
      if(!data){onError("The property changed elsewhere. Reload to retry.");return;}
      try{await onRefresh();onSaved("Property explicitly restored with its existing values.");}catch(e){onError(errText(e))}
    })()}>Restore</button></div>)}
 </details>;
}
