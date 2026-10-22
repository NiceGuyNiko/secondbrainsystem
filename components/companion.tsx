"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ChevronLeft,ChevronRight,ChevronUp,ChevronDown,Lightbulb,Lock,LockOpen,Pin,PinOff,Plus,RotateCcw,Settings2,X,LocateFixed} from "lucide-react";
import {canPin,type AgendaPreference} from "@/lib/agenda-state";
import type {AgendaMode} from "@/components/agenda";
import {occurrenceKey,timedLanes,type Occurrence,type CalendarEvent,type CalendarTask} from "@/lib/calendar-layout";
import {thoughtStore,type Thought} from "@/lib/thoughts";
import {contextKey,defaultSections,resolveSections,scopeKey,sectionVisible,type CompanionPreferences,type CompanionTool,type CompanionTarget,type ContextScope,type ContextSection,type ContextConfigurations,type CompanionCondition} from "@/lib/companion-config";

const tools: {key:CompanionTool;title:string}[] = [
  {key:"agenda",title:"The Agenda"},{key:"context",title:"Context"},{key:"thoughts",title:"Thoughts"}
];
const dayShift=(date:string,days:number)=>{
  const d=new Date(date+"T12:00:00");d.setDate(d.getDate()+days);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
};
const minuteOf=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
const labelDate=(date:string)=>new Date(date+"T12:00:00").toLocaleDateString("en-CA",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
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
  const [chosenDate,setChosenDate]=useState(p.today);
  const [selected,setSelected]=useState<string|null>(null);
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
  const scroll=useRef<HTMLDivElement>(null);
  const panel=useRef<HTMLElement>(null);
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
  const today=p.today;
  const occurrences=p.occurrencesForDate(chosenDate);
  const timed=timedLanes(occurrences,chosenDate);
  const actual=occurrences.find(o=>occurrenceKey(o)===selected);
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:p.timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(p.now);
  const clockTime=(parts.find(x=>x.type==="hour")?.value||"00")+":"+(parts.find(x=>x.type==="minute")?.value||"00");
  const nowMinute=minuteOf(clockTime);
  const beginning=useMemo(()=>{
    if(chosenDate===today)return Math.max(0,nowMinute-120);
    if(p.options.jump==="midnight")return 0;
    const first=occurrences.filter(o=>!o.event.allDay).map(o=>minuteOf(o.start||o.event.start)).sort((a,b)=>a-b)[0];
    return Math.max(0,(first??0)-80);
  },[chosenDate,today,nowMinute,p.options.jump,occurrences.length]);
  useEffect(()=>{if(p.mode!=="closed" && scroll.current)scroll.current.scrollTop=beginning;},[chosenDate,p.mode,p.options.jump,top,bottom]);
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
    const nextTop=slot==="top"?tool:(tool===top?bottom:top);
    const nextBottom=slot==="bottom"?tool:(tool===bottom?top:bottom);
    if(nextTop===nextBottom)return;
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
  const toolHeader=()=><div className="aaa-companion-tool-head">
    <span>SECOND TOOL</span>
    <select value={bottom} aria-label="Choose second Companion tool"
      onChange={e=>selectTool("bottom",e.target.value as CompanionTool)}
      disabled={fixed===bottom}>
      {tools.filter(t=>t.key!==top).map(t=><option key={t.key} value={t.key}>{t.title}</option>)}
    </select>
    <button title={fixed===bottom?"Unpin second tool":"Pin second tool"} aria-label={fixed===bottom?"Unpin second tool":"Pin second tool"}
      aria-pressed={fixed===bottom} onClick={()=>setFixed(fixed===bottom?null:bottom)}>
      {fixed===bottom?<Pin size={15}/>:<PinOff size={15}/>}
    </button>
  </div>;
  const agenda=<div className="aaa-companion-agenda">
    <div className="aaa-companion-agenda-top">
      <div className="aaa-companion-date">
        <label className="aaa-companion-date-label">
          <span>{labelDate(chosenDate)}</span>
          <input type="date" aria-label="Choose Agenda date" value={chosenDate}
            onChange={e=>{if(e.target.value){setChosenDate(e.target.value);setSelected(null);}}}/>
        </label>
        <div className="aaa-companion-date-arrows">
          <button aria-label="Previous day" onClick={()=>{setChosenDate(v=>dayShift(v,-1));setSelected(null);}}><ChevronLeft size={19}/></button>
          <button aria-label="Next day" onClick={()=>{setChosenDate(v=>dayShift(v,1));setSelected(null);}}><ChevronRight size={19}/></button>
        </div>
      </div>
      <div className="aaa-companion-agenda-actions">
        <small>{occurrences.length} visible blocks</small>
        <button onClick={()=>p.onNew(chosenDate)}><Plus size={14}/> New event</button>
        <button onClick={()=>{
          setChosenDate(today);setSelected(null);
          requestAnimationFrame(()=>{if(scroll.current)scroll.current.scrollTop=Math.max(0,nowMinute-120);});
        }}><LocateFixed size={14}/> Now {p.format(clockTime)}</button>
      </div>
    </div>
    {occurrences.some(o=>o.event.allDay)&&<div className="aaa-companion-allday">
      <small>All day</small>
      {occurrences.filter(o=>o.event.allDay).map(o=><button key={occurrenceKey(o)} className={"event-chip event-"+p.colour(o.event)}
        onClick={()=>setSelected(occurrenceKey(o))}>{o.event.title}</button>)}
    </div>}
    <div className="aaa-companion-timeline" ref={scroll}>
      <div className="aaa-companion-grid">
        {Array.from({length:24},(_,h)=><div className="aaa-companion-hour" style={{top:h*60}} key={h}>
          <span>{p.format(String(h).padStart(2,"0")+":00")}</span>
        </div>)}
        {timed.map(({o,start,end,lane,lanes})=><button key={occurrenceKey(o)}
          className={"event-chip event-"+p.colour(o.event)+" aaa-companion-block"}
          style={{top:start,height:Math.max(24,end-start),left:"calc(52px + (100% - 55px) * "+(lane/lanes)+")",width:"calc((100% - 55px) * "+(1/lanes)+")"}}
          onClick={()=>setSelected(occurrenceKey(o))}><strong>{o.event.title}</strong>
          <small>{p.format(o.start||o.event.start)} – {p.format(o.end||o.event.end)}</small>
          {!!o.event.tasks.length&&<small>{o.event.tasks.filter(t=>t.done).length}/{o.event.tasks.length} tasks</small>}
        </button>)}
        {chosenDate===today&&<div className="aaa-companion-now" style={{top:nowMinute}}><i/></div>}
      </div>
    </div>
    {chosenDate!==today&&!occurrences.length&&<p className="aaa-companion-empty-day">No events or timed blocks this day.</p>}
    {actual&&<div className="aaa-companion-detail">
      <div className="aaa-companion-actions"><strong>{actual.event.title}</strong><button onClick={()=>setSelected(null)} aria-label="Close block details"><X size={15}/></button></div>
      <small>{actual.event.allDay?"All day":p.format(actual.start||actual.event.start)+" – "+p.format(actual.end||actual.event.end)}</small>
      {actual.event.tasks.map(task=><label key={task.taskId||task.id} className="aaa-companion-task">
        <input type="checkbox" checked={task.done} disabled={busy} onChange={async()=>{setBusy(true);try{await p.onToggleTask(actual.event,task);}catch(e){setMessage(String(e));}finally{setBusy(false);}}}/>
        <span>{task.title}</span>
      </label>)}
      {actual.event.thoughtId&&p.onOpenThought&&<button onClick={()=>p.onOpenThought?.(actual.event.thoughtId!)}>Open linked working page ↗</button>}
    </div>}
  </div>;
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
  const body=(tool:CompanionTool)=>tool==="agenda"?agenda:tool==="context"?context:thoughtPane;
  if(p.mode==="closed")return null;
  return <>
    {p.mode==="overlay"&&<button className="aaa-companion-backdrop" aria-label="Close The Companion" onClick={()=>p.onMode("closed")}/>}
    <aside ref={panel} className={"aaa-hybrid-companion aaa-hybrid-"+p.mode} aria-label="The Companion">
      <header className="aaa-hybrid-header">
        <nav role="tablist" aria-label="Companion tools" className="aaa-companion-header-tabs">
          {tools.map(t=><button type="button" role="tab" key={t.key} aria-selected={top===t.key}
            className={top===t.key?"active":""} onClick={()=>selectTool("top",t.key)}>
            {t.title.toUpperCase()}
          </button>)}
        </nav>
        <div className="aaa-companion-header-actions">
          {canPin(p.preference,p.mode)&&<button aria-label={p.mode==="pinned"?"Unpin Companion":"Pin Companion"}
            title={p.mode==="pinned"?"Unpin":"Pin"} onClick={()=>p.onMode(p.mode==="pinned"?"overlay":"pinned")}>
            {p.mode==="pinned"?<PinOff size={17}/>:<Pin size={17}/>}</button>}
          {p.preference!=="column"&&<button aria-label="Close Companion" onClick={()=>p.onMode("closed")}><X size={17}/></button>}
        </div>
      </header>
      <div className="aaa-hybrid-sections">
        <div className="aaa-hybrid-slot aaa-hybrid-primary">
          <div className="aaa-hybrid-slot-body">{body(top)}</div>
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
          {toolHeader()}
          <div className="aaa-hybrid-slot-body">{body(bottom)}</div>
        </div>}
      </div>
      {message&&<div className="aaa-companion-message" role="status">{message}<button onClick={()=>setMessage("")} aria-label="Dismiss"><X size={13}/></button></div>}
    </aside>
  </>;
}