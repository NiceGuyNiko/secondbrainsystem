"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {Check,ChevronDown,Plus,Search} from "lucide-react";
import {optionMatches,canCreateOption} from "@/lib/db-engine/select-options";
export default function InlineSelectPicker({name,value,options,onChoose,onCreate}:{
 name:string;value:string;options:string[];
 onChoose:(next:string|null)=>void;
 onCreate:(newOption:string)=>Promise<void>;
}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[busy,setBusy]=useState(false);
 const [failure,setFailure]=useState("");
 const trigger=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null);
 const [pos,setPos]=useState({top:0,left:0,width:270});
 useEffect(()=>{
  if(!open)return;
  const align=()=>{
   const r=trigger.current?.getBoundingClientRect();
   if(!r)return;
   const width=272,estimatedHeight=310,margin=8;
   const left=Math.max(margin,Math.min(r.left,window.innerWidth-width-margin));
   const below=r.bottom+5;
   const top=below+estimatedHeight>window.innerHeight-margin&&r.top>estimatedHeight+margin?r.top-estimatedHeight-5:below;
   setPos({top,left,width});
  };
  align();input.current?.focus();
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};
  const outside=(e:PointerEvent)=>{if(!trigger.current?.contains(e.target as Node)&&!(e.target as Element)?.closest?.(".db-option-popup"))setOpen(false)};
  document.addEventListener("pointerdown",outside);
  document.addEventListener("keydown",esc);
  window.addEventListener("resize",align);window.addEventListener("scroll",align,true);
  return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",esc);
   window.removeEventListener("resize",align);window.removeEventListener("scroll",align,true)};
 },[open]);
 const matches=optionMatches(options,query);
 const create=async()=>{
  if(!canCreateOption(options,query)||busy)return;
  setBusy(true);
  try{await onCreate(query.trim());setQuery("");setFailure("");setOpen(false)}
  catch(err){setFailure(err instanceof Error?err.message:"Could not create option. Try again.")}
  finally{setBusy(false)}
 };
 return <>
   <button type="button" ref={trigger} aria-label={"Choose "+name} aria-expanded={open} className="db-option-trigger"
    onClick={()=>{setOpen(v=>!v);setQuery("");setFailure("")}}>
    {value?<span className="db-option-pill">{value}</span>:<span className="db-option-placeholder">Select</span>}
    <ChevronDown size={13}/>
   </button>
   {open&&typeof document!=="undefined"&&createPortal(
    <div className="db-option-popup" style={{position:"fixed",top:pos.top,left:pos.left,width:pos.width}}
     role="dialog" aria-label={"Select "+name}>
     {value&&<div className="db-option-current"><span className="db-option-pill">{value}</span>
       <button type="button" onClick={()=>{onChoose(null);setOpen(false)}} aria-label="Clear selection">×</button></div>}
     <div className="db-option-search"><Search size={15}/><input ref={input} value={query} placeholder="Search or create option…"
       aria-label={"Search "+name+" options"} onChange={e=>setQuery(e.target.value)}
       onKeyDown={e=>{
        if(e.key==="Enter"){e.preventDefault();
         if(matches.length===1&&!canCreateOption(options,query)){onChoose(matches[0]);setOpen(false)}
         else if(canCreateOption(options,query))void create();
        }
       }}/></div>
     <div className="db-option-results">
       {matches.map(o=><button type="button" key={o} className="db-option-result" onClick={()=>{onChoose(o);setOpen(false)}}>
        <span className="db-option-pill">{o}</span>{o===value&&<Check size={13}/>}
       </button>)}
       {!matches.length&&<p>No matching options</p>}
     </div>
     {failure&&<p role="alert" className="db-option-error">{failure}</p>}
     {canCreateOption(options,query)&&<button type="button" className="db-option-create" disabled={busy}
       onClick={()=>void create()}><Plus size={14}/> Create <strong>{query.trim()}</strong></button>}
    </div>,document.body)}
 </>;
}
