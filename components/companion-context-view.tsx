"use client";
import {Lock,LockOpen,Settings2,RotateCcw,Plus} from "lucide-react";
import {resolveSections,scopeKey,sectionVisible,type CompanionTarget,type CompanionVisibility,type ContextScope,type ContextSection,type ContextConfigurations,type CompanionCondition} from "@/lib/companion-config";
import {referenceForPane,type ContextViewState} from "@/lib/companion-pane-state";

type Props={
  current:CompanionTarget;
  recent:CompanionTarget[];
  state:ContextViewState;
  onState:(patch:Partial<ContextViewState>)=>void;
  configs:ContextConfigurations;
  onConfigs:(next:ContextConfigurations)=>void;
  visibility:CompanionVisibility;
  paneLabel:string;
};
export default function CompanionContextView(p:Props){
  const target=referenceForPane(p.state.locked,p.current);
  const sections=resolveSections(target,p.configs);
  const visibleSections=sections.filter(s=>sectionVisible(s,target,p.visibility));
  const change=(section:ContextSection,patch:Partial<ContextSection>|{removed:true})=>{
    const key=scopeKey(p.state.scope,target);
    const entries=p.configs[key]||[];
    const prior=entries.find(s=>s.id===section.id);
    p.onConfigs({...p.configs,[key]:[
      ...entries.filter(s=>s.id!==section.id),
      {...prior,id:section.id,...patch}
    ]});
  };
  const chooseReference=(id:string)=>{
    if(id==="follow"){p.onState({locked:null});return;}
    const found=[p.current,...p.recent,target].find(t=>t.id===id);
    if(found)p.onState({locked:{...found,fields:found.fields.map(f=>({...f}))}});
  };
  return <div className="aaa-companion-context">
    <div className="aaa-companion-actions">
      <button type="button" onClick={()=>p.onState({locked:p.state.locked?null:{...target,fields:target.fields.map(f=>({...f}))}})}
        aria-pressed={!!p.state.locked} title={p.state.locked?"Resume following the active page":"Lock this reference in this panel"}>
        {p.state.locked?<Lock size={15}/>:<LockOpen size={15}/>} {p.state.locked?"Locked":"Follow"}
      </button>
      <button type="button" onClick={()=>p.onState({configure:!p.state.configure})} aria-pressed={p.state.configure}>
        <Settings2 size={15}/>{p.state.configure?"Done":"Configure"}
      </button>
    </div>
    <label className="aaa-companion-reference-chooser">
      <span>{p.paneLabel} reference</span>
      <select aria-label={p.paneLabel+" Context reference"} value={p.state.locked?.id??"follow"} onChange={e=>chooseReference(e.target.value)}>
        <option value="follow">Follow current page ({p.current.title})</option>
        {p.state.locked&&!p.recent.some(t=>t.id===p.state.locked?.id)&&p.current.id!==p.state.locked.id&&
          <option value={p.state.locked.id}>{p.state.locked.title} — locked</option>}
        {p.recent.filter(t=>t.id!==p.current.id).map(t=><option key={t.id} value={t.id}>{t.title} · {t.databaseName}</option>)}
      </select>
    </label>
    <div className="aaa-companion-reference">
      <small>{target.workspaceName} / {target.databaseName}</small>
      <strong>{target.title}</strong>
      <small>{p.state.locked?"Locked to this reference":"Following the active page"}</small>
    </div>
    {p.state.configure&&<div className="aaa-companion-config">
      <label>Editing scope
        <select value={p.state.scope} onChange={e=>p.onState({scope:e.target.value as ContextScope})}>
          <option value="database">Database default</option>
          <option value="workspace">Current workspace</option>
          <option value="record">This record everywhere</option>
          <option value="record-workspace">This record here</option>
        </select>
      </label>
      <small>Layout changes affect references only. Source records remain unchanged; layouts are saved locally for this preview.</small>
      <form onSubmit={e=>{
        e.preventDefault();
        const name=p.state.newSection.trim();if(!name)return;
        const section:ContextSection={id:"section:"+crypto.randomUUID(),title:name,visible:true,condition:"always",fieldIds:[],text:"",origin:p.state.scope};
        change(section,section);p.onState({newSection:""});
      }}>
        <input maxLength={80} value={p.state.newSection} onChange={e=>p.onState({newSection:e.target.value})} placeholder="New section"/>
        <button type="submit" disabled={!p.state.newSection.trim()}><Plus size={14}/> Add</button>
      </form>
      <button type="button" onClick={()=>{
        const key=scopeKey(p.state.scope,target);const next={...p.configs};delete next[key];p.onConfigs(next);
      }}><RotateCcw size={14}/> Reset this scope</button>
    </div>}
    <div className="aaa-companion-sections">
      {sections.map((section,i)=>{
        const visible=sectionVisible(section,target,p.visibility);
        if(!p.state.configure&&!visible)return null;
        const fields=target.fields.filter(f=>section.fieldIds.includes(f.id));
        const open=p.state.expanded[section.id]!==false;
        return <section key={section.id} className={"aaa-companion-reference-section "+(!visible?"aaa-section-hidden":"")}>
          <div className="aaa-companion-section-title">
            <button type="button" aria-expanded={open} onClick={()=>p.onState({expanded:{...p.state.expanded,[section.id]:!open}})}>
              {open?"▾":"▸"} {section.title}
            </button>
            {p.state.configure&&<small>{section.origin||"Database"}</small>}
          </div>
          {p.state.configure&&<div className="aaa-companion-section-editor">
            <label>Title<input value={section.title} onChange={e=>change(section,{title:e.target.value})}/></label>
            <label>Visibility<select value={section.condition} onChange={e=>change(section,{condition:e.target.value as CompanionCondition})}>
              <option value="always">Always</option><option value="nonempty">Not empty</option>
              <option value="property">Has property value</option><option value="relation">Has relationships</option>
              <option value="workflow">In a workspace</option>
            </select></label>
            <label><input type="checkbox" checked={section.visible} onChange={e=>change(section,{visible:e.target.checked})}/> Enabled</label>
            <label>Reference note<textarea value={section.text||""} onChange={e=>change(section,{text:e.target.value})} placeholder="Optional note"/></label>
            <div className="aaa-companion-config-fields">
              {target.fields.map(f=><label key={f.id}><input type="checkbox"
                checked={section.fieldIds.includes(f.id)}
                onChange={e=>change(section,{fieldIds:e.target.checked?[...section.fieldIds,f.id]:section.fieldIds.filter(id=>id!==f.id)})}/>
                {f.label}</label>)}
            </div>
            <div className="aaa-companion-actions">
              <button disabled={i===0} onClick={()=>change(section,{afterId:i>=2?sections[i-2].id:"__first"})}>↑ Move</button>
              <button disabled={i===sections.length-1} onClick={()=>change(section,{afterId:sections[i+1].id})}>↓ Move</button>
              {section.id.startsWith("section:")&&<button onClick={()=>change(section,{removed:true})}>Remove</button>}
            </div>
          </div>}
          {open&&<div className="aaa-companion-section-body">
            {section.text&&<p>{section.text}</p>}
            {fields.map(f=><div key={f.id} className="aaa-companion-field"><span>{f.label}</span><strong>{f.value||"—"}</strong></div>)}
            {!fields.length&&!section.text&&<small>{p.state.configure?"Add properties or a note.":"No reference information available."}</small>}
          </div>}
        </section>;
      })}
      {!visibleSections.length&&!p.state.configure&&<p>No sections match the current visibility rules. Choose Configure to change them.</p>}
    </div>
  </div>;
}