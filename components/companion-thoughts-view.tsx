"use client";
import {useState} from "react";
import {Lightbulb,Lock,LockOpen,Plus,RotateCcw} from "lucide-react";
import {referenceForPane,type ThoughtsViewState} from "@/lib/companion-pane-state";
import type {CompanionTarget} from "@/lib/companion-config";
import type {Thought} from "@/lib/thoughts";

type Props={
  paneLabel:string;
  current:CompanionTarget;
  recent:CompanionTarget[];
  state:ThoughtsViewState;
  onState:(patch:Partial<ThoughtsViewState>)=>void;
  thoughts:Thought[];
  loading:boolean;
  onRefresh:()=>Promise<void>;
  onCapture:(name:string,linkedReference:CompanionTarget|null)=>Promise<void>;
  onOpenThought?:(id:string)=>void;
};
export default function CompanionThoughtsView(p:Props){
  const target=referenceForPane(p.state.locked,p.current);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const related=p.thoughts.filter(t=>p.state.filter==="all"||(
    Array.isArray(t.content.companionRefs)&&t.content.companionRefs.includes(target.id)
  ));
  const chooseReference=(id:string)=>{
    if(id==="follow"){p.onState({locked:null});return;}
    const found=[p.current,...p.recent,target].find(t=>t.id===id);
    if(found)p.onState({locked:{...found,fields:found.fields.map(f=>({...f}))},filter:"related"});
  };
  const capture=async()=>{
    if(!p.state.draft.trim()||busy)return;
    setBusy(true);setError("");
    try{
      await p.onCapture(p.state.draft.trim(),p.state.linkDraft?target:null);
      p.onState({draft:""});
    }catch(e){setError(e instanceof Error?e.message:"Could not save Thought.")}
    finally{setBusy(false);}
  };
  return <div className="aaa-companion-thoughts">
    <div className="aaa-companion-actions">
      <button type="button" onClick={()=>p.onState({filter:"related"})} aria-pressed={p.state.filter==="related"}>Related</button>
      <button type="button" onClick={()=>p.onState({filter:"all"})} aria-pressed={p.state.filter==="all"}>All</button>
      <button type="button" title="Refresh thoughts" aria-label="Refresh thoughts" onClick={()=>void p.onRefresh()}><RotateCcw size={14}/></button>
      <button type="button" title={p.state.locked?"Unlock this Thoughts reference":"Lock these Thoughts to this page"}
        aria-label={p.state.locked?"Unlock Thoughts reference":"Lock Thoughts reference"}
        aria-pressed={!!p.state.locked}
        onClick={()=>p.onState({locked:p.state.locked?null:{...target,fields:target.fields.map(f=>({...f}))}})}>
        {p.state.locked?<Lock size={15}/>:<LockOpen size={15}/>} {p.state.locked?"Locked":"Follow"}
      </button>
    </div>
    <label className="aaa-companion-reference-chooser">
      <span>{p.paneLabel} related to</span>
      <select aria-label={p.paneLabel+" Thoughts reference"} value={p.state.locked?.id??"follow"} onChange={e=>chooseReference(e.target.value)}>
        <option value="follow">Follow current page ({p.current.title})</option>
        {p.state.locked&&!p.recent.some(t=>t.id===p.state.locked?.id)&&p.current.id!==p.state.locked.id&&
          <option value={p.state.locked.id}>{p.state.locked.title} — locked</option>}
        {p.recent.filter(t=>t.id!==p.current.id).map(t=><option key={t.id} value={t.id}>{t.title} · {t.databaseName}</option>)}
      </select>
    </label>
    <small>{p.loading?"Loading thoughts…":related.length+" thoughts"} · {target.title} · {p.state.locked?"locked":"following"}</small>
    <div className="aaa-companion-thought-list">
      {related.slice(0,60).map(t=><button key={t.id} type="button" onClick={()=>p.onOpenThought?.(t.id)}>
        <Lightbulb size={14}/><span>{t.title||"Untitled"}</span>
      </button>)}
      {!related.length&&!p.loading&&<p>No thoughts in this view yet.</p>}
    </div>
    <form className="aaa-companion-capture" onSubmit={e=>{e.preventDefault();void capture()}}>
      <textarea placeholder="Capture a thought…" rows={3} value={p.state.draft}
        onChange={e=>p.onState({draft:e.target.value})}/>
      <label><input type="checkbox" checked={p.state.linkDraft} onChange={e=>p.onState({linkDraft:e.target.checked})}/>
        Link to {target.title}
      </label>
      <button type="submit" disabled={busy||!p.state.draft.trim()}><Plus size={14}/> Capture Thought</button>
      {error&&<small role="alert">{error}</small>}
    </form>
  </div>;
}