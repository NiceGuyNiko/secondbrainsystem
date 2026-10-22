"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ChevronUp,ChevronDown,Lightbulb,Lock,LockOpen,Pin,PinOff,Plus,RotateCcw,Settings2,X} from "lucide-react";
import {canPin,type AgendaPreference} from "@/lib/agenda-state";
import type {AgendaMode} from "@/components/agenda";
import {type Occurrence,type CalendarEvent,type CalendarTask} from "@/lib/calendar-layout";
import CompanionAgendaView from "@/components/companion-agenda-view";
import {thoughtStore,type Thought} from "@/lib/thoughts";
import {contextKey,defaultSections,resolveSections,scopeKey,sectionVisible,type CompanionPreferences,type CompanionTool,type CompanionTarget,type ContextScope,type ContextSection,type ContextConfigurations,type CompanionCondition} from "@/lib/companion-config";

const tools: {key:CompanionTool;title:string}[] = [
  {key:"agenda",title:"The Agenda"},{key:"context",title:"Context"},{key:"thoughts",title:"Thoughts"}
];
type Props={
  preference:AgendaPreference;mode:AgendaMode;onMode:(mode:AgendaMode)=>void;
  today:string;now:Date;timeZone:string;
  occurrencesForDate:(date:string)=>Occurrence[];
  colour:(event:CalendarEvent)=>string;
  format:(time:string)=>string;
  onNew:(date:string)=>void;
  onToggleTask:(event:CalendarEvent,task:CalendarTask)=>Promise<void>;
  onOpenThought?:(id:string)=>void;
  options:CompanionPreferences;
  onOptions:(change:Partial<CompanionPreferences>)=>void;
  target:CompanionTarget;
  profileKey:string;
};
export default function Companion(p:Props){
  const [top,setTop]=useState<CompanionTool>(p.options.primary);
  const [bottom,setBottom]=useState<CompanionTool>(p.options.secondary);
  useEffect(()=>{setTop(p.options.primary);setBottom(p.options.secondary)},[p.options.primary,p.options.secondary]);
  const [fixed,setFixed]=useState<CompanionTool|null>(null);
  // The secondary tool is a draggable drawer. Zero means only the main tab is visible.
  const [drawerHeight,setDrawerHeight]=useState(p.options.layout==="split"?100-p.options.splitPercent:0);
  const drawerHeightRef=useRef(drawerHeight);
  useEffect(()=>{
    const value=p.options.layout==="split"?100-p.options.splitPercent:0;
    drawerHeightRef.current=value;setDrawerHeight(value);
  },[p.options.layout,p.options.splitPercent]);
  const [topDate,setTopDate]=useState(p.today);
  const [bottomDate,setBottomDate]=useState(p.today);
  const [topSelected,setTopSelected]=useState<string|null>(null);
  const [bottomSelected,setBottomSelected]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [locked,setLocked]=useState<CompanionTarget|null>(null);
  const [configure,setConfigure]=useState(false);
  const [scope,setScope]=useState<ContextScope>("workspace");
  const [configs,setConfigs]=useState<ContextConfigurations>({});
  const [newSection,setNewSection]=useState("");
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [thoughts,setThoughts]=useState<Thought[]>([]);
  const [thoughtFilter,setThoughtFilter]=useState<"related"|"all">("related");
  const [draft,setDraft]=useState("");
  const [linkDraft,setLinkDraft]=useState(p.options.quickLink);
  const [loadingThoughts,setLoadingThoughts]=useState(false);
  const panel=useRef<HTMLElement>(null);
  const columnResizeStart=useRef<{x:number;width:number}|null>(null);
  const [previewWidth,setPreviewWidth]=useState(p.options.widthPx);
  const previewWidthRef=useRef(p.options.widthPx);
  useEffect(()=>{previewWidthRef.current=p.options.widthPx;setPreviewWidth(p.options.widthPx);},[p.options.widthPx]);
  const columnMin=300;
  const clampWidth=(w:number)=>Math.max(columnMin,Math.min(Math.min(720,Math.max(300,window.innerWidth-360)),Math.round(w)));
  const updateWidth=(w:number)=>{
    const next=clampWidth(w);previewWidthRef.current=next;setPreviewWidth(next);return next;
  };
  const target=locked || (p.options.follow==="workspace" ? {
    id:"workspace:"+p.target.workspaceId,title:p.target.workspaceName,databaseId:"workspace",
    databaseName:"Workspace",workspaceId:p.target.workspaceId,workspaceName:p.target.workspaceName,
    kind:"page" as const,fields:[{id:"workspace",label:"Workspace",value:p.target.workspaceName}]
  } : p.target);
  useEffect(()=>{if(locked && p.target.id===locked.id && JSON.stringify(p.target)!==JSON.stringify(locked))setLocked(p.target);},[p.target,locked]);
  const storageId=contextKey(p.profileKey);
  useEffect(()=>{try{const data=localStorage.getItem(storageId);setConfigs(data?JSON.parse(data) as ContextConfigurations:{});}catch{setConfigs({});}},[storageId]);
  const saveConfig=(next:ContextConfigurations)=>{setConfigs(next);try{localStorage.setItem(storageId,JSON.stringify(next));}catch{setMessage("Context layout could not be saved in this browser.");}};
  const changeSection=(section:ContextSection,patch:Partial<ContextSection>|{removed:true})=>{
    const key=scopeKey(scope,target);
    const prior=configs[key]||[];
    const old=prior.find(item=>item.id===section.id);
    const next={...configs,[key]:[...prior.filter(item=>item.id!==section.id),{...old,id:section.id,...patch}]};
    saveConfig(next);
  };
  const sections=resolveSections(target,configs);
  const visibleSections=sections.filter(section=>sectionVisible(section,target,p.options.visibility));
  useEffect(()=>{if(p.mode==="closed")return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape" && !configure){if(p.preference!=="column")p.onMode("closed");}};window.addEventListener("keydown",onKey);return()=>window.removeEventListener("keydown",onKey);},[p.mode,p.preference,p.onMode,configure]);
  const loadThoughts=useCallback(async()=>{
    setLoadingThoughts(true);
    try{setThoughts((await thoughtStore.load()).thoughts.filter(t=>!t.details.archived_at));}
    catch(e){setMessage(e instanceof Error?e.message:"Thoughts could not be loaded.");}
    finally{setLoadingThoughts(false);}
  },[]);
  useEffect(()=>{if(p.mode==="closed"||(top!=="thoughts"&&bottom!=="thoughts"))return;void loadThoughts();},[p.mode,top,bottom,loadThoughts]);
  useEffect(()=>setLinkDraft(p.options.quickLink),[p.options.quickLink]);
  const linked=(thought:Thought)=>Array.isArray(thought.content.companionRefs)&&thought.content.companionRefs.includes(target.id);
  const related=thoughts.filter(t=>thoughtFilter==="all"||linked(t));
  const capture=async()=>{
    const name=draft.trim();if(!name||busy)return;setBusy(true);setMessage("");
    try{
      const id=await thoughtStore.create(name);
      if(linkDraft){
        const data=await thoughtStore.load();
        const thought=data.thoughts.find(t=>t.id===id);
        if(thought)await thoughtStore.save({...thought,content:{...thought.content,companionRefs:[target.id]}});
      }
      setDraft("");await loadThoughts();setMessage("Thought captured.");
    }catch(e){setMessage(e instanceof Error?e.message:"Could not capture Thought.");}
    finally{setBusy(false);}
  };
  const selectTool=(slot:"top"|"bottom",tool:CompanionTool)=>{
    if(slot==="bottom"&&fixed===bottom)return;
    let nextTop=slot==="top"?tool:top;
    let nextBottom=slot==="bottom"?tool:bottom;
    if(p.options.matchingTool==="swap" && nextTop===nextBottom){
      if(fixed===bottom && slot==="top")return;
      if(slot==="top")nextBottom=top;else nextTop=bottom;
    }
    setTop(nextTop);setBottom(nextBottom);
    p.onOptions({primary:nextTop,secondary:nextBottom});
  };
  const resizeStart=useRef<{y:number;percent:number;height:number;moved:boolean}|null>(null);
  const commitDrawer=(percent:number)=>{
    const next=percent<15?0:Math.max(25,Math.min(75,Math.round(percent)));
    drawerHeightRef.current=next;setDrawerHeight(next);
    if(next===0)p.onOptions({layout:"single"});
    else p.onOptions({layout:"split",splitPercent:100-next});
  };
  const tabList=(slot:"top"|"bottom",value:CompanionTool)=>
    <nav role="tablist" aria-label={slot==="top"?"Primary Companion tools":"Secondary Companion tools"} className="aaa-companion-header-tabs">
      {tools.map(t=><button type="button" role="tab" key={t.key} aria-selected={value===t.key}
        disabled={slot==="bottom"&&fixed===bottom&&value!==t.key}
        className={value===t.key?"active":""} onClick={()=>selectTool(slot,t.key)}>
        {t.title.toUpperCase()}
      </button>)}
    </nav>;
  const secondaryHeader=()=><header className="aaa-hybrid-header aaa-companion-secondary-header">
    {tabList("bottom",bottom)}
    <div className="aaa-companion-header-actions">
      <button title={fixed===bottom?"Unpin second tool":"Keep second tool selected"} aria-label={fixed===bottom?"Unpin second tool":"Pin second tool"}
        aria-pressed={fixed===bottom} onClick={()=>setFixed(fixed===bottom?null:bottom)}>
        {fixed===bottom?<Pin size={15}/>:<PinOff size={15}/>}
      </button>
    </div>
  </header>;
  const agenda=(slot:"top"|"bottom")=><CompanionAgendaView
    date={slot==="top"?topDate:bottomDate}
    today={p.today} now={p.now} timeZone={p.timeZone} jump={p.options.jump}
    onDate={slot==="top"?setTopDate:setBottomDate}
    selected={slot==="top"?topSelected:bottomSelected}
    onSelected={slot==="top"?setTopSelected:setBottomSelected}
    occurrencesForDate={p.occurrencesForDate} colour={p.colour} format={p.format}
    onNew={p.onNew} onToggleTask={p.onToggleTask} onOpenThought={p.onOpenThought}/>;
  const context=<div className="aaa-companion-context">
    <div className="aaa-companion-actions">
      <button onClick={()=>setLocked(locked?null:{...target})} aria-pressed={!!locked}>
        {locked?<Lock size={15}/>:<LockOpen size={15}/>} {locked?"Locked":"Follow"}
      </button>
      <button onClick={()=>setConfigure(v=>!v)} aria-pressed={configure}><Settings2 size={15}/>{configure?"Done":"Configure"}</button>
    </div>
    <div className="aaa-companion-reference">
      <small>{target.workspaceName} / {target.databaseName}</small>
      <strong>{target.title}</strong>
      <small>{locked?"Reference fixed · values from last refresh":"Following "+p.options.follow}</small>
    </div>
    {configure&&<div className="aaa-companion-config">
      <label>Editing scope
        <select value={scope} onChange={e=>setScope(e.target.value as ContextScope)}>
          <option value="database">Database default</option>
          <option value="workspace">Current workspace</option>
          <option value="record">This record everywhere</option>
          <option value="record-workspace">This record here</option>
        </select>
      </label>
      <small>Layout edits do not change the original records. Overrides for this preview are saved on this device and profile.</small>
      <form onSubmit={e=>{e.preventDefault();const name=newSection.trim();if(!name)return;
        const id="section:"+crypto.randomUUID();
        const s:ContextSection={id,title:name,visible:true,condition:"always",fieldIds:[],text:"",origin:scope};
        changeSection(s,s);setNewSection("");
      }}>
        <input value={newSection} maxLength={80} onChange={e=>setNewSection(e.target.value)} placeholder="New section"/>
        <button type="submit" disabled={!newSection.trim()}><Plus size={14}/> Add</button>
      </form>
      <button onClick={()=>{const key=scopeKey(scope,target);const next={...configs};delete next[key];saveConfig(next);}}><RotateCcw size={14}/> Reset this scope</button>
    </div>}
    <div className="aaa-companion-sections">
      {sections.map((s,index)=>{
        const visible=sectionVisible(s,target,p.options.visibility);
        if(!configure&&!visible)return null;
        const fields=target.fields.filter(f=>s.fieldIds.includes(f.id));
        const open=expanded[s.id]!==false;
        return <section key={s.id} className={"aaa-companion-reference-section "+(!visible?"aaa-section-hidden":"")}>
          <div className="aaa-companion-section-title">
            <button onClick={()=>setExpanded(prev=>({...prev,[s.id]:!open}))} aria-expanded={open}>
              {open?"▾":"▸"} {s.title}
            </button>
            {configure&&<small>{s.origin||"Database"}</small>}
          </div>
          {configure&&<div className="aaa-companion-section-editor">
            <label>Title <input value={s.title} onChange={e=>changeSection(s,{title:e.target.value})}/></label>
            <label>Visibility <select value={s.condition} onChange={e=>changeSection(s,{condition:e.target.value as CompanionCondition})}>
              <option value="always">Always</option><option value="nonempty">Not empty</option>
              <option value="property">Has property value</option><option value="relation">Has relationships</option>
              <option value="workflow">In a workspace</option>
            </select></label>
            <label><input type="checkbox" checked={s.visible} onChange={e=>changeSection(s,{visible:e.target.checked})}/> Enabled</label>
            <label>Reference note <textarea value={s.text||""} onChange={e=>changeSection(s,{text:e.target.value})} placeholder="Optional section note"/></label>
            <div className="aaa-companion-config-fields">
              {target.fields.map(f=><label key={f.id}>
                <input type="checkbox" checked={s.fieldIds.includes(f.id)}
                  onChange={e=>changeSection(s,{fieldIds:e.target.checked?[...s.fieldIds,f.id]:s.fieldIds.filter(id=>id!==f.id)})}/>
                {f.label}
              </label>)}
            </div>
            <div className="aaa-companion-actions">
              <button disabled={index===0} onClick={()=>changeSection(s,{afterId:index>=2?sections[index-2].id:"__first"})}>↑ Move</button>
              <button disabled={index===sections.length-1} onClick={()=>changeSection(s,{afterId:sections[index+1].id})}>↓ Move</button>
              {s.id.startsWith("section:")&&<button onClick={()=>changeSection(s,{removed:true})}>Remove</button>}
            </div>
          </div>}
          {open&&<div className="aaa-companion-section-body">
            {s.text&&<p>{s.text}</p>}
            {fields.map(f=><div key={f.id} className="aaa-companion-field"><span>{f.label}</span><strong>{f.value||"—"}</strong></div>)}
            {!fields.length&&!s.text&&<small>{configure?"Add properties or a reference note.":"No reference information available."}</small>}
          </div>}
        </section>;
      })}
      {!visibleSections.length&&!configure&&<p>No sections match the current visibility rules. Choose Configure to change them.</p>}
    </div>
  </div>;
  const thoughtPane=<div className="aaa-companion-thoughts">
    <div className="aaa-companion-actions">
      <button onClick={()=>setThoughtFilter("related")} aria-pressed={thoughtFilter==="related"}>Related</button>
      <button onClick={()=>setThoughtFilter("all")} aria-pressed={thoughtFilter==="all"}>All</button>
      <button onClick={()=>void loadThoughts()}><RotateCcw size={14}/></button>
    </div>
    <small>{loadingThoughts?"Loading thoughts…":related.length+" thoughts"} · {target.title}</small>
    <div className="aaa-companion-thought-list">
      {related.slice(0,60).map(t=><button key={t.id} onClick={()=>p.onOpenThought?.(t.id)}>
        <Lightbulb size={14}/><span>{t.title||"Untitled"}</span>
      </button>)}
      {!related.length&&!loadingThoughts&&<p>No thoughts in this view yet.</p>}
    </div>
    <form className="aaa-companion-capture" onSubmit={e=>{e.preventDefault();void capture();}}>
      <textarea placeholder="Capture a thought…" value={draft} onChange={e=>setDraft(e.target.value)} rows={3}/>
      <label><input type="checkbox" checked={linkDraft} onChange={e=>setLinkDraft(e.target.checked)}/> Link to {target.title}</label>
      <button type="submit" disabled={busy||!draft.trim()}><Plus size={14}/> Capture thought</button>
    </form>
  </div>;
  const body=(slot:"top"|"bottom",tool:CompanionTool)=>tool==="agenda"?agenda(slot):tool==="context"?context:thoughtPane;
  if(p.mode==="closed")return null;
  return <>
    {p.mode==="overlay"&&<button className="aaa-companion-backdrop" aria-label="Close The Companion" onClick={()=>p.onMode("closed")}/>}
    <aside ref={panel} className={"aaa-hybrid-companion aaa-hybrid-"+p.mode} aria-label="The Companion"
      style={{width:previewWidth+"px",flexBasis:previewWidth+"px"}}>
      {p.mode==="pinned"&&p.options.resizableColumn&&<div className="aaa-companion-width-resizer"
        role="separator" aria-label="Resize Companion width" aria-orientation="vertical" tabIndex={0}
        aria-valuemin={300} aria-valuemax={720} aria-valuenow={previewWidth}
        onPointerDown={e=>{
          if(e.button!==0)return;
          columnResizeStart.current={x:e.clientX,width:previewWidth};
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e=>{
          const start=columnResizeStart.current;if(!start)return;
          updateWidth(start.width+start.x-e.clientX);
        }}
        onPointerUp={e=>{
          if(!columnResizeStart.current)return;
          columnResizeStart.current=null;
          p.onOptions({widthPx:previewWidthRef.current});
        }}
        onPointerCancel={()=>{columnResizeStart.current=null;p.onOptions({widthPx:previewWidthRef.current});}}
        onKeyDown={e=>{
          if(!["ArrowLeft","ArrowRight","Home"].includes(e.key))return;
          e.preventDefault();
          const next=e.key==="Home"?380:updateWidth(previewWidth+(e.key==="ArrowLeft"?20:-20));
          previewWidthRef.current=next;setPreviewWidth(next);p.onOptions({widthPx:next});
        }}/>} 
      <header className="aaa-hybrid-header">
        {tabList("top",top)}
        <div className="aaa-companion-header-actions">
          {canPin(p.preference,p.mode)&&<button aria-label={p.mode==="pinned"?"Unpin Companion":"Pin Companion"}
            title={p.mode==="pinned"?"Unpin":"Pin"} onClick={()=>p.onMode(p.mode==="pinned"?"overlay":"pinned")}>
            {p.mode==="pinned"?<PinOff size={17}/>:<Pin size={17}/>}</button>}
          {p.preference!=="column"&&<button aria-label="Close Companion" onClick={()=>p.onMode("closed")}><X size={17}/></button>}
        </div>
      </header>
      <div className="aaa-hybrid-sections">
        <div className="aaa-hybrid-slot aaa-hybrid-primary">
          <div className="aaa-hybrid-slot-body">{body("top",top)}</div>
        </div>
        <button type="button" className={"aaa-companion-pull"+(drawerHeight>0?" is-open":"")}
          role="separator" aria-label={drawerHeight>0?"Drag down to hide second tool":"Drag up to reveal second tool"}
          aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={75} aria-valuenow={drawerHeight} tabIndex={0}
          title={drawerHeight>0?"Drag down to collapse the second tool":"Pull up to open a second tool"}
          onPointerDown={e=>{
            if(e.button!==0)return;
            const height=e.currentTarget.parentElement?.getBoundingClientRect().height||1;
            resizeStart.current={y:e.clientY,percent:drawerHeightRef.current,height,moved:false};
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e=>{
            const start=resizeStart.current;
            if(!start)return;
            if(Math.abs(e.clientY-start.y)>5)start.moved=true;
            const next=Math.max(0,Math.min(75,start.percent+(start.y-e.clientY)/start.height*100));
            drawerHeightRef.current=next;setDrawerHeight(next);
          }}
          onPointerUp={e=>{
            const start=resizeStart.current;
            resizeStart.current=null;
            if(start?.moved){
              e.currentTarget.dataset.dragged="true";
              commitDrawer(drawerHeightRef.current);
            }
          }}
          onPointerCancel={()=>{resizeStart.current=null;commitDrawer(drawerHeightRef.current);}}
          onKeyDown={e=>{
            if(e.key==="ArrowUp"||e.key==="ArrowDown"){
              e.preventDefault();commitDrawer(drawerHeightRef.current+(e.key==="ArrowUp"?10:-10));
            }else if(e.key==="Home"){e.preventDefault();commitDrawer(0);}
            else if(e.key==="End"){e.preventDefault();commitDrawer(55);}
          }}
          onClick={e=>{
            if(e.currentTarget.dataset.dragged==="true"){
              delete e.currentTarget.dataset.dragged;return;
            }
            commitDrawer(drawerHeightRef.current>0?0:Math.max(25,100-p.options.splitPercent));
          }}>
          <span className="aaa-companion-pull-track"/><span className="aaa-companion-pull-pill">
            {drawerHeight>0?<ChevronDown size={14}/>:<ChevronUp size={14}/>}
          </span><span className="aaa-companion-pull-track"/>
        </button>
        {drawerHeight>0&&<div className="aaa-hybrid-slot aaa-hybrid-secondary" style={{flex:"0 0 "+drawerHeight+"%"}}>
          {secondaryHeader()}
          <div className="aaa-hybrid-slot-body">{body("bottom",bottom)}</div>
        </div>}
      </div>
      {message&&<div className="aaa-companion-message" role="status">{message}<button onClick={()=>setMessage("")} aria-label="Dismiss"><X size={13}/></button></div>}
    </aside>
  </>;
}