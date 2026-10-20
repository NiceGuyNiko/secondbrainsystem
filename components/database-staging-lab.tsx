"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { importFirstCharactersToStaging } from "@/lib/db-engine/import-first-characters";
import { countMissingCharacters, FIRST_CHARACTERS } from "@/lib/db-engine/nobody-special-characters";
import { WORLD_DATABASE_TEMPLATES, setupWorldbuildingDatabases } from "@/lib/db-engine/worldbuilding-templates";
import {DatabasePropertyHeading,RestoreDatabaseProperties} from "@/components/db-property-heading";
type DB={id:string;name:string;icon:string};
type Prop={id:string;database_id:string;name:string;type:string;version:number;archived_at:string|null;
 config:{options?:string[];target_database_id?:string;multi?:boolean};position:number};
type Rec={record_id:string;database_id:string;sequence_no:number;version:number;values_json:Record<string,string|number|boolean|null>;archived_at:string|null};
type View={id:string;database_id:string;name:string;layout:string;config:Record<string,unknown>};
type Link={id:string;property_id:string;source_record_id:string;target_record_id:string};
type Item={id:string;title:string};
type PerspectivePair={record_id:string;character_id:string;event_id:string};
const types=["text","long_text","number","date","checkbox","select","relation"];
const check=<T,>(response:{data:T;error:{message:string}|null}):T=>{
  if(response.error)throw new Error(response.error.message);
  return response.data;
};
export default function StagingDatabaseLab(){
 const [dbs,setDbs]=useState<DB[]>([]);
 const [props,setProps]=useState<Prop[]>([]);
 const [archivedProps,setArchivedProps]=useState<Prop[]>([]);
 const [perspectives,setPerspectives]=useState<PerspectivePair[]>([]);
 const [records,setRecords]=useState<Rec[]>([]);
 const [views,setViews]=useState<View[]>([]);
 const [links,setLinks]=useState<Link[]>([]);
 const [items,setItems]=useState<Item[]>([]);
 const [dbId,setDbId]=useState("");
 const [selected,setSelected]=useState("");
 const [viewId,setViewId]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [info,setInfo]=useState("");
 const [addDb,setAddDb]=useState("");
 const [addRec,setAddRec]=useState("");
 const [addProp,setAddProp]=useState("");
 const [propType,setPropType]=useState("text");
 const [options,setOptions]=useState("Idea, Developing, Canon");
 const [target,setTarget]=useState("");
 const [showProperties,setShowProperties]=useState(false);
 const [search,setSearch]=useState("");
 const [sort,setSort]=useState("creation");
 const [reverse,setReverse]=useState(false);
 const [importing,setImporting]=useState(false);
 const [importProgress,setImportProgress]=useState("");
 const [settingUpWorld,setSettingUpWorld]=useState(false);
 const [setupProgress,setSetupProgress]=useState("");
 const [snapshotChoice,setSnapshotChoice]=useState("");
 const [makingSnapshot,setMakingSnapshot]=useState(false);
 const refresh=useCallback(async()=>{
  const [a,b,c,d,e,f,g]=await Promise.all([
   supabase.from("db_databases").select("id,name,icon").is("archived_at",null),
   supabase.from("db_properties").select("id,database_id,name,type,config,position,version,archived_at").order("position"),
   supabase.from("db_records").select("record_id,database_id,sequence_no,version,values_json,archived_at").is("archived_at",null),
   supabase.from("db_views").select("id,database_id,name,layout,config"),
   supabase.from("db_relations").select("id,property_id,source_record_id,target_record_id"),
   supabase.from("user_items").select("id,title").eq("item_type","thought"),
   supabase.from("db_perspectives").select("record_id,character_id,event_id")
  ]);
  setDbs(check(a) as DB[]);
  const allProperties=check(b) as Prop[];
  setProps(allProperties.filter(p=>!p.archived_at));
  setArchivedProps(allProperties.filter(p=>Boolean(p.archived_at)));
  setPerspectives(check(g) as PerspectivePair[]);
  setRecords(check(c) as Rec[]);
  setViews(check(d) as View[]);setLinks(check(e) as Link[]);setItems(check(f) as Item[]);
  setDbId(old=>(a.data||[]).some((x:{id:string})=>x.id===old)?old:(a.data?.[0]?.id||""));
 },[]);
 useEffect(()=>{let cancelled=false;void refresh().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[refresh]);
 const run=async(fn:()=>Promise<void>,message="Saved to staging Supabase")=>{
  setError("");setInfo("");
  try{await fn();await refresh();setInfo(message)}catch(e){setError(e instanceof Error?e.message:String(e))}
 };
 const database=dbs.find(x=>x.id===dbId);
 const cols=props.filter(x=>x.database_id===dbId);
 const activeViews=views.filter(x=>x.database_id===dbId);
 const view=activeViews.find(x=>x.id===viewId)||activeViews[0];
 const rawLabel=(id:string)=>items.find(x=>x.id===id)?.title||"Untitled";
 const label=(id:string)=>{
  const pair=perspectives.find(p=>p.record_id===id);
  return pair?rawLabel(pair.character_id)+" during "+rawLabel(pair.event_id):rawLabel(id);
 };
 const list=records.filter(x=>x.database_id===dbId&&(!search||[label(x.record_id),...Object.values(x.values_json)].join(" ").toLowerCase().includes(search.toLowerCase())))
 .sort((a,b)=>{const av=sort==="creation"?a.sequence_no:sort==="name"?label(a.record_id):a.values_json[sort];
 const bv=sort==="creation"?b.sequence_no:sort==="name"?label(b.record_id):b.values_json[sort];
 const n=typeof av==="number"&&typeof bv==="number"?av-bv:String(av??"").localeCompare(String(bv??""),undefined,{numeric:true});
 return reverse?-n:n;});
 const record=records.find(x=>x.record_id===selected && x.database_id===dbId);
 const charactersDatabase=dbs.find(d=>d.name.toLowerCase()==="characters");
 const eventsDatabase=dbs.find(d=>d.name.toLowerCase()==="events");
 const perspectivesDatabase=dbs.find(d=>d.name.toLowerCase()==="perspectives");
 const snapshotPair=record?perspectives.find(p=>p.record_id===record.record_id):undefined;
 const currentSnapshotPairs=record?perspectives.filter(p=>
   database?.name.toLowerCase()==="characters"?p.character_id===record.record_id:
   database?.name.toLowerCase()==="events"?p.event_id===record.record_id:false):[];
 const snapTargets=record && database?.name.toLowerCase()==="characters"?
   records.filter(r=>r.database_id===eventsDatabase?.id):
   record && database?.name.toLowerCase()==="events"?
   records.filter(r=>r.database_id===charactersDatabase?.id):[];
 const openSnapshot=(eventOrCharacter:string)=>void(async()=>{
   if(!record||!perspectivesDatabase||makingSnapshot)return;
   const characterId=database?.name.toLowerCase()==="characters"?record.record_id:eventOrCharacter;
   const eventId=database?.name.toLowerCase()==="events"?record.record_id:eventOrCharacter;
   const exists=perspectives.find(p=>p.character_id===characterId&&p.event_id===eventId);
   if(exists){openRelatedRecord(perspectivesDatabase.id,exists.record_id);return;}
   setMakingSnapshot(true);setError("");setInfo("");
   try{
     const id=crypto.randomUUID();
     const {data,error}=await supabase.rpc("db_create_perspective",{
       p_id:id,p_character_id:characterId,p_event_id:eventId
     });
     if(error)throw error;
     await refresh();openRelatedRecord(perspectivesDatabase.id,String(data));
     setInfo("New Character × Event snapshot saved. Add groups and abilities that apply during this Event.");
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setMakingSnapshot(false)}
 })();
 const incomingLinks=record?links.filter(l=>l.target_record_id===record.record_id).map(link=>{
  const property=props.find(p=>p.id===link.property_id);
  const origin=records.find(r=>r.record_id===link.source_record_id);
  if(!property||!origin)return null;
  return {link,property,origin,database:dbs.find(d=>d.id===origin.database_id)};
 }).filter((v):v is NonNullable<typeof v>=>v!==null):[];
 const openRelatedRecord=(nextDbId:string,nextRecordId:string)=>{
  setDbId(nextDbId);setSelected(nextRecordId);setViewId("");
 };
 const addDatabase=()=>void run(async()=>{
  const id=crypto.randomUUID();check(await supabase.rpc("db_create_database",{p_id:id,p_name:addDb.trim(),p_dataset:"acceptance"}));
  setDbId(id);setAddDb("");
 },"Database created in staging");
 const addRecord=()=>void run(async()=>{
  check(await supabase.rpc("db_create_record",{p_id:crypto.randomUUID(),p_database_id:dbId,p_name:addRec.trim()}));setAddRec("");
 },"Record created in staging");
 const addProperty=()=>void run(async()=>{
  const config=propType==="select"?{options:options.split(",").map(s=>s.trim())}:propType==="relation"?{target_database_id:target,multi:true}:{};
  check(await supabase.from("db_properties").insert({database_id:dbId,name:addProp.trim(),type:propType,config,position:cols.length}));
  setAddProp("");
 },"Property added in staging");
 const saveTitle=(id:string,title:string)=>void run(async()=>{
  const current=items.find(x=>x.id===id);if(!current||title.trim()===current.title)return;
  const details=check(await supabase.from("thought_details").select("version,parent_id,position,archived_at").eq("thought_id",id).single()) as {version:number;parent_id:string|null;position:number;archived_at:string|null};
  check(await supabase.rpc("save_thought",{p_id:id,p_version:details.version,p_title:title.trim(),p_content:{blocks:[]},p_parent:details.parent_id,p_position:details.position,p_archive:details.archived_at}));
 },"Record name saved");
 const saveValue=(r:Rec,p:Prop,v:string|number|boolean|null)=>void run(async()=>{
  check(await supabase.rpc("db_set_value",{p_record_id:r.record_id,p_version:r.version,p_property_id:p.id,p_value:v}));
 },"Value saved to staging");
 const saveRelation=(r:Rec,p:Prop,t:string)=>void run(async()=>{
  check(await supabase.rpc("db_link",{p_property_id:p.id,p_source:r.record_id,p_target:t}));
 },"Relation saved to staging");
 const removeRelation=(id:string)=>void run(async()=>{
  check(await supabase.from("db_relations").delete().eq("id",id));
 },"Relation removed");
 const updateView=(patch:Record<string,unknown>)=>void run(async()=>{
  if(!view)return;
  check(await supabase.from("db_views").update(patch).eq("id",view.id).eq("database_id",dbId));
 },"View settings saved");
 const createView=()=>void run(async()=>{
  const name=window.prompt("Name the new saved view");if(!name?.trim())return;
  const result=check(await supabase.from("db_views").insert({database_id:dbId,name:name.trim(),layout:"table",config:{}}).select("id").single()) as {id:string};
  setViewId(result.id);
 },"Saved view created");
 const renderCell=(r:Rec,p:Prop)=>{
  if(p.type==="relation"){
   const assigned=links.filter(l=>l.source_record_id===r.record_id&&l.property_id===p.id);
   return <div className="db-lab-relations"><div className="db-lab-relations-chips">{assigned.map(l=><button type="button" className="db-lab-chip" key={l.id} onClick={()=>removeRelation(l.id)} title="Remove link">{label(l.target_record_id)} ×</button>)}</div>
   <select aria-label={"Link "+p.name} value="" onChange={e=>{if(e.target.value)saveRelation(r,p,e.target.value)}}>
    <option value="">+ Link record</option>
    {(p.config.multi!==false||assigned.length===0) && records.filter(x=>x.database_id===p.config.target_database_id&&x.record_id!==r.record_id&&!assigned.some(l=>l.target_record_id===x.record_id)).map(x=><option key={x.record_id} value={x.record_id}>{label(x.record_id)}</option>)}
   </select></div>;
  }
  const value=r.values_json[p.id];
  if(p.type==="checkbox")return <input type="checkbox" aria-label={p.name} checked={value===true} onChange={e=>saveValue(r,p,e.target.checked)}/>;
  if(p.type==="select")return <select aria-label={p.name} value={String(value??"")} onChange={e=>saveValue(r,p,e.target.value||null)}>
    <option value="">—</option>{(p.config.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>;
  return <input key={r.record_id+":"+p.id+":"+r.version} aria-label={p.name} type={p.type==="number"?"number":p.type==="date"?"date":"text"}
   defaultValue={value===undefined||value===null?"":String(value)}
   onBlur={e=>{const t=e.target.value;if(t===String(value??""))return;saveValue(r,p,t===""?null:p.type==="number"?Number(t):t)}}
   onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>;
 };
 const characterDb=dbs.find(d=>d.name.toLowerCase()==="characters");
 const characterIds=new Set(records.filter(r=>r.database_id===characterDb?.id).map(r=>r.record_id));
 const missingCharacters=countMissingCharacters(items.filter(i=>characterIds.has(i.id)).map(i=>i.title));
 const worldSetupMissing=WORLD_DATABASE_TEMPLATES.filter(template=>
  !dbs.some(d=>d.name.trim().toLowerCase()===template.name.toLowerCase())).length;
 const startWorldSetup=async()=>{
  if(settingUpWorld||loading)return;
  if(!window.confirm("Add the seven linked worldbuilding databases and missing relation properties to your staging account? Existing Characters, Events, IDs, properties, values and links will be preserved."))return;
  setSettingUpWorld(true);setSetupProgress("Preparing worldbuilding databases");setError("");setInfo("");
  try{
   const result=await setupWorldbuildingDatabases(supabase,setSetupProgress);
   await refresh();
   setInfo(`Worldbuilding foundation ready: ${result.databasesCreated} databases created, ${result.databasesReused} reused, ${result.propertiesCreated} relation/metadata properties added and ${result.selectOptionsExpanded} select property sets expanded. No existing records were replaced.`);
  }catch(e){
   setError("Worldbuilding setup stopped: "+(e instanceof Error?e.message:String(e))+
     ". Existing records remain unchanged. You can safely retry the setup.");
  }finally{setSettingUpWorld(false);setSetupProgress("");}
 };
 const legacyCharacterNames=["Summary","Affiliation","Story role","Power status","Ability","Curse","Timeline note"];
 const legacyCharacterProps=props.filter(p=>p.database_id===charactersDatabase?.id
   &&legacyCharacterNames.includes(p.name));
 const retireLegacyCharacterFields=()=>void(async()=>{
  if(!charactersDatabase||!perspectivesDatabase||!eventsDatabase){
    setError("Set up the Perspectives worldbuilding foundation before retiring legacy columns.");return;
  }
  if(!legacyCharacterProps.length){setInfo("All legacy character columns are already removed.");return;}
  if(!window.confirm("Hide "+legacyCharacterProps.length+" old Character text/status columns? Their original values remain safely stored and can be restored from Properties. They will NOT be assumed to apply to any Event; enter those details in the appropriate snapshots when you know their context."))return;
  setError("");setInfo("");
  try{
    for(const p of legacyCharacterProps){
      const {data,error}=await supabase.from("db_properties")
       .update({archived_at:new Date().toISOString()})
       .eq("id",p.id).eq("database_id",charactersDatabase.id)
       .eq("version",p.version).select("id").maybeSingle();
      if(error)throw error;
      if(!data)throw new Error("A property changed during cleanup. Refresh and retry.");
    }
    await refresh();
    setInfo("Old Character text columns hidden. No data deleted. Add group/ability relationships through event snapshots.");
  }catch(e){setError(e instanceof Error?e.message:String(e))}
 })();
 const startCharacterImport=async()=>{
  if(importing||loading)return;
  if(!window.confirm("Import the 23 starter Characters into your signed-in staging account? Existing Characters, IDs, and nonempty fields will be preserved. Only missing records and fields will be added."))return;
  setImporting(true);setImportProgress("Preparing import");setError("");setInfo("");
  try{
   const report=await importFirstCharactersToStaging(supabase,setImportProgress);
   await refresh();setDbId(report.databaseId);setSelected("");
   setInfo(`Character import complete: ${report.created} created, ${report.reused} reused, ${report.fieldsFilled} values added, ${report.linksCreated+report.eventLinksCreated} links added. Refresh to verify cloud persistence.`);
  }catch(e){setError("Import stopped: "+(e instanceof Error?e.message:String(e))+". You can safely retry without duplicating completed records.");}
  finally{setImporting(false);setImportProgress("");}
 };
 const checklist=[
  ["Characters database exists",dbs.some(d=>d.name==="Characters")],
  ["At least one Character stored",records.some(r=>dbs.find(d=>d.id===r.database_id)?.name==="Characters")],
  ["Custom Character property",props.some(p=>dbs.find(d=>d.id===p.database_id)?.name==="Characters")],
  ["A property value saved",records.some(r=>Object.keys(r.values_json).length>0)],
  ["An Event stored",records.some(r=>dbs.find(d=>d.id===r.database_id)?.name==="Events")],
  ["Character/Event relation saved",links.length>0]
 ] as const;
 return <main className="db-lab">
  <header className="db-lab-header"><div><Link className="db-lab-back" href="/">← All About Action</Link>
   <span className="db-lab-kicker">DATABASE ENGINE · STAGING BACKEND</span><h1>Database Acceptance Lab</h1>
   <p>Real authenticated storage in your separate staging Supabase project.</p></div>
   <div className="db-lab-mode"><strong>STAGING SUPABASE · LIVE</strong><span>Saved to an isolated cloud database · Not production</span></div></header>
  <div className="db-lab-workspace"><aside className="db-lab-sidebar">
   <div className="db-lab-sidebar-heading"><strong>Databases</strong></div>
   {dbs.map(d=><button key={d.id} className={"db-lab-nav "+(dbId===d.id?"active":"")} onClick={()=>{setDbId(d.id);setSelected("");setViewId("");}}>
    <span>🗃️</span><span>{d.name}</span><small>{records.filter(r=>r.database_id===d.id).length}</small></button>)}
   <div className="db-lab-inline-form"><input aria-label="Database name" placeholder="New database name" value={addDb} onChange={e=>setAddDb(e.target.value)}/><button onClick={addDatabase} disabled={!addDb.trim()}>+ Create</button></div>
   <section className="db-lab-import"><strong>Worldbuilding foundation</strong>
    <p>Eight linked databases, including Perspectives (Character × Event), Groups and Abilities.</p>
    <p>{worldSetupMissing===0?"All seven databases exist.":worldSetupMissing+" databases need to be added."} Creates typed relationships and parent hierarchies without duplicating your records.</p>
    <button type="button" disabled={loading||settingUpWorld||importing} onClick={()=>void startWorldSetup()}>{settingUpWorld?"Setting up…":"Set up linked databases"}</button>
    {settingUpWorld&&<p role="status">{setupProgress}</p>}
    <small>Opt-in and repeatable · No sample locations, abilities or lore records will be invented.</small>
   </section>
   <section className="db-lab-import">
    <strong>Event-scoped character context</strong>
    <p>Groups, abilities, beliefs and knowledge belong to a Character during an Event. Snapshot IDs are permanent and each pairing is unique.</p>
    <p>{legacyCharacterProps.length?legacyCharacterProps.length+" legacy Character columns are still visible.":"Legacy Character text columns are hidden or not present."}</p>
    <button disabled={!legacyCharacterProps.length||!perspectivesDatabase} type="button"
      onClick={retireLegacyCharacterFields}>Hide old Character text columns</button>
    <small>Reversible. Existing values stay in Supabase; no historical memberships are guessed.</small>
   </section>
   <section className="db-lab-import"><strong>Nobody Special starter dataset</strong><p>{FIRST_CHARACTERS.length} Characters · {missingCharacters} missing from your staging account. Adds structured story fields and only explicitly described connections.</p><button type="button" disabled={loading||importing} onClick={()=>void startCharacterImport()}>{importing?"Importing…":"Import 23 Characters"}</button>{importing&&<p role="status">{importProgress}</p>}<small>Review before importing. Existing names, IDs, genders, descriptions, and links are preserved.</small></section>
   <section className="db-lab-checklist"><strong>Real backend acceptance</strong><p>{checklist.filter(x=>x[1]).length} / {checklist.length} steps completed</p>
    {checklist.map(([s,done])=><div key={s} className="db-lab-check"><span>{done?"✓":"○"}</span>{s}</div>)}
    <p>After saving, refresh this page or sign into staging from another device to verify cloud persistence.</p>
   </section>
   <button className="db-lab-reset" onClick={()=>void run(refresh,"Synced from Supabase")}>Reload from Supabase</button>
  </aside><section className="db-lab-main">
   <div className="db-lab-db-head"><span className="db-lab-kicker">CLOUD BACKED DATABASE</span>
   <h2>{database?.name||"Create your first database"}</h2><p>Every record has its own permanent ID and page identity.</p></div>
   {loading&&<div className="db-lab-notice">Loading staging records…</div>}
   {error&&<div role="alert" className="db-lab-error">{error}<button onClick={()=>setError("")}>Dismiss</button></div>}
   {info&&<div role="status" className="db-lab-notice">{info}</div>}
   {database&&<>
    <div className="db-lab-toolbar"><label>Saved view <select value={view?.id||""} onChange={e=>setViewId(e.target.value)}>
     {activeViews.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
    <label>Layout <select value={view?.layout||"table"} onChange={e=>updateView({layout:e.target.value})}>
     <option value="table">Table</option><option value="gallery">Gallery</option></select></label>
    <button onClick={createView}>+ Save view</button><button onClick={()=>setShowProperties(v=>!v)}>+ Property</button>
    <label>Sort <select value={sort} onChange={e=>setSort(e.target.value)}>
     <option value="creation">Creation order</option><option value="name">Name</option>
     {cols.filter(p=>p.type!=="relation").map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <button onClick={()=>setReverse(v=>!v)}>{reverse?"Descending":"Ascending"}</button>
    <label className="db-lab-query">Search <input value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {showProperties&&<div className="db-lab-editor"><strong>Create a property</strong><div className="db-lab-form-grid">
     <label>Name<input value={addProp} placeholder="e.g. Motivation" onChange={e=>setAddProp(e.target.value)}/></label>
     <label>Type<select value={propType} onChange={e=>setPropType(e.target.value)}>{types.map(t=><option key={t} value={t}>{t}</option>)}</select></label>
     {propType==="select"&&<label>Options<input value={options} onChange={e=>setOptions(e.target.value)}/></label>}
     {propType==="relation"&&<label>Target database<select value={target} onChange={e=>setTarget(e.target.value)}>
      <option value="">Choose target</option>{dbs.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
     <button onClick={addProperty} disabled={!addProp.trim()||(propType==="relation"&&!target)}>Create property</button></div>
     <RestoreDatabaseProperties archived={archivedProps} dbId={dbId}
      onRefresh={refresh} onError={setError} onSaved={setInfo}/>
    </div>}
    {record?<div className="db-lab-detail"><button className="db-lab-back" onClick={()=>setSelected("")}>← Back to table</button>
     <span className="db-lab-kicker">RECORD #{record.sequence_no}</span>
     <label className="db-lab-detail-title">Name<input key={record.record_id} defaultValue={label(record.record_id)} onBlur={e=>saveTitle(record.record_id,e.target.value)}
       onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/></label>
     {snapshotPair&&<section className="db-lab-snapshot-context">
      <strong>Character snapshot</strong>
      <p><button type="button" onClick={()=>charactersDatabase&&openRelatedRecord(charactersDatabase.id,snapshotPair.character_id)}>
        {rawLabel(snapshotPair.character_id)}</button> during
      <button type="button" onClick={()=>eventsDatabase&&openRelatedRecord(eventsDatabase.id,snapshotPair.event_id)}>
        {rawLabel(snapshotPair.event_id)}</button></p>
      <small>Changes to this record describe only this event; they do not overwrite the Character across all time.</small>
     </section>}
     {record&&(database?.name.toLowerCase()==="characters"||database?.name.toLowerCase()==="events")&&
       <section className="db-lab-snapshot-context">
        <strong>{database.name==="Characters"?"Event snapshots for this Character":"Character snapshots for this Event"}</strong>
        {currentSnapshotPairs.length?<div className="db-lab-snapshot-list">
          {currentSnapshotPairs.map(p=><button type="button" key={p.record_id}
           onClick={()=>perspectivesDatabase&&openRelatedRecord(perspectivesDatabase.id,p.record_id)}>
            {label(p.record_id)} →</button>)}</div>:<p>No snapshots have been recorded yet.</p>}
        {perspectivesDatabase&&<div className="db-lab-inline-form">
         <select aria-label="Choose event or character for snapshot" value={snapshotChoice}
           onChange={e=>setSnapshotChoice(e.target.value)}>
          <option value="">Choose {database.name==="Characters"?"an Event":"a Character"}…</option>
          {snapTargets.map(t=><option key={t.record_id} value={t.record_id}>{label(t.record_id)}</option>)}
         </select>
         <button type="button" disabled={!snapshotChoice||makingSnapshot}
           onClick={()=>{openSnapshot(snapshotChoice);setSnapshotChoice("");}}>
          {makingSnapshot?"Saving…":"Open / create snapshot"}</button>
        </div>}
       {!perspectivesDatabase&&<p>Run Set up linked databases to enable Perspectives.</p>}
       </section>}
     <div className="db-lab-detail-grid">{cols.map(p=><div key={p.id} className="db-lab-detail-field">
      <DatabasePropertyHeading property={p} onRefresh={refresh} onError={setError} onSaved={setInfo}/>
      {renderCell(record,p)}</div>)}</div>
     <section className="db-lab-backlinks">
       <strong>Referenced by other records</strong>
       <p>Automatic backlinks from shared relationships. These are not copied records.</p>
       {incomingLinks.length===0?<small>No incoming relationships yet.</small>:
        <div className="db-lab-backlink-list">
        {incomingLinks.map(({link,property,origin,database})=>
         <button type="button" key={link.id}
           onClick={()=>openRelatedRecord(origin.database_id,origin.record_id)}>
           <span>{label(origin.record_id)} <small>({database?.name??"Database"})</small></span>
           <span className="db-lab-backlink-detail">via {property.name} →</span>
         </button>)}
        </div>}
     </section>
     <div className="db-lab-detail-foot">Permanent record ID: {record.record_id}</div></div>:<>
     <form className="db-lab-new-record" onSubmit={e=>{e.preventDefault();addRecord()}}>
      <input aria-label="New record name" required placeholder={"New "+database.name+" record"} value={addRec} onChange={e=>setAddRec(e.target.value)}/>
      <button type="submit">+ New record</button></form>
     {view?.layout==="gallery"?<div className="db-lab-gallery">{list.map(r=><button key={r.record_id} onClick={()=>setSelected(r.record_id)}>
       <small>{database.name} #{r.sequence_no}</small><strong>{label(r.record_id)}</strong>
       {cols.slice(0,3).map(p=><span key={p.id}>{p.name}: {String(r.values_json[p.id]??"—")}</span>)}</button>)}</div>:
     <div className="db-lab-table-wrap"><table className="db-lab-table"><thead><tr><th>Name</th><th>ID</th>{cols.map(p=><th key={p.id}>
       <DatabasePropertyHeading property={p} onRefresh={refresh} onError={setError} onSaved={setInfo}/>
      </th>)}</tr></thead>
      <tbody>{list.map(r=><tr key={r.record_id}><td><button className="db-lab-record-link" onClick={()=>setSelected(r.record_id)}>{label(r.record_id)} ↗</button></td>
       <td className="db-lab-id">{r.sequence_no}</td>{cols.map(p=><td key={p.id}>{renderCell(r,p)}</td>)}</tr>)}</tbody></table></div>}
     {!list.length&&<div className="db-lab-empty">No records yet. Add one above to test cloud persistence.</div>}</>}
   </>}
   <footer className="db-lab-footer">Connected to staging Supabase only · Sign-in required · No production database changes</footer>
  </section></div></main>;
}
