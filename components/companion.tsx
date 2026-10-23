"use client";
import {useCallback,useEffect,useRef,useState,type MouseEvent,type SyntheticEvent} from "react";
import {createPortal} from "react-dom";
import {CalendarDays,BookOpen,Lightbulb,ChevronUp,ChevronDown,Pin,PinOff,X,PanelsTopLeft,Settings2,Database} from "lucide-react";
import {canPin,type AgendaPreference} from "@/lib/agenda-state";
import type {AgendaMode} from "@/components/agenda";
import {type Occurrence,type CalendarEvent,type CalendarTask} from "@/lib/calendar-layout";
import CompanionAgendaView from "@/components/companion-agenda-view";
import CompanionContextView from "@/components/companion-context-view";
import CompanionThoughtsView from "@/components/companion-thoughts-view";
import {thoughtStore,type Thought} from "@/lib/thoughts";
import {contextKey,type CompanionPreferences,type CompanionTool,type CompanionTarget,type ContextConfigurations} from "@/lib/companion-config";
import {initialPaneState,cloneCompanionView,addRecentReference,
  type CompanionPaneState,type CompanionSlot,type ContextViewState,type ThoughtsViewState} from "@/lib/companion-pane-state";
import {positionCompanionPopover} from "@/lib/companion-popover-position";
import WidgetConfigurePanel from "@/components/widget-configure-panel";
import WidgetDatabaseEditorPanel from "@/components/widget-database-editor-panel";
import type {WidgetConfigureTarget} from "@/lib/widget-system";

