"use client";
import {Fragment,useCallback,useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowDown,ArrowUp,BookOpen,Check,ChevronDown,ChevronRight,ChevronUp,Copy,Database,Eye,EyeOff,LayoutGrid,Link2,Lock,Unlock,MoreHorizontal,Pencil,Plus,RefreshCw,Search,Settings2,Trash2,Unlink2,X} from "lucide-react";
import {useWidgetFormationPreferences} from "@/lib/widget-layout-preferences";
import {magneticSnapWidth,setWidgetRowLock,widgetBandIdentity,widgetBandLocked,widgetRowOccupancy,widgetRowPinned,widgetSizeLocked} from "@/lib/widget-formation";
import {supabase} from "@/lib/supabase";
import {applyViewRules} from "@/lib/db-engine/view-operators";
import {chronologyAddresses,perspectiveChronologyLabel} from "@/lib/db-engine/hierarchy-numbering";
import {copyWidgetBlueprint,groupPageWidgets,placementConfigAfterPublish,widgetConfig,widgetGridSize,widgetHeightPx,widgetIsSynced,widgetPlacementConfig,widgetSectionId,type WidgetConfig,type WidgetConfigureTarget,type WidgetDatabase,type WidgetDefinition,type WidgetProperty,type WidgetRecord,type WidgetRelation,type WidgetView,type WidgetPageSection,type LibraryPage,type PageWidget} from "@/lib/widget-system";
import {widgetVisualHierarchy,widgetVisualTracks,applyWidgetDoubleClickAction,expandWidgetIntoVacantLane,placeWidget,reorderWidgetColumn,removeWidgetAndCompactLayout,resizeWidgetLane,resizeWidgetHeight,widgetDoubleClickDescription,widgetDropEdgeAtPoint,widgetReorderZoneAtPoint,widgetLayoutBands,widgetFootprintHeight,WIDGET_EDITOR_FOOTER_PX,type WidgetVisualNode,type WidgetDoubleClickAction,type WidgetDropTarget,type WidgetLayoutLane,type WidgetLayoutBand} from "@/lib/widget-layout";
import {initialFluidRects,fluidCanvasHeight,fluidPointerRect,placeFluidWidget,resizeFluidWidget,clampFluidRect,
  insertFluidBeside,alignFluidWidgetEdge,fluidSharedBoundaries,resizeFluidSharedBoundary,
  fluidDropTargetAtPoint,liftFluidIntoVacancy,preferVacantSnap,fluidGroupId,setFluidGroup,FLUID_GAP,
  type FluidWidgetRect} from "@/lib/widget-fluid-layout";
import {insertPresetWidget,movePresetWidget,presetSizingOf,presetToUnits,
  resizePresetDivider,presetUpdatePreferred,swapPresetWidgets,presetDropTargetAtPoint} from "@/lib/widget-preset-layout";
import {modeAtWidth,modeWithHysteresis,type PresetContentMode} from "@/lib/widget-preset-presentation";
import DatabasePropertyValue from "@/components/database-property-value";
import WidgetPlacementChooser,{type WidgetPlacementChoice} from "@/components/widget-placement-chooser";
import {isWidgetRecordExpanded,toggleWidgetRecordExpanded} from "@/lib/widget-inline-details";
import PlanningWorkspace from "@/components/planning-workspace";
import type {CompanionInspection} from "@/lib/companion-config";

type Mode="library"|"goals"|"widgets";
type Selection={kind:"definition"|"instance";id:string}|null;
type Props={
  mode:Mode;visualStyle?:"classic"|"studio"|"blend";headerPosition?:"top"|"bottom";
  cornerDoubleClick?:WidgetDoubleClickAction;bottomDoubleClick?:WidgetDoubleClickAction;
  activePageId?:string;newPageIntent?:number;
  editIntent?:number;
  developerActive?:boolean;
  onEditModeChange?:(editing:boolean)=>void;
  onInspect?:(selection:CompanionInspection)=>void;
  previewMount?:HTMLElement|null;
  modeToggleMount?:HTMLElement|null;
  onPages?:(items:{id:string;title:string}[])=>void;
  onPage?:(id:string)=>void;
  onConfigure:(target:WidgetConfigureTarget|null)=>void;
  onOpenConfigure:()=>void;
  onOpenDeveloper?:()=>void;
  onOpenRecord:(id:string)=>void;
  onPlanningContext?:(items:{id:string;title:string}[])=>void;
  onSchedule?:(task:{id:string;title:string;workingId?:string})=>void;
};
type Snapshot={
  pages:LibraryPage[];sections:WidgetPageSection[];instances:PageWidget[];definitions:WidgetDefinition[];
  databases:WidgetDatabase[];views:WidgetView[];properties:WidgetProperty[];
  records:WidgetRecord[];relations:WidgetRelation[];perspectives:{record_id:string;character_id:string;event_id:string}[];titles:Record<string,string>;
};
const empty:Snapshot={pages:[],sections:[],instances:[],definitions:[],databases:[],views:[],properties:[],records:[],relations:[],perspectives:[],titles:{}};
type SaveTable="aaa_widget_definitions"|"aaa_page_widgets"|"aaa_page_sections"|"aaa_library_pages";
type FluidDropIntent="free"|"above"|"below"|"left"|"right"|"replace"|"blocked";
type FluidDrop={sectionId:string;id:string;rect:FluidWidgetRect;intent:FluidDropIntent;
  targetId?:string;projected?:Record<string,FluidWidgetRect>};

/** Observe the actual inner widget width; breakpoints never rewrite geometry. */
function PresetContentRegion({children}:{children:(mode:PresetContentMode)=>React.ReactNode}){
  const ref=useRef<HTMLDivElement|null>(null);
  const [mode,setMode]=useState<PresetContentMode>("expanded");
  const lastWidth=useRef<number|null>(null);
  const lastMode=useRef<PresetContentMode|null>(null);
  useEffect(()=>{
    const element=ref.current;if(!element)return;
    let frame=0,settled=0;
    const read=()=>{
      const width=Math.round(element.getBoundingClientRect().width);
      if(lastWidth.current===width)return;
      lastWidth.current=width;
      const next=modeWithHysteresis(width,lastMode.current);
      lastMode.current=next;
      setMode(current=>current===next?current:next);
      // On pointer release/settle, snap to the direct mode so hysteresis
      // cannot leave a presentation permanently on the wrong side.
      window.clearTimeout(settled);
      settled=window.setTimeout(()=>{
        const final=modeAtWidth(Math.round(element.getBoundingClientRect().width));
        lastMode.current=final;
        setMode(current=>current===final?current:final);
      },180);
    };
    const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(read)};
    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(measure);
    observer?.observe(element);measure();
    return()=>{observer?.disconnect();cancelAnimationFrame(frame);window.clearTimeout(settled)};
  },[]);
  return <div ref={ref} className="aaa-widget-preset-content" data-aaa-responsive-mode={mode}>
    {children(mode)}
  </div>;
}

