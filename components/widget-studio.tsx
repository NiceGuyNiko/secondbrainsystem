"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowDown,ArrowUp,BookOpen,Check,ChevronRight,Database,GripVertical,LayoutGrid,Plus,RefreshCw,Search,Settings2,Trash2,X} from "lucide-react";
import {supabase} from "@/lib/supabase";
import {applyViewRules} from "@/lib/db-engine/view-operators";
import {widgetConfig,type WidgetConfig,type WidgetConfigureTarget,type WidgetDatabase,type WidgetDefinition,type WidgetProperty,type WidgetRecord,type WidgetRelation,type WidgetView,type LibraryPage,type PageWidget} from "@/lib/widget-system";
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
  pages:LibraryPage[];instances:PageWidget[];definitions:WidgetDefinition[];
  databases:WidgetDatabase[];views:WidgetView[];properties:WidgetProperty[];
  records:WidgetRecord[];relations:WidgetRelation[];titles:Record<string,string>;
};
const empty:Snapshot={pages:[],instances:[],definitions:[],databases:[],views:[],properties:[],records:[],relations:[],titles:{}};
type SaveTable="aaa_widget_definitions"|"aaa_page_widgets";

export default function WidgetStudio(p:Props){
  const [data,setData]=useState<Snapshot>(empty);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [arrange,setArrange]=useState(false);
  const [selected,setSelected]=useState<Selection>(null);
  const [creatingPage,setCreatingPage]=useState(false);
  const [newPage,setNewPage]=useState("");
  const [addWidget,setAddWidget]=useState(false);
  const [search,setSearch]=useState<Record<string,string>>({});
  const [newRecord,setNewRecord]=useState<Record<string,string>>({});
  const [detail,setDetail]=useState<{widget:string;record:string}|null>(null);
  const [drag,setDrag]=useState<string|null>(null);
  const pending=useRef<Map<string,{table:SaveTable;id:string;patch:Record<string,unknown>;timer:ReturnType<typeof setTimeout>}>>(new Map());
  const snapshot=useRef(data);
  snapshot.current=data;
  const report=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
  const check=(result:{error:{message:string}|null})=>{if(result.error)throw new Error(result.error.message)};

  const load=useCallback(async()=>{
    const [a,b,c,d,e,f,g,h,i,j]=await Promise.all([
      supabase.from("aaa_library_pages").select("id,area,title,position").order("position"),
      supabase.from("aaa_page_widgets").select("id,page_id,definition_id,kind,title,config,width,height,position").order("position"),
      supabase.from("aaa_widget_definitions").select("id,name,database_id,view_id,config").order("created_at"),
      supabase.from("db_databases").select("id,name,icon").is("archived_at",null).order("name"),
      supabase.from("db_views").select("id,database_id,name,layout,config"),
      supabase.from("db_properties").select("id,database_id,name,type,config,position").is("archived_at",null).order("position"),
      supabase.from("db_records").select("record_id,database_id,sequence_no,version,values_json,position").is("archived_at",null).limit(2000),
      supabase.from("db_relations").select("source_record_id,target_record_id,property_id").limit(2000),
      supabase.from("user_items").select("id,title").eq("item_type","thought").limit(3000),
      supabase.from("db_perspectives").select("record_id,character_id,event_id").limit(2000)
    ]);
    [a,b,c,d,e,f,g,h,i,j].forEach(check);
    const names:Record<string,string>={};
    (i.data??[]).forEach(row=>{names[row.id]=row.title||"Untitled"});
    (j.data??[]).forEach(row=>{names[row.record_id]=(names[row.character_id]||"Unknown character")+" during "+(names[row.event_id]||"Unknown event")});
    const next:Snapshot={
      pages:(a.data??[]) as LibraryPage[],instances:(b.data??[]) as PageWidget[],definitions:(c.data??[]) as WidgetDefinition[],
      databases:(d.data??[]) as WidgetDatabase[],views:(e.data??[]) as WidgetView[],properties:(f.data??[]) as WidgetProperty[],
      records:(g.data??[]) as WidgetRecord[],relations:(h.data??[]) as WidgetRelation[],titles:names
    };
    if(p.mode==="goals"&&!next.pages.some(x=>x.area==="goals")){
      const {data:page,error:pageError}=await supabase.from("aaa_library_pages").insert({area:"goals",title:"Overview",position:0}).select("id,area,title,position").single();
      if(pageError)throw new Error(pageError.message);
      next.pages.push(page as LibraryPage);
      const {data:widget,error:widgetError}=await supabase.from("aaa_page_widgets").insert({page_id:page.id,kind:"goals",width:12,height:4,position:0}).select("id,page_id,definition_id,kind,title,config,width,height,position").single();
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
      setCreatingPage(false);setNewPage("");p.onPage?.(row.id);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const createDefinition=async()=>{
    if(busy)return;setBusy(true);
    try{
      const first=data.databases[0];
      const {data:row,error}=await supabase.from("aaa_widget_definitions")
        .insert({name:"Untitled widget",database_id:first?.id??null,config:{renderer:"table"}})
        .select("id,name,database_id,view_id,config").single();
      if(error)throw error;
      setData(s=>({...s,definitions:[...s.definitions,row as WidgetDefinition]}));
      setSelected({kind:"definition",id:row.id});p.onOpenConfigure();
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const createAndPlaceWidget=async()=>{
    if(!page||busy)return;
    setBusy(true);
    let createdDefinition:WidgetDefinition|null=null;
    try{
      const {data:definition,error:definitionError}=await supabase.from("aaa_widget_definitions")
        .insert({name:"Untitled widget",database_id:data.databases[0]?.id??null,config:{renderer:"table"}})
        .select("id,name,database_id,view_id,config").single();
      if(definitionError)throw definitionError;
      createdDefinition=definition as WidgetDefinition;
      const {data:instance,error:instanceError}=await supabase.from("aaa_page_widgets")
        .insert({page_id:page.id,definition_id:createdDefinition.id,kind:"database",
          position:instanceList.length?Math.max(...instanceList.map(w=>w.position))+1:0,width:6,height:2})
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
      const {data:row,error}=await supabase.from("aaa_page_widgets")
        .insert({page_id:page.id,definition_id:definition.id,kind:"database",position:instanceList.length?Math.max(...instanceList.map(w=>w.position))+1:0,width:6,height:2})
        .select("id,page_id,definition_id,kind,title,config,width,height,position").single();
      if(error)throw error;
      setData(s=>({...s,instances:[...s.instances,row as PageWidget]}));setAddWidget(false);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const addGoals=async()=>{
    if(!page||busy)return;setBusy(true);
    try{
      const {data:row,error}=await supabase.from("aaa_page_widgets")
        .insert({page_id:page.id,kind:"goals",position:instanceList.length,width:12,height:4})
        .select("id,page_id,definition_id,kind,title,config,width,height,position").single();
      if(error)throw error;
      setData(s=>({...s,instances:[...s.instances,row as PageWidget]}));setAddWidget(false);
    }catch(e){report(e)}finally{setBusy(false)}
  };
  const deleteInstance=async(id:string)=>{
    if(!window.confirm("Remove this widget from the page? The reusable widget and database records will remain."))return;
    const {error}=await supabase.from("aaa_page_widgets").delete().eq("id",id);
    if(error){report(error);return}
    setData(s=>({...s,instances:s.instances.filter(w=>w.id!==id)}));
    if(selected?.id===id)setSelected(null);
  };
  const deleteDefinition=async(id:string)=>{
    if(data.instances.some(w=>w.definition_id===id)){setError("This widget is used on a page. Remove those instances first.");return}
    if(!window.confirm("Delete this reusable widget definition? Database records will not be deleted."))return;
    const {error}=await supabase.from("aaa_widget_definitions").delete().eq("id",id);
    if(error){report(error);return}
    setData(s=>({...s,definitions:s.definitions.filter(w=>w.id!==id)}));
    if(selected?.id===id)setSelected(null);
  };
  const shift=(id:string,direction:-1|1)=>{
    const index=instanceList.findIndex(w=>w.id===id),other=instanceList[index+direction];
    if(index<0||!other)return;
    const current=instanceList[index];
    changeInstance(id,{position:other.position});changeInstance(other.id,{position:current.position});
  };
  const reorder=(source:string,target:string)=>{
    if(source===target)return;
    const order=[...instanceList];const from=order.findIndex(w=>w.id===source),to=order.findIndex(w=>w.id===target);
    if(from<0||to<0)return;
    const [item]=order.splice(from,1);order.splice(to,0,item);
    order.forEach((w,index)=>{if(w.position!==index)changeInstance(w.id,{position:index})});
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
      if(instance){changeInstance(instance.id,{config:{...instance.config,...config,...patch}})}
      else changeDefinition(def.id,{config:{...def.config,...config,...patch}});
    };
    const updateSource=(databaseId:string|null,viewId:string|null)=>{
      if(instance){changeInstance(instance.id,{config:{...instance.config,databaseOverride:databaseId??"",viewOverride:viewId??"",filters:[],sorts:[],scopeField:"",scopeValue:""}})}
      else changeDefinition(def.id,{database_id:databaseId,view_id:viewId,config:{...def.config,filters:[],sorts:[],scopeField:"",scopeValue:""}});
    };
    const saveMaster=()=>{
      if(!instance)return;
      const effective=effectiveConfig(def,instance);
      changeDefinition(def.id,{database_id:source.databaseId,view_id:source.viewId,config:effective});
      // The page now inherits exactly what it just published; other instances retain local overrides.
      changeInstance(instance.id,{config:{}});
      setNotice("Saved to the master widget: "+def.name);
    };
    p.onConfigure({id:selected.id,kind:selected.kind,title:instance?.title||def.name,
      databaseId:source.databaseId,viewId:source.viewId,config,
      width:instance?.width,height:instance?.height,
      databases:data.databases,views:data.views,properties:data.properties,
      onConfig:updateConfig,onSource:updateSource,
      onRename:name=>instance?changeInstance(instance.id,{title:name}):changeDefinition(def.id,{name}),
      onSize:instance?(width,height)=>changeInstance(instance.id,{width,height}):undefined,
      onSaveToDefinition:instance?saveMaster:undefined
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
        {records.map(r=><tr key={r.record_id}><td><button onClick={()=>open(r.record_id)}>{viewContext.name(r.record_id)}</button></td>{columns.map(f=><td key={f.id}>{fieldValue(r,f)||"—"}</td>)}</tr>)}
      </tbody></table></div>
      :<div className={"aaa-widget-records aaa-widget-records-"+cfg.renderer}>{records.map(r=><button key={r.record_id} className="aaa-widget-record" onClick={()=>open(r.record_id)}>
        {cfg.renderer==="timeline"&&<span className="aaa-widget-sequence">{r.sequence_no}</span>}
        <strong>{viewContext.name(r.record_id)}</strong>
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
    return <article key={widget.id} className={`aaa-widget-card aaa-widget-color-${cfg.color} aaa-widget-density-${cfg.density} ${arrange?"aaa-widget-arranging":""}`}
      style={{gridColumn:`span ${widget.width}`,minHeight:widget.kind==="goals"?"440px":(widget.height*135)+"px"}}
      draggable={arrange} onDragStart={e=>{setDrag(widget.id);e.dataTransfer.effectAllowed="move"}} onDragOver={e=>{if(arrange)e.preventDefault()}}
      onDrop={e=>{e.preventDefault();if(drag)reorder(drag,widget.id);setDrag(null)}} onDragEnd={()=>setDrag(null)}>
      {(cfg.showTitle||arrange)&&<header className="aaa-widget-card-head">
        <div>{arrange&&<GripVertical size={17}/>}<span className="aaa-widget-lab-kicker">{widget.kind==="goals"?"PLANNING / LIVE":"CONNECTED VIEW"}</span><strong>{widget.title||def?.name||"Goals & projects"}</strong>
          {def&&<small>{data.databases.find(x=>x.id===sourceOf(widget).databaseId)?.name||"Unconnected"}</small>}</div>
        <div className="aaa-widget-card-actions">
          {arrange&&<><button aria-label="Move widget earlier" disabled={index===0} onClick={()=>shift(widget.id,-1)}><ArrowUp size={15}/></button><button aria-label="Move widget later" disabled={index===instanceList.length-1} onClick={()=>shift(widget.id,1)}><ArrowDown size={15}/></button></>}
          {def&&<button title="Configure in The Companion" aria-label="Configure widget" onClick={()=>select("instance",widget.id)}><Settings2 size={16}/></button>}
          {arrange&&<button title="Remove from page" aria-label="Remove widget" onClick={()=>void deleteInstance(widget.id)}><Trash2 size={15}/></button>}
        </div>
      </header>}
      <div className="aaa-widget-card-body">
        {widget.kind==="goals"?<PlanningWorkspace key={widget.id} section="Goals" onContext={p.onPlanningContext??(()=>{})} onOpenPage={p.onOpenRecord} onSchedule={p.onSchedule??(()=>{})}/>
        :def?renderRecords(widget.id,def,widget):<div className="aaa-widget-empty">The reusable widget is unavailable.</div>}
      </div>
    </article>;
  };

  if(loading)return <section className="aaa-widget-studio"><div className="aaa-widget-empty">Loading your widget system…</div></section>;
  if(error&&data.pages.length===0&&data.definitions.length===0)return <section className="aaa-widget-studio aaa-widget-error"><h2>Widget system unavailable</h2><p>{error}</p><p>The separate widget tables may need to be installed in this Supabase environment. Existing data is untouched.</p><button onClick={()=>{setLoading(true);void load().catch(report).finally(()=>setLoading(false))}}><RefreshCw size={15}/> Retry</button></section>;

  return <section className={"aaa-widget-studio "+(p.visualStyle==="studio"?"aaa-widget-studio-lab":"")}>
    {error&&<div className="aaa-widget-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss error"><X size={14}/></button></div>}
    {notice&&<div className="aaa-widget-alert" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice"><X size={14}/></button></div>}
    {p.mode==="widgets"?<>
      <div className="aaa-widget-hero"><div><span className="aaa-widget-eyebrow">DEVELOPING IT / WIDGETS</span><h1>Widget workshop</h1><p>Design reusable ways to read your database records. Configure a master here, then add instances to Library or Goals pages.</p></div>
        <button className="aaa-widget-primary" onClick={()=>void createDefinition()} disabled={busy}><Plus size={17}/> New widget</button></div>
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
        <footer><button onClick={()=>select("definition",def.id)}><Settings2 size={14}/> Configure</button><button onClick={()=>void deleteDefinition(def.id)} aria-label={"Delete "+def.name}><Trash2 size={14}/></button></footer>
      </article>)}</div>}
    </>:<>
      <div className="aaa-widget-hero"><div><span className="aaa-widget-eyebrow">{p.mode==="goals"?"GOALS / DASHBOARD":"LIBRARY / PAGES"}</span>
        <h1>{page?.title|| (p.mode==="goals"?"Goals":"Your Library")}</h1>
        <p>{p.mode==="goals"?"Your existing goals, projects and tasks alongside reusable database widgets.":"Create pages and combine reusable database views into a readable workspace."}</p></div>
        <div className="aaa-widget-hero-actions"><div className="aaa-widget-mode" role="group" aria-label="Page editing mode">
          <button aria-pressed={!arrange} className={!arrange?"active":""} onClick={()=>setArrange(false)}>Use mode</button>
          <button aria-pressed={arrange} className={arrange?"active":""} onClick={()=>setArrange(true)}>Arrange mode</button>
        </div><button className="aaa-widget-secondary" onClick={()=>setCreatingPage(true)}><Plus size={16}/> Page</button>
        <button className="aaa-widget-secondary" disabled={!page||busy} onClick={()=>void createAndPlaceWidget()}><Plus size={16}/> New widget</button>
        {arrange&&<button className="aaa-widget-primary" onClick={()=>setAddWidget(true)}><Plus size={16}/> Add widget</button>}</div>
      </div>
      {p.visualStyle==="studio"&&page&&<div className="aaa-widget-lab-stats" aria-label="Current page summary">
        <div><small>THIS PAGE</small><strong>{instanceList.length}</strong><span>Placed widgets</span></div>
        <div><small>CONNECTED SOURCES</small><strong>{new Set(instanceList.map(w=>sourceOf(w).databaseId).filter(Boolean)).size}</strong><span>Database views</span></div>
        <div><small>RECORDS AVAILABLE</small><strong>{data.records.length}</strong><span>Across {data.databases.length} databases</span></div>
      </div>}
      {creatingPage&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createPage()}}><input aria-label="New page title" autoFocus placeholder={p.mode==="library"?"e.g. World View, Characters…":"New Goals page…"} maxLength={100} value={newPage} onChange={e=>setNewPage(e.target.value)}/><button type="submit" disabled={!newPage.trim()||busy}><Check size={16}/> Create page</button><button type="button" onClick={()=>setCreatingPage(false)} aria-label="Cancel"><X size={16}/></button></form>}
      {addWidget&&<div className="aaa-widget-add-picker"><div><strong>Add to {page?.title}</strong><button onClick={()=>setAddWidget(false)} aria-label="Close widget picker"><X size={16}/></button></div>
        <button disabled={!page||busy} onClick={()=>void createAndPlaceWidget()}><Plus size={16}/> Create a new reusable widget <small>Open Configure</small><ChevronRight size={16}/></button>
        {p.mode==="goals"&&<button onClick={()=>void addGoals()}><BookOpen size={16}/> Goals &amp; projects (existing planner)<Plus size={16}/></button>}
        {data.definitions.map(def=><button key={def.id} onClick={()=>void addDefinition(def)}><LayoutGrid size={16}/>{def.name}<small>{data.databases.find(db=>db.id===def.database_id)?.name||"Unconnected"}</small><Plus size={16}/></button>)}
        {!data.definitions.length&&<p>No saved widgets yet. Create one here and it will also appear in Developing IT → Widgets.</p>}
      </div>}
      {page?<div className="aaa-widget-canvas" aria-label="Page widgets">
        {instanceList.map(widgetCard)}
        {arrange&&<button className="aaa-widget-empty-slot" style={{gridColumn:"span 6"}} onClick={()=>setAddWidget(true)}><Plus size={24}/> Add a widget</button>}
        {!instanceList.length&&!arrange&&<div className="aaa-widget-empty aaa-widget-large"><LayoutGrid size={28}/><p>This page has no widgets. Create a new widget here or enter Arrange mode to add existing ones.</p><button disabled={busy} onClick={()=>void createAndPlaceWidget()}><Plus size={16}/> Create widget</button><button onClick={()=>setArrange(true)}>Arrange page</button></div>}
      </div>:<div className="aaa-widget-empty aaa-widget-large"><LayoutGrid size={28}/><p>Create a page to start organizing your widgets.</p><button onClick={()=>setCreatingPage(true)}><Plus size={16}/> New page</button></div>}
    </>}
  </section>;
}