const tools: {key:CompanionTool;title:string}[] = [
  {key:"agenda",title:"The Agenda"},
  {key:"context",title:"Context"},
  {key:"thoughts",title:"Thoughts"}
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
  configuration?:WidgetConfigureTarget|null;
  onConfigureClose?:()=>void;
};
export default function Companion(p:Props){
  const [top,setTop]=useState<CompanionTool>(p.options.primary);
  const [bottom,setBottom]=useState<CompanionTool>(p.options.secondary);
  useEffect(()=>{setTop(p.options.primary);setBottom(p.options.secondary);},[p.options.primary,p.options.secondary]);
  const [fixed,setFixed]=useState<CompanionTool|null>(null);
  const [drawerHeight,setDrawerHeight]=useState(p.options.layout==="split"?100-p.options.splitPercent:0);
  const [databaseEditorId,setDatabaseEditorId]=useState<string|null>(null);
  const drawerHeightRef=useRef(drawerHeight);
  useEffect(()=>{
    const value=p.options.layout==="split"?100-p.options.splitPercent:0;
    drawerHeightRef.current=value;setDrawerHeight(value);
  },[p.options.layout,p.options.splitPercent]);

  const [panes,setPanes]=useState<Record<CompanionSlot,CompanionPaneState>>({
    top:initialPaneState(p.today,p.options.quickLink),
    bottom:initialPaneState(p.today,p.options.quickLink)
  });
  const [recent,setRecent]=useState<CompanionTarget[]>([]);
  const [tabMenu,setTabMenu]=useState<{slot:CompanionSlot;tool:CompanionTool;left:number;top:number}|null>(null);
  const [tabTooltip,setTabTooltip]=useState<{title:string;left:number;top:number;width:number}|null>(null);
  const [message,setMessage]=useState("");
  const [configs,setConfigs]=useState<ContextConfigurations>({});
  const [thoughts,setThoughts]=useState<Thought[]>([]);
  const [loadingThoughts,setLoadingThoughts]=useState(false);
  const targetSignature=JSON.stringify(p.target);
  useEffect(()=>{setRecent(prev=>addRecentReference(prev,p.target));},[targetSignature]);
  useEffect(()=>{
    setPanes({top:initialPaneState(p.today,p.options.quickLink),bottom:initialPaneState(p.today,p.options.quickLink)});
    setRecent([p.target]);setTabMenu(null);setTabTooltip(null);
  },[p.profileKey]);
  const updateAgenda=(slot:CompanionSlot,patch:Partial<CompanionPaneState["agenda"]>)=>
    setPanes(prev=>({...prev,[slot]:{...prev[slot],agenda:{...prev[slot].agenda,...patch}}}));
  const updateContext=(slot:CompanionSlot,patch:Partial<ContextViewState>)=>
    setPanes(prev=>({...prev,[slot]:{...prev[slot],context:{...prev[slot].context,...patch}}}));
  const updateThoughts=(slot:CompanionSlot,patch:Partial<ThoughtsViewState>)=>
    setPanes(prev=>({...prev,[slot]:{...prev[slot],thoughts:{...prev[slot].thoughts,...patch}}}));

  const panel=useRef<HTMLElement>(null);
  const columnResizeStart=useRef<{x:number;width:number}|null>(null);
  const [previewWidth,setPreviewWidth]=useState(p.options.widthPx);
  const previewWidthRef=useRef(p.options.widthPx);
  useEffect(()=>{previewWidthRef.current=p.options.widthPx;setPreviewWidth(p.options.widthPx);},[p.options.widthPx]);
  useEffect(()=>{setDatabaseEditorId(null)},[p.configuration?.id]);
  const clampWidth=(w:number)=>Math.max(300,Math.min(Math.min(720,Math.max(300,window.innerWidth-360)),Math.round(w)));
  const updateWidth=(w:number)=>{
    const next=clampWidth(w);previewWidthRef.current=next;setPreviewWidth(next);return next;
  };
  const currentTarget:CompanionTarget=p.options.follow==="workspace"?{
    id:"workspace:"+p.target.workspaceId,title:p.target.workspaceName,databaseId:"workspace",
    databaseName:"Workspace",workspaceId:p.target.workspaceId,workspaceName:p.target.workspaceName,
    kind:"page",fields:[{id:"workspace",label:"Workspace",value:p.target.workspaceName}]
  }:p.target;
  const storageId=contextKey(p.profileKey);
  useEffect(()=>{try{
    const data=localStorage.getItem(storageId);
    setConfigs(data?JSON.parse(data) as ContextConfigurations:{});
  }catch{setConfigs({});}},[storageId]);
  const saveConfigs=(next:ContextConfigurations)=>{
    setConfigs(next);
    try{localStorage.setItem(storageId,JSON.stringify(next));}
    catch{setMessage("Context layout could not be saved in this browser.");}
  };
  useEffect(()=>{
    if(p.mode==="closed")return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.key!=="Escape")return;
      if(tabMenu){e.preventDefault();e.stopPropagation();setTabMenu(null);return;}
      if(p.preference!=="column")p.onMode("closed");
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[p.mode,p.preference,p.onMode,tabMenu]);

  const loadThoughts=useCallback(async()=>{
    setLoadingThoughts(true);
    try{setThoughts((await thoughtStore.load()).thoughts.filter(t=>!t.details.archived_at));}
    catch(e){setMessage(e instanceof Error?e.message:"Thoughts could not be loaded.");}
    finally{setLoadingThoughts(false);}
  },[]);
  useEffect(()=>{
    if(p.mode==="closed"||(top!=="thoughts"&&bottom!=="thoughts"))return;
    void loadThoughts();
  },[p.mode,top,bottom,loadThoughts]);
  const captureThought=async(name:string,reference:CompanionTarget|null)=>{
    const id=await thoughtStore.create(name);
    if(reference){
      const data=await thoughtStore.load();
      const thought=data.thoughts.find(t=>t.id===id);
      if(thought)await thoughtStore.save({...thought,content:{...thought.content,
        companionRefs:[...new Set([...(Array.isArray(thought.content.companionRefs)?thought.content.companionRefs:[]),reference.id])]
      }});
    }
    await loadThoughts();
  };

  const selectTool=(slot:CompanionSlot,tool:CompanionTool)=>{
    if(slot==="top"&&p.configuration)p.onConfigureClose?.();
    if(slot==="bottom"&&fixed===bottom&&bottom!==tool)return;
    let nextTop=slot==="top"?tool:top;
    let nextBottom=slot==="bottom"?tool:bottom;
    if(p.options.matchingTool==="swap"&&nextTop===nextBottom){
      if(fixed===bottom&&slot==="top")return;
      if(slot==="top")nextBottom=top;else nextTop=bottom;
    }
    setTop(nextTop);setBottom(nextBottom);
    p.onOptions({primary:nextTop,secondary:nextBottom});
  };
  const duplicateToOtherPane=(source:CompanionSlot,tool:CompanionTool)=>{
    const destination:CompanionSlot=source==="top"?"bottom":"top";
    if(destination==="bottom"&&fixed===bottom&&bottom!==tool){
      setMessage("Unpin the lower tool before opening another view there.");
      setTabMenu(null);return;
    }
    setPanes(prev=>({...prev,[destination]:cloneCompanionView(prev[source],prev[destination],tool)}));
    const nextTop=destination==="top"?tool:top;
    const nextBottom=destination==="bottom"?tool:bottom;
    setTop(nextTop);setBottom(nextBottom);setTabMenu(null);
    p.onOptions({primary:nextTop,secondary:nextBottom,layout:"split",
      matchingTool:nextTop===nextBottom?"duplicate":p.options.matchingTool});
  };
  const resizeStart=useRef<{y:number;percent:number;height:number;moved:boolean}|null>(null);
  const commitDrawer=(percent:number)=>{
    const next=percent<15?0:Math.max(25,Math.min(75,Math.round(percent)));
    drawerHeightRef.current=next;setDrawerHeight(next);
    if(next===0)p.onOptions({layout:"single"});
    else p.onOptions({layout:"split",splitPercent:100-next});
  };
  const showTabTooltip=(event:SyntheticEvent<HTMLButtonElement>,title:string)=>{
    if(p.options.tabDisplay!=="icons"||tabMenu)return;
    // Anchor to the visible glyph, not the full-height tab button or its underline.
    const rect=(event.currentTarget.querySelector("svg, span")??event.currentTarget).getBoundingClientRect();
    // Size the hover label to the text while retaining its icon-centered anchor.
    const width=Math.max(58,Math.ceil(title.length*6.3+22));
    const position=positionCompanionPopover(
      rect,{width:window.innerWidth,height:window.innerHeight},
      {width,height:34},"center"
    );
    setTabTooltip({title,...position,width});
  };
  const showTabMenu=(event:MouseEvent<HTMLButtonElement>,slot:CompanionSlot,tool:CompanionTool)=>{
    event.preventDefault();
    event.stopPropagation();
    // Anchor to the visible glyph, not the full-height tab button or its underline.
    const rect=(event.currentTarget.querySelector("svg, span")??event.currentTarget).getBoundingClientRect();
    const position=positionCompanionPopover(
      rect,{width:window.innerWidth,height:window.innerHeight},
      {width:218,height:50},"start"
    );
    setTabTooltip(null);
    setTabMenu({slot,tool,...position});
  };
  const tabList=(slot:CompanionSlot,value:CompanionTool)=>
    <nav role="tablist" aria-label={slot==="top"?"Primary Companion tools":"Secondary Companion tools"}
      className={"aaa-companion-header-tabs aaa-companion-tabs-"+p.options.tabDisplay}>
      {slot==="top"&&p.configuration&&<button type="button" role="tab" aria-selected={true} className="active" aria-label="Configure widget" onClick={()=>{}}>
        <Settings2 size={20}/>{p.options.tabDisplay!=="icons"&&<span>CONFIGURE</span>}
      </button>}
      {tools.map(t=><button type="button" role="tab" key={t.key} aria-selected={slot==="top"&&p.configuration?false:value===t.key}
        aria-label={t.title}
        disabled={slot==="bottom"&&fixed===bottom&&value!==t.key}
        className={!p.configuration&&value===t.key?"active":""} onClick={()=>{setTabTooltip(null);selectTool(slot,t.key)}}
        onMouseEnter={e=>showTabTooltip(e,t.title)}
        onMouseLeave={()=>setTabTooltip(null)}
        onFocus={e=>showTabTooltip(e,t.title)}
        onBlur={()=>setTabTooltip(null)}
        onContextMenu={e=>showTabMenu(e,slot,t.key)}>
        {p.options.tabDisplay!=="labels"&&(t.key==="agenda"?<CalendarDays size={20}/>:t.key==="context"?<BookOpen size={20}/>:<Lightbulb size={20}/>)}
        {p.options.tabDisplay!=="icons"&&<span>{t.title.toUpperCase()}</span>}
      </button>)}
    </nav>;
  const secondaryHeader=()=><header className="aaa-hybrid-header aaa-companion-secondary-header">
    {databaseEditorId&&p.configuration?<div className="aaa-widget-secondary-context-title"><Database size={15}/> DATABASE · PROPERTIES</div>:tabList("bottom",bottom)}
    {databaseEditorId&&<button className="aaa-widget-secondary-context-close" onClick={()=>{
      setDatabaseEditorId(null);if(p.options.layout==="single"){drawerHeightRef.current=0;setDrawerHeight(0)}
    }} aria-label="Close second database Context"><X size={16}/></button>}
  </header>;
  const editDatabaseInContext=(id:string)=>{
    setDatabaseEditorId(id);
    if(drawerHeightRef.current<35){drawerHeightRef.current=50;setDrawerHeight(50)}
  };
  const body=(slot:CompanionSlot,tool:CompanionTool)=>{
    if(tool==="agenda")return <CompanionAgendaView
      date={panes[slot].agenda.date} today={p.today} now={p.now}
      timeZone={p.timeZone} jump={p.options.jump}
      onDate={date=>updateAgenda(slot,{date,selected:null})}
      selected={panes[slot].agenda.selected}
      onSelected={selected=>updateAgenda(slot,{selected})}
      occurrencesForDate={p.occurrencesForDate} colour={p.colour} format={p.format}
      onNew={p.onNew} onToggleTask={p.onToggleTask} onOpenThought={p.onOpenThought}/>;
    if(tool==="context")return <CompanionContextView
      paneLabel={slot==="top"?"Top":"Bottom"}
      current={currentTarget} recent={recent}
      state={panes[slot].context} onState={patch=>updateContext(slot,patch)}
      configs={configs} onConfigs={saveConfigs} visibility={p.options.visibility}/>;
    return <CompanionThoughtsView
      paneLabel={slot==="top"?"Top":"Bottom"}
      current={currentTarget} recent={recent}
      state={panes[slot].thoughts} onState={patch=>updateThoughts(slot,patch)}
      thoughts={thoughts} loading={loadingThoughts}
      onRefresh={loadThoughts} onCapture={captureThought} onOpenThought={p.onOpenThought}/>;
  };
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
          <div className="aaa-hybrid-slot-body">{p.configuration?<WidgetConfigurePanel selection={p.configuration} onClose={()=>p.onConfigureClose?.()} onEditDatabase={editDatabaseInContext}/>:body("top",top)}</div>
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
          <div className="aaa-hybrid-slot-body">{databaseEditorId&&p.configuration?<WidgetDatabaseEditorPanel target={p.configuration} databaseId={databaseEditorId} onClose={()=>{
            setDatabaseEditorId(null);if(p.options.layout==="single"){drawerHeightRef.current=0;setDrawerHeight(0)}
          }}/>:body("bottom",bottom)}</div>
        </div>}
      </div>
      {message&&<div className="aaa-companion-message" role="status">{message}<button onClick={()=>setMessage("")} aria-label="Dismiss"><X size={13}/></button></div>}
    </aside>
    {tabTooltip&&!tabMenu&&p.options.tabDisplay==="icons"&&typeof document!=="undefined"&&createPortal(
      <div className="aaa-companion-tab-tooltip" role="tooltip"
        style={{left:tabTooltip.left,top:tabTooltip.top,width:tabTooltip.width}}>{tabTooltip.title}</div>,
      document.body
    )}
    {tabMenu&&typeof document!=="undefined"&&createPortal(<>
      <button type="button" className="aaa-companion-tab-menu-shield" tabIndex={-1} aria-label="Close Companion tab menu"
        onClick={()=>setTabMenu(null)}/>
      <div className="aaa-companion-tab-menu" role="menu" aria-label={tools.find(t=>t.key===tabMenu.tool)?.title+" options"}
        style={{left:tabMenu.left,top:tabMenu.top}}>
        <button type="button" role="menuitem"
          onClick={()=>duplicateToOtherPane(tabMenu.slot,tabMenu.tool)}>
          <PanelsTopLeft size={15}/>
          {tabMenu.slot==="top"?"Open in second panel":"Open in first panel"}
        </button>
      </div>
    </>,document.body)}
  </>;
}
