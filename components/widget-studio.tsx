"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowDown,ArrowUp,BookOpen,Check,ChevronRight,Copy,Database,LayoutGrid,Link2,Pencil,Plus,RefreshCw,Search,Settings2,Trash2,Unlink2,X} from "lucide-react";
import {useWidgetGapFill} from "@/lib/widget-layout-preferences";
import {supabase} from "@/lib/supabase";
import {applyViewRules} from "@/lib/db-engine/view-operators";
import {chronologyAddresses,perspectiveChronologyLabel} from "@/lib/db-engine/hierarchy-numbering";
import {groupPageWidgets,placementConfigAfterPublish,widgetConfig,widgetGridSize,widgetHeightPx,widgetIsSynced,widgetPlacementConfig,widgetSectionId,type WidgetConfig,type WidgetConfigureTarget,type WidgetDatabase,type WidgetDefinition,type WidgetProperty,type WidgetRecord,type WidgetRelation,type WidgetView,type WidgetPageSection,type LibraryPage,type PageWidget} from "@/lib/widget-system";
import {placeWidget,resizeWidgetLane,widgetLayoutBands,type WidgetDropEdge,type WidgetDropTarget} from "@/lib/widget-layout";
import PlanningWorkspace from "@/components/planning-workspace";

type Mode="library"|"goals"|"widgets";
type Selection={kind:"definition"|"instance";id:string}|null;
type Props={
  mode:Mode;visualStyle?:"classic"|"studio";activePageId?:string;newPageIntent?:number;
  onPages?:(items:{id:string;title:string}[])=>void;
  onPage?:(id:string)=>void;
  onConfigure:(target:WidgetConfigureTarget|null)=>void;
  onOpenConfigure:()=>void;
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

export default function WidgetStudio(p:Props){
  const [data,setData]=useState<Snapshot>(empty);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [arrange,setArrange]=useState(true);
  const [fillGaps]=useWidgetGapFill();
  const [selected,setSelected]=useState<Selection>(null);
  const [creatingPage,setCreatingPage]=useState(false);
  const [newPage,setNewPage]=useState("");
  const [renamingPage,setRenamingPage]=useState(false);
  const [pageDraft,setPageDraft]=useState("");
  const [creatingSection,setCreatingSection]=useState(false);
  const [newSection,setNewSection]=useState("");
  const [renamingSection,setRenamingSection]=useState<string|null>(null);
  const [sectionDraft,setSectionDraft]=useState("");
  const [pickerSection,setPickerSection]=useState("");
  const [addWidget,setAddWidget]=useState(false);
  const [search,setSearch]=useState<Record<string,string>>({});
  const [newRecord,setNewRecord]=useState<Record<string,string>>({});
  const [detail,setDetail]=useState<{widget:string;record:string}|null>(null);
  const [drag,setDrag]=useState<string|null>(null);
  const [dropHint,setDropHint]=useState<WidgetDropTarget|null>(null);
  const [resizePreview,setResizePreview]=useState<PageWidget[]|null>(null);
  const resizePreviewRef=useRef<PageWidget[]|null>(null);
  const resizeStart=useRef<{id:string;x:number;y:number;unitX:number;heightPx:number;axis:"x"|"y"|"both";initial:PageWidget[]}|null>(null);
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
  const instanceList=data.instances.filter(w=>w.page_id===page?.id).sort((a,b)=>a.position-b.position);
  const pageSections=data.sections.filter(s=>s.page_id===page?.id).sort((a,b)=>a.position-b.position);
  // Dragging never changes the rendered layout. Only a thin insertion guide moves;
  // the actual placement is calculated once when the pointer is released.
  const layoutItems=resizePreview??instanceList;
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
  const renameSection=(id:string)=>{
    const title=sectionDraft.trim();
    const current=data.sections.find(s=>s.id===id);
    if(current&&title&&title!==current.title){
      setData(s=>({...s,sections:s.sections.map(row=>row.id===id?{...row,title}:row)}));
      queueSave("aaa_page_sections",id,{title});
    }
    setRenamingSection(null);
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
      setSelected({kind:"definition",id:row.id});p.onOpenConfigure();
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const createAndPlaceWidget=async(sectionOverride?:string)=>{
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
      setData(s=>({...s,definitions:[...s.definitions,createdDefinition!],instances:[...s.instances,instance as PageWidget]}));
      setAddWidget(false);
      setArrange(true);
      setSelected({kind:"instance",id:instance.id});
      setError("");
      p.onOpenConfigure();
      setNotice("New reusable widget created. Configure it in The Companion, then save changes to the master widget if you'd like to reuse them.");
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
  const addDefinition=async(definition:WidgetDefinition)=>{
    if(!page||busy)return;setBusy(true);
    try{
      // Choosing an existing view creates an independent copy by default.
      // Shared master IDs are reserved for the explicitly requested Widget Sync action.
      const {data:master,error:masterError}=await supabase.from("aaa_widget_definitions")
        .insert({name:definition.name+" · Copy",database_id:definition.database_id,view_id:definition.view_id,config:{...definition.config}})
        .select("id,name,database_id,view_id,config").single();
      if(masterError)throw masterError;
      const {data:row,error}=await supabase.from("aaa_page_widgets")
        .insert({page_id:page.id,definition_id:master.id,kind:"database",position:instanceList.length?Math.max(...instanceList.map(w=>w.position))+1:0,width:12,height:2,config:activePlacementSection?{sectionId:activePlacementSection}:{}})
        .select("id,page_id,definition_id,kind,title,config,width,height,position").single();
      if(error)throw error;
      setData(s=>({...s,definitions:[...s.definitions,master as WidgetDefinition],instances:[...s.instances,row as PageWidget]}));setAddWidget(false);
      setNotice("Independent view created. Editing it will not change the original widget.");
    }catch(e){report(e)}finally{setBusy(false)}
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
    setData(s=>({...s,instances:s.instances.filter(w=>w.id!==id)}));
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
  const shift=(id:string,direction:-1|1)=>{
    const index=instanceList.findIndex(w=>w.id===id),other=instanceList[index+direction];
    if(index<0||!other)return;
    const current=instanceList[index];
    changeInstance(id,{position:other.position});changeInstance(other.id,{position:current.position});
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
  const commitDrop=(fallback?:WidgetDropTarget)=>{
    const target=fallback??dropHint;
    if(drag&&target&&target.targetId!==drag)saveLayout(placeWidget(instanceList,pageSections,drag,target,fillGaps));
    setDrag(null);setDropHint(null);
  };
  const hint=(value:WidgetDropTarget)=>setDropHint(old=>old?.sectionId===value.sectionId&&old.targetId===value.targetId&&old.edge===value.edge?old:value);
  const dropTargetFor=(event:React.DragEvent<HTMLElement>,widget:PageWidget):WidgetDropTarget=>{
    const bounds=event.currentTarget.getBoundingClientRect();
    const x=(event.clientX-bounds.left)/bounds.width,y=(event.clientY-bounds.top)/bounds.height;
    // A comfortable 28–38px bottom target creates a NEW full-width row.
    // The larger zone above it stacks within the existing column.
    // Hysteresis keeps the indicator steady near the boundary.
    const bottomPixels=bounds.bottom-event.clientY;
    const wasNewRow=dropHint?.targetId===widget.id&&dropHint.edge==="new-row";
    const newRowBoundary=wasNewRow?38:27;
    const edge:WidgetDropEdge=bottomPixels>=0&&bottomPixels<=newRowBoundary?"new-row":
      x<.22?"left":x>.78?"right":y<.5?"above":"below";
    return {sectionId:widgetSectionId(widget),targetId:widget.id,edge};
  };
  const widgetHover=(event:React.DragEvent<HTMLElement>,widget:PageWidget)=>{
    if(!arrange||!drag)return;
    event.preventDefault();event.stopPropagation();
    if(drag===widget.id){setDropHint(null);return}
    hint(dropTargetFor(event,widget));
  };
  const startResize=(e:React.PointerEvent<HTMLButtonElement>,widget:PageWidget,axis:"x"|"y"|"both")=>{
    e.preventDefault();e.stopPropagation();
    const grid=e.currentTarget.closest(".aaa-widget-canvas");
    const bounds=grid?.getBoundingClientRect();
    if(!bounds)return;
    resizeStart.current={id:widget.id,x:e.clientX,y:e.clientY,
      unitX:bounds.width/12,heightPx:widgetHeightPx(widget),axis,initial:instanceList};
    resizePreviewRef.current=instanceList;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const resizeMove=(e:React.PointerEvent<HTMLButtonElement>)=>{
    const start=resizeStart.current;if(!start)return;
    const x=Math.round((e.clientX-start.x)/start.unitX);
    let result=start.axis==="y"?start.initial:resizeWidgetLane(start.initial,pageSections,start.id,x,fillGaps);
    if(start.axis!=="x")result=result.map(w=>w.id===start.id?{...w,config:{...w.config,heightPx:Math.max(160,Math.min(1200,Math.round((start.heightPx+e.clientY-start.y)/8)*8))}}:w);
    resizePreviewRef.current=result;setResizePreview(result);
  };
  const resizeEnd=()=>{
    if(resizeStart.current&&resizePreviewRef.current)saveLayout(resizePreviewRef.current);
    resizeStart.current=null;resizePreviewRef.current=null;setResizePreview(null);
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
      width:instance?.width,height:instance?.height,heightPx:instance?widgetHeightPx(instance):undefined,
      databases:data.databases,views:data.views,properties:data.properties,
      onConfig:updateConfig,onSource:updateSource,
      onRename:name=>instance&&!widgetIsSynced(instance)?changeInstance(instance.id,{title:name}):changeDefinition(def.id,{name}),
      onSize:instance?(width)=>saveLayout(resizeWidgetLane(instanceList,pageSections,instance.id,width-widgetGridSize(instance).width,fillGaps)):undefined,
      onHeightPx:instance?pixels=>changeInstance(instance.id,{config:{...instance.config,heightPx:Math.max(160,Math.min(1200,Math.round(pixels)))}}):undefined,
      onSaveToDefinition:instance?saveMaster:undefined,
      onCreateDatabase:createSource,onAddProperty:addSourceProperty,onUpdateProperty:updateSourceProperty
    });
  // Selection and persisted state are the only sources for the Companion's controls.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[selected,data.instances,data.definitions,data.databases,data.views,data.properties]);

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

  const renderRecords=(widgetId:string,def:WidgetDefinition,instance?:PageWidget)=>{
    const source=instance?sourceOf(instance):{databaseId:def.database_id,viewId:def.view_id};
    const db=data.databases.find(x=>x.id===source.databaseId);
    if(!db)return <div className="aaa-widget-empty"><Database size={25}/> Choose a database in Configure to connect live records.</div>;
    const cfg=effectiveConfig(def,instance);
    const fields=data.properties.filter(x=>x.database_id===db.id);
    const columns=cfg.visibleProperties.length?fields.filter(x=>cfg.visibleProperties.includes(x.id)):fields.slice(0,4);
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
    const fieldValue=(record:WidgetRecord,prop:WidgetProperty)=>prop.type==="relation"
      ?viewContext.relationTargets(record.record_id,prop.id).join(", ")
      :String(record.values_json[prop.id]??"");
    const detailRecord=data.records.find(r=>r.record_id===detail?.record&&detail.widget===widgetId);
    const open=(id:string)=>{if(cfg.openBehavior==="source"){p.onOpenRecord(id);return}setDetail({widget:widgetId,record:id})};
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
        {records.map(r=><tr key={r.record_id}><td><button onClick={()=>open(r.record_id)}>{numberedName(r.record_id)}</button></td>{columns.map(f=><td key={f.id}>{fieldValue(r,f)||"—"}</td>)}</tr>)}
      </tbody></table></div>
      :<div className={"aaa-widget-records aaa-widget-records-"+cfg.renderer}>{records.map(r=><button key={r.record_id} className="aaa-widget-record" onClick={()=>open(r.record_id)}>
        {cfg.renderer==="timeline"&&<span className="aaa-widget-sequence">{db.id===eventDb?.id?address.get(r.record_id)||r.sequence_no:r.sequence_no}</span>}
        <strong>{numberedName(r.record_id)}</strong>
        <span>{columns.filter(f=>fieldValue(r,f)).slice(0,cfg.renderer==="list"?1:3).map(f=><small key={f.id}>{f.name}: {fieldValue(r,f)}</small>)}</span>
        <ChevronRight size={16}/>
      </button>)}</div>}
      {cfg.allowCreate&&cfg.editable&&<form className="aaa-widget-new-record" onSubmit={e=>{e.preventDefault();void createRecord(db.id,widgetId)}}>
        <input value={newRecord[widgetId]||""} placeholder={"New "+db.name.toLowerCase()+" record…"} aria-label="New record name" onChange={e=>setNewRecord(old=>({...old,[widgetId]:e.target.value}))}/>
        <button type="submit" disabled={!newRecord[widgetId]?.trim()}><Plus size={14}/> Create</button>
      </form>}
      {detailRecord&&<div className="aaa-widget-detail">
        <div className="aaa-widget-detail-head"><strong>{viewContext.name(detailRecord.record_id)}</strong><button onClick={()=>setDetail(null)} aria-label="Close record detail"><X size={15}/></button></div>
        <p>Record {detailRecord.sequence_no} · {db.name}</p>
        {fields.map(f=><label key={f.id} className="aaa-widget-field">{f.name}
          {cfg.editable&&f.type!=="relation"&&f.type!=="select"&&f.type!=="checkbox"
            ?<input key={detailRecord.record_id+f.id+detailRecord.version} defaultValue={fieldValue(detailRecord,f)} onBlur={e=>void saveProperty(detailRecord,f,e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
            :cfg.editable&&f.type==="select"
            ?<select value={fieldValue(detailRecord,f)} onChange={e=>void saveProperty(detailRecord,f,e.target.value)}><option value="">None</option>{Array.isArray(f.config.options)&&f.config.options.filter((o):o is string=>typeof o==="string").map(o=><option key={o}>{o}</option>)}</select>
            :cfg.editable&&f.type==="checkbox"
            ?<select value={fieldValue(detailRecord,f)} onChange={e=>void saveProperty(detailRecord,f,e.target.value)}><option value="true">Yes</option><option value="false">No</option></select>
            :<span>{fieldValue(detailRecord,f)||"—"}</span>}
        </label>)}
        <button className="aaa-widget-add-rule" onClick={()=>p.onOpenRecord(detailRecord.record_id)}>Open original database page <ChevronRight size={14}/></button>
      </div>}
    </>;
  };
  const widgetCard=(widget:PageWidget,index:number)=>{
    const def=definitionOf(widget);
    const cfg=def?effectiveConfig(def,widget):widgetConfig({});
    const height=widgetHeightPx(widget);
    const title=widget.title||def?.name||"Goals & projects";
    return <article key={widget.id} className={`aaa-widget-card aaa-widget-color-${cfg.color} aaa-widget-density-${cfg.density} ${arrange?"aaa-widget-arranging":""} ${drag===widget.id?"aaa-widget-dragging":""} ${dropHint?.targetId===widget.id?"aaa-widget-target-"+dropHint.edge:""}`}
      style={{height:"100%",minHeight:0}}
      onDragStart={e=>{if(!arrange)return;setDrag(widget.id);e.dataTransfer.setData("text/plain",widget.id);e.dataTransfer.effectAllowed="move"}}
      onDragOver={e=>widgetHover(e,widget)}
      onDrop={e=>{e.stopPropagation();e.preventDefault();if(drag===widget.id){setDrag(null);setDropHint(null)}else commitDrop(dropTargetFor(e,widget))}}
      onDragEnd={()=>{setDrag(null);setDropHint(null)}}>
      <header className="aaa-widget-card-head">
        <div className="aaa-widget-title-group">{arrange&&<span className="aaa-widget-drag-handle" draggable title="Drag to rearrange or move into another section" aria-label={`Drag ${title}`}><svg viewBox="0 0 24 18" width="19" height="16" fill="currentColor" aria-hidden="true">
              {[5,12,19].map(x=>[5,13].map(y=><circle key={x+"-"+y} cx={x} cy={y} r="1.7"/>))}
            </svg></span>}
          <div className="aaa-widget-title-stack">
            {cfg.showViewTag&&<span className="aaa-widget-lab-kicker">{widget.kind==="goals"?"PLANNING / LIVE":widgetIsSynced(widget)?"WIDGET SYNC · LINKED":"CONNECTED VIEW"}</span>}
            {cfg.showTitle&&<button type="button" className="aaa-widget-title-button" title="Configure this widget" onClick={()=>def&&select("instance",widget.id)}>{title}</button>}
            {cfg.showDatabase&&def&&<button className="aaa-widget-source-button" type="button" onClick={()=>select("instance",widget.id)}>{data.databases.find(x=>x.id===sourceOf(widget).databaseId)?.name||"Unconnected"}</button>}
          </div></div>
        <div className="aaa-widget-card-actions">
          {arrange&&<><button aria-label="Move widget earlier" disabled={index===0} onClick={()=>shift(widget.id,-1)}><ArrowUp size={15}/></button><button aria-label="Move widget later" disabled={index===instanceList.length-1} onClick={()=>shift(widget.id,1)}><ArrowDown size={15}/></button></>}
          {def&&<button title="Configure in The Companion" aria-label="Configure widget" onClick={()=>select("instance",widget.id)}><Settings2 size={16}/></button>}
          {def&&<button title="Duplicate to another page" aria-label={`Duplicate ${title}`} onClick={()=>{setDuplicate(widget);setDuplicatePageId(page?.id||"");setDuplicateMode("independent")}}><Copy size={15}/></button>}
          <button title="Remove view, with optional source database deletion" aria-label={`Delete ${title} view`} onClick={()=>{setRemoveTarget({kind:"instance",id:widget.id,databaseId:sourceOf(widget).databaseId});setRemoveCore(false);setDeleteConfirmation("")}}><Trash2 size={15}/></button>
        </div>
      </header>
      <div className="aaa-widget-card-body">
        {widget.kind==="goals"?<PlanningWorkspace key={widget.id} section="Goals" onContext={p.onPlanningContext??(()=>{})} onOpenPage={p.onOpenRecord} onSchedule={p.onSchedule??(()=>{})}/>
        :def?renderRecords(widget.id,def,widget):<div className="aaa-widget-empty">The reusable widget is unavailable.</div>}
      </div>
      {arrange&&<footer className="aaa-widget-card-resize">
        <label>Section<select aria-label={`Move ${title} to section`} value={widgetSectionId(widget)} onChange={e=>moveWidgetToSection(widget,e.target.value)}>
          <option value="">Overview</option>{pageSections.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}
        </select></label>
        <span className="aaa-widget-height-caption">{Math.round(height)}px tall · drag corner to resize</span>
      </footer>}
      {arrange&&<>
        <button type="button" className="aaa-widget-resize-corner" aria-label={`Resize ${title} width and height`} title="Drag to resize both dimensions"
          onPointerDown={e=>startResize(e,widget,"both")} onPointerMove={resizeMove} onPointerUp={resizeEnd} onPointerCancel={resizeEnd}/>
      </>}
    </article>;
  };

  if(loading)return <section className="aaa-widget-studio"><div className="aaa-widget-empty">Loading your widget system…</div></section>;
  if(error&&data.pages.length===0&&data.definitions.length===0)return <section className="aaa-widget-studio aaa-widget-error"><h2>Widget system unavailable</h2><p>{error}</p><p>The separate widget tables may need to be installed in this Supabase environment. Existing data is untouched.</p><button onClick={()=>{setLoading(true);void load().catch(report).finally(()=>setLoading(false))}}><RefreshCw size={15}/> Retry</button></section>;

  return <section className={"aaa-widget-studio "+(p.visualStyle==="studio"?"aaa-widget-studio-lab":"")}>
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
        <div className="aaa-widget-hero-actions"><div className="aaa-widget-mode" role="group" aria-label="Page editing mode">
          <button aria-pressed={!arrange} className={!arrange?"active":""} onClick={()=>setArrange(false)}>Use mode</button>
          <button aria-pressed={arrange} className={arrange?"active":""} onClick={()=>setArrange(true)}>Arrange mode</button>
        </div>{arrange&&page&&<button className="aaa-widget-secondary" onClick={()=>{setPageDraft(page.title);setRenamingPage(true)}}><Pencil size={15}/> Rename page</button>}
        <button className="aaa-widget-secondary" disabled={busy} onClick={()=>setCreatingDatabase(true)}><Database size={16}/> New database</button>
        <button className="aaa-widget-secondary" disabled={!page||busy} onClick={()=>void createAndPlaceWidget(pageSections[0]?.id??"")}><Plus size={16}/> New widget</button>
        {arrange&&<button className="aaa-widget-primary" onClick={()=>{setPickerSection(pageSections[0]?.id??"");setAddWidget(true)}}><Plus size={16}/> Add widget</button>}</div>
      </div>
      <nav className="aaa-widget-page-tabs" aria-label={p.mode==="goals"?"Goals pages":"Library pages"}>
        {pages.map((item,index)=><button key={item.id} className={item.id===page?.id?"active":""} aria-current={item.id===page?.id?"page":undefined}
          onClick={()=>{p.onPage?.(item.id);setRenamingPage(false);setAddWidget(false);setCreatingSection(false)}}>
          {index===0?<LayoutGrid size={14}/>:<BookOpen size={14}/>} {item.title}
        </button>)}
        <button className="aaa-widget-page-add" onClick={()=>setCreatingPage(true)}><Plus size={14}/> Page</button>
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
      {page?<div className="aaa-widget-sections">
        {arrange&&<div className="aaa-widget-section-toolbar"><span>Drag a widget to an insertion line. Release to rearrange; drag its corner or column dividers to resize.</span>
          <button className="aaa-widget-secondary" onClick={()=>setCreatingSection(true)}><Plus size={15}/> Add section</button></div>}
        {creatingSection&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createSection()}}>
          <input autoFocus aria-label="New section name" placeholder="e.g. World History, Project Progress…" maxLength={100} value={newSection} onChange={e=>setNewSection(e.target.value)}/>
          <button type="submit" disabled={!newSection.trim()||busy}><Check size={15}/> Create section</button>
          <button type="button" aria-label="Cancel new section" onClick={()=>setCreatingSection(false)}><X size={15}/></button>
        </form>}
        {sectionGroups.map(({section,widgets},sectionIndex)=><section key={section.id||"overview"} className="aaa-widget-page-section" aria-label={section.title+" section"}>
          <header className="aaa-widget-section-header"><div><small>SECTION {sectionIndex+1}</small>
            {renamingSection===section.id&&section.id?<form className="aaa-widget-section-rename" onSubmit={e=>{e.preventDefault();renameSection(section.id)}}>
              <input autoFocus maxLength={100} aria-label="Rename section" value={sectionDraft} onChange={e=>setSectionDraft(e.target.value)}/>
              <button type="submit" disabled={!sectionDraft.trim()} aria-label="Save section name"><Check size={15}/></button>
              <button type="button" onClick={()=>setRenamingSection(null)} aria-label="Cancel section rename"><X size={15}/></button>
            </form>:<h2>{section.title}</h2>}
            <p>{widgets.length} {widgets.length===1?"widget":"widgets"} · reusable database views</p></div>
            {arrange&&<div className="aaa-widget-section-actions">
              {section.id&&<><button disabled={pageSections.findIndex(s=>s.id===section.id)===0} aria-label={`Move ${section.title} section up`} onClick={()=>shiftSection(section.id,-1)}><ArrowUp size={15}/></button>
                <button disabled={pageSections.findIndex(s=>s.id===section.id)===pageSections.length-1} aria-label={`Move ${section.title} section down`} onClick={()=>shiftSection(section.id,1)}><ArrowDown size={15}/></button>
                <button aria-label={`Rename ${section.title} section`} onClick={()=>{setRenamingSection(section.id);setSectionDraft(section.title)}}><Pencil size={15}/></button>
                <button aria-label={`Remove ${section.title} section`} onClick={()=>void deleteSection(section.id)}><Trash2 size={15}/></button></>}
              <button className="aaa-widget-secondary" onClick={()=>void createAndPlaceWidget(section.id)} disabled={busy}><Plus size={14}/> Widget</button>
            </div>}
          </header>
          <div className={`aaa-widget-canvas ${arrange&&drag?"aaa-widget-drop-zone":""} ${arrange&&dropHint?.sectionId===section.id&&dropHint.edge==="section-end"?"aaa-widget-section-end-highlight":""}`} aria-label={section.title+" widgets"}
            onDragOver={e=>{if(!arrange||!drag)return;e.preventDefault();hint({sectionId:section.id,targetId:null,edge:"section-end"})}}
            onDrop={e=>{if(!arrange)return;e.preventDefault();commitDrop({sectionId:section.id,targetId:null,edge:"section-end"})}}>
            {widgetLayoutBands(widgets).map(band=>{
              const used=band.lanes.reduce((sum,lane)=>sum+lane.width,0);
              return <div className={"aaa-widget-layout-band "+(dropHint?.edge==="new-row"&&band.lanes.some(l=>l.widgets.some(w=>w.id===dropHint.targetId))?"aaa-widget-band-new-row":"")} key={band.id}>
                {band.lanes.map((lane,laneIndex)=><div className="aaa-widget-layout-lane-shell" key={lane.id} style={{flex:`${lane.width} 1 0`}}>
                  <div className="aaa-widget-layout-lane">
                    {lane.widgets.map((widget,widgetIndex)=><div className="aaa-widget-layout-item" key={widget.id} style={{height:widgetHeightPx(widget)}}>
                      {widgetIndex>0&&arrange&&<button className="aaa-widget-stack-divider" type="button" title="Drag to change the widget height above" aria-label={`Resize height above ${widget.title||"widget"}`}
                        onPointerDown={e=>startResize(e,lane.widgets[widgetIndex-1],"y")} onPointerMove={resizeMove} onPointerUp={resizeEnd} onPointerCancel={resizeEnd}/>}
                      {widgetCard(widget,instanceList.findIndex(row=>row.id===widget.id))}
                    </div>)}
                  </div>
                  {arrange&&laneIndex<band.lanes.length-1&&<button className="aaa-widget-lane-divider" type="button" title="Drag to resize both neighboring columns" aria-label={`Resize column next to ${lane.widgets[0]?.title||"widget"}`}
                    onDragOver={e=>{if(!drag)return;e.preventDefault();e.stopPropagation();hint({sectionId:section.id,targetId:lane.widgets[0]?.id??null,edge:"right"})}}
                    onPointerDown={e=>startResize(e,lane.widgets[0],"x")} onPointerMove={resizeMove} onPointerUp={resizeEnd} onPointerCancel={resizeEnd}/>}</div>)}
                {used<12&&<div className="aaa-widget-layout-spacer" style={{flex:`${12-used} 1 0`}}/>}
                {arrange&&drag&&band.lanes.length>0&&(()=>{
                  const lastLane=band.lanes[band.lanes.length-1];
                  const afterId=lastLane.widgets[lastLane.widgets.length-1]?.id??null;
                  return <div className="aaa-widget-band-row-drop" role="presentation"
                    onDragOver={e=>{e.preventDefault();e.stopPropagation();if(afterId!==drag)hint({sectionId:section.id,targetId:afterId,edge:"new-row"})}}
                    onDrop={e=>{e.preventDefault();e.stopPropagation();if(afterId!==drag)commitDrop({sectionId:section.id,targetId:afterId,edge:"new-row"});else{setDrag(null);setDropHint(null)}}}/>;
                })()}
              </div>;
            })}
            {arrange&&!widgets.length&&<button className="aaa-widget-empty-slot" onClick={()=>void createAndPlaceWidget(section.id)}><Plus size={20}/> Add a widget</button>}
            {!widgets.length&&!arrange&&<div className="aaa-widget-section-empty">No widgets in this section yet. Switch to Arrange mode to add some.</div>}
          </div>
        </section>)}
        {!instanceList.length&&!arrange&&<div className="aaa-widget-empty aaa-widget-large"><LayoutGrid size={28}/><p>Create a new widget here or enter Arrange mode to add an existing one.</p><button disabled={busy} onClick={()=>void createAndPlaceWidget()}><Plus size={16}/> Create widget</button></div>}
      </div>:<div className="aaa-widget-empty aaa-widget-large"><LayoutGrid size={28}/><p>Create a page to start organizing your widgets.</p><button onClick={()=>setCreatingPage(true)}><Plus size={16}/> New page</button></div>}
    </>}
  </section>;
}
