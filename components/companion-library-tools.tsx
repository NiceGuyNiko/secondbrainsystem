"use client";
import {useEffect,useState} from "react";
import {Code2,Database,Eye,Grip,NotebookPen} from "lucide-react";
import type {CompanionInspection,CompanionTarget} from "@/lib/companion-config";

export function CompanionDeveloperView({profileKey,target,inspection}:{
  profileKey:string;target:CompanionTarget;inspection:CompanionInspection|null;
}){
  const storageKey="aaa-developer-notes-v1:"+profileKey+":"+target.id;
  const [notes,setNotes]=useState("");
  const [saved,setSaved]=useState(true);
  useEffect(()=>{
    try{setNotes(localStorage.getItem(storageKey)??"");setSaved(true)}
    catch{setNotes("");setSaved(false)}
  },[storageKey]);
  const changeNotes=(value:string)=>{
    setNotes(value);
    try{localStorage.setItem(storageKey,value);setSaved(true)}catch{setSaved(false)}
  };
  return <div className="aaa-companion-library-tool aaa-companion-developer-view">
    <div className="aaa-companion-tool-intro"><Code2 size={18}/><div><strong>Developer</strong>
      <small>Edit-mode workspace · early build</small></div></div>
    <section className="aaa-companion-dev-preview">
      <h3>Build &amp; review</h3>
      {inspection?<div className="aaa-companion-dev-widget" aria-label="Selected widget preview">
        <Grip size={19}/><div><strong>{inspection.title}</strong><small>{inspection.databaseName} · {inspection.viewName}</small></div>
      </div>:<p>Select a Library widget to inspect its design here.</p>}
      <p className="aaa-companion-dev-future">The six-dot drag-to-page builder, live UI language editor, and component construction tools are planned for a later build.</p>
    </section>
    <section className="aaa-companion-dev-notes">
      <h3><NotebookPen size={15}/> Next-build notes</h3>
      <p>Capture ideas and specifications while working on this page.</p>
      <textarea aria-label="Developer notes for this page" value={notes} onChange={e=>changeNotes(e.target.value)}
        placeholder="What should this widget or page do in the next build?" rows={7}/>
      <small role="status">{saved?"Saved in this browser for this page":"Unable to save notes in this browser"}</small>
    </section>
    <section className="aaa-companion-dev-fields">
      <h3><Database size={15}/> Connected data fields</h3>
      {inspection?.fields.length?<ul>{inspection.fields.map(field=><li key={field.name}><span>{field.name}</span><small>{field.type}</small></li>)}</ul>
        :<p>Choose a connected widget to see its database field definitions. Field-to-UI binding is coming later.</p>}
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
