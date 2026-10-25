"use client";
import {useEffect,useState} from "react";
import {ChevronDown,ChevronRight,Database,Eye,Grip,NotebookPen} from "lucide-react";
import WidgetConfigurePanel from "@/components/widget-configure-panel";
import type {WidgetConfigureTarget} from "@/lib/widget-system";
import type {CompanionInspection,CompanionTarget} from "@/lib/companion-config";

export function CompanionDeveloperView({profileKey,target,inspection,configuration,onConfigureClose,onEditDatabase,onDragState}:{
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
  const beginDrag=(event:React.DragEvent<HTMLElement>)=>{
    const id=inspection?.definitionId;
    if(!id){event.preventDefault();return}
    event.dataTransfer.setData("application/x-aaa-widget-definition",id);
    event.dataTransfer.setData("text/plain",id);
    event.dataTransfer.effectAllowed="copy";
    window.dispatchEvent(new CustomEvent("aaa-developer-widget-drag",{detail:{definitionId:id}}));
    onDragState?.(true);
  };
  const endDrag=()=>{
    window.dispatchEvent(new Event("aaa-developer-widget-drag-end"));
    onDragState?.(false);
  };
  return <div className="aaa-companion-library-tool aaa-companion-developer-view">
    <section className="aaa-companion-dev-preview" aria-label="Widget build preview">
      <div className="aaa-companion-dev-widget" draggable={!!inspection?.definitionId}
        onDragStart={beginDrag} onDragEnd={endDrag} title="Drag the six-dot grip to place a reusable copy on the page">
        <span className="aaa-companion-dev-drag-grip" aria-label="Drag widget onto the page"><Grip size={19}/></span>
        <strong>{inspection?.title??"Select a widget to develop"}</strong>
        <small>{inspection?.databaseName??"Choose a widget on this page"}</small>
      </div>
      {inspection?.samples?.length?<div className="aaa-companion-dev-preview-body">
        {inspection.samples.map((record,index)=><div className="aaa-companion-dev-preview-record" key={index}>
          <strong>{record.title}</strong><small>{record.detail}</small><ChevronRight size={14}/>
        </div>)}
      </div>:<div className="aaa-companion-dev-preview-empty"><Database size={22}/>
        <span>{inspection?.databaseName&&inspection.databaseName!=="Not connected"
          ?"No records in this connected view yet":"Connect a database source to build this widget."}</span></div>}
      <p className="aaa-companion-dev-drag-help">Drag the six-dot handle into a section. Drop on a card to stack above or below; use a divider to choose a specific position.</p>
    </section>
    <section className="aaa-companion-dev-source" aria-label="Widget data source and configuration">
      <h3><Database size={15}/> Source &amp; configuration</h3>
      {configuration?<WidgetConfigurePanel selection={configuration} onClose={onConfigureClose??(()=>{})} onEditDatabase={onEditDatabase}/>
        :<div className="aaa-companion-dev-source-summary">
          <dl><div><dt>Database</dt><dd>{inspection?.databaseName??"Not connected"}</dd></div>
            <div><dt>Saved view</dt><dd>{inspection?.viewName??"Default view"}</dd></div>
            <div><dt>Renderer</dt><dd>{inspection?.renderer??"Table"}</dd></div></dl>
          {inspection?.fields.length?<ul>{inspection.fields.map(field=><li key={field.name}>
            <span>{field.name}</span><small>{field.type}</small></li>)}</ul>:null}
          <p>Select a widget or add one to edit its source, display settings, and database fields.</p>
        </div>}
    </section>
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

export function CompanionViewPanel({target,inspection}:{target:CompanionTarget;inspection:CompanionInspection|null}){
  return <div className="aaa-companion-library-tool aaa-companion-view-panel">
    <div className="aaa-companion-tool-intro"><Eye size={18}/><div><strong>View</strong><small>Context from what you select</small></div></div>
    {inspection?<>
      <section><small>SELECTED WIDGET</small><h3>{inspection.title}</h3>
        <dl><div><dt>Type</dt><dd>{inspection.kind}</dd></div>
          <div><dt>Connected database</dt><dd>{inspection.databaseName}</dd></div>
          <div><dt>Saved view</dt><dd>{inspection.viewName}</dd></div></dl></section>
      <section><h3>Available fields</h3>{inspection.fields.length?<ul>{inspection.fields.map(field=><li key={field.name}>
        <span>{field.name}</span><small>{field.type}</small></li>)}</ul>:<p>No database fields are connected yet.</p>}</section>
    </>:<section><small>CURRENT PAGE</small><h3>{target.title}</h3>
      <p>Select a widget in the page to see its connected data, saved view, and relevant details here.</p></section>}
  </div>;
}
