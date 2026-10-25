"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ChevronDown,ChevronRight,Code2,Eye,NotebookPen,Plus} from "lucide-react";
import WidgetConfigurePanel from "@/components/widget-configure-panel";
import type {WidgetConfigureTarget} from "@/lib/widget-system";
import type {CompanionInspection,CompanionTarget} from "@/lib/companion-config";

/** Developer reuses the one canonical widget Configure editor. */
export function CompanionDeveloperView({profileKey,target,inspection,configuration,onConfigureClose,onEditDatabase}:{
  profileKey:string;target:CompanionTarget;inspection:CompanionInspection|null;
  configuration?:WidgetConfigureTarget|null;onConfigureClose?:()=>void;
  onEditDatabase?:(id:string)=>void;onDragState?:(active:boolean)=>void;
}){
  const storageKey="aaa-developer-notes-v1:"+profileKey+":"+target.id;
  const visibilityKey="aaa-developer-notes-open-v1:"+profileKey+":"+target.id;
  const [notes,setNotes]=useState("");
  const [saved,setSaved]=useState(true);
  const [notesOpen,setNotesOpen]=useState(false);
  useEffect(()=>{
    try{setNotes(localStorage.getItem(storageKey)??"");setNotesOpen(localStorage.getItem(visibilityKey)==="true");setSaved(true)}
    catch{setNotes("");setSaved(false)}
  },[storageKey,visibilityKey]);
  const changeNotes=(value:string)=>{
    setNotes(value);
    try{localStorage.setItem(storageKey,value);setSaved(true)}catch{setSaved(false)}
  };
  const toggleNotes=()=>{
    const next=!notesOpen;setNotesOpen(next);
    try{localStorage.setItem(visibilityKey,String(next))}catch{}
  };
  return <div className="aaa-companion-library-tool aaa-companion-developer-view aaa-companion-developer-workshop">
    <header className="aaa-companion-workshop-heading">
      <span><Code2 size={16}/> Developer</span>
      <small>Reusable widget configuration</small>
    </header>
    <nav className="aaa-companion-workshop-tabs" aria-label="Developer widget views">
      {configuration&&<span className="aaa-companion-workshop-tab active" title={configuration.title}>
        <Code2 size={14}/>{configuration.title}
      </span>}
      <button type="button" className="aaa-companion-workshop-new" onClick={()=>
        window.dispatchEvent(new Event("aaa-developer-create-widget"))}>
        <Plus size={14}/> New Widget
      </button>
    </nav>
    <div className="aaa-companion-workshop-config" aria-label="Widget configuration editor">
      {configuration?<WidgetConfigurePanel key={configuration.id} selection={configuration}
        onClose={onConfigureClose??(()=>{})} onEditDatabase={onEditDatabase}/>
        :<div className="aaa-companion-workshop-empty">
          <p>{inspection?`Select ${inspection.title} on the page to configure it.`:
            "Choose a widget from the page, or create a new reusable widget."}</p>
          <button type="button" onClick={()=>window.dispatchEvent(new Event("aaa-developer-create-widget"))}>
            <Plus size={15}/> New Widget
          </button>
        </div>}
    </div>
    <section className="aaa-companion-dev-notes">
      <button className="aaa-companion-dev-notes-toggle" type="button" aria-expanded={notesOpen}
        onClick={toggleNotes}>{notesOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<NotebookPen size={15}/>
        <strong>Next-build notes</strong>{!notesOpen&&notes.trim()&&<small>Saved draft</small>}</button>
      {notesOpen&&<><p>Keep ideas and requirements for the next widget-builder iteration.</p>
        <textarea aria-label="Developer notes for this page" value={notes} onChange={e=>changeNotes(e.target.value)}
          placeholder="What should this widget or page do in the next build?" rows={7}/>
        <small role="status">{saved?"Saved in this browser for this page":"Unable to save notes in this browser"}</small></>}
    </section>
  </div>;
}

export function CompanionViewPanel({target,inspection,configuration,onPreviewMount,onPreviewHeight}:{
  target:CompanionTarget;inspection:CompanionInspection|null;
  configuration?:WidgetConfigureTarget|null;onPreviewHeight?:(height:number)=>void;
  onPreviewMount?:(element:HTMLDivElement|null)=>void;
}){
  const viewport=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{
    const node=viewport.current;if(!node||!onPreviewHeight)return;
    const update=()=>{
      const card=node.querySelector<HTMLElement>(".aaa-companion-live-widget");
      if(card)onPreviewHeight(Math.ceil(card.getBoundingClientRect().height));
    };
    const changes=new MutationObserver(update);
    const size=new ResizeObserver(update);
    changes.observe(node,{childList:true,subtree:true});size.observe(node);update();
    return ()=>{changes.disconnect();size.disconnect()};
  },[onPreviewHeight]);
  const mount=useCallback((node:HTMLDivElement|null)=>{viewport.current=node;onPreviewMount?.(node)},[onPreviewMount]);
  return <div className="aaa-companion-library-tool aaa-companion-view-panel aaa-companion-live-preview-view">
    <div className="aaa-companion-tool-intro"><Eye size={17}/><div><strong>View</strong>
      <small>{configuration?.title??inspection?.title??target.title} · live widget appearance</small></div></div>
    <div className="aaa-companion-preview-viewport" ref={mount} aria-label="Live widget container preview"/>
    {!inspection&&!configuration&&<p className="aaa-companion-preview-empty-text">Select a widget or create a New Widget in Developer to see its live appearance here.</p>}
  </div>;
}
