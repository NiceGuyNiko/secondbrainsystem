"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {Link2,Search,Check,ChevronDown} from "lucide-react";
type Candidate={id:string;name:string};
type LinkItem={id:string;targetId:string};
export default function InlineRelationPicker({name,selected,candidates,multi,onLink,onUnlink}:{
 name:string;selected:LinkItem[];candidates:Candidate[];multi:boolean;
 onLink:(id:string)=>void;onUnlink:(id:string)=>void;
}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const button=useRef<HTMLButtonElement>(null),input=useRef<HTMLInputElement>(null);
 const [place,setPlace]=useState({top:0,left:0});
 useEffect(()=>{
  if(!open)return;
  const position=()=>{
   const r=button.current?.getBoundingClientRect();
   if(!r)return;
   const left=Math.max(8,Math.min(r.left,window.innerWidth-295));
   const top=r.bottom+320>window.innerHeight&&r.top>320?r.top-320:r.bottom+5;
   setPlace({left,top});
  };
  position();input.current?.focus();
  const close=(e:PointerEvent)=>{
   if(!button.current?.contains(e.target as Node)&&!(e.target as Element)?.closest?.(".db-relation-popup"))setOpen(false);
  };
  const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};
  document.addEventListener("pointerdown",close);document.addEventListener("keydown",esc);
  window.addEventListener("resize",position);window.addEventListener("scroll",position,true);
  return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",esc);
   window.removeEventListener("resize",position);window.removeEventListener("scroll",position,true)};
 },[open]);
 const title=(id:string)=>candidates.find(x=>x.id===id)?.name||"Untitled";
 const filtered=candidates.filter(x=>x.name.toLowerCase().includes(query.trim().toLowerCase()));
 const linked=new Set(selected.map(x=>x.targetId));
 return <div className="db-relation-cell">
  <div className="db-relation-pills">{selected.map(l=><span className="db-relation-pill" key={l.id}>
   {title(l.targetId)} <button type="button" aria-label={"Unlink "+title(l.targetId)} onClick={()=>onUnlink(l.id)}>×</button>
  </span>)}</div>
  <button type="button" className="db-relation-open" ref={button}
   aria-label={"Select linked "+name} aria-expanded={open}
   onClick={()=>{setOpen(v=>!v);setQuery("")}}>
   <Link2 size={12}/> {selected.length?"Link more":"+ Link"} <ChevronDown size={12}/>
  </button>
  {open&&typeof document!=="undefined"&&createPortal(
   <section className="db-relation-popup" role="dialog" aria-label={"Link "+name}
    style={{top:place.top,left:place.left}}>
    <label className="db-option-search"><Search size={15}/><input ref={input} value={query}
     aria-label={"Search "+name+" records"} placeholder="Search pages…" onChange={e=>setQuery(e.target.value)}/></label>
    <div className="db-relation-results">{filtered.map(c=><button key={c.id} type="button" disabled={linked.has(c.id)||(!multi&&selected.length>0&&!linked.has(c.id))}
     onClick={()=>{onLink(c.id);if(!multi)setOpen(false)}}>
     <span>{c.name}</span>{linked.has(c.id)&&<Check size={14}/>}</button>)}
     {!filtered.length&&<p>No matching pages in the related database.</p>}
    </div>
    {selected.length>0&&!multi&&<p className="db-relation-note">Remove the current link to choose another.</p>}
   </section>,document.body)}
 </div>;
}