export default function WidgetStudio(p:Props){
  const [data,setData]=useState<Snapshot>(empty);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [arrange,setArrange]=useState(false);
  const [sectionPrefs,setSectionPrefs]=useState<Record<string,{collapsed:boolean;hideLabel:boolean;hideSummary:boolean;label:string}>>({});
  const [sectionToolsVisible,setSectionToolsVisible]=useState(false);
  // Temporary Arrange Mode folding only; saved sizes and record views remain
  // unchanged in Use Mode and after reload.
  const [collapsedWidgets,setCollapsedWidgets]=useState<string[]>([]);
  const flipWidgetCollapse=(id:string)=>setCollapsedWidgets(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const [formation,setFormation]=useWidgetFormationPreferences();
  const fillGaps=formation.fillFreedSpace!=="off";
  const [selected,setSelected]=useState<Selection>(null);
  const [creatingPage,setCreatingPage]=useState(false);
  const [newPage,setNewPage]=useState("");
  const [renamingPage,setRenamingPage]=useState(false);
  const [pageDraft,setPageDraft]=useState("");
  const [creatingSection,setCreatingSection]=useState(false);
  const [newSection,setNewSection]=useState("");
  const [pickerSection,setPickerSection]=useState("");
  const [addWidget,setAddWidget]=useState(false);
  const [placementRequest,setPlacementRequest]=useState<{band:WidgetLayoutBand;target:WidgetDropTarget}|null>(null);
  const [search,setSearch]=useState<Record<string,string>>({});
  const [newRecord,setNewRecord]=useState<Record<string,string>>({});
  // Expanded records are independent, per widget and per record.
  // Opening one record must not collapse its neighbors.
  const [expandedRecords,setExpandedRecords]=useState<Record<string,string[]>>({});
  const [drag,setDrag]=useState<string|null>(null);
  const [selectedWidgetIds,setSelectedWidgetIds]=useState<string[]>([]);
  const fluidEnabled=p.mode!=="widgets";
  const [fluidDrop,setFluidDrop]=useState<FluidDrop|null>(null);
  const fluidDropRef=useRef<FluidDrop|null>(null);
  const fluidDragAnchor=useRef({x:20,y:18});
  const fluidDragPointerY=useRef<number|null>(null);
  const fluidResizeStart=useRef<{id:string;handle:"left"|"right"|"top"|"bottom-left"|"bottom-right"|"bottom";
    x:number;y:number;unit:number;initial:PageWidget[]}|null>(null);
  const sharedResizeStart=useRef<{leftId:string;rightId:string;x:number;unit:number;
    initial:PageWidget[]}|null>(null);
  const [dropHint,setDropHint]=useState<WidgetDropTarget|null>(null);
  const [reorderPreview,setReorderPreview]=useState<PageWidget[]|null>(null);
  const [expandedWidgetActions,setExpandedWidgetActions]=useState<string|null>(null);
  const touchDrag=useRef<{id:string;x:number;y:number;active:boolean;target:WidgetDropTarget|null;
    handle?:HTMLElement;pointerId?:number}|null>(null);
  const previewPointer=useRef<{id:string;x:number;y:number;active:boolean;target:WidgetDropTarget|null;
    handle?:HTMLElement;pointerId?:number}|null>(null);
  const returnWidgetRef=useRef<(id:string)=>void>(()=>{});
  const dividerWasResized=useRef(false);
  const spanHandleDrag=useRef<{id:string;side:"left"|"right";x:number;completed:boolean}|null>(null);
  const spanHandleConsumedClick=useRef<string|null>(null);
  const [resizePreview,setResizePreview]=useState<PageWidget[]|null>(null);
  const [snapGuide,setSnapGuide]=useState(false);
  const [measuredWidgetHeights,setMeasuredWidgetHeights]=useState<Record<string,number>>({});
  const resizePreviewRef=useRef<PageWidget[]|null>(null);
  const resizeStart=useRef<{id:string;x:number;y:number;unitX:number;heightPx:number;axis:"x"|"y"|"both";
    side:"left"|"right";initial:PageWidget[]}|null>(null);
  const [duplicate,setDuplicate]=useState<PageWidget|null>(null);
  const [duplicateMode,setDuplicateMode]=useState<"independent"|"synced">("independent");
  const [duplicatePageId,setDuplicatePageId]=useState("");
  const [creatingDatabase,setCreatingDatabase]=useState(false);
  const [newDatabaseName,setNewDatabaseName]=useState("");
  const [removeTarget,setRemoveTarget]=useState<{kind:"instance"|"definition";id:string;databaseId:string|null}|null>(null);
  const [removeCore,setRemoveCore]=useState(false);
  const [deleteConfirmation,setDeleteConfirmation]=useState("");
  const pending=useRef<Map<string,{table:SaveTable;id:string;patch:Record<string,unknown>;timer:ReturnType<typeof setTimeout>}>>(new Map());
  const snapshot=useRef(data);
  snapshot.current=data;
  const report=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
  const check=(result:{error:{message:string}|null})=>{if(result.error)throw new Error(result.error.message)};

  const load=useCallback(async()=>{
    const [a,b,c,d,e,f,g,h,i,j,k]=await Promise.all([
      supabase.from("aaa_library_pages").select("id,area,title,position").order("position"),
      supabase.from("aaa_page_widgets").select("id,page_id,definition_id,kind,title,config,width,height,position").order("position"),
      supabase.from("aaa_widget_definitions").select("id,name,database_id,view_id,config").order("created_at"),
      supabase.from("db_databases").select("id,name,icon").is("archived_at",null).order("name"),
      supabase.from("db_views").select("id,database_id,name,layout,config"),
      supabase.from("db_properties").select("id,database_id,name,type,config,position").is("archived_at",null).order("position"),
      supabase.from("db_records").select("record_id,database_id,sequence_no,version,values_json,position").is("archived_at",null).limit(2000),
      supabase.from("db_relations").select("source_record_id,target_record_id,property_id").limit(2000),
      supabase.from("user_items").select("id,title").eq("item_type","thought").limit(3000),
      supabase.from("db_perspectives").select("record_id,character_id,event_id").limit(2000),
      supabase.from("aaa_page_sections").select("id,page_id,title,position").order("position")
    ]);
    [a,b,c,d,e,f,g,h,i,j,k].forEach(check);
    const names:Record<string,string>={};
    (i.data??[]).forEach(row=>{names[row.id]=row.title||"Untitled"});
    (j.data??[]).forEach(row=>{names[row.record_id]=(names[row.character_id]||"Unknown character")+" during "+(names[row.event_id]||"Unknown event")});
    const next:Snapshot={
      pages:(a.data??[]) as LibraryPage[],sections:(k.data??[]) as WidgetPageSection[],instances:(b.data??[]) as PageWidget[],definitions:(c.data??[]) as WidgetDefinition[],
      databases:(d.data??[]) as WidgetDatabase[],views:(e.data??[]) as WidgetView[],properties:(f.data??[]) as WidgetProperty[],
      records:(g.data??[]) as WidgetRecord[],relations:(h.data??[]) as WidgetRelation[],perspectives:(j.data??[]) as Snapshot["perspectives"],titles:names
    };
    if(p.mode==="goals"&&!next.pages.some(x=>x.area==="goals")){
      const {data:page,error:pageError}=await supabase.from("aaa_library_pages").insert({area:"goals",title:"Overview",position:0}).select("id,area,title,position").single();
      if(pageError)throw new Error(pageError.message);
      next.pages.push(page as LibraryPage);
      const {data:section,error:sectionError}=await supabase.from("aaa_page_sections").insert({page_id:page.id,title:"Overview",position:0}).select("id,page_id,title,position").single();
      if(sectionError)throw new Error(sectionError.message);
      next.sections.push(section as WidgetPageSection);
      const {data:widget,error:widgetError}=await supabase.from("aaa_page_widgets").insert({page_id:page.id,kind:"goals",width:12,height:4,position:0,config:{sectionId:section.id}}).select("id,page_id,definition_id,kind,title,config,width,height,position").single();
      if(widgetError)throw new Error(widgetError.message);
      next.instances.push(widget as PageWidget);
    }
    setData(next);
    setError("");
  },[p.mode]);

  useEffect(()=>{let alive=true;void load().catch(e=>{if(alive)report(e)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false}},[load]);
  useEffect(()=>()=>{
    // Flush any debounced saves when leaving a page, so no keystroke is lost.
    for(const entry of pending.current.values()){
      clearTimeout(entry.timer);
      void supabase.from(entry.table).update(entry.patch).eq("id",entry.id);
    }
    pending.current.clear();
    p.onConfigure(null);
  // The studio is keyed by destination; cleanup is deliberately only on unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const queueSave=(table:SaveTable,id:string,patch:Record<string,unknown>)=>{
    const key=table+":"+id;
    const previous=pending.current.get(key);
    if(previous)clearTimeout(previous.timer);
    const next={table,id,patch:{...previous?.patch,...patch},timer:setTimeout(async()=>{
      pending.current.delete(key);
      const {error}=await supabase.from(table).update(next.patch).eq("id",id);
      if(error)setError("Could not save widget: "+error.message);
    },500)};
    pending.current.set(key,next);
  };
  const changeDefinition=(id:string,patch:Partial<WidgetDefinition>)=>{
    setData(s=>({...s,definitions:s.definitions.map(d=>d.id===id?{...d,...patch}:d)}));
    queueSave("aaa_widget_definitions",id,patch);
  };
  const changeInstance=(id:string,patch:Partial<PageWidget>)=>{
    setData(s=>({...s,instances:s.instances.map(w=>w.id===id?{...w,...patch}:w)}));
    queueSave("aaa_page_widgets",id,patch);
  };
  const area=p.mode==="goals"?"goals":"library";
  const pages=data.pages.filter(x=>x.area===area);
  const page=pages.find(x=>x.id===p.activePageId)??pages[0];
  const presetEnabled=formation.presetWidths;
  useEffect(()=>{if(p.editIntent)setArrange(true)},[p.editIntent]);
  useEffect(()=>{
    if(!page?.id)return;
    try{
      const raw=localStorage.getItem("aaa-section-display-v1:"+page.id);
      const stored=raw?JSON.parse(raw):{};
      setSectionPrefs(stored&&typeof stored==="object"&&!Array.isArray(stored)?stored:{});
    }catch{setSectionPrefs({})}
  },[page?.id]);
  const updateSectionDisplay=(id:string,patch:Partial<{collapsed:boolean;hideLabel:boolean;hideSummary:boolean;label:string}>)=>{
    const current=sectionPrefs[id];
    const next={...sectionPrefs,[id]:{collapsed:current?.collapsed??false,hideLabel:current?.hideLabel??false,
      hideSummary:current?.hideSummary??false,label:current?.label??"",...patch}};
    setSectionPrefs(next);
    try{if(page?.id)localStorage.setItem("aaa-section-display-v1:"+page.id,JSON.stringify(next))}catch{}
  };
  const changeMode=(editing:boolean)=>{setArrange(editing);if(!editing)setSelectedWidgetIds([]);p.onEditModeChange?.(editing)};
  const instanceList=data.instances.filter(w=>w.page_id===page?.id).sort((a,b)=>a.position-b.position);
  const selectedPageWidgets=instanceList.filter(widget=>selectedWidgetIds.includes(widget.id));
  const selectedCanGroup=selectedPageWidgets.length>=2&&
    new Set(selectedPageWidgets.map(widgetSectionId)).size===1;
  const groupSelectedWidgets=()=>{
    if(!selectedCanGroup)return;
    const changed=setFluidGroup(instanceList,selectedPageWidgets.map(widget=>widget.id),crypto.randomUUID());
    saveLayout(changed);setSelectedWidgetIds([]);
    setNotice("Widgets grouped. Drag any member to move the group together.");
  };
  const ungroupSelectedWidgets=()=>{
    const groups=new Set(selectedPageWidgets.map(fluidGroupId).filter((id):id is string=>!!id));
    if(!groups.size)return;
    const ids=instanceList.filter(widget=>groups.has(fluidGroupId(widget)??"")).map(widget=>widget.id);
    saveLayout(setFluidGroup(instanceList,ids,null));setSelectedWidgetIds([]);
    setNotice("The widgets are independent again.");
  };
  const allWidgetsCollapsed=instanceList.length>0&&instanceList.every(w=>collapsedWidgets.includes(w.id));
  const toggleAllWidgetCollapse=()=>setCollapsedWidgets(old=>allWidgetsCollapsed?old.filter(id=>!instanceList.some(w=>w.id===id))
    :[...new Set([...old,...instanceList.map(w=>w.id)])]);
  const pageSections=data.sections.filter(s=>s.page_id===page?.id).sort((a,b)=>a.position-b.position);
  // Full-card dragging previews the shifted lane order. Persistence occurs
  // only on drop, leaving database identities unchanged while hovering.
  const layoutItems=reorderPreview??resizePreview??instanceList;
  const sectionGroups=page?groupPageWidgets(page.id,pageSections,layoutItems):[];
  const activePlacementSection=pageSections.some(s=>s.id===pickerSection)?pickerSection:pageSections[0]?.id??"";
  useEffect(()=>{
    if(p.mode==="widgets")return;
    p.onPages?.(pages.map(({id,title})=>({id,title})));
    if(page&&p.activePageId!==page.id)p.onPage?.(page.id);
  // Avoid extra parent updates while editing widget configuration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[p.mode,p.activePageId,data.pages]);
  useEffect(()=>{if(p.newPageIntent)setCreatingPage(true)},[p.newPageIntent]);
  // A content-fitted widget has intrinsic rather than configured height.
  // Measure rendered cards so shared Stack guides appear when neighboring
  // columns genuinely finish at the same position, not merely when their
  // saved numeric heights happen to match.
  useEffect(()=>{
    if(!arrange||typeof ResizeObserver==="undefined")return;
    const host=document.querySelector(".aaa-widget-studio .aaa-widget-sections");
    if(!host)return;
    const elements=Array.from(host.querySelectorAll<HTMLElement>("[data-aaa-layout-widget-id]"));
    if(!elements.length)return;
    const refresh=()=>{
      const next:Record<string,number>={};
      for(const el of elements){
        const id=el.getAttribute("data-aaa-layout-widget-id");
        if(id)next[id]=Math.round(el.getBoundingClientRect().height);
      }
      setMeasuredWidgetHeights(current=>{
        const ids=Object.keys(next);
        return ids.length===Object.keys(current).length&&ids.every(id=>Math.abs((current[id]??-999)-next[id])<=2)
          ?current:next;
      });
    };
    const observer=new ResizeObserver(refresh);
    for(const element of elements)observer.observe(element);
    refresh();
    return ()=>observer.disconnect();
  },[arrange,page?.id,data.instances,collapsedWidgets,resizePreview,loading]);

  const createPage=async()=>{
    const title=newPage.trim();if(!title||busy)return;
    setBusy(true);
    try{
      const {data:row,error}=await supabase.from("aaa_library_pages")
        .insert({area,title,position:pages.length?Math.max(...pages.map(x=>x.position))+1:0})
        .select("id,area,title,position").single();
      if(error)throw error;
      setData(s=>({...s,pages:[...s.pages,row as LibraryPage]}));
      const {data:section,error:sectionError}=await supabase.from("aaa_page_sections")
        .insert({page_id:row.id,title:"Overview",position:0}).select("id,page_id,title,position").single();
      if(sectionError)throw sectionError;
      setData(s=>({...s,sections:[...s.sections,section as WidgetPageSection]}));
      setCreatingPage(false);setNewPage("");p.onPage?.(row.id);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const renamePage=()=>{
    if(!page)return;
    const title=pageDraft.trim();
    if(title&&title!==page.title){
      setData(s=>({...s,pages:s.pages.map(row=>row.id===page.id?{...row,title}:row)}));
      queueSave("aaa_library_pages",page.id,{title});
    }
    setRenamingPage(false);
  };
  const createSection=async()=>{
    const title=newSection.trim();
    if(!page||!title||busy)return;
    setBusy(true);
    try{
      const {data:row,error}=await supabase.from("aaa_page_sections")
        .insert({page_id:page.id,title,position:pageSections.length?Math.max(...pageSections.map(s=>s.position))+1:0})
        .select("id,page_id,title,position").single();
      if(error)throw error;
      setData(s=>({...s,sections:[...s.sections,row as WidgetPageSection]}));
      setNewSection("");setCreatingSection(false);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const renameSection=(id:string,title:string)=>{
    const current=data.sections.find(s=>s.id===id);
    if(current&&title!==current.title){
      setData(s=>({...s,sections:s.sections.map(row=>row.id===id?{...row,title}:row)}));
      queueSave("aaa_page_sections",id,{title});
    }
  };
  const shiftSection=(id:string,direction:-1|1)=>{
    const index=pageSections.findIndex(s=>s.id===id),other=pageSections[index+direction];
    if(index<0||!other)return;
    const current=pageSections[index];
    setData(s=>({...s,sections:s.sections.map(row=>row.id===id?{...row,position:other.position}:row.id===other.id?{...row,position:current.position}:row)}));
    queueSave("aaa_page_sections",id,{position:other.position});
    queueSave("aaa_page_sections",other.id,{position:current.position});
  };
  const deleteSection=async(id:string)=>{
    if(instanceList.some(widget=>widgetSectionId(widget)===id)){
      setError("Move this section's widgets into another section before removing it.");return;
    }
    if(!window.confirm("Remove this empty page section?"))return;
    const {error}=await supabase.from("aaa_page_sections").delete().eq("id",id);
    if(error){report(error);return}
    setData(s=>({...s,sections:s.sections.filter(section=>section.id!==id)}));
  };
  const moveWidgetToSection=(widget:PageWidget,sectionId:string)=>{
    const config={...widget.config};
    if(sectionId)config.sectionId=sectionId;
    else delete config.sectionId;
    changeInstance(widget.id,{config});
  };
  const createDatabase=async()=>{
    const name=newDatabaseName.trim();if(!name||busy)return;
    const placeInCurrentPage=p.mode!=="widgets"&&!!page;
    setBusy(true);setError("");
    try{
      const id=crypto.randomUUID();
      const {error}=await supabase.rpc("db_create_database",{p_id:id,p_name:name,p_dataset:"acceptance"});
      if(error)throw error;
      if(placeInCurrentPage&&page){
        const {data:definition,error:definitionError}=await supabase.from("aaa_widget_definitions")
          .insert({name:name+" view",database_id:id,config:{renderer:"table",editable:true,allowCreate:true}})
          .select("id,name,database_id,view_id,config").single();
        if(definitionError)throw definitionError;
        const {error:placementError}=await supabase.from("aaa_page_widgets").insert({page_id:page.id,definition_id:definition.id,
          kind:"database",position:instanceList.length,width:12,height:2,config:activePlacementSection?{sectionId:activePlacementSection}:{}});
        if(placementError)throw placementError;
      }
      await load();setNewDatabaseName("");setCreatingDatabase(false);setAddWidget(false);
      setNotice(`${name} was created in Databases. ${placeInCurrentPage?"This page now contains an independent view of it.":"You can now add its views to any page."}`);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const deleteDatabase=async()=>{
    const db=data.databases.find(row=>row.id===removeTarget?.databaseId);
    if(!db||deleteConfirmation!==db.name||busy)return;
    setBusy(true);setError("");
    try{
      const {error}=await supabase.rpc("db_delete_database",{p_database_id:db.id,p_confirm_name:db.name});
      if(error)throw error;
      await load();setSelected(null);setRemoveTarget(null);setRemoveCore(false);setDeleteConfirmation("");
      setNotice(`${db.name} and its source records were deleted. All views linked to it were removed.`);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const createDefinition=async()=>{
    if(busy)return;setBusy(true);
    try{
      const {data:row,error}=await supabase.from("aaa_widget_definitions")
        .insert({name:"Untitled widget",database_id:null,config:{renderer:"table"}})
        .select("id,name,database_id,view_id,config").single();
      if(error)throw error;
      setData(s=>({...s,definitions:[...s.definitions,row as WidgetDefinition]}));
      setSelected({kind:"definition",id:row.id});
      p.onInspect?.({id:row.id,definitionId:row.id,title:row.name,kind:"database",databaseName:"Not connected",viewName:"Default view",renderer:"table",samples:[],fields:[]});
      (p.onOpenDeveloper??p.onOpenConfigure)();
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const createDefinitionRef=useRef(createDefinition);
  createDefinitionRef.current=createDefinition;
  useEffect(()=>{
    const create=()=>{void createDefinitionRef.current()};
    window.addEventListener("aaa-developer-create-widget",create);
    return()=>window.removeEventListener("aaa-developer-create-widget",create);
  },[]);
  useEffect(()=>{
    if(!p.developerActive||selected||loading)return;
    const first=instanceList[0];
    if(first)setSelected({kind:"instance",id:first.id});
    else if(data.definitions[0])setSelected({kind:"definition",id:data.definitions[0].id});
  // Only seed selection when entering an empty Developer pane.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[p.developerActive,selected,loading]);
  const preparedPlacement=(created:PageWidget,placement?:WidgetDropTarget,
    heightMode:"preferred"|"match"="preferred")=>{
    const anchor=instanceList.find(widget=>widget.id===placement?.targetId);
    const initial=heightMode==="match"&&anchor
      ?{...created,config:{...created.config,fitContent:false,heightPx:widgetHeightPx(anchor)}}
      :created;
    const proposed=placement?placeWidget([...instanceList,initial],pageSections,initial.id,placement,fillGaps,formation):null;
    // If a drop cannot occupy a full or locked row, create a separate band.
    // Never leave a freshly inserted Supabase placement invisible/orphaned.
    const placed=proposed&&placement&&
      !proposed.find(w=>w.id===initial.id)?.config.layoutBand&&placement.targetId
      ?placeWidget([...instanceList,initial],pageSections,initial.id,
        {sectionId:placement.sectionId,targetId:placement.targetId,edge:"new-row"},fillGaps,formation)
      :proposed;
    if(placed){
      for(const widget of placed){
        const old=instanceList.find(previous=>previous.id===widget.id);
        if(!old||widget.width!==old.width||widget.position!==old.position||
          JSON.stringify(widget.config)!==JSON.stringify(old.config))
          queueSave("aaa_page_widgets",widget.id,{
            position:widget.position,width:widget.width,height:widget.height,config:widget.config
          });
      }
    }
    return {initial,placed};
  };
  const createAndPlaceWidget=async(sectionOverride?:string,placement?:WidgetDropTarget,
    heightMode:"preferred"|"match"="preferred")=>{
    if(!page||busy)return;
    const sectionId=sectionOverride??activePlacementSection;
    setBusy(true);
    let createdDefinition:WidgetDefinition|null=null;
    try{
      const {data:definition,error:definitionError}=await supabase.from("aaa_widget_definitions")
        .insert({name:"Untitled widget",database_id:null,config:{renderer:"table"}})
        .select("id,name,database_id,view_id,config").single();
      if(definitionError)throw definitionError;
      createdDefinition=definition as WidgetDefinition;
      const {data:instance,error:instanceError}=await supabase.from("aaa_page_widgets")
        .insert({page_id:page.id,definition_id:createdDefinition.id,kind:"database",
          position:instanceList.length?Math.max(...instanceList.map(w=>w.position))+1:0,width:12,height:2,
          config:sectionId?{sectionId}:{} })
        .select("id,page_id,definition_id,kind,title,config,width,height,position").single();
      if(instanceError)throw instanceError;
      const {initial,placed}=preparedPlacement(instance as PageWidget,placement,heightMode);
      setData(s=>({...s,definitions:[...s.definitions,createdDefinition!],
        instances:placed?[...s.instances.filter(w=>w.page_id!==page.id),...placed]:[...s.instances,initial]}));
      setAddWidget(false);
      setArrange(true);
      setSelected({kind:"instance",id:instance.id});
      p.onInspect?.({id:instance.id,definitionId:createdDefinition.id,title:createdDefinition.name,kind:"database",
        databaseName:"Not connected",viewName:"Default view",renderer:"table",samples:[],fields:[]});
      setError("");
      (p.onOpenDeveloper??p.onOpenConfigure)();
      setNotice("New reusable widget created. Develop it in The Companion, then save changes to the master widget to reuse them.");
    }catch(e){
      if(createdDefinition){
        // Undo only the untouched master made by this action if page placement fails.
        const {error:rollbackError}=await supabase.from("aaa_widget_definitions").delete().eq("id",createdDefinition.id);
        if(rollbackError){
          setData(s=>({...s,definitions:[...s.definitions,createdDefinition!]}));
          setError("Could not place the widget on this page. Its master was kept in Developing IT → Widgets: "+String(e));
        }else report(e);
      }else report(e);
    }finally{setBusy(false)}
  };
  const addDefinition=async(definition:WidgetDefinition,placement?:WidgetDropTarget,
    heightMode:"preferred"|"match"="preferred",sourceInstance?:PageWidget,
    fluidPlacement?:FluidWidgetRect,fluidIntent?:Pick<FluidDrop,"intent"|"targetId">)=>{
    if(!page||busy)return;setBusy(true);
    try{
      // Choosing an existing view creates an independent copy by default.
      // Shared master IDs are reserved for the explicitly requested Widget Sync action.
      // A page widget may have unpublished per-instance edits. Copy the actual
      // rendered configuration and connected source, not its older master.
      const source=sourceInstance?sourceOf(sourceInstance):{
        databaseId:definition.database_id,viewId:definition.view_id};
      const copiedConfig=sourceInstance?effectiveConfig(definition,sourceInstance):
        effectiveConfig(definition);
      const blueprint=copyWidgetBlueprint(definition,source,copiedConfig,sourceInstance);
      const {data:master,error:masterError}=await supabase.from("aaa_widget_definitions")
        .insert(blueprint)
        .select("id,name,database_id,view_id,config").single();
      if(masterError)throw masterError;
      const {data:row,error}=await supabase.from("aaa_page_widgets")
        .insert({page_id:page.id,definition_id:master.id,kind:"database",position:instanceList.length?Math.max(...instanceList.map(w=>w.position))+1:0,
          width:sourceInstance?.width??12,height:sourceInstance?.height??2,
          config:{...(sourceInstance?{heightPx:widgetHeightPx(sourceInstance),
              ...("presetPreferredWidth" in sourceInstance.config?{presetPreferredWidth:sourceInstance.config.presetPreferredWidth}:{}),
              ...("presetMinWidth" in sourceInstance.config?{presetMinWidth:sourceInstance.config.presetMinWidth}:{}),
              ...("presetAllowShrink" in sourceInstance.config?{presetAllowShrink:sourceInstance.config.presetAllowShrink}:{})}:{}),
            ...(fluidPlacement?{fluidDesktop:fluidPlacement,
              heightPx:Math.max(160,fluidPlacement.h-WIDGET_EDITOR_FOOTER_PX)}:{}),
            ...(placement?.sectionId||activePlacementSection?{sectionId:placement?.sectionId??activePlacementSection}:{})}})
        .select("id,page_id,definition_id,kind,title,config,width,height,position").single();
      if(error)throw error;
      const {initial,placed}=fluidPlacement
        ?{initial:row as PageWidget,placed:(()=>{
          const withNew=[...instanceList,row as PageWidget];
          if(fluidIntent?.targetId&&(fluidIntent.intent==="left"||fluidIntent.intent==="right")){
            const fit=presetEnabled
              ?insertPresetWidget(withNew,row.id,fluidIntent.targetId,fluidIntent.intent,formation.intelligentShrinking)
              :insertFluidBeside(withNew,row.id,fluidIntent.targetId,fluidIntent.intent);
            if(fit.placed)return fit.items;
            // A size lock makes side insertion invalid. Keep the new view
            // intact and put it below the target instead of overlapping it.
            const target=initialFluidRects(withNew)[fluidIntent.targetId];
            if(target)return placeFluidWidget(withNew,row.id,
              {...fluidPlacement,x:target.x,y:target.y+target.h+FLUID_GAP});
          }
          return placeFluidWidget(withNew,row.id,fluidPlacement);
        })()}
        :preparedPlacement(row as PageWidget,placement,heightMode);
      if(fluidPlacement&&placed){
        const before=new Map(instanceList.map(w=>[w.id,w]));
        for(const item of placed){
          const previous=before.get(item.id);
          if(previous&&JSON.stringify(previous.config)!==JSON.stringify(item.config))
            queueSave("aaa_page_widgets",item.id,{config:item.config});
        }
        const inserted=placed.find(w=>w.id===row.id);
        if(inserted)queueSave("aaa_page_widgets",row.id,{config:inserted.config});
      }
      setData(s=>({...s,definitions:[...s.definitions,master as WidgetDefinition],
        instances:placed?[...s.instances.filter(w=>w.page_id!==page.id),...placed]:[...s.instances,initial]}));
      setAddWidget(false);
      setSelected({kind:"instance",id:row.id});
      p.onInspect?.({id:row.id,definitionId:master.id,title:master.name,kind:"database",
        databaseName:data.databases.find(db=>db.id===master.database_id)?.name??"Not connected",
        viewName:data.views.find(view=>view.id===master.view_id)?.name??"Default view",
        renderer:widgetConfig(master.config).renderer,samples:[],fields:data.properties.filter(field=>field.database_id===master.database_id).map(field=>({name:field.name,type:field.type}))});
      (p.onOpenDeveloper??p.onOpenConfigure)();
      setNotice("Independent view created. Editing it will not change the original widget.");
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const openPlacement=(band:WidgetLayoutBand,target:WidgetDropTarget)=>{
    if(!busy&&!drag)setPlacementRequest({band,target});
  };
  const confirmPlacement=(choice:WidgetPlacementChoice)=>{
    setPlacementRequest(null);
    const section=choice.target.sectionId;
    const definition=data.definitions.find(item=>item.id===choice.definitionId);
    if(definition)void addDefinition(definition,choice.target,choice.heightMode);
    else void createAndPlaceWidget(section,choice.target,choice.heightMode);
  };
  const duplicateWidget=async()=>{
    if(!duplicate||busy)return;
    const target=data.pages.find(row=>row.id===duplicatePageId);
    const original=data.instances.find(row=>row.id===duplicate.id),def=original?definitionOf(original):null;
    if(!target||!original||!def)return;
    setBusy(true);setError("");
    try{
      let masterId=def.id;
      if(duplicateMode==="independent"||!widgetIsSynced(original)){
        const source=sourceOf(original);
        const {data:master,error:masterError}=await supabase.from("aaa_widget_definitions")
          .insert({name:def.name+(duplicateMode==="independent"?" · Copy":" · Sync"),database_id:source.databaseId,
            view_id:source.viewId,config:effectiveConfig(def,original)})
          .select("id,name,database_id,view_id,config").single();
        if(masterError)throw masterError;
        masterId=master.id;
        if(duplicateMode==="synced"){
          // Promote this instance to a dedicated sync group. Existing unrelated
          // placements using its previous master must remain independent.
          const {error:promoteError}=await supabase.from("aaa_page_widgets").update({definition_id:masterId,title:null,
            config:{...widgetPlacementConfig(original),syncMode:"synced"}}).eq("id",original.id);
          if(promoteError)throw promoteError;
        }
      }
      const destination=data.sections.filter(s=>s.page_id===target.id).sort((a,b)=>a.position-b.position)[0];
      const targetCount=data.instances.filter(row=>row.page_id===target.id).length;
      const {error:placeError}=await supabase.from("aaa_page_widgets").insert({page_id:target.id,definition_id:masterId,
        kind:"database",title:null,config:{...(destination?{sectionId:destination.id}:{}),...(duplicateMode==="synced"?{syncMode:"synced"}:{})},
        width:original.width,height:original.height,position:targetCount});
      if(placeError)throw placeError;
      await load();setDuplicate(null);
      setNotice(duplicateMode==="synced"?"Synced copy created. Changes to either synced view update every widget in this sync group.":
        "Independent copy created. Its filters, appearance and layout are yours to change separately.");
    }catch(e){report(e);await load().catch(report)}finally{setBusy(false)}
  };
  const addGoals=async()=>{
    if(!page||busy)return;setBusy(true);
    try{
      const {data:row,error}=await supabase.from("aaa_page_widgets")
        .insert({page_id:page.id,kind:"goals",position:instanceList.length,width:12,height:4,config:activePlacementSection?{sectionId:activePlacementSection}:{}})
        .select("id,page_id,definition_id,kind,title,config,width,height,position").single();
      if(error)throw error;
      setData(s=>({...s,instances:[...s.instances,row as PageWidget]}));setAddWidget(false);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const deleteInstance=async(id:string)=>{
    const {error}=await supabase.from("aaa_page_widgets").delete().eq("id",id);
    if(error){report(error);return}
    const next=removeWidgetAndCompactLayout(instanceList,pageSections,id,fillGaps);
    const prior=new Map(instanceList.map(w=>[w.id,w]));
    setData(s=>({...s,instances:[...s.instances.filter(w=>w.page_id!==page?.id),...next]}));
    const scheduled=pending.current.get("aaa_page_widgets:"+id);
    if(scheduled){clearTimeout(scheduled.timer);pending.current.delete("aaa_page_widgets:"+id)}
    for(const widget of next){
      const old=prior.get(widget.id);
      if(old&&(old.width!==widget.width||old.position!==widget.position||JSON.stringify(old.config)!==JSON.stringify(widget.config)))
        queueSave("aaa_page_widgets",widget.id,{width:widget.width,position:widget.position,config:widget.config});
    }
    if(selected?.id===id)setSelected(null);
    setRemoveTarget(null);setRemoveCore(false);
  };
  const deleteDefinition=async(id:string)=>{
    if(data.instances.some(w=>w.definition_id===id)){setError("This widget is used on a page. Remove those instances first.");return}
    const {error}=await supabase.from("aaa_widget_definitions").delete().eq("id",id);
    if(error){report(error);return}
    setData(s=>({...s,definitions:s.definitions.filter(w=>w.id!==id)}));
    if(selected?.id===id)setSelected(null);
    setRemoveTarget(null);setRemoveCore(false);
  };
  const saveLayout=(next:PageWidget[])=>{
    const prior=new Map(instanceList.map(widget=>[widget.id,widget]));
    setData(s=>({...s,instances:s.instances.map(widget=>next.find(w=>w.id===widget.id)??widget)}));
    for(const widget of next){
      const before=prior.get(widget.id);if(!before)continue;
      const changed=before.width!==widget.width||before.height!==widget.height||before.position!==widget.position||
        JSON.stringify(before.config)!==JSON.stringify(widget.config);
      if(changed)queueSave("aaa_page_widgets",widget.id,{width:widget.width,height:widget.height,position:widget.position,config:widget.config});
    }
  };
  const clearFluidDrop=()=>{fluidDropRef.current=null;setFluidDrop(null)};
  // Native HTML dragging may never fire dragend when the Windows screenshot
  // overlay or an app switch steals focus. Unwind every piece of transient UI,
  // including pointer captures and the wheel/autoscroll state.
  const cancelInterruptedWidgetDrag=useCallback(()=>{
    const developerDrag=previewPointer.current?.active===true;
    for(const pointer of [touchDrag.current,previewPointer.current]){
      if(pointer?.handle&&pointer.pointerId!==undefined){
        try{if(pointer.handle.hasPointerCapture(pointer.pointerId))
          pointer.handle.releasePointerCapture(pointer.pointerId)}catch{}
      }
    }
    touchDrag.current=null;previewPointer.current=null;
    fluidDragPointerY.current=null;fluidDropRef.current=null;
    setFluidDrop(null);setDrag(null);setDropHint(null);setReorderPreview(null);
    document.body.classList.remove("aaa-page-widget-in-flight");
    if(developerDrag)window.dispatchEvent(new Event("aaa-developer-widget-drag-end"));
  },[]);
  useEffect(()=>{
    if(!drag)return;
    const onVisibility=()=>{if(document.hidden)cancelInterruptedWidgetDrag()};
    const onKey=(event:KeyboardEvent)=>{
      const screenshotShortcut=event.shiftKey&&(event.ctrlKey||event.metaKey)&&
        event.key.toLowerCase()==="s";
      if(event.key==="Escape"||screenshotShortcut)cancelInterruptedWidgetDrag();
    };
    window.addEventListener("blur",cancelInterruptedWidgetDrag);
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("keydown",onKey,true);
    window.addEventListener("pointercancel",cancelInterruptedWidgetDrag,true);
    window.addEventListener("dragend",cancelInterruptedWidgetDrag,true);
    return()=>{
      window.removeEventListener("blur",cancelInterruptedWidgetDrag);
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("keydown",onKey,true);
      window.removeEventListener("pointercancel",cancelInterruptedWidgetDrag,true);
      window.removeEventListener("dragend",cancelInterruptedWidgetDrag,true);
    };
  },[drag,cancelInterruptedWidgetDrag]);
  const scrollDuringWidgetDrag=useCallback((y:number)=>{
    const viewport=document.querySelector<HTMLElement>(".aaa-working-surface");
    if(!viewport)return;
    const bounds=viewport.getBoundingClientRect();
    const proximity=66;
    if(y<bounds.top+proximity)viewport.scrollTop-=Math.max(4,Math.round((bounds.top+proximity-y)/3));
    else if(y>bounds.bottom-proximity)viewport.scrollTop+=Math.max(4,Math.round((y-bounds.bottom+proximity)/3));
  },[]);
  useEffect(()=>{
    if(!fluidEnabled||!drag){fluidDragPointerY.current=null;return}
    const position=(event:DragEvent|PointerEvent)=>{fluidDragPointerY.current=event.clientY};
    const wheel=(event:WheelEvent)=>{
      const viewport=document.querySelector<HTMLElement>(".aaa-working-surface");
      if(viewport&&event.target instanceof Node&&viewport.contains(event.target)){
        viewport.scrollTop+=event.deltaY;event.preventDefault();
      }
    };
    window.addEventListener("dragover",position);
    window.addEventListener("pointermove",position);
    window.addEventListener("wheel",wheel,{passive:false});
    const ticker=window.setInterval(()=>{
      if(fluidDragPointerY.current!==null)scrollDuringWidgetDrag(fluidDragPointerY.current);
    },45);
    return()=>{window.removeEventListener("dragover",position);
      window.removeEventListener("pointermove",position);
      window.removeEventListener("wheel",wheel);window.clearInterval(ticker)};
  },[drag,fluidEnabled,scrollDuringWidgetDrag]);
  const fluidHoverAtPoint=(x:number,y:number,sourceId:string)=>{
    if(!fluidEnabled)return false;
    fluidDragPointerY.current=y;
    scrollDuringWidgetDrag(y);
    const field=document.elementFromPoint(x,y)?.closest<HTMLElement>("[data-aaa-fluid-canvas]");
    if(!field){clearFluidDrop();return false}
    const sectionId=field.dataset.aaaSectionId??"";
    const existing=instanceList.filter(w=>widgetSectionId(w)===sectionId);
    const source=instanceList.find(w=>w.id===sourceId.replace(/^developer:/,""));
    const movingGroup=source?fluidGroupId(source):null;
    const belongsToMovingGroup=(id:string)=>source?.id===id||
      movingGroup!==null&&instanceList.some(widget=>widget.id===id&&fluidGroupId(widget)===movingGroup);
    const sourceRect=source?initialFluidRects(instanceList.filter(widget=>
      widgetSectionId(widget)===widgetSectionId(source)))[source.id]:null;
    const w=presetEnabled&&source?presetToUnits(presetSizingOf(source,sourceRect??undefined).preferred)
      :sourceRect?.w??Math.max(2,Math.min(6,Number(source?.config.layoutWidth??source?.width??4)));
    const h=sourceRect?.h??(source?widgetHeightPx(source):280)+WIDGET_EDITOR_FOOTER_PX;
    const isCopy=sourceId.startsWith("developer:");
    const positions=initialFluidRects(existing);
    const otherRects=Object.entries(positions)
      .filter(([id])=>isCopy||!belongsToMovingGroup(id)).map(([,peer])=>peer);
    const raw=fluidPointerRect({x,y},field.getBoundingClientRect(),{w,h},fluidDragAnchor.current);
    const snapped=fluidPointerRect({x,y},field.getBoundingClientRect(),{w,h},fluidDragAnchor.current,
      otherRects,formation.quickEdgeSnap?formation.snapDistancePx:0);
    let rect=preferVacantSnap(raw,snapped,otherRects);
    let intent:FluidDropIntent="free",targetId:string|undefined;
    let projected:Record<string,FluidWidgetRect>|undefined;
    const stableTarget=presetEnabled
      ?presetDropTargetAtPoint(positions,field.getBoundingClientRect(),{x,y},
        isCopy?[]:existing.filter(widget=>belongsToMovingGroup(widget.id)).map(widget=>widget.id),
        fluidDropRef.current?.id===sourceId&&fluidDropRef.current?.sectionId===sectionId
          ?fluidDropRef.current.targetId:undefined)
      :fluidDropTargetAtPoint(positions,field.getBoundingClientRect(),{x,y},
        isCopy?[]:existing.filter(widget=>belongsToMovingGroup(widget.id)).map(widget=>widget.id));
    const target=stableTarget&&existing.find(widget=>widget.id===stableTarget.id);
    if(target&&target.id!==sourceId){
      targetId=target.id;
      intent=stableTarget!.intent;
      const peer=positions[target.id];
      if(intent==="above"||intent==="below"){
        rect=clampFluidRect({x:peer.x,y:intent==="above"?peer.y:peer.y+peer.h+FLUID_GAP,
          // Stacking never inherits the other card's width: the content of
          // each widget determines the width it was individually given.
          w,h});
      }else if(intent==="left"||intent==="right"){
        // Moving an existing group never shrinks an individual group member
        // just because the cursor crossed another card's insertion strip.
        if(movingGroup&&!isCopy){intent="free"}
        else {
        const mock:PageWidget={...(source??{id:sourceId,page_id:page?.id??"",definition_id:null,
          kind:"database",title:null,width:w,height:2,position:existing.length,config:{}}),
          id:sourceId,config:{...(source?.config??{}),sectionId,fluidDesktop:sourceRect??{x:raw.x,y:raw.y,w,h}}};
        const fit=presetEnabled
          ?insertPresetWidget([...existing.filter(widget=>widget.id!==sourceId),mock],
            sourceId,target.id,intent,formation.intelligentShrinking)
          :insertFluidBeside([...existing.filter(widget=>widget.id!==sourceId),mock],
            sourceId,target.id,intent);
        if(fit.placed){
          projected=initialFluidRects(fit.items);rect=projected[sourceId];
          if(presetEnabled&&"newRow" in fit&&fit.newRow)intent="below";
        }else {intent="blocked";rect=raw;projected=positions}
        }
      }else if(presetEnabled&&source&&intent==="replace"){
        const swapped=swapPresetWidgets(existing,sourceId,target.id);
        const before=initialFluidRects(existing),after=initialFluidRects(swapped);
        if(JSON.stringify(after)!==JSON.stringify(before)){
          projected=after;rect=after[sourceId];
        }else rect={...rect,x:peer.x,y:peer.y};
      }else rect={...rect,x:peer.x,y:peer.y};
    }
    if(intent==="free"&&formation.fillFreedSpace!=="off"&&!movingGroup){
      rect=liftFluidIntoVacancy(rect,Object.entries(positions)
        .filter(([id])=>isCopy||!belongsToMovingGroup(id)).map(([,peer])=>peer));
    }
    if(!projected){
      const mock:PageWidget={...(source??{id:sourceId,page_id:page?.id??"",definition_id:null,
        kind:"database",title:null,width:w,height:2,position:existing.length,config:{}}),
        id:sourceId,config:{...(source?.config??{}),sectionId,
          fluidDesktop:sourceRect??{x:rect.x,y:rect.y,w,h}}};
      const simulated=presetEnabled
        ?movePresetWidget(existing.some(widget=>widget.id===sourceId)?existing:[...existing,mock],sourceId,rect)
        :placeFluidWidget(existing.some(widget=>widget.id===sourceId)?existing:[...existing,mock],sourceId,rect);
      projected=initialFluidRects(simulated);
      rect=projected[sourceId]??rect;
    }
    const next:FluidDrop={sectionId,id:sourceId,rect,intent,targetId,projected};
    fluidDropRef.current=next;
    setFluidDrop(prev=>prev?.id===sourceId&&prev.sectionId===sectionId&&
      prev.intent===intent&&prev.targetId===targetId&&prev.rect.x===rect.x&&
      prev.rect.y===rect.y&&prev.rect.w===rect.w&&prev.rect.h===rect.h?prev:next);
    return true;
  };
  const commitFluidDrop=async(sourceId:string,placement:FluidDrop)=>{
    if(placement.intent==="blocked"){
      setNotice("No room beside this widget. Drop in open space or use the center to replace its position.");
      setDrag(null);setDropHint(null);setReorderPreview(null);clearFluidDrop();
      return;
    }
    if(sourceId.startsWith("developer:")){
      const sourceKey=sourceId.slice("developer:".length);
      const source=data.instances.find(w=>w.id===sourceKey);
      const definition=data.definitions.find(def=>def.id===(source?.definition_id??sourceKey));
      if(definition)void addDefinition(definition,{sectionId:placement.sectionId,targetId:null,edge:"section-end"},
        "preferred",source,placement.rect,{intent:placement.intent,targetId:placement.targetId});
    }else{
      const original=instanceList.find(widget=>widget.id===sourceId);
      const movingGroup=original?fluidGroupId(original):null;
      const moved=instanceList.map(w=>(w.id===sourceId||movingGroup!==null&&
        fluidGroupId(w)===movingGroup)?{...w,config:{...w.config,
        sectionId:placement.sectionId}}:w);
      // The live projection is authoritative: mouseup must save that exact geometry.
      const updated=placement.projected&&!movingGroup
        ?moved.map(item=>{
          const position=placement.projected?.[item.id];
          return position?{...item,config:{...item.config,fluidDesktop:position}}:item;
        })
        :placement.targetId&&(placement.intent==="left"||placement.intent==="right")
          ?(presetEnabled
            ?insertPresetWidget(moved,sourceId,placement.targetId,placement.intent,formation.intelligentShrinking).items
            :insertFluidBeside(moved,sourceId,placement.targetId,placement.intent).items)
          :(presetEnabled?movePresetWidget(moved,sourceId,placement.rect)
            :placeFluidWidget(moved,sourceId,placement.rect));
      if(updated.some((w,index)=>JSON.stringify(w.config)!==JSON.stringify(instanceList[index]?.config)))saveLayout(updated);
      else setNotice("This widget is locked or the chosen position is occupied by a pinned widget.");
    }
    setDrag(null);setDropHint(null);setReorderPreview(null);clearFluidDrop();
  };
  const startFluidResize=(e:React.PointerEvent<HTMLButtonElement>,widget:PageWidget,
    handle:"left"|"right"|"top"|"bottom-left"|"bottom-right"|"bottom")=>{
    if(widgetSizeLocked(widget))return;
    if(e.detail>=2)return;
    e.preventDefault();e.stopPropagation();
    const canvas=e.currentTarget.closest("[data-aaa-fluid-canvas]");
    const width=canvas?.getBoundingClientRect().width;if(!width)return;
    fluidResizeStart.current={id:widget.id,handle,x:e.clientX,y:e.clientY,unit:width/12,initial:instanceList};
    resizePreviewRef.current=instanceList;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const fluidResizeMove=(e:React.PointerEvent<HTMLButtonElement>)=>{
    const start=fluidResizeStart.current;if(!start)return;
    let dx=Math.round((e.clientX-start.x)/start.unit*20)/20;
    let dy=Math.round(e.clientY-start.y);
    if(Math.abs(e.clientX-start.x)<4&&Math.abs(e.clientY-start.y)<4)return;
    const section=widgetSectionId(start.initial.find(w=>w.id===start.id)!);
    const same=start.initial.filter(w=>widgetSectionId(w)===section);
    if(formation.quickEdgeSnap){
      const positions=initialFluidRects(same),current=positions[start.id];
      const peers=same.filter(w=>w.id!==start.id).map(w=>positions[w.id]);
      const nearest=(at:number,edges:number[],scale:number)=>edges
        .map(value=>({value,delta:Math.abs(value-at)*scale}))
        .filter(item=>item.delta<=formation.snapDistancePx)
        .sort((a,b)=>a.delta-b.delta)[0]?.value;
      let snapped=false;
      if(start.handle.includes("left")||start.handle==="right"||start.handle==="bottom-right"){
        const edge=start.handle.includes("left")?current.x:current.x+current.w;
        const aligned=peers.filter(p=>p.y<current.y+current.h&&p.y+p.h>current.y);
        const snap=nearest(edge+dx,aligned.flatMap(p=>[p.x,p.x+p.w]),start.unit);
        if(snap!==undefined){dx=snap-edge;snapped=true}
      }
      if(start.handle==="top"||start.handle.includes("bottom")){
        const edge=start.handle==="top"?current.y:current.y+current.h;
        const aligned=peers.filter(p=>p.x<current.x+current.w&&p.x+p.w>current.x ||
          Math.abs(p.y-current.y)<24);
        const snap=nearest(edge+dy,aligned.flatMap(p=>[p.y,p.y+p.h,p.y+p.h+FLUID_GAP]),1);
        if(snap!==undefined){dy=snap-edge;snapped=true}
      }
      setSnapGuide(snapped);
    }
    const updated=resizeFluidWidget(same,start.id,{
      ...(start.handle.includes("left")?{left:dx}:{}),
      ...(start.handle==="right"||start.handle==="bottom-right"?{right:dx}:{}),
      ...(start.handle==="top"?{top:dy}:{}),
      ...(start.handle.includes("bottom")?{bottom:dy}:{})});
    const changed=new Map(updated.map(w=>[w.id,w]));
    const next=start.initial.map(w=>changed.get(w.id)??w);
    resizePreviewRef.current=next;setResizePreview(next);
  };
  const fluidResizeEnd=()=>{
    const initial=fluidResizeStart.current?.initial;
    if(initial&&resizePreviewRef.current&&resizePreviewRef.current!==initial)
      saveLayout(resizePreviewRef.current);
    fluidResizeStart.current=null;
    resizePreviewRef.current=null;
    setResizePreview(null);
    setSnapGuide(false);
  };
  const sharedResizeDown=(e:React.PointerEvent<HTMLButtonElement>,leftId:string,rightId:string)=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const field=e.currentTarget.closest<HTMLElement>("[data-aaa-fluid-canvas]");
    const width=field?.getBoundingClientRect().width;if(!width)return;
    sharedResizeStart.current={leftId,rightId,x:e.clientX,unit:width/12,initial:instanceList};
    resizePreviewRef.current=instanceList;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const sharedResizeMove=(e:React.PointerEvent<HTMLButtonElement>)=>{
    const start=sharedResizeStart.current;if(!start)return;
    const dx=Math.round((e.clientX-start.x)/start.unit*20)/20;
    const updated=presetEnabled
      ?resizePresetDivider(start.initial,start.leftId,start.rightId,dx)
      :resizeFluidSharedBoundary(start.initial,start.leftId,start.rightId,dx);
    const changes=new Map(updated.map(w=>[w.id,w]));
    const next=start.initial.map(w=>changes.get(w.id)??w);
    resizePreviewRef.current=next;setResizePreview(next);
  };
  const sharedResizeEnd=()=>{
    const start=sharedResizeStart.current;
    if(start&&resizePreviewRef.current&&resizePreviewRef.current!==start.initial){
      const changed=resizePreviewRef.current.some((w,i)=>
        JSON.stringify(w.config)!==JSON.stringify(start.initial[i]?.config));
      if(changed)saveLayout(resizePreviewRef.current);
    }
    sharedResizeStart.current=null;resizePreviewRef.current=null;setResizePreview(null);
  };
  const commitDrop=(fallback?:WidgetDropTarget,sourceOverride?:string)=>{
    const target=fallback??dropHint;
    const movingId=sourceOverride??drag;
    const fluid=fluidDropRef.current;
    if(fluidEnabled&&movingId&&fluid?.id===movingId){void commitFluidDrop(movingId,fluid);return}
    if(movingId&&target){
      if(movingId.startsWith("developer:")){
        const sourceId=movingId.slice("developer:".length);
        const sourceWidget=data.instances.find(widget=>widget.id===sourceId);
        const definition=data.definitions.find(def=>def.id===(sourceWidget?.definition_id??sourceId));
        if(definition)void addDefinition(definition,target,"preferred",sourceWidget);
      }else if(target.targetId!==movingId){
        if(target.edge==="reorder"&&target.targetId)
          saveLayout(reorderWidgetColumn(instanceList,pageSections,movingId,target.targetId));
        else {
          const next=placeWidget(instanceList,pageSections,movingId,target,fillGaps,formation);
          if(next.some((w,index)=>w!==instanceList[index]))saveLayout(next);
          else setNotice("This row is full or locked. Drop in the center of an unlocked widget to replace it, or choose a new row.");
        }
      }
    }
    setDrag(null);setDropHint(null);setReorderPreview(null);
  };
  returnWidgetRef.current=id=>{
    const instance=instanceList.find(widget=>widget.id===id);
    if(!instance)return;
    p.onInspect?.(inspectionFor(instance));
    void deleteInstance(id);
    p.onOpenDeveloper?.();
  };
  useEffect(()=>{
    const started=(event:Event)=>{
      const detail=(event as CustomEvent<{definitionId:string;instanceId?:string}>).detail;
      if(detail?.definitionId){setDrag("developer:"+(detail.instanceId??detail.definitionId));setArrange(true)}
    };
    const ended=()=>{setDrag(null);setDropHint(null);setReorderPreview(null);fluidDropRef.current=null;setFluidDrop(null)};
    const returned=(event:Event)=>{
      const id=(event as CustomEvent<{widgetId:string}>).detail?.widgetId;
      if(id)returnWidgetRef.current(id);
    };
    window.addEventListener("aaa-developer-widget-drag",started);
    window.addEventListener("aaa-developer-widget-drag-end",ended);
    window.addEventListener("aaa-widget-return-to-developer",returned);
    return ()=>{
      window.removeEventListener("aaa-developer-widget-drag",started);
      window.removeEventListener("aaa-developer-widget-drag-end",ended);
      window.removeEventListener("aaa-widget-return-to-developer",returned);
    };
  // Event handlers read the latest callback from the active studio render.
  },[page?.id]);
  const hint=(value:WidgetDropTarget)=>setDropHint(old=>
    old?.sectionId===value.sectionId&&old.targetId===value.targetId&&
    old.edge===value.edge&&old.spanStartLane===value.spanStartLane&&
    old.spanLaneCount===value.spanLaneCount&&
    old.extendSpanWidgetId===value.extendSpanWidgetId?old:value);
  const dropTargetFor=(event:React.DragEvent<HTMLElement>,widget:PageWidget):WidgetDropTarget=>{
    const bounds=event.currentTarget.getBoundingClientRect();
    const x=event.clientX-bounds.left,y=event.clientY-bounds.top;
    // Within an existing row, the card's central area reorders columns;
    // the upper/lower strips explicitly STACK in that same column instead.
    // This also prevents a drop near the bottom of a card from creating a row.
    const reordered=widgetReorderZoneAtPoint(bounds.height,y)?reorderTargetFor(widget):null;
    if(reordered)return reordered;
    const movingWidget=instanceList.find(w=>w.id===drag);
    const outsideBand=!movingWidget||widgetBandIdentity(movingWidget)!==widgetBandIdentity(widget);
    const edge=x>bounds.width*.36&&x<bounds.width*.64&&y>bounds.height*.43&&y<bounds.height*.57&&
      outsideBand?"replace":widgetDropEdgeAtPoint(bounds.width,bounds.height,x,y);
    return {sectionId:widgetSectionId(widget),targetId:widget.id,edge};
  };
  const reorderTargetFor=(widget:PageWidget,movingId=drag):WidgetDropTarget|null=>{
    const moving=instanceList.find(w=>w.id===movingId);
    if(!moving||moving.id===widget.id||widgetSectionId(moving)!==widgetSectionId(widget))return null;
    const band=widgetLayoutBands(instanceList.filter(w=>widgetSectionId(w)===widgetSectionId(widget)))
      .find(row=>row.lanes.some(lane=>lane.widgets.some(w=>w.id===moving.id))&&
        row.lanes.some(lane=>lane.widgets.some(w=>w.id===widget.id)));
    if(!band||band.spans?.length)return null;
    const source=band.lanes.find(l=>l.widgets.some(w=>w.id===moving.id));
    const destination=band.lanes.find(l=>l.widgets.some(w=>w.id===widget.id));
    // A stacked card is moved individually; dragging one must not silently
    // relocate its entire column of unrelated widgets.
    if(!source||!destination||source===destination||
      source.widgets.length!==1||destination.widgets.length!==1)return null;
    return {sectionId:widgetSectionId(widget),targetId:widget.id,edge:"reorder"};
  };
  // iOS touch handles share the same drop targets as desktop dragging.
  const touchTargetAt=(x:number,y:number,movingId:string):WidgetDropTarget|null=>{
    const element=document.elementFromPoint(x,y);
    if(fluidEnabled){
      const field=element?.closest<HTMLElement>("[data-aaa-fluid-canvas]");
      if(field){fluidHoverAtPoint(x,y,movingId);
        return {sectionId:field.dataset.aaaSectionId??"",targetId:null,edge:"section-end"}}
    }
    const surface=element?.closest<HTMLElement>("[data-aaa-insert-edge]");
    if(surface){
      const edge=surface.getAttribute("data-aaa-insert-edge") as WidgetDropTarget["edge"];
      const targetId=surface.getAttribute("data-aaa-target-id");
      const sectionId=surface.getAttribute("data-aaa-section-id")??"";
      const rawStart=surface.getAttribute("data-aaa-span-start");
      const spanStartLane=rawStart===null?undefined:Number(rawStart);
      const rawCount=surface.getAttribute("data-aaa-span-count");
      const spanLaneCount=rawCount===null?undefined:Number(rawCount);
      const extendSpanWidgetId=surface.getAttribute("data-aaa-extend-span")??undefined;
      const preserveGroupWidth=surface.getAttribute("data-aaa-preserve-group")==="true";
      if(targetId&&targetId!==movingId)
        return {sectionId,targetId,edge,spanStartLane,spanLaneCount,extendSpanWidgetId,preserveGroupWidth};
    }
    const article=element?.closest<HTMLElement>("[data-aaa-widget-id]");
    const targetId=article?.getAttribute("data-aaa-widget-id");
    const target=instanceList.find(w=>w.id===targetId);
    if(article&&target&&target.id!==movingId){
      const rect=article.getBoundingClientRect();
      const dx=x-rect.left,dy=y-rect.top;
      const reorder=widgetReorderZoneAtPoint(rect.height,dy)
        ?reorderTargetFor(target,movingId):null;
      if(reorder)return reorder;
      const movingWidget=instanceList.find(w=>w.id===movingId);
      const outsideBand=!movingWidget||widgetBandIdentity(movingWidget)!==widgetBandIdentity(target);
      const edge=dx>rect.width*.36&&dx<rect.width*.64&&dy>rect.height*.43&&dy<rect.height*.57&&
        outsideBand?"replace":widgetDropEdgeAtPoint(rect.width,rect.height,dx,dy);
      return {sectionId:widgetSectionId(target),targetId:target.id,edge};
    }
    const lane=element?.closest<HTMLElement>("[data-aaa-lane-bottom-widget]");
    const bottomId=lane?.dataset.aaaLaneBottomWidget;
    if(bottomId&&bottomId!==movingId)
      return {sectionId:lane?.dataset.aaaSectionId??"",targetId:bottomId,edge:"below"};
    // Gaps between a row's cards are part of that row, not an implicit
    // section-end/new-row zone. Pick the nearest surviving card instead.
    const band=element?.closest<HTMLElement>(".aaa-widget-layout-band");
    if(band){
      const cards=[...band.querySelectorAll<HTMLElement>("[data-aaa-widget-id]")]
        .filter(card=>card.dataset.aaaWidgetId!==movingId);
      const nearest=cards.map(card=>{
        const r=card.getBoundingClientRect();
        const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom);
        return {card,score:dx*dx+dy*dy};
      }).sort((a,b)=>a.score-b.score)[0]?.card;
      const next=instanceList.find(w=>w.id===nearest?.dataset.aaaWidgetId);
      if(next)return {sectionId:widgetSectionId(next),targetId:next.id,
        edge:y<nearest!.getBoundingClientRect().top?"above":"below"};
    }
    const canvas=element?.closest<HTMLElement>(".aaa-widget-canvas");
    if(canvas)return {sectionId:canvas.dataset.aaaSectionId??"",targetId:null,edge:"section-end"};
    return null;
  };
  // Pointer-based workshop drag works when the source is inside an overlaid
  // Companion, where native HTML dragging may cancel as the panel fades.
  const previewPointerStart=(e:React.PointerEvent<HTMLSpanElement>,widget:PageWidget,def:WidgetDefinition)=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    fluidDragAnchor.current={x:20,y:18};
    const id="developer:"+(data.instances.some(row=>row.id===widget.id)?widget.id:def.id);
    previewPointer.current={id,x:e.clientX,y:e.clientY,active:false,target:null,
      handle:e.currentTarget,pointerId:e.pointerId};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const previewPointerMove=(e:React.PointerEvent<HTMLSpanElement>)=>{
    const state=previewPointer.current;if(!state)return;
    if(!state.active&&Math.hypot(e.clientX-state.x,e.clientY-state.y)<8)return;
    if(!state.active){
      state.active=true;
      setDrag(state.id);setArrange(true);
      window.dispatchEvent(new CustomEvent("aaa-developer-widget-drag",{
        detail:{definitionId:state.id.slice("developer:".length)}}));
    }
    const target=touchTargetAt(e.clientX,e.clientY,state.id);
    state.target=target;setDropHint(target);
  };
  const previewPointerEnd=(e:React.PointerEvent<HTMLSpanElement>,cancel=false)=>{
    const state=previewPointer.current;if(!state)return;
    previewPointer.current=null;
    if(state.active&&!cancel&&state.target)commitDrop(state.target,state.id);
    if(state.active)window.dispatchEvent(new Event("aaa-developer-widget-drag-end"));
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const startTouchRearrange=(e:React.PointerEvent<HTMLSpanElement>,id:string)=>{
    if(!arrange||(e.pointerType!=="touch"&&!presetEnabled))return;
    e.preventDefault();e.stopPropagation();
    touchDrag.current={id,x:e.clientX,y:e.clientY,active:false,target:null,
      handle:e.currentTarget,pointerId:e.pointerId};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveTouchRearrange=(e:React.PointerEvent<HTMLSpanElement>)=>{
    const state=touchDrag.current;
    if(!state||(e.pointerType!=="touch"&&!presetEnabled))return;
    if(!state.active&&Math.hypot(e.clientX-state.x,e.clientY-state.y)<9)return;
    if(!state.active){state.active=true;setDrag(state.id);}
    const target=touchTargetAt(e.clientX,e.clientY,state.id);
    if(target||state.target?.edge!=="reorder"){
      state.target=target;
      setDropHint(target);
    }
  };
  const endTouchRearrange=(e:React.PointerEvent<HTMLSpanElement>,cancel=false)=>{
    const state=touchDrag.current;
    if(!state)return;
    touchDrag.current=null;
    if(state.active&&!cancel&&fluidEnabled&&fluidDropRef.current)
      void commitFluidDrop(state.id,fluidDropRef.current);
    else if(state.active&&!cancel&&state.target&&state.target.targetId!==state.id)
      saveLayout(state.target.edge==="reorder"&&state.target.targetId
        ?reorderWidgetColumn(instanceList,pageSections,state.id,state.target.targetId)
        :placeWidget(instanceList,pageSections,state.id,state.target,fillGaps,formation));
    setDrag(null);setDropHint(null);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const widgetHover=(event:React.DragEvent<HTMLElement>,widget:PageWidget)=>{
    if(!arrange||!drag)return;
    event.preventDefault();event.stopPropagation();
    if(drag===widget.id){if(dropHint?.edge!=="reorder")setDropHint(null);return}
    const target=dropTargetFor(event,widget);
    hint(target);
    if(target.edge==="reorder"&&target.targetId)
      setReorderPreview(reorderWidgetColumn(instanceList,pageSections,drag!,target.targetId));
    else setReorderPreview(null);
  };
  const startResize=(e:React.PointerEvent<HTMLButtonElement>,widget:PageWidget,axis:"x"|"y"|"both",
    side:"left"|"right"="right")=>{
    e.preventDefault();e.stopPropagation();
    if(widgetSizeLocked(widget)){setNotice("Unlock this widget's size in Configure before resizing.");return}
    const grid=e.currentTarget.closest(".aaa-widget-canvas");
    const bounds=grid?.getBoundingClientRect();
    if(!bounds)return;
    dividerWasResized.current=false;
    resizeStart.current={id:widget.id,x:e.clientX,y:e.clientY,
      unitX:bounds.width/12,heightPx:widgetHeightPx(widget),axis,side,initial:instanceList};
    resizePreviewRef.current=instanceList;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const resizeMove=(e:React.PointerEvent<HTMLButtonElement>)=>{
    const start=resizeStart.current;if(!start)return;
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    // A click (including the two clicks of a double-click) is not a resize.
    // Previously every pointer-up saved the unchanged layout and re-rendered
    // the handle, making the browser lose the second click target.
    if(start.axis==="x"&&Math.abs(dx)<5)return;
    if(start.axis==="y"&&Math.abs(dy)<5)return;
    if(start.axis==="both"&&Math.max(Math.abs(dx),Math.abs(dy))<5)return;
    const selected=start.initial.find(w=>w.id===start.id);
    const activeBand=selected?widgetBandIdentity(selected):"";
    const peerEdges=widgetLayoutBands(start.initial)
      .filter(band=>band.id!==activeBand)
      .flatMap(band=>band.lanes.reduce((edges:number[],lane)=>{
        edges.push((edges[edges.length-1]??0)+lane.width);return edges},[]));
    const nominalWidth=selected?Number(selected.config.layoutWidth??selected.width):6;
    const signedDx=start.side==="left"?-dx:dx;
    const snapped=formation.magneticSnapping
      ?magneticSnapWidth(nominalWidth+signedDx/start.unitX,peerEdges,start.unitX,formation.snapDistancePx)
      :{width:nominalWidth+signedDx/start.unitX,snapped:false};
    setSnapGuide(snapped.snapped&&start.axis!=="y");
    // Ten subdivisions per 12-slot grid unit make drag resizing responsive
    // without silently jumping from one coarse 8.33% step to another.
    const x=Math.round((snapped.snapped?snapped.width-nominalWidth:signedDx/start.unitX)*10)/10;
    const lowerWidget=selected&&widgetLayoutBands(start.initial.filter(w=>widgetSectionId(w)===widgetSectionId(selected)))
      .some(b=>b.spans?.some(span=>span.widgets.some(w=>w.id===selected.id))||
        b.lanes.some(lane=>lane.widgets.findIndex(w=>w.id===selected.id)>0));
    let result=start.axis==="y"||x===0?start.initial:lowerWidget
      ?x>0?expandWidgetIntoVacantLane(start.initial,start.id,start.side):start.initial
      :resizeWidgetLane(start.initial,pageSections,start.id,x,fillGaps,formation,start.side);
    if(start.axis!=="x")result=resizeWidgetHeight(result,pageSections,start.id,start.heightPx+dy,formation);
    if(result===start.initial)return;
    dividerWasResized.current=true;
    resizePreviewRef.current=result;setResizePreview(result);
  };
  const resizeEnd=()=>{
    const initial=resizeStart.current?.initial;
    // Don't persist an unchanged layout: it can remount the resize button
    // between clicks and prevent onDoubleClick from firing at all.
    if(initial&&resizePreviewRef.current&&resizePreviewRef.current!==initial)
      saveLayout(resizePreviewRef.current);
    resizeStart.current=null;resizePreviewRef.current=null;setResizePreview(null);
    setSnapGuide(false);
  };
  const definitionOf=(widget:PageWidget)=>data.definitions.find(d=>d.id===widget.definition_id);
  const sourceOf=(widget:PageWidget)=>{
    const def=definitionOf(widget),raw=widget.config;
    return {
      databaseId:(typeof raw.databaseOverride==="string"?raw.databaseOverride:def?.database_id)??null,
      viewId:(typeof raw.viewOverride==="string"?raw.viewOverride:def?.view_id)??null
    };
  };
  const effectiveConfig=(def:WidgetDefinition|undefined,instance?:PageWidget)=>{
    const source=instance?sourceOf(instance):{databaseId:def?.database_id??null,viewId:def?.view_id??null};
    const base=data.views.find(v=>v.id===source.viewId)?.config??{};
    return widgetConfig({...base,...def?.config,...instance?.config});
  };
  const select=(kind:"instance"|"definition",id:string)=>{setSelected({kind,id});p.onOpenConfigure()};
  const inspectionFor=(widget:PageWidget):CompanionInspection=>{
    const def=definitionOf(widget),source=sourceOf(widget);
    const db=data.databases.find(row=>row.id===source.databaseId);
    const fields=data.properties.filter(row=>row.database_id===source.databaseId);
    const records=data.records.filter(row=>row.database_id===source.databaseId).slice(0,3);
    return {id:widget.id,definitionId:def?.id,title:widget.title||def?.name||"Goals & projects",kind:widget.kind,
      databaseName:db?.name??"Not connected",viewName:data.views.find(view=>view.id===source.viewId)?.name??"Default view",
      renderer:effectiveConfig(def,widget).renderer,
      samples:records.map(record=>({title:data.titles[record.record_id]??String(Object.values(record.values_json??{}).find(Boolean)??"Untitled record"),
        detail:fields.slice(0,2).map(field=>field.name+": "+String(record.values_json?.[field.id]??"—")).join(" · ")})),
      fields:fields.map(field=>({name:field.name,type:field.type}))};
  };
  useEffect(()=>{
    if(!p.developerActive||selected?.kind!=="instance")return;
    const instance=data.instances.find(item=>item.id===selected.id);
    if(instance)p.onInspect?.(inspectionFor(instance));
  // Inspect the latest source fields and records after configuring this widget.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[data,selected?.id,selected?.kind,p.developerActive]);
  useEffect(()=>{
    if(!selected){p.onConfigure(null);return}
    const instance=selected.kind==="instance"?data.instances.find(w=>w.id===selected.id):undefined;
    const def=instance?definitionOf(instance):data.definitions.find(w=>w.id===selected.id);
    if(!def){p.onConfigure(null);return}
    const source=instance?sourceOf(instance):{databaseId:def.database_id,viewId:def.view_id};
    const config=effectiveConfig(def,instance);
    const updateConfig=(patch:Partial<WidgetConfig>)=>{
      if(instance&&widgetIsSynced(instance))changeDefinition(def.id,{config:{...def.config,...config,...patch}});
      else if(instance){changeInstance(instance.id,{config:{...instance.config,...config,...patch}})}
      else changeDefinition(def.id,{config:{...def.config,...config,...patch}});
    };
    const updateSource=(databaseId:string|null,viewId:string|null)=>{
      if(instance&&widgetIsSynced(instance))changeDefinition(def.id,{database_id:databaseId,view_id:viewId,config:{...def.config,filters:[],sorts:[],scopeField:"",scopeValue:""}});
      else if(instance){changeInstance(instance.id,{config:{...instance.config,databaseOverride:databaseId??"",viewOverride:viewId??"",filters:[],sorts:[],scopeField:"",scopeValue:""}})}
      else changeDefinition(def.id,{database_id:databaseId,view_id:viewId,config:{...def.config,filters:[],sorts:[],scopeField:"",scopeValue:""}});
    };
    const saveMaster=()=>{
      if(!instance)return;
      const effective=effectiveConfig(def,instance);
      changeDefinition(def.id,{database_id:source.databaseId,view_id:source.viewId,config:effective});
      // Page placement is independent of the reusable view; publishing must not move the card.
      changeInstance(instance.id,{config:placementConfigAfterPublish(instance)});
      setNotice("Saved to the master widget: "+def.name);
    };
    const createSource=async(name:string)=>{
      const id=crypto.randomUUID();
      const {error}=await supabase.rpc("db_create_database",{p_id:id,p_name:name,p_dataset:"acceptance"});
      if(error)throw new Error(error.message);
      if(instance&&!widgetIsSynced(instance)){
        const {error:saveError}=await supabase.from("aaa_page_widgets").update({config:{...instance.config,databaseOverride:id,viewOverride:"",filters:[],sorts:[]}}).eq("id",instance.id);
        if(saveError)throw new Error(saveError.message);
      }else{
        const {error:saveError}=await supabase.from("aaa_widget_definitions").update({database_id:id,view_id:null}).eq("id",def.id);
        if(saveError)throw new Error(saveError.message);
      }
      await load();setNotice(`Created ${name} in Databases and connected this widget to it.`);
      return id;
    };
    const addSourceProperty=async(databaseId:string,name:string,type:string)=>{
      const position=data.properties.filter(f=>f.database_id===databaseId).length;
      const {error}=await supabase.from("db_properties").insert({id:crypto.randomUUID(),database_id:databaseId,name,type,config:{},position,archived_at:null});
      if(error)throw new Error(error.message);
      await load();
    };
    const updateSourceProperty=async(id:string,patch:Partial<WidgetProperty>)=>{
      const {error}=await supabase.from("db_properties").update(patch).eq("id",id);
      if(error)throw new Error(error.message);
      await load();
    };
    p.onConfigure({id:selected.id,kind:selected.kind,title:instance?.title||def.name,synced:instance?widgetIsSynced(instance):false,
      databaseId:source.databaseId,viewId:source.viewId,config,
      width:instance?(fluidEnabled?initialFluidRects(instanceList)[instance.id]?.w??instance.width
        :Number(instance.config.layoutWidth??instance.width)):undefined,
      height:instance?.height,heightPx:instance?widgetHeightPx(instance):undefined,
      layoutEditing:arrange,sizeLocked:instance?widgetSizeLocked(instance):false,
      magneticLinked:instance?.config.magneticLinked===true,
      rowPinned:instance?widgetRowPinned(instance):false,
      rowLocked:instance?widgetLayoutBands(instanceList.filter(w=>widgetSectionId(w)===widgetSectionId(instance)))
        .find(b=>b.id===widgetBandIdentity(instance))?.lanes.some(l=>l.widgets.some(w=>w.config.rowLocked===true)):false,
      rowOccupancy:instance?widgetRowOccupancy(instanceList,widgetBandIdentity(instance)):undefined,
      magneticConnections:instance?(formation.magneticSnapping
        ?(()=>{
          const band=widgetLayoutBands(instanceList.filter(w=>widgetSectionId(w)===widgetSectionId(instance)))
            .find(b=>b.id===widgetBandIdentity(instance));
          return instance.config.magneticLinked===true&&band&&band.lanes.length>1&&
            band.lanes.some(l=>l.widgets.some(w=>w.id!==instance.id&&w.config.magneticLinked===true))
            ?"Adjacent columns share a magnetic boundary":"No magnetic connection";
        })():"Snapping disabled"):undefined,
      presetSizing:presetEnabled&&instance
        ?presetSizingOf(instance,initialFluidRects(instanceList)[instance.id]):undefined,
      onPresetSizing:presetEnabled&&instance?patch=>{
        const original=presetSizingOf(instance,initialFluidRects(instanceList)[instance.id]);
        const preferred=patch.preferred??original.preferred;
        const minimum=Math.min(patch.minimum??original.minimum,preferred);
        const next=patch.preferred!==undefined
          ?presetUpdatePreferred(instanceList,instance.id,preferred):instanceList;
        saveLayout(next.map(w=>w.id===instance.id?{...w,config:{...w.config,
          presetPreferredWidth:preferred,presetMinWidth:minimum,
          presetAllowShrink:patch.allowShrink??original.allowShrink}}:w));
      }:undefined,
      databases:data.databases,views:data.views,properties:data.properties,
      onConfig:updateConfig,onSource:updateSource,
      onRename:name=>instance&&!widgetIsSynced(instance)?changeInstance(instance.id,{title:name}):changeDefinition(def.id,{name}),
      onSize:instance&&arrange?(width)=>{
        if(fluidEnabled){
          const current=initialFluidRects(instanceList)[instance.id];
          if(current)saveLayout(resizeFluidWidget(instanceList,instance.id,{right:width-current.w}));
        }else saveLayout(resizeWidgetLane(instanceList,pageSections,instance.id,
          width-Number(instance.config.layoutWidth??instance.width),fillGaps,formation));
      }:undefined,
      onHeightPx:instance&&arrange?pixels=>{
        if(fluidEnabled){
          const current=initialFluidRects(instanceList)[instance.id];
          if(current)saveLayout(resizeFluidWidget(instanceList,instance.id,
            {bottom:pixels+WIDGET_EDITOR_FOOTER_PX-current.h}));
        }else saveLayout(resizeWidgetHeight(instanceList,pageSections,instance.id,pixels,formation));
      }:undefined,
      onSizeLock:instance?locked=>changeInstance(instance.id,{config:{...instance.config,sizeLocked:locked}}):undefined,
      onRowPin:instance?pinned=>changeInstance(instance.id,{config:{...instance.config,rowPinned:pinned}}):undefined,
      onRowLock:instance?locked=>saveLayout(setWidgetRowLock(instanceList,instance.id,locked)):undefined,
      onMagneticLink:instance?linked=>{
        const band=widgetLayoutBands(instanceList.filter(w=>widgetSectionId(w)===widgetSectionId(instance)))
          .find(b=>b.id===widgetBandIdentity(instance));
        const laneIndex=band?.lanes.findIndex(l=>l.widgets.some(w=>w.id===instance.id))??-1;
        const peerIds=new Set([instance.id,
          ...((band?.lanes[laneIndex+1]??band?.lanes[laneIndex-1])?.widgets??[]).map(w=>w.id)]);
        saveLayout(instanceList.map(w=>peerIds.has(w.id)?{...w,config:{...w.config,magneticLinked:linked}}:w));
      }:undefined,
      onSaveToDefinition:instance?saveMaster:undefined,
      onCreateDatabase:createSource,onAddProperty:addSourceProperty,onUpdateProperty:updateSourceProperty
    });
  // Selection and persisted state are the only sources for the Companion's controls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selected,data.instances,data.definitions,data.databases,data.views,data.properties,arrange,formation,fluidEnabled,presetEnabled]);

  const createRecord=async(databaseId:string,widgetId:string)=>{
    const name=newRecord[widgetId]?.trim();if(!name)return;
    try{
      const id=crypto.randomUUID();
      const {error}=await supabase.rpc("db_create_record",{p_id:id,p_database_id:databaseId,p_name:name});
      if(error)throw error;
      setNewRecord(old=>({...old,[widgetId]:""}));await load();setNotice("Created "+name);
    }catch(e){report(e)}
  };
  const saveProperty=async(record:WidgetRecord,property:WidgetProperty,raw:string)=>{
    const previous=String(record.values_json[property.id]??"");if(previous===raw)return;
    try{
      const value=property.type==="number"?(raw===""?null:Number(raw)):property.type==="checkbox"?raw==="true":raw===""?null:raw;
      if(property.type==="number"&&raw!==""&&!Number.isFinite(Number(raw)))throw new Error("Enter a valid number.");
      const {data:version,error}=await supabase.rpc("db_set_value",{p_record_id:record.record_id,p_version:record.version,p_property_id:property.id,p_value:value});
      if(error)throw error;
      setData(s=>({...s,records:s.records.map(r=>r.record_id===record.record_id?{...r,version:Number(version),values_json:{...r.values_json,[property.id]:value}}:r)}));
      setNotice("Record updated.");
    }catch(e){report(e)}
  };

  const renderRecords=(widgetId:string,def:WidgetDefinition,instance?:PageWidget,
    contentMode:PresetContentMode="expanded")=>{
    const source=instance?sourceOf(instance):{databaseId:def.database_id,viewId:def.view_id};
    const db=data.databases.find(x=>x.id===source.databaseId);
    if(!db)return <div className="aaa-widget-empty"><Database size={25}/> Choose a database in Configure to connect live records.</div>;
    const baseCfg=effectiveConfig(def,instance);
    const compactTable=(contentMode==="compact"||contentMode==="minimal")&&baseCfg.renderer==="table";
    const minimalCards=contentMode==="minimal"&&baseCfg.renderer==="cards";
    const cfg={...baseCfg,renderer:compactTable||minimalCards?"list" as const:baseCfg.renderer};
    const fields=data.properties.filter(x=>x.database_id===db.id);
    const allColumns=cfg.visibleProperties.length?fields.filter(x=>cfg.visibleProperties.includes(x.id)):fields.slice(0,4);
    const columns=contentMode==="minimal"?[]:contentMode==="compact"?allColumns.slice(0,1)
      :contentMode==="comfortable"?allColumns.slice(0,2):allColumns;
    const viewContext={
      name:(id:string)=>data.titles[id]||"Untitled record",
      relationTargets:(recordId:string,propertyId:string)=>data.relations.filter(link=>link.source_record_id===recordId&&link.property_id===propertyId).map(link=>data.titles[link.target_record_id]||"Untitled")
    };
    const filter=cfg.scopeField&&cfg.scopeValue?{id:"scope",field:cfg.scopeField,operator:"contains" as const,value:cfg.scopeValue}:null;
    const records=applyViewRules(data.records.filter(r=>r.database_id===db.id),
      {...cfg,filters:filter?[...cfg.filters,filter]:cfg.filters},viewContext,search[widgetId]||"");
    const eventDb=data.databases.find(source=>source.name.toLowerCase()==="events");
    const eventFields=data.properties.filter(f=>f.database_id===eventDb?.id);
    const parent=eventFields.find(f=>f.name.toLowerCase()==="parent event");
    const chronologyOrder=eventFields.find(f=>f.name.toLowerCase()==="chronology order");
    const eventRecords=data.records.filter(r=>r.database_id===eventDb?.id);
    const eventIds=new Set(eventRecords.map(r=>r.record_id));
    const address=chronologyAddresses(eventRecords.map(r=>({id:r.record_id,sequence:r.sequence_no,position:r.position,
      order:chronologyOrder&&typeof r.values_json[chronologyOrder.id]==="number"?r.values_json[chronologyOrder.id] as number:null,
      parentId:parent?data.relations.find(edge=>edge.property_id===parent.id&&edge.source_record_id===r.record_id&&eventIds.has(edge.target_record_id))?.target_record_id??null:null
    })));
    if(db.id===eventDb?.id&&!cfg.sorts.length){
      records.sort((a,b)=>{
        const left=(address.get(a.record_id)||"").split(".").map(Number),right=(address.get(b.record_id)||"").split(".").map(Number);
        for(let index=0;index<Math.max(left.length,right.length);index++){
          if(index>=left.length)return -1;if(index>=right.length)return 1;
          if(left[index]!==right[index])return left[index]-right[index];
        }
        return 0;
      });
    }
    const numberedName=(id:string)=>{
      const title=viewContext.name(id);
      if(db.id===eventDb?.id)return address.has(id)?`${address.get(id)}.${title}`:title;
      if(db.name.toLowerCase()==="perspectives"){
        const pair=data.perspectives.find(item=>item.record_id===id);
        if(pair&&address.has(pair.event_id))return perspectiveChronologyLabel(address,pair.event_id,data.titles[pair.character_id]||"Character")+" · "+title;
      }
      return title;
    };
    const rawFieldValue=(record:WidgetRecord,prop:WidgetProperty)=>prop.type==="relation"
      ?viewContext.relationTargets(record.record_id,prop.id).join(", ")
      :String(record.values_json[prop.id]??"");
    const formattedField=(record:WidgetRecord,prop:WidgetProperty)=>prop.type==="relation"
      ?rawFieldValue(record,prop):<DatabasePropertyValue property={prop} value={record.values_json[prop.id]}/>;
    const expanded=(recordId:string)=>isWidgetRecordExpanded(expandedRecords,widgetId,recordId);
    const open=(id:string)=>{
      if(cfg.openBehavior==="source"){p.onOpenRecord(id);return}
      setExpandedRecords(state=>toggleWidgetRecordExpanded(state,widgetId,id));
    };
    const inlineDetails=(record:WidgetRecord)=><div className="aaa-widget-detail aaa-widget-inline-detail"
      id={"aaa-record-detail-"+widgetId+"-"+record.record_id} aria-label={"Properties of "+viewContext.name(record.record_id)}>
      <div className="aaa-widget-detail-head"><strong>{viewContext.name(record.record_id)}</strong>
        <button type="button" onClick={()=>open(record.record_id)} aria-label={"Collapse "+viewContext.name(record.record_id)}><X size={15}/></button>
      </div>
      <p>Record {record.sequence_no} · {db.name}</p>
      {fields.map(f=><label key={f.id} className="aaa-widget-field">{f.name}
        {cfg.editable&&f.type!=="relation"&&f.type!=="select"&&f.type!=="checkbox"
          ?<input key={record.record_id+f.id+record.version} defaultValue={rawFieldValue(record,f)}
            onBlur={e=>void saveProperty(record,f,e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
          :cfg.editable&&f.type==="select"
          ?<select value={rawFieldValue(record,f)} onChange={e=>void saveProperty(record,f,e.target.value)}>
            <option value="">None</option>{Array.isArray(f.config.options)&&f.config.options.filter((o):o is string=>typeof o==="string").map(o=><option key={o}>{o}</option>)}
          </select>
          :cfg.editable&&f.type==="checkbox"
          ?<select value={rawFieldValue(record,f)} onChange={e=>void saveProperty(record,f,e.target.value)}>
            <option value="true">Yes</option><option value="false">No</option>
          </select>
          :<span>{formattedField(record,f)}</span>}
      </label>)}
      <button type="button" className="aaa-widget-add-rule" onClick={()=>p.onOpenRecord(record.record_id)}>
        Open original database page <ChevronRight size={14}/>
      </button>
    </div>;
    return <>
      {(cfg.exposeFilters||cfg.exposeSorts)&&<div className="aaa-widget-runtime-tools">
        {cfg.exposeFilters&&<label><Search size={14}/><input aria-label="Search records" placeholder="Find records…" value={search[widgetId]||""} onChange={e=>setSearch(prev=>({...prev,[widgetId]:e.target.value}))}/></label>}
        {cfg.exposeSorts&&<span>Sorted by {cfg.sorts[0]?fields.find(f=>f.id===cfg.sorts[0].field)?.name||cfg.sorts[0].field:"record ID"} <button onClick={()=>{
          const next=cfg.sorts.length?cfg.sorts.map((s,i)=>i===0?{...s,direction:s.direction==="asc"?"desc" as const:"asc" as const}:s):[{id:crypto.randomUUID(),field:"creation",direction:"desc" as const}];
          if(instance)changeInstance(instance.id,{config:{...instance.config,...cfg,sorts:next}});
          else changeDefinition(def.id,{config:{...def.config,...cfg,sorts:next}});
        }}>Reverse sort</button></span>}
      </div>}
      {records.length===0?<div className="aaa-widget-empty">No matching records in {db.name}. Adjust filters or add a record.</div>
      :cfg.renderer==="table"?<div className="aaa-widget-table-scroll"><table className="aaa-widget-table"><thead><tr><th>Record</th>{columns.map(f=><th key={f.id}>{f.name}</th>)}</tr></thead><tbody>
        {records.map(r=><Fragment key={r.record_id}>
          <tr><td><button type="button" aria-expanded={expanded(r.record_id)} aria-controls={"aaa-record-detail-"+widgetId+"-"+r.record_id}
            onClick={()=>open(r.record_id)}>{numberedName(r.record_id)}</button></td>{columns.map(f=><td key={f.id}>{formattedField(r,f)}</td>)}</tr>
          {expanded(r.record_id)&&<tr className="aaa-widget-inline-table-row"><td colSpan={columns.length+1}>{inlineDetails(r)}</td></tr>}
        </Fragment>)}
      </tbody></table></div>
      :<div className={"aaa-widget-records aaa-widget-records-"+cfg.renderer}>{records.map(r=><div
        key={r.record_id} className={"aaa-widget-record-shell"+(expanded(r.record_id)?" is-expanded":"")}>
        <button type="button" className="aaa-widget-record" aria-expanded={expanded(r.record_id)}
          aria-controls={"aaa-record-detail-"+widgetId+"-"+r.record_id} onClick={()=>open(r.record_id)}>
          {cfg.renderer==="timeline"&&<span className="aaa-widget-sequence">{db.id===eventDb?.id?address.get(r.record_id)||r.sequence_no:r.sequence_no}</span>}
          <strong>{numberedName(r.record_id)}</strong>
          <span>{columns.filter(f=>rawFieldValue(r,f)).slice(0,cfg.renderer==="list"?1:3).map(f=><small key={f.id}>{f.name}: {formattedField(r,f)}</small>)}</span>
          <ChevronRight size={16}/>
        </button>
        {expanded(r.record_id)&&inlineDetails(r)}
      </div>)}</div>}
      {cfg.allowCreate&&cfg.editable&&<form className="aaa-widget-new-record" onSubmit={e=>{e.preventDefault();void createRecord(db.id,widgetId)}}>
        <input value={newRecord[widgetId]||""} placeholder={"New "+db.name.toLowerCase()+" record…"} aria-label="New record name" onChange={e=>setNewRecord(old=>({...old,[widgetId]:e.target.value}))}/>
        <button type="submit" disabled={!newRecord[widgetId]?.trim()}><Plus size={14}/> Create</button>
      </form>}

    </>;
  };
  const widgetCard=(widget:PageWidget,preview=false,fluidCard=false)=>{
    const def=definitionOf(widget);
    const cfg=def?effectiveConfig(def,widget):widgetConfig({});
    const height=widgetHeightPx(widget);
    const title=widget.title||def?.name||"Goals & projects";
    const editing=arrange&&!preview;
    const folded=editing&&collapsedWidgets.includes(widget.id);
    const fitContent=widget.config.fitContent===true;
    const cornerAction=p.cornerDoubleClick??"fit-content";
    const expandedLeft=expandWidgetIntoVacantLane(instanceList,widget.id,"left");
    const expandedRight=expandWidgetIntoVacantLane(instanceList,widget.id,"right");
    const canFillWidth=expandedLeft.some(w=>w.id===widget.id&&w.config.layoutSpanCount!==widget.config.layoutSpanCount)||
      expandedRight.some(w=>w.id===widget.id&&w.config.layoutSpanCount!==widget.config.layoutSpanCount);
    const cornerDescription=cornerAction==="fit-content"&&canFillWidth?"fill available row space":
      cornerAction==="fit-content"&&fitContent?"restore saved fixed height":widgetDoubleClickDescription(cornerAction);
    const chromeLocked=widget.config.chromeLocked===true;
    const hideChrome=!editing&&chromeLocked&&!preview;
    const labelsShown=cfg.showTitle||cfg.showDatabase||cfg.showViewTag;
    const inspect=()=>{
      p.onInspect?.(inspectionFor(widget));
      if(!preview&&arrange&&p.developerActive&&def&&selected?.id!==widget.id)setSelected({kind:"instance",id:widget.id});
    };
    return <article key={widget.id} draggable={editing||preview} className={`aaa-widget-card aaa-widget-color-${cfg.color} aaa-widget-density-${cfg.density} ${editing?"aaa-widget-arranging":""} ${preview?"aaa-widget-live-preview-card":""} ${folded?"aaa-widget-folded":""} ${hideChrome?"aaa-widget-chrome-locked":""} ${p.headerPosition==="bottom"?"aaa-widget-header-bottom":""} ${fitContent?"aaa-widget-fit-content":""} ${drag===widget.id?"aaa-widget-dragging":""} ${editing&&selectedWidgetIds.includes(widget.id)?"aaa-widget-multi-selected":""} ${dropHint?.targetId===widget.id?"aaa-widget-target-"+dropHint.edge:""}`}
      data-aaa-widget-id={widget.id}
      style={{height:"100%",minHeight:0}}
      onClickCapture={e=>{if(editing&&fluidCard&&(e.ctrlKey||e.metaKey)){
          e.preventDefault();e.stopPropagation();
          setSelectedWidgetIds(ids=>ids.includes(widget.id)?ids.filter(id=>id!==widget.id):[...ids,widget.id]);
        }else inspect()}}
      onDragStart={e=>{if(preview){
          if(previewPointer.current){e.preventDefault();return}
          if(!def){e.preventDefault();return}
          e.dataTransfer.setData("application/x-aaa-widget-definition",def.id);
          e.dataTransfer.setData("text/plain",def.id);e.dataTransfer.effectAllowed="copy";
          window.dispatchEvent(new CustomEvent("aaa-developer-widget-drag",{
            detail:{definitionId:def.id,instanceId:previewInstance?.id===widget.id?previewInstance.id:undefined}}));
          return;
        }
        if(!editing)return;
        if(fluidCard){const r=e.currentTarget.getBoundingClientRect();
          fluidDragAnchor.current={x:e.clientX-r.left,y:e.clientY-r.top};
          // The real widget card now follows the projected layout. Suppress
          // the browser's extra drag bitmap to avoid two copies under cursor.
          const transparent=document.createElement("canvas");transparent.width=1;transparent.height=1;
          e.dataTransfer.setDragImage(transparent,0,0);
        }
        setDrag(widget.id);document.body.classList.add("aaa-page-widget-in-flight");e.dataTransfer.setData("text/plain",widget.id);
        e.dataTransfer.setData("application/x-aaa-page-widget",widget.id);e.dataTransfer.effectAllowed="move"}}
      onDragOver={e=>{if(preview)return;
        if(fluidCard&&drag){e.preventDefault();e.stopPropagation();fluidHoverAtPoint(e.clientX,e.clientY,drag)}
        else widgetHover(e,widget)}}
      onDrop={e=>{if(preview)return;e.stopPropagation();e.preventDefault();
        if(fluidCard&&drag){fluidHoverAtPoint(e.clientX,e.clientY,drag);commitDrop();return}
        if(drag===widget.id&&dropHint?.edge!=="reorder"){setDrag(null);setDropHint(null);setReorderPreview(null)}
        else commitDrop(dropHint?.edge==="reorder"?dropHint:dropTargetFor(e,widget))}}
      onDragEnd={()=>{if(preview){window.dispatchEvent(new Event("aaa-developer-widget-drag-end"));return}
        cancelInterruptedWidgetDrag()}}>
      {(!hideChrome||labelsShown)&&<header className="aaa-widget-card-head">
        <div className="aaa-widget-title-group">
          <div className="aaa-widget-title-stack">
            {cfg.showViewTag&&<span className="aaa-widget-lab-kicker">{widget.kind==="goals"?"PLANNING / LIVE":widgetIsSynced(widget)?"WIDGET SYNC · LINKED":"CONNECTED VIEW"}</span>}
            {(cfg.showTitle||folded)&&(!hideChrome
              ?<button type="button" className="aaa-widget-title-button" title={"Configure "+title} aria-label={"Edit title or configure "+title} onClick={()=>def&&select("instance",widget.id)}>{title}</button>
              :<strong className="aaa-widget-title-button">{title}</strong>)}
            {cfg.showDatabase&&def&&<button className="aaa-widget-source-button" type="button" onClick={()=>select("instance",widget.id)}>{data.databases.find(x=>x.id===sourceOf(widget).databaseId)?.name||"Unconnected"}</button>}
          </div></div>
        {!hideChrome&&<div className={"aaa-widget-card-actions"+(expandedWidgetActions===widget.id?" aaa-widget-actions-open":"")}
          onClick={()=>{if(expandedWidgetActions===widget.id)setExpandedWidgetActions(null)}}>
          {editing&&<><button type="button" title={folded?"Expand widget":"Collapse widget"} aria-label={(folded?"Expand ":"Collapse ")+title}
            aria-expanded={!folded} onClick={()=>flipWidgetCollapse(widget.id)}>{folded?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button>
            {fluidCard&&fluidGroupId(widget)&&<span title="Grouped widget · Ctrl-click to select and ungroup" aria-label="Grouped widget" className="aaa-widget-group-marker"><Link2 size={13}/></span>}
            <button type="button" title={chromeLocked?"Unlock widget controls in Use Mode":"Lock widget controls in Use Mode"}
              aria-label={(chromeLocked?"Unlock ":"Lock ")+title+" controls"} aria-pressed={chromeLocked}
              onClick={()=>changeInstance(widget.id,{config:{...widget.config,chromeLocked:!chromeLocked}})}>
              {chromeLocked?<Lock size={16}/>:<Unlock size={16}/>}
            </button>
            <span className="aaa-widget-drag-handle" title="Drag the widget container to rearrange"
              aria-label={`Drag ${title}`} role="button" tabIndex={0}
              onPointerDown={e=>startTouchRearrange(e,widget.id)}
              onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();if(def)select("instance",widget.id)}}}
              onPointerMove={moveTouchRearrange}
              onPointerUp={e=>endTouchRearrange(e)}
              onPointerCancel={e=>endTouchRearrange(e,true)}
              onLostPointerCapture={()=>{if(touchDrag.current?.id===widget.id)cancelInterruptedWidgetDrag()}}><svg viewBox="0 0 24 18" width="19" height="16" fill="currentColor" aria-hidden="true">
              {[5,12,19].map(x=>[5,13].map(y=><circle key={x+"-"+y} cx={x} cy={y} r="1.7"/>))}
            </svg></span>
          </>}
          {preview&&def&&<span className="aaa-widget-drag-handle aaa-widget-preview-grip" draggable={false}
            role="button" tabIndex={0} aria-label="Drag this widget into the page"
            title="Drag this widget into a Library section"
            onPointerDown={e=>previewPointerStart(e,widget,def)}
            onPointerMove={previewPointerMove}
            onPointerUp={e=>previewPointerEnd(e)}
            onPointerCancel={e=>previewPointerEnd(e,true)}
            onLostPointerCapture={()=>{if(previewPointer.current)cancelInterruptedWidgetDrag()}}>
            <svg viewBox="0 0 24 18" width="19" height="16" fill="currentColor" aria-hidden="true">{[5,12,19].map(x=>[5,13].map(y=><circle key={x+"-"+y} cx={x} cy={y} r="1.7"/>))}</svg></span>}
          {def&&<button title="Configure in The Companion" aria-label="Configure widget" onClick={()=>select("instance",widget.id)}><Settings2 size={16}/></button>}
          {def&&<button title="Duplicate to another page" aria-label={`Duplicate ${title}`} onClick={()=>{setDuplicate(widget);setDuplicatePageId(page?.id||"");setDuplicateMode("independent")}}><Copy size={15}/></button>}
          <button title="Remove view, with optional source database deletion" aria-label={`Delete ${title} view`} onClick={()=>{setRemoveTarget({kind:"instance",id:widget.id,databaseId:sourceOf(widget).databaseId});setRemoveCore(false);setDeleteConfirmation("")}}><Trash2 size={15}/></button>
          <button type="button" className="aaa-widget-more-toggle" title="More widget actions"
            aria-label={"More actions for "+title} aria-expanded={expandedWidgetActions===widget.id}
            onClick={e=>{e.stopPropagation();setExpandedWidgetActions(previous=>previous===widget.id?null:widget.id)}}>
            <MoreHorizontal size={18}/>
          </button>
        </div>}
      </header>}
      {!folded&&<div className="aaa-widget-card-body">
        {widget.kind==="goals"?<PlanningWorkspace key={widget.id} section="Goals" onContext={p.onPlanningContext??(()=>{})} onOpenPage={p.onOpenRecord} onSchedule={p.onSchedule??(()=>{})}/>
        :def?(presetEnabled&&fluidCard
          ?<PresetContentRegion>{mode=>renderRecords(widget.id,def,widget,mode)}</PresetContentRegion>
          :renderRecords(widget.id,def,widget))
          :<div className="aaa-widget-empty">The reusable widget is unavailable.</div>}
      </div>}
      {editing&&!folded&&<footer className="aaa-widget-card-resize">
        <label>Section<select aria-label={`Move ${title} to section`} value={widgetSectionId(widget)} onChange={e=>moveWidgetToSection(widget,e.target.value)}>
          <option value="">Overview</option>{pageSections.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
        </select></label>
        <span className="aaa-widget-height-caption">{fitContent?"Content-fit height":Math.round(height)+"px tall"} · double-click corner: {cornerDescription}</span>
      </footer>}
      {editing&&<>
        <button type="button" className="aaa-widget-resize-corner"
          aria-label={`Resize ${title}. Double-click to ${cornerDescription}.`}
          title={`Drag to resize height; double-click to ${cornerDescription}`}
          onPointerDown={e=>{if(e.detail>=2)return;startResize(e,widget,"y")}}
          onPointerMove={resizeMove} onPointerUp={resizeEnd} onPointerCancel={resizeEnd}
          onDoubleClick={e=>{e.preventDefault();e.stopPropagation();
            resizeStart.current=null;resizePreviewRef.current=null;setResizePreview(null);
            if(cornerAction==="fit-content"&&canFillWidth)saveLayout(
              expandedLeft.find(w=>w.id===widget.id)?.config.layoutSpanCount!==widget.config.layoutSpanCount
                ?expandedLeft:expandedRight);
            else if(cornerAction!=="none")saveLayout(applyWidgetDoubleClickAction(instanceList,pageSections,widget.id,cornerAction,fillGaps,14,WIDGET_EDITOR_FOOTER_PX));
          }}/>
      </>}
    </article>;
  };

  if(loading)return <section className="aaa-widget-studio"><div className="aaa-widget-empty">Loading your widget system…</div></section>;
  if(error&&data.pages.length===0&&data.definitions.length===0)return <section className="aaa-widget-studio aaa-widget-error"><h2>Widget system unavailable</h2><p>{error}</p><p>The separate widget tables may need to be installed in this Supabase environment. Existing data is untouched.</p><button onClick={()=>{setLoading(true);void load().catch(report).finally(()=>setLoading(false))}}><RefreshCw size={15}/> Retry</button></section>;

  const previewInstance=selected?.kind==="instance"?data.instances.find(w=>w.id===selected.id):undefined;
  const previewDefinition=selected?.kind==="definition"?data.definitions.find(d=>d.id===selected.id):undefined;
  const previewWidget:PageWidget|null=previewInstance??(previewDefinition?{
    id:"preview-definition-"+previewDefinition.id,definition_id:previewDefinition.id,
    title:previewDefinition.name,kind:"database",page_id:page?.id??"preview",position:0,
    width:12,height:2,config:{heightPx:280}
  }:null);
  return <Fragment><section className={"aaa-widget-studio "+(p.visualStyle==="studio"?"aaa-widget-studio-lab":p.visualStyle==="blend"?"aaa-widget-style-blend":"")}>
    {error&&<div className="aaa-widget-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error"><X size={14}/></button></div>}
    {notice&&<div className="aaa-widget-alert" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice"><X size={14}/></button></div>}
    {removeTarget&&(()=>{
      const db=data.databases.find(row=>row.id===removeTarget.databaseId);
      const widget=data.instances.find(w=>w.id===removeTarget.id);
      const master=data.definitions.find(w=>w.id===removeTarget.id);
      const title=widget?.title|| (widget?definitionOf(widget)?.name:master?.name)||"Widget";
      const count=db?data.records.filter(row=>row.database_id===db.id).length:0;
      const views=db?data.definitions.filter(def=>def.database_id===db.id).length:0;
      const canRemove=removeTarget.kind==="instance"||!data.instances.some(w=>w.definition_id===removeTarget.id);
      return <div className="aaa-widget-dialog-backdrop" role="presentation"><section className="aaa-widget-dialog" role="alertdialog" aria-modal="true" aria-labelledby="aaa-remove-widget-title" aria-describedby="aaa-remove-widget-desc">
        <div className="aaa-widget-dialog-icon"><Trash2 size={22}/></div><h2 id="aaa-remove-widget-title">Remove “{title}”?</h2>
        <p id="aaa-remove-widget-desc">{removeTarget.kind==="instance"?"This removes the widget view from this page. The reusable widget, its database, and all records stay intact.":"This removes the reusable widget design from Developing IT. No source database records are deleted."}</p>
        {!canRemove&&!removeCore&&<p className="aaa-widget-danger-copy">This master still has views on pages. Remove those first, or choose the source deletion option if appropriate.</p>}
        {db&&<label className="aaa-widget-delete-core-toggle"><input type="checkbox" checked={removeCore} onChange={e=>{setRemoveCore(e.target.checked);setDeleteConfirmation("")}}/><span>Delete core <strong>“{db.name}”</strong> database instead</span></label>}
        {removeCore&&db&&<div className="aaa-widget-core-warning"><p><strong>Permanent deletion:</strong> This deletes the entire {db.name} database, {count} records, properties and {views} connected widget masters across all pages, including Widget Sync copies. This cannot be undone.</p>
          <label>Type <strong>{db.name}</strong> to confirm<input autoFocus aria-label="Confirm core database name" value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)}/></label></div>}
        <div className="aaa-widget-dialog-actions"><button onClick={()=>{setRemoveTarget(null);setRemoveCore(false);setDeleteConfirmation("")}}>Cancel</button>
          <button className={removeCore?"aaa-widget-danger-button":"aaa-widget-primary"} disabled={busy||(removeCore?deleteConfirmation!==db?.name:!canRemove)} onClick={()=>void(removeCore?deleteDatabase():removeTarget.kind==="instance"?deleteInstance(removeTarget.id):deleteDefinition(removeTarget.id))}>{removeCore?"Delete database and all records":removeTarget.kind==="instance"?"Remove this view":"Delete widget design"}</button></div>
      </section></div>;
    })()}
    {duplicate&&<div className="aaa-widget-dialog-backdrop" role="presentation"><section className="aaa-widget-dialog" role="dialog" aria-modal="true" aria-labelledby="aaa-widget-copy-title">
      <h2 id="aaa-widget-copy-title">Duplicate “{duplicate.title||definitionOf(duplicate)?.name}”</h2>
      <p>Choose the page for the new widget and whether future configuration changes should be shared.</p>
      <label>Destination page<select aria-label="Copy destination page" value={duplicatePageId} onChange={e=>setDuplicatePageId(e.target.value)}>
        {data.pages.map(target=><option key={target.id} value={target.id}>{target.area==="goals"?"Goals":"Library"} · {target.title}</option>)}
      </select></label>
      <div className="aaa-widget-copy-modes">
        <button type="button" className={duplicateMode==="independent"?"active":""} onClick={()=>setDuplicateMode("independent")}><Unlink2 size={17}/><strong>Independent copy</strong><small>Same starting data and styling. Edit filters, layout and settings without changing other widgets.</small></button>
        <button type="button" className={duplicateMode==="synced"?"active":""} onClick={()=>setDuplicateMode("synced")}><Link2 size={17}/><strong>Widget Sync</strong><small>Linked configuration across every widget in this sync group. Each page keeps its own size and position.</small></button>
      </div>
      <div className="aaa-widget-dialog-actions"><button onClick={()=>setDuplicate(null)}>Cancel</button><button className="aaa-widget-primary" disabled={busy||!duplicatePageId} onClick={()=>void duplicateWidget()}><Copy size={15}/> Create {duplicateMode==="synced"?"synced":"independent"} copy</button></div>
    </section></div>}
    {creatingDatabase&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createDatabase()}}>
      <Database size={18}/><input autoFocus aria-label="New source database name" maxLength={80} placeholder="Name your new database…" value={newDatabaseName} onChange={e=>setNewDatabaseName(e.target.value)}/>
      <button type="submit" disabled={busy||!newDatabaseName.trim()}><Check size={15}/> Create database</button>
      <button type="button" onClick={()=>setCreatingDatabase(false)} aria-label="Cancel new database"><X size={15}/></button>
    </form>}
    {p.mode==="widgets"?<>
      <div className="aaa-widget-hero"><div><span className="aaa-widget-eyebrow">DEVELOPING IT / WIDGETS</span><h1>Widget workshop</h1><p>Design reusable ways to read your database records. Configure a master here, then add instances to Library or Goals pages.</p></div>
        <div className="aaa-widget-hero-actions"><button className="aaa-widget-secondary" onClick={()=>setCreatingDatabase(true)}><Database size={16}/> New database</button>
          <button className="aaa-widget-primary" onClick={()=>void createDefinition()} disabled={busy}><Plus size={17}/> New widget</button></div></div>
      <section className="aaa-widget-formation-settings aaa-widget-config-group" aria-label="Widget layout behavior">
        <strong><Settings2 size={16}/> Widget formation &amp; layout</strong>
        <div className="aaa-widget-config-pair">
          <label className="aaa-widget-switch"><span>Magnetic snapping</span>
            <input type="checkbox" checked={formation.magneticSnapping}
              onChange={e=>setFormation({magneticSnapping:e.target.checked})}/></label>
          <label className="aaa-widget-field">Snap distance (px)
            <input type="number" min={2} max={40} step={1} disabled={!formation.magneticSnapping&&!formation.quickEdgeSnap}
              value={formation.snapDistancePx} onChange={e=>setFormation({snapDistancePx:Number(e.target.value)})}/>
          </label>
        </div>
        <label className="aaa-widget-switch"><span>Quick edge alignment (no size linking)</span>
          <input type="checkbox" checked={formation.quickEdgeSnap}
            onChange={e=>setFormation({quickEdgeSnap:e.target.checked})}/></label>
        <div className="aaa-widget-config-pair">
          <label className="aaa-widget-field">Fill Freed Space
            <select value={formation.fillFreedSpace}
              onChange={e=>setFormation({fillFreedSpace:e.target.value as typeof formation.fillFreedSpace})}>
              <option value="off">Off · preserve empty spaces</option>
              <option value="column-rise">Column Rise</option>
              <option value="left-to-right">Left-to-Right Reflow</option>
            </select>
          </label>
          <label className="aaa-widget-field">When replacing a widget
            <select value={formation.displacement}
              onChange={e=>setFormation({displacement:e.target.value as typeof formation.displacement})}>
              <option value="same-column">Move down the same column</option>
              <option value="next-row">Move to the next row</option>
            </select>
          </label>
        </div>
        <p className="aaa-widget-config-sub">Configure individual size and row locks from the existing Companion. These layout preferences do not change database records.</p>
      </section>
      {p.visualStyle==="studio"&&<div className="aaa-widget-lab-stats" aria-label="Widget workshop summary">
        <div><small>MASTER WIDGETS</small><strong>{data.definitions.length}</strong><span>Reusable designs</span></div>
        <div><small>DATABASE SOURCES</small><strong>{data.databases.length}</strong><span>Canonical record sets</span></div>
        <div><small>LIBRARY LAYOUTS</small><strong>{data.pages.length}</strong><span>Pages and dashboards</span></div>
      </div>}
      {data.definitions.length===0?<div className="aaa-widget-empty aaa-widget-large"><LayoutGrid size={30}/><strong>No widgets yet</strong><p>Create your first widget and connect it to a database.</p></div>:
      <div className="aaa-widget-definitions">{data.definitions.map(def=><article key={def.id} className="aaa-widget-definition">
        <header><div><span className="aaa-widget-definition-icon"><LayoutGrid size={18}/></span><div><strong>{def.name}</strong><small>{data.databases.find(d=>d.id===def.database_id)?.name||"Choose database"} · {widgetConfig(def.config).renderer}</small></div></div>
          <button aria-label="Configure master widget" onClick={()=>select("definition",def.id)}><Settings2 size={17}/></button></header>
        <div className="aaa-widget-definition-preview">{renderRecords(def.id,def)}</div>
        <footer><button onClick={()=>select("definition",def.id)}><Settings2 size={14}/> Configure</button>
          <button title="Delete widget design or optionally its source" onClick={()=>{setRemoveTarget({kind:"definition",id:def.id,databaseId:def.database_id});setRemoveCore(false);setDeleteConfirmation("")}} aria-label={"Delete "+def.name+" widget design"}><Trash2 size={14}/></button>
        </footer>
      </article>)}</div>}
    </>:<>
      <div className="aaa-widget-hero"><div><span className="aaa-widget-eyebrow">{p.mode==="goals"?"GOALS / DASHBOARD":"LIBRARY / PAGES"}</span>
        <h1>{page?.title|| (p.mode==="goals"?"Goals":"Your Library")}</h1>
        <p>{p.mode==="goals"?"Your existing goals, projects and tasks alongside reusable database widgets.":"Create pages and combine reusable database views into a readable workspace."}</p></div>
        <div className="aaa-widget-hero-actions">
        {arrange&&page&&<button className="aaa-widget-secondary" aria-pressed={allWidgetsCollapsed}
            title={allWidgetsCollapsed?"Expand all widgets":"Collapse all widgets to titles"} onClick={toggleAllWidgetCollapse}>
            {allWidgetsCollapsed?<ChevronDown size={15}/>:<ChevronUp size={15}/>} {allWidgetsCollapsed?"Expand all":"Collapse all"}
          </button>}
        {arrange&&page&&<button className="aaa-widget-secondary" onClick={()=>{setPageDraft(page.title);setRenamingPage(true)}}><Pencil size={15}/> Rename page</button>}
        {arrange&&<button className="aaa-widget-secondary" disabled={busy} onClick={()=>setCreatingDatabase(true)}><Database size={16}/> New database</button>}
        {!p.modeToggleMount&&<button className="aaa-widget-mode-toggle" type="button"
          aria-label={arrange?"Switch to View mode":"Switch to Edit mode"} aria-pressed={arrange}
          onClick={()=>changeMode(!arrange)}>{arrange?<><Eye size={16}/> View</>:<><Pencil size={16}/> Edit</>}</button>}</div>
      </div>
      {p.modeToggleMount&&createPortal(<button className="aaa-widget-mode-toggle aaa-widget-toolbar-mode-toggle" type="button"
        aria-label={arrange?"Switch to View mode":"Switch to Edit mode"} aria-pressed={arrange}
        onClick={()=>changeMode(!arrange)}>{arrange?<><Eye size={16}/> View</>:<><Pencil size={16}/> Edit</>}</button>,p.modeToggleMount)}
      <nav className="aaa-widget-page-tabs" aria-label={p.mode==="goals"?"Goals pages":"Library pages"}>
        {pages.map((item,index)=><button key={item.id} className={item.id===page?.id?"active":""} aria-current={item.id===page?.id?"page":undefined}
          onClick={()=>{p.onPage?.(item.id);setRenamingPage(false);setAddWidget(false);setCreatingSection(false)}}>
          {index===0?<LayoutGrid size={14}/>:<BookOpen size={14}/>} {item.title}
        </button>)}
        <button className="aaa-widget-page-add" onClick={()=>setCreatingPage(true)}><Plus size={14}/> Page</button>
        {arrange&&page&&<button className="aaa-widget-page-add aaa-widget-section-add" type="button"
          title="Add a section to the current page" onClick={()=>setCreatingSection(true)}><Plus size={14}/> Section</button>}
      </nav>
      {renamingPage&&page&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();renamePage()}}>
        <input autoFocus aria-label="Rename page" maxLength={100} value={pageDraft} onChange={e=>setPageDraft(e.target.value)}/>
        <button type="submit" disabled={!pageDraft.trim()}><Check size={16}/> Save name</button>
        <button type="button" aria-label="Cancel page rename" onClick={()=>setRenamingPage(false)}><X size={16}/></button>
      </form>}
      {p.visualStyle==="studio"&&page&&<div className="aaa-widget-lab-stats" aria-label="Current page summary">
        <div><small>THIS PAGE</small><strong>{instanceList.length}</strong><span>Placed widgets</span></div>
        <div><small>CONNECTED SOURCES</small><strong>{new Set(instanceList.map(w=>sourceOf(w).databaseId).filter(Boolean)).size}</strong><span>Database views</span></div>
        <div><small>RECORDS AVAILABLE</small><strong>{data.records.length}</strong><span>Across {data.databases.length} databases</span></div>
      </div>}
      {creatingPage&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createPage()}}><input aria-label="New page title" autoFocus placeholder={p.mode==="library"?"e.g. World View, Characters…":"New Goals page…"} maxLength={100} value={newPage} onChange={e=>setNewPage(e.target.value)}/><button type="submit" disabled={!newPage.trim()||busy}><Check size={16}/> Create page</button><button type="button" onClick={()=>setCreatingPage(false)} aria-label="Cancel"><X size={16}/></button></form>}
      {addWidget&&<div className="aaa-widget-add-picker"><div><strong>Add to {page?.title}{pageSections.find(s=>s.id===activePlacementSection)?" · "+pageSections.find(s=>s.id===activePlacementSection)?.title:""}</strong><button onClick={()=>setAddWidget(false)} aria-label="Close widget picker"><X size={16}/></button></div>
        <button onClick={()=>{setAddWidget(false);setCreatingDatabase(true)}}><Database size={16}/> Create a new source database <small>Saved centrally in Databases</small><ChevronRight size={16}/></button>
        <button disabled={!page||busy} onClick={()=>void createAndPlaceWidget()}><Plus size={16}/> Create a new reusable widget <small>Open Configure</small><ChevronRight size={16}/></button>
        {p.mode==="goals"&&<button onClick={()=>void addGoals()}><BookOpen size={16}/> Goals &amp; projects (existing planner)<Plus size={16}/></button>}
        {data.definitions.map(def=><button key={def.id} onClick={()=>void addDefinition(def)}><LayoutGrid size={16}/>{def.name}<small>Independent view · {data.databases.find(db=>db.id===def.database_id)?.name||"Unconnected"}</small><Plus size={16}/></button>)}
        {!data.definitions.length&&<p>No saved widgets yet. Create one here and it will also appear in Developing IT → Widgets.</p>}
      </div>}
      {page?<div className={"aaa-widget-sections"+(arrange?" aaa-widget-sections-arranging":"")}>
        {arrange&&<div className="aaa-widget-section-toolbar"><button type="button" className="aaa-widget-tips-toggle"
          aria-expanded={sectionToolsVisible} onClick={()=>setSectionToolsVisible(open=>!open)}>
          {sectionToolsVisible?"Hide editing tips":"Show editing tips"}</button>
          {sectionToolsVisible&&<span>Drag widgets to insertion lines, or drag their corner and dividers to resize. Ctrl-click (⌘ on Mac) to select widgets for grouping.</span>}
          {selectedPageWidgets.length>0&&<div className="aaa-widget-group-actions" role="group" aria-label="Selected widget grouping actions">
            <span>{selectedPageWidgets.length} selected</span>
            <button type="button" disabled={!selectedCanGroup} onClick={groupSelectedWidgets}><Link2 size={14}/> Group</button>
            <button type="button" disabled={!selectedPageWidgets.some(widget=>fluidGroupId(widget))}
              onClick={ungroupSelectedWidgets}><Unlink2 size={14}/> Ungroup</button>
            <button type="button" aria-label="Clear selected widgets" onClick={()=>setSelectedWidgetIds([])}><X size={14}/></button>
          </div>}</div>}
        {creatingSection&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createSection()}}>
          <input autoFocus aria-label="New section name" placeholder="e.g. World History, Project Progress…" maxLength={100} value={newSection} onChange={e=>setNewSection(e.target.value)}/>
          <button type="submit" disabled={!newSection.trim()||busy}><Check size={15}/> Create section</button>
          <button type="button" aria-label="Cancel new section" onClick={()=>setCreatingSection(false)}><X size={15}/></button>
        </form>}
        {sectionGroups.map(({section,widgets},sectionIndex)=><section key={section.id||"overview"} className="aaa-widget-page-section" aria-label={section.title+" section"}>
          <header className="aaa-widget-section-header"><div className="aaa-widget-section-heading-main">
            <button type="button" className="aaa-widget-section-collapse" aria-expanded={!sectionPrefs[section.id]?.collapsed}
              aria-label={(sectionPrefs[section.id]?.collapsed?"Expand ":"Collapse ")+section.title+" section"}
              onClick={()=>updateSectionDisplay(section.id,{collapsed:!sectionPrefs[section.id]?.collapsed})}>
              {sectionPrefs[section.id]?.collapsed?<ChevronRight size={17}/>:<ChevronDown size={17}/>}</button>
            <div className="aaa-widget-section-text-blocks">
              {!sectionPrefs[section.id]?.hideLabel&&<small key={"label-"+section.id} className={arrange?"aaa-widget-inline-edit":""}
                contentEditable={arrange} suppressContentEditableWarning spellCheck={false} role={arrange?"textbox":undefined}
                aria-label={arrange?"Edit section eyebrow label":undefined} data-placeholder="Section label"
                onBlur={e=>{if(arrange)updateSectionDisplay(section.id,{label:e.currentTarget.textContent?.slice(0,60)??""})}}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur()}
                  if(e.key==="Escape"){e.currentTarget.textContent=sectionPrefs[section.id]?.label??`SECTION ${sectionIndex+1}`;e.currentTarget.blur()}}}>
                {sectionPrefs[section.id]?.label??`SECTION ${sectionIndex+1}`}</small>}
              <h2 key={"title-"+section.id} className={arrange?"aaa-widget-inline-edit":""}
                contentEditable={arrange} suppressContentEditableWarning spellCheck={false} role={arrange?"textbox":undefined}
                aria-label={arrange?"Edit section heading":undefined} data-placeholder="Section heading"
                onBlur={e=>{if(arrange)renameSection(section.id,(e.currentTarget.textContent??"").slice(0,100).trim())}}
                onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();e.currentTarget.blur()}
                  if(e.key==="Escape"){e.currentTarget.textContent=section.title;e.currentTarget.blur()}}}>{section.title}</h2>
              {!sectionPrefs[section.id]?.hideSummary&&<p>{widgets.length} {widgets.length===1?"widget":"widgets"} · reusable database views</p>}
            </div></div>
            {arrange&&<div className="aaa-widget-section-actions">
              {section.id&&<><button disabled={pageSections.findIndex(s=>s.id===section.id)===0} aria-label={`Move ${section.title} section up`} onClick={()=>shiftSection(section.id,-1)}><ArrowUp size={15}/></button>
                <button disabled={pageSections.findIndex(s=>s.id===section.id)===pageSections.length-1} aria-label={`Move ${section.title} section down`} onClick={()=>shiftSection(section.id,1)}><ArrowDown size={15}/></button>
                <button aria-label={sectionPrefs[section.id]?.hideLabel?"Show section label":"Hide section label"}
                  title={sectionPrefs[section.id]?.hideLabel?"Show label":"Hide label"}
                  onClick={()=>updateSectionDisplay(section.id,{hideLabel:!sectionPrefs[section.id]?.hideLabel})}>
                  {sectionPrefs[section.id]?.hideLabel?<Eye size={15}/>:<EyeOff size={15}/>}</button>
                <button aria-label={sectionPrefs[section.id]?.hideSummary?"Show section details":"Hide section details"}
                  title={sectionPrefs[section.id]?.hideSummary?"Show widget count":"Hide widget count"}
                  onClick={()=>updateSectionDisplay(section.id,{hideSummary:!sectionPrefs[section.id]?.hideSummary})}>
                  {sectionPrefs[section.id]?.hideSummary?<LayoutGrid size={15}/>:<EyeOff size={15}/>}</button>
                <button aria-label={`Remove ${section.title} section`} onClick={()=>void deleteSection(section.id)}><Trash2 size={15}/></button></>}
            </div>}
          </header>
          {!sectionPrefs[section.id]?.collapsed&&<div className={`aaa-widget-canvas ${arrange&&drag?"aaa-widget-drop-zone":""} ${snapGuide?"aaa-widget-magnetic-active":""} ${arrange&&dropHint?.sectionId===section.id&&dropHint.edge==="section-end"?"aaa-widget-section-end-highlight":""}`} aria-label={section.title+" widgets"}
            data-aaa-section-id={section.id}
            onDragOver={e=>{if(!arrange||!drag)return;e.preventDefault();
              if(fluidEnabled)fluidHoverAtPoint(e.clientX,e.clientY,drag);
              else hint({sectionId:section.id,targetId:null,edge:"section-end"})}}
            onDrop={e=>{if(!arrange)return;e.preventDefault();
              if(fluidEnabled&&drag){fluidHoverAtPoint(e.clientX,e.clientY,drag);commitDrop()}
              else commitDrop({sectionId:section.id,targetId:null,edge:"section-end"})}}>
            {fluidEnabled?(()=>{
              const positions=initialFluidRects(widgets);
              const coords=(r:FluidWidgetRect)=>({
                left:`calc(${r.x/12*100}% + ${r.x>0?7:0}px)`,
                width:`calc(${r.w/12*100}% - ${(r.x>0?7:0)+(r.x+r.w<11.999?7:0)}px)`,
                top:r.y,height:r.h
              });
              const preview=fluidDrop?.sectionId===section.id?fluidDrop.rect:null;
              const projected=fluidDrop?.sectionId===section.id?fluidDrop.projected:undefined;
              const guideIntent=fluidDrop?.sectionId===section.id?fluidDrop.intent:"free";
              const sourceVisiblyProjected=!!preview&&!!drag&&guideIntent!=="blocked"&&!drag.startsWith("developer:")&&
                widgets.some(widget=>widget.id===drag);
              const guideTarget=fluidDrop?.sectionId===section.id&&fluidDrop.targetId
                ?positions[fluidDrop.targetId]:null;
              return <div className={"aaa-widget-fluid-field"+(arrange&&preview?" aaa-widget-fluid-live-projecting":"")}
                data-aaa-fluid-canvas="true"
                data-aaa-section-id={section.id} style={{height:Math.max(220,fluidCanvasHeight(projected??positions)+170,
                  preview?preview.y+preview.h+FLUID_GAP:0)}}
                onDragOver={e=>{if(!arrange||!drag)return;e.preventDefault();
                  fluidHoverAtPoint(e.clientX,e.clientY,drag)}}
                onDrop={e=>{if(!arrange||!drag)return;e.preventDefault();e.stopPropagation();
                  fluidHoverAtPoint(e.clientX,e.clientY,drag);commitDrop()}}>
                {[...widgets].sort((a,b)=>{
                  const first=positions[a.id],second=positions[b.id];
                  return (first?.y??0)-(second?.y??0)||(first?.x??0)-(second?.x??0);
                }).map(widget=>{
                  const rect=positions[widget.id];if(!rect)return null;
                  const displayed=projected?.[widget.id]??rect;
                  const displaced=!!preview&&widget.id!==drag&&
                    JSON.stringify(displayed)!==JSON.stringify(rect);
                  const locked=widgetSizeLocked(widget);
                  return <div className={"aaa-widget-fluid-item"+
                    (widget.id===drag&&preview?" aaa-widget-fluid-drag-source":"")+
                    (displaced?" aaa-widget-fluid-displaced":"")}
                    key={widget.id} style={coords(displayed)} data-aaa-fluid-widget={widget.id}>
                    {widgetCard(widget,false,true)}
                    {arrange&&!collapsedWidgets.includes(widget.id)&&([
                      "left","right","top","bottom-left","bottom-right","bottom"
                    ] as const).map(handle=><button type="button" key={handle}
                      className={"aaa-widget-fluid-handle aaa-widget-fluid-handle-"+handle}
                      disabled={locked} aria-label={"Resize "+(widget.title||"widget")+" from "+handle.replace("-"," ")}
                      
                      onPointerDown={e=>startFluidResize(e,widget,handle)}
                      onPointerMove={fluidResizeMove}
                      onPointerUp={fluidResizeEnd} onPointerCancel={fluidResizeEnd}
                      onDoubleClick={e=>{if(locked)return;e.stopPropagation();
                        const same=instanceList.filter(w=>widgetSectionId(w)===section.id);
                        const edge=handle.includes("left")?"left":handle.includes("right")?"right":
                          handle==="top"?"top":"bottom";
                        let next=alignFluidWidgetEdge(same,widget.id,edge);
                        if(handle.includes("bottom")&&handle!=="bottom")
                          next=alignFluidWidgetEdge(next,widget.id,"bottom");
                        const changed=new Map(next.map(w=>[w.id,w]));
                        saveLayout(instanceList.map(w=>changed.get(w.id)??w));
                      }}/>) }
                  </div>;
                })}
                {arrange&&fluidSharedBoundaries(widgets).map(boundary=>{
                  const a=widgets.find(w=>w.id===boundary.leftId);
                  const b=widgets.find(w=>w.id===boundary.rightId);
                  const locked=[...(boundary.leftIds??[boundary.leftId]),...(boundary.rightIds??[boundary.rightId])].some(id=>{const item=widgets.find(w=>w.id===id);return !item||widgetSizeLocked(item)});
                  return <button type="button" key={boundary.leftId+"-"+boundary.rightId}
                    className="aaa-widget-fluid-shared-divider" disabled={locked}
                    aria-label={`Resize shared boundary between ${a?.title??"left widget"} and ${b?.title??"right widget"}`}
                    
                    style={{left:`${boundary.x/12*100}%`,top:boundary.top,height:boundary.height}}
                    onPointerDown={e=>sharedResizeDown(e,boundary.leftId,boundary.rightId)}
                    onPointerMove={sharedResizeMove} onPointerUp={sharedResizeEnd}
                    onPointerCancel={sharedResizeEnd}/>;
                })}
                {arrange&&preview&&guideTarget&&guideIntent!=="replace"&&guideIntent!=="free"&&<div
                  className={"aaa-widget-fluid-insertion-line aaa-widget-fluid-insertion-"+guideIntent}
                  data-aaa-drop-intent={guideIntent} aria-hidden="true"
                  style={guideIntent==="above"||guideIntent==="below"?{
                    left:`${guideTarget.x/12*100}%`,
                    width:`${guideTarget.w/12*100}%`,
                    top:guideIntent==="above"?guideTarget.y-7:guideTarget.y+guideTarget.h+7
                  }:{
                    left:`${(guideIntent==="left"?preview.x+preview.w:preview.x)/12*100}%`,
                    top:guideTarget.y,height:guideTarget.h
                  }}/>} 
                {arrange&&preview&&<div className={"aaa-widget-fluid-drop-preview"+
                  (sourceVisiblyProjected?" aaa-widget-fluid-real-preview":"")}
                  data-aaa-drop-intent={guideIntent} style={coords(preview)} role="status" aria-label="Widget drop position">
                  {!sourceVisiblyProjected&&<span>{guideIntent==="above"?"Insert above":guideIntent==="below"?"Stack below":
                    guideIntent==="left"||guideIntent==="right"?"Fit beside":guideIntent==="blocked"?"No room here":guideIntent==="replace"?"Replace position":
                    widgets.some(w=>w.id===drag)?"Move here":"Add widget here"}</span>}
                </div>}
                {arrange&&preview&&sourceVisiblyProjected&&drag&&positions[drag]&&
                  JSON.stringify(projected?.[drag]??preview)!==JSON.stringify(positions[drag])&&
                  <div className="aaa-widget-fluid-origin-placeholder" style={coords(positions[drag])}
                    aria-hidden="true"><span>Original position</span></div>}
              </div>;
            })():<>
            {arrange&&widgets.length>0&&(()=>{
              const first=widgetLayoutBands(widgets)[0];
              const tracks=widgetVisualTracks(first);
              const topId=tracks[0]?.targetId;
              if(!topId)return null;
              const newRowTarget:WidgetDropTarget={sectionId:section.id,targetId:topId,edge:"new-row-before"};
              return <div className="aaa-widget-top-insertion" aria-label="Insert before the first widget row">
                <div className="aaa-widget-top-new-row" role="presentation"
                  title="Insert a new full-width row above the existing widgets"
                  aria-label="New full-width row at the top"
                  data-aaa-insert-edge="new-row-before" data-aaa-target-id={topId}
                  data-aaa-section-id={section.id}
                  onDragOver={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();hint(newRowTarget)}}
                  onDrop={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();commitDrop(newRowTarget)}}
                  >
                  <span className="aaa-widget-divider-stroke" aria-hidden="true"/>
                  <span className="aaa-widget-guide-label">New row above</span>
                </div>
                <div className="aaa-widget-top-stack-options">
                  {tracks.map((track,index)=>{
                    const target:WidgetDropTarget={sectionId:section.id,targetId:track.targetId,edge:"above"};
                    return <div key={"above-"+index} role="presentation"
                      className="aaa-widget-top-column-stack"
                      style={{flex:`${track.width} 1 0`}}
                      title={`Stack a widget above visual column ${index+1}`}
                      aria-label={`Stack widget above column ${index+1}`}
                      data-aaa-insert-edge="above" data-aaa-target-id={track.targetId}
                      data-aaa-section-id={section.id}
                      onDragOver={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();hint(target)}}
                      onDrop={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();commitDrop(target)}}
                      >
                      <span className="aaa-widget-divider-stroke" aria-hidden="true"/>
                      <span className="aaa-widget-guide-label"><Plus size={12}/> Stack above</span>
                    </div>;
                  })}
                </div>
              </div>;
            })()}
            {widgetLayoutBands(widgets).map(band=>{
              const used=band.lanes.reduce((sum,lane)=>sum+lane.width,0);
              const gap=14;
              const heights=(w:PageWidget)=>measuredWidgetHeights[w.id]??
                (widgetFootprintHeight(w,arrange,collapsedWidgets.includes(w.id))??widgetHeightPx(w)+WIDGET_EDITOR_FOOTER_PX);
              const visualTracks=widgetVisualTracks(band,heights,gap);
              const largestEnd=Math.max(0,...visualTracks.map(track=>track.endPx));
              const bandPadding=arrange?42:undefined;
              // The upper-row divider creates an upper column; the lower-row
              // edge fills a vacant lower slot. They must never share a hit box.
              const extendLowerWidget=(widget:PageWidget,side:"left"|"right")=>
                saveLayout(expandWidgetIntoVacantLane(instanceList,widget.id,side));
              const renderItem=(widget:PageWidget)=><div className={"aaa-widget-layout-item"+(widget.config.fitContent===true?" aaa-widget-layout-fit":"")} key={widget.id}
                data-aaa-layout-widget-id={widget.id}
                style={{height:widgetFootprintHeight(widget,arrange,collapsedWidgets.includes(widget.id))??"auto",
                  marginTop:Math.max(0,Number(widget.config.layoutOffsetPx??0))}}>
                {widgetCard(widget)}
                {arrange&&!collapsedWidgets.includes(widget.id)&&(["left","right"] as const).map(side=>
                  <button key={"edge-"+side} type="button"
                    className={"aaa-widget-side-resize aaa-widget-side-resize-"+side}
                    aria-label={"Resize "+(widget.title||"widget")+" from "+side+" side"}
                    title={widgetSizeLocked(widget)?"Unlock widget size in Configure":"Drag this side to resize the widget"}
                    disabled={widgetSizeLocked(widget)}
                    onPointerDown={e=>startResize(e,widget,"x",side)}
                    onPointerMove={resizeMove}
                    onPointerUp={resizeEnd}
                    onPointerCancel={resizeEnd}/>)}
                {arrange&&(()=>{
                  const start=widget.config.layoutSpanStart,count=widget.config.layoutSpanCount;
                  const laneIndex=band.lanes.findIndex(lane=>lane.widgets.some(item=>item.id===widget.id));
                  const lane=band.lanes[laneIndex];
                  const isLower=typeof start==="number"&&typeof count==="number"&&count>=2||
                    !!lane&&lane.widgets.findIndex(item=>item.id===widget.id)>0;
                  if(!isLower)return null;
                  const first=typeof start==="number"&&typeof count==="number"&&count>=2?start:laneIndex;
                  const last=first+(typeof count==="number"&&count>=2?count:1);
                  const isAvailable=(side:"left"|"right")=>{
                    const result=expandWidgetIntoVacantLane(instanceList,widget.id,side);
                    return result.find(w=>w.id===widget.id)?.config.layoutSpanCount!==count;
                  };
                  const growHandle=(side:"left"|"right")=><button type="button" key={side}
                    className={"aaa-widget-span-edge-resize aaa-widget-span-edge-"+side}
                    title={"Drag this dotted edge "+side+" to expand into available space"}
                    aria-label={"Drag lower widget's "+side+" dotted edge to expand into free space"}
                    onPointerDown={e=>{e.preventDefault();e.stopPropagation();
                      spanHandleDrag.current={id:widget.id,side,x:e.clientX,completed:false};
                      e.currentTarget.setPointerCapture(e.pointerId)}}
                    onPointerMove={e=>{const state=spanHandleDrag.current;
                      if(state?.id===widget.id&&state.side===side&&
                        (side==="left"?state.x-e.clientX:e.clientX-state.x)>23)
                        state.completed=true}}
                    onPointerUp={e=>{const state=spanHandleDrag.current;
                      if(state?.id===widget.id&&state.side===side){
                        if(state.completed){spanHandleConsumedClick.current=widget.id+side;extendLowerWidget(widget,side)}
                        spanHandleDrag.current=null;
                      }
                      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
                    onPointerCancel={()=>{spanHandleDrag.current=null}}
                    onClick={e=>{e.stopPropagation();
                      if(spanHandleConsumedClick.current===widget.id+side){spanHandleConsumedClick.current=null;return}
                      extendLowerWidget(widget,side)}}/>;
                  return <>
                    {first>0&&isAvailable("left")&&growHandle("left")}
                    {last<band.lanes.length&&isAvailable("right")&&growHandle("right")}
                  </>;
                })()}
                {false&&arrange&&(["left","right"] as const).map(side=>{
                  // The lower-row + lives near the bottom of the merged card,
                  // clear of its central sideways resize arrow (part zero).
                  const start=widget.config.layoutSpanStart,count=widget.config.layoutSpanCount;
                  if(typeof start!=="number"||typeof count!=="number"||count<2)return null;
                  const adjacent=band.lanes[side==="left"?start-1:start+count];
                  if(!adjacent||adjacent.widgets.length!==1)return null;
                  const target:WidgetDropTarget={sectionId:section.id,targetId:widget.id,
                    edge:side==="left"?"lower-adjacent-left":"lower-adjacent-right"};
                  return <button key={"local-"+side} type="button"
                    className={"aaa-widget-lower-adjacent-drop aaa-widget-lower-adjacent-"+side+
                      (dropHint?.edge===target.edge&&dropHint.targetId===target.targetId?" is-target":"")}
                    title={`Add a widget in the lower empty space ${side} of ${widget.title||"this widget"}`}
                    aria-label={`Fill lower empty space ${side} of ${widget.title||"this widget"}`}
                    data-aaa-insert-edge={target.edge} data-aaa-target-id={target.targetId}
                    data-aaa-section-id={section.id}
                    onDragOver={e=>{if(!drag||drag===target.targetId)return;
                      e.preventDefault();e.stopPropagation();hint(target)}}
                    onDrop={e=>{if(!drag||drag===target.targetId)return;
                      e.preventDefault();e.stopPropagation();commitDrop(target)}}
                    onClick={e=>{e.stopPropagation();openPlacement(band,target)}}/>;
                })}
                {arrange&&<button className="aaa-widget-height-divider" type="button"
                  data-aaa-insert-edge="below" data-aaa-target-id={widget.id} data-aaa-section-id={section.id}
                  title={"Drag to resize "+(widget.title||"widget")+" height; double-click to "+widgetDoubleClickDescription(p.bottomDoubleClick??"match-height")}
                  aria-label={"Resize "+(widget.title||"widget")+" height; double-click to "+widgetDoubleClickDescription(p.bottomDoubleClick??"match-height")}
                  onPointerDown={e=>startResize(e,widget,"y")} onPointerMove={resizeMove}
                  onPointerUp={resizeEnd} onPointerCancel={resizeEnd}
                  onDoubleClick={e=>{e.preventDefault();e.stopPropagation();
                    resizeStart.current=null;resizePreviewRef.current=null;setResizePreview(null);
                    const action=p.bottomDoubleClick??"match-height";
                    if(action!=="none")saveLayout(applyWidgetDoubleClickAction(instanceList,pageSections,widget.id,action,fillGaps,14,WIDGET_EDITOR_FOOTER_PX));
                  }}
                  onKeyDown={e=>{
                    if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();
                      if(widgetSizeLocked(widget)){setNotice("This widget's size is locked.");return}
                      const direction=e.key==="ArrowDown"?24:-24;
                      saveLayout(instanceList.map(item=>item.id===widget.id
                        ?{...item,config:{...item.config,fitContent:false,heightPx:Math.max(160,Math.min(1200,widgetHeightPx(item)+direction))}}:item));
                    }
                  }}
                  onDragOver={e=>{if(!drag||drag===widget.id)return;e.preventDefault();e.stopPropagation();
                    hint({sectionId:section.id,targetId:widget.id,edge:"below"})}}
                  onDrop={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();
                    commitDrop({sectionId:section.id,targetId:widget.id,edge:"below"})}}/>}
              </div>;
              const renderLane=(lane:WidgetLayoutLane,laneIndex:number)=><div className="aaa-widget-layout-lane-shell" key={lane.id}
                style={{flex:`${lane.width} 1 0`}}>
                <div className="aaa-widget-layout-lane" data-aaa-lane-bottom-widget={lane.widgets[lane.widgets.length-1]?.id}
                  data-aaa-section-id={section.id}
                  onDragOver={e=>{if(!drag||!lane.widgets.length)return;
                    if((e.target as HTMLElement).closest("[data-aaa-widget-id]"))return;
                    e.preventDefault();e.stopPropagation();
                    hint({sectionId:section.id,targetId:lane.widgets[lane.widgets.length-1].id,edge:"below"})}}
                  onDrop={e=>{if(!drag||!lane.widgets.length)return;
                    e.preventDefault();e.stopPropagation();
                    commitDrop({sectionId:section.id,targetId:lane.widgets[lane.widgets.length-1].id,edge:"below"})}}>
                  {lane.widgets.map(renderItem)}
                  {arrange&&lane.widgets.length>0&&(()=>{
                    const bottom=lane.widgets[lane.widgets.length-1];
                    return <button type="button"
                      className="aaa-widget-lane-stack-drop aaa-widget-stack-resizer"
                      title={"Drag to resize "+(bottom.title||"this widget")+" height"}
                      aria-label={"Resize "+(bottom.title||"this widget")+" height"}
                      data-aaa-insert-edge="below" data-aaa-target-id={bottom.id} data-aaa-section-id={section.id}
                      onDragOver={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();
                        hint({sectionId:section.id,targetId:bottom.id,edge:"below"})}}
                      onDrop={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();
                        commitDrop({sectionId:section.id,targetId:bottom.id,edge:"below"})}}
                      onPointerDown={e=>startResize(e,bottom,"y")}
                      onPointerMove={resizeMove} onPointerUp={resizeEnd} onPointerCancel={resizeEnd}>
                      <span className="aaa-widget-divider-stroke" aria-hidden="true"/>
                      <span className="aaa-widget-guide-label" aria-hidden="true"><Plus size={12}/> Stack</span>
                    </button>;
                  })()}
                </div>
                {arrange&&laneIndex<band.lanes.length-1&&(()=>{
                  const rightWidget=band.lanes[laneIndex+1]?.widgets[0];
                  const insertBetween=band.lanes.length<4&&rightWidget&&drag?.startsWith("developer:")
                    ?{sectionId:section.id,targetId:rightWidget.id,edge:"left" as const}:null;
                  const upperSpan=(band.spans??[])
                    .filter(span=>span.startLane<=laneIndex&&span.startLane+span.laneCount>laneIndex+1)
                    .sort((a,b)=>a.laneCount-b.laneCount)[0];
                  const nextSpan=(band.spans??[]).find(span=>span.startLane===laneIndex+1);
                  const junctionY=nextSpan?Math.max(0,...band.lanes
                    .slice(nextSpan.startLane,nextSpan.startLane+nextSpan.laneCount)
                    .map(inner=>inner.widgets.reduce((total,w)=>total+heights(w),0)+
                      Math.max(0,inner.widgets.length-1)*gap))+gap:undefined;
                  return <button className="aaa-widget-lane-divider" type="button"
                    data-aaa-guide={upperSpan?"upper-segment":"full-band"}
                    data-aaa-junction={junctionY===undefined?undefined:"true"}
                    style={junctionY===undefined?undefined:{"--aaa-junction-y":`${junctionY}px`} as React.CSSProperties}
                    title="Drag to resize neighboring columns"
                    aria-label="Resize neighboring columns"
                    onDragOver={e=>{if(!insertBetween)return;e.preventDefault();e.stopPropagation();hint(insertBetween)}}
                    onDrop={e=>{if(!insertBetween)return;e.preventDefault();e.stopPropagation();commitDrop(insertBetween)}}
                    onPointerDown={e=>startResize(e,lane.widgets[0],"x")}
                    onPointerMove={resizeMove} onPointerUp={resizeEnd} onPointerCancel={resizeEnd}/>;
                })()}
              </div>;
              const renderNode=(node:WidgetVisualNode):React.ReactNode=>{
                if(node.kind==="lane")return renderLane(node.lane,node.startLane);
                const targetId=band.lanes.slice(node.startLane,node.startLane+node.laneCount)
                  .flatMap(lane=>lane.widgets).find(w=>w.id!==drag)?.id??
                  node.span.widgets.find(w=>w.id!==drag)?.id;
                const target:WidgetDropTarget={
                  sectionId:section.id,targetId:targetId??null,edge:"span-below",
                  spanStartLane:node.startLane,spanLaneCount:node.laneCount
                };
                return <div key={"nested-"+node.startLane+"-"+node.laneCount}
                  className="aaa-widget-span-cluster"
                  style={{flex:`${node.width} 1 0`}}>
                  <div className="aaa-widget-span-cluster-columns">
                    {node.children.map(renderNode)}
                  </div>
                  {node.span.widgets.map(renderItem)}
                  {arrange&&targetId&&<div role="presentation" className="aaa-widget-span-insertion"
                    title="Stack another widget in this combined column"
                    aria-label={"Stack in combined column "+(node.startLane+1)+" through "+(node.startLane+node.laneCount)}
                    data-aaa-insert-edge="span-below"
                    data-aaa-target-id={targetId}
                    data-aaa-section-id={section.id}
                    data-aaa-span-start={node.startLane}
                    data-aaa-span-count={node.laneCount}
                    onDragOver={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();hint(target)}}
                    onDrop={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();commitDrop(target)}}
                    >
                    <span className="aaa-widget-guide-label" aria-hidden="true"><Plus size={12}/> Stack combined</span>
                  </div>}
                </div>;
              };
              const segments=widgetVisualHierarchy(band).map(renderNode);
              const firstOuter=band.lanes.flatMap(l=>l.widgets).find(w=>w.id!==drag);
              const lastOuter=[...band.lanes].reverse().flatMap(l=>l.widgets).find(w=>w.id!==drag);
              // Never expose a fifth-column target; a 1–3-column band keeps
              // its subtle outer rails for dragging a workshop preview in.
              const showOuter=arrange&&band.lanes.length<4;
              const afterId=band.lanes.flatMap(l=>l.widgets).find(w=>w.id!==drag)?.id??
                band.spans?.flatMap(s=>s.widgets).find(w=>w.id!==drag)?.id??null;
              const rangeTarget:WidgetDropTarget={
                sectionId:section.id,targetId:afterId,
                edge:band.lanes.length===1?"below":"span-below",
                ...(band.lanes.length>1?{spanStartLane:0,spanLaneCount:band.lanes.length}:{})
              };
              return <div className={"aaa-widget-layout-band "+(dropHint?.edge==="new-row"&&band.lanes.some(l=>l.widgets.some(w=>w.id===dropHint.targetId))?"aaa-widget-band-new-row":"")} key={band.id}
                style={{paddingBottom:bandPadding}}> 
                {arrange&&<div className="aaa-widget-row-controls">
                  <span>{Math.min(100,Math.round(used/12*100))}% occupied</span>
                  <button type="button" className="aaa-widget-row-lock" aria-pressed={widgetBandLocked(band.lanes.flatMap(l=>l.widgets))}
                    title={widgetBandLocked(band.lanes.flatMap(l=>l.widgets))?"Unlock this row":"Lock this row"}
                    onClick={()=>saveLayout(setWidgetRowLock(instanceList,band.lanes[0]?.widgets[0]?.id??"",!widgetBandLocked(band.lanes.flatMap(l=>l.widgets))))}>
                    {widgetBandLocked(band.lanes.flatMap(l=>l.widgets))?<Lock size={12}/>:<Unlock size={12}/>}
                    {widgetBandLocked(band.lanes.flatMap(l=>l.widgets))?"Locked":"Flexible"}
                  </button>
                </div>}
                {showOuter&&firstOuter&&<div role="presentation"
                  className={"aaa-widget-outer-column-drop aaa-widget-outer-left"+(dropHint?.edge==="left"&&dropHint.targetId===firstOuter.id?" is-target":"")}
                  title="Drop a widget here to add a column on the left"
                  aria-label="Insert new column on left edge"
                  data-aaa-insert-edge="left" data-aaa-target-id={firstOuter.id} data-aaa-section-id={section.id}
                  onDragOver={e=>{if(!drag||drag===firstOuter.id)return;e.preventDefault();e.stopPropagation();
                    hint({sectionId:section.id,targetId:firstOuter.id,edge:"left"})}}
                  onDrop={e=>{if(!drag||drag===firstOuter.id)return;e.preventDefault();e.stopPropagation();
                    commitDrop({sectionId:section.id,targetId:firstOuter.id,edge:"left"})}}
                  />}
                {segments}
                {arrange&&afterId&&<div className="aaa-widget-combine-bar"
                  style={{top:largestEnd+19}} role="group" aria-label="Add across selected columns">
                  <span className="aaa-widget-combine-track" aria-hidden="true"/>
                  <div role="presentation" className="aaa-widget-combine-choice"
                    style={{left:0,width:"100%"}}
                    title="Select any contiguous range of columns for a new widget"
                    aria-label="Choose columns for a combined widget"
                    data-aaa-insert-edge={rangeTarget.edge} data-aaa-target-id={afterId}
                    data-aaa-section-id={section.id} data-aaa-span-start={rangeTarget.spanStartLane}
                    data-aaa-span-count={rangeTarget.spanLaneCount}
                    onDragOver={e=>{if(!drag||drag===afterId)return;
                      e.preventDefault();e.stopPropagation();hint(rangeTarget)}}
                    onDrop={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();commitDrop(rangeTarget)}}
                    >
                    <span className="aaa-widget-combine-label" style={{left:"50%"}}>
                      <Plus size={10}/> Choose columns
                    </span>
                  </div>
                </div>}
                {used<12&&<div className="aaa-widget-layout-spacer" style={{flex:`${12-used} 1 0`}}/>}
                {showOuter&&lastOuter&&<div role="presentation"
                  className={"aaa-widget-outer-column-drop aaa-widget-outer-right"+(dropHint?.edge==="right"&&dropHint.targetId===lastOuter.id?" is-target":"")}
                  title="Drop a widget here to add a column on the right"
                  aria-label="Insert new column on right edge"
                  data-aaa-insert-edge="right" data-aaa-target-id={lastOuter.id} data-aaa-section-id={section.id}
                  onDragOver={e=>{if(!drag||drag===lastOuter.id)return;e.preventDefault();e.stopPropagation();
                    hint({sectionId:section.id,targetId:lastOuter.id,edge:"right"})}}
                  onDrop={e=>{if(!drag||drag===lastOuter.id)return;e.preventDefault();e.stopPropagation();
                    commitDrop({sectionId:section.id,targetId:lastOuter.id,edge:"right"})}}
                  />}
                {arrange&&band.lanes.length>0&&<div className="aaa-widget-band-row-drop" role="presentation"
                  aria-label="Drop a widget here to add another row"
                  onDragOver={e=>{if(!drag||!afterId)return;e.preventDefault();e.stopPropagation();
                    hint({sectionId:section.id,targetId:afterId,edge:"new-row"})}}
                  onDrop={e=>{if(!drag||!afterId)return;e.preventDefault();e.stopPropagation();
                    commitDrop({sectionId:section.id,targetId:afterId,edge:"new-row"})}}>
                    <span className="aaa-widget-divider-stroke" aria-hidden="true"/>
                    <span className="aaa-widget-guide-label" aria-hidden="true">New row</span>
                  </div>}
              </div>;
            })}
            </>}
            {arrange&&!widgets.length&&<div className="aaa-widget-empty-slot aaa-widget-empty-developer">Create a widget in Developer, then drag it into this section.</div>}
            {!widgets.length&&!arrange&&<div className="aaa-widget-section-empty">No widgets in this section yet. Switch to Arrange mode to add some.</div>}
          </div>}
        </section>)}
        {!instanceList.length&&!arrange&&<div className="aaa-widget-empty aaa-widget-large"><LayoutGrid size={28}/><p>Create a widget in Developer, then drag it into this page in Edit mode.</p></div>}
      </div>:<div className="aaa-widget-empty aaa-widget-large"><LayoutGrid size={28}/><p>Create a page to start organizing your widgets.</p><button onClick={()=>setCreatingPage(true)}><Plus size={16}/> New page</button></div>}
    </>}
    {placementRequest&&<WidgetPlacementChooser key={
      placementRequest.band.id+":"+placementRequest.target.edge+":"+
      placementRequest.target.targetId+":"+placementRequest.target.spanStartLane}
      band={placementRequest.band} target={placementRequest.target}
      definitions={data.definitions} onCancel={()=>setPlacementRequest(null)}
      onConfirm={confirmPlacement}/>}
  </section>{p.previewMount&&previewWidget&&createPortal(
    <div className="aaa-companion-live-widget" style={{height:widgetHeightPx(previewWidget)+WIDGET_EDITOR_FOOTER_PX}}>
      {widgetCard(previewWidget,true)}
    </div>,p.previewMount
  )}</Fragment>;
}
