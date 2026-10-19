"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
type DB={id:string;name:string;icon:string};
type Prop={id:string;database_id:string;name:string;type:string;config:{options?:string[];target_database_id?:string;multi?:boolean};position:number};
type Rec={record_id:string;database_id:string;sequence_no:number;version:number;values_json:Record<string,string|number|boolean|null>;archived_at:string|null};
type View={id:string;database_id:string;name:string;layout:string;config:Record<string,unknown>};
type Link={id:string;property_id:string;source_record_id:string;target_record_id:string};
type Item={id:string;title:string};
const types=["text","long_text","number","date","checkbox","select","relation"];
const check=<T,>(response:{data:T;error:{message:string}|null}):T=>{
  if(response.error)throw new Error(response.error.message);
  return response.data;
};
export default function StagingDatabaseLab(){
 const [dbs,setDbs]=useState<DB[]>([]);
 const [props,setProps]=useState<Prop[]>([]);
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
 const refresh=useCallback(async()=>{
  const [a,b,c,d,e,f]=await Promise.all([
   supabase.from("db_databases").select("id,name,icon").is("archived_at",null),
   supabase.from("db_properties").select("id,database_id,name,type,config,position").is("archived_at",null).order("position"),
   supabase.from("db_records").select("record_id,database_id,sequence_no,version,values_json,archived_at").is("archived_at",null),
   supabase.from("db_views").select("id,database_id,name,layout,config"),
   supabase.from("db_relations").select("id,property_id,source_record_id,target_record_id"),
   supabase.from("user_items").select("id,title").eq("item_type","thought")
  ]);
  setDbs(check(a) as DB[]);setProps(check(b) as Prop[]);setRecords(check(c) as Rec[]);
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
 const label=(id:string)=>items.find(x=>x.id===id)?.title||"Untitled";
 const list=records.filter(x=>x.database_id===dbId&&(!search||[label(x.record_id),...Object.values(x.values_json)].join(" ").toLowerCase().includes(search.toLowerCase())))
 .sort((a,b)=>{const av=sort==="creation"?a.sequence_no:sort==="name"?label(a.record_id):a.values_json[sort];
 const bv=sort==="creation"?b.sequence_no:sort==="name"?label(b.record_id):b.values_json[sort];
 const n=typeof av==="number"&&typeof bv==="number"?av-bv:String(av??"").localeCompare(String(bv??""),undefined,{numeric:true});
 return reverse?-n:n;});
 const record=records.find(x=>x.record_id===selected && x.database_id===dbId);
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
    {records.filter(x=>x.database_id===p.config.target_database_id&&x.record_id!==r.record_id&&!assigned.some(l=>l.target_record_id===x.record_id)).map(x=><option key={x.record_id} value={x.record_id}>{label(x.record_id)}</option>)}
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
     <button onClick={addProperty} disabled={!addProp.trim()||(propType==="relation"&&!target)}>Create property</button></div></div>}
    {record?<div className="db-lab-detail"><button className="db-lab-back" onClick={()=>setSelected("")}>← Back to table</button>
     <span className="db-lab-kicker">RECORD #{record.sequence_no}</span>
     <label className="db-lab-detail-title">Name<input key={record.record_id} defaultValue={label(record.record_id)} onBlur={e=>saveTitle(record.record_id,e.target.value)}
       onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/></label>
     <div className="db-lab-detail-grid">{cols.map(p=><div key={p.id} className="db-lab-detail-field"><label>{p.name}<small>{p.type}</small></label>{renderCell(record,p)}</div>)}</div>
     <div className="db-lab-detail-foot">Permanent record ID: {record.record_id}</div></div>:<>
     <form className="db-lab-new-record" onSubmit={e=>{e.preventDefault();addRecord()}}>
      <input aria-label="New record name" required placeholder={"New "+database.name+" record"} value={addRec} onChange={e=>setAddRec(e.target.value)}/>
      <button type="submit">+ New record</button></form>
     {view?.layout==="gallery"?<div className="db-lab-gallery">{list.map(r=><button key={r.record_id} onClick={()=>setSelected(r.record_id)}>
       <small>{database.name} #{r.sequence_no}</small><strong>{label(r.record_id)}</strong>
       {cols.slice(0,3).map(p=><span key={p.id}>{p.name}: {String(r.values_json[p.id]??"—")}</span>)}</button>)}</div>:
     <div className="db-lab-table-wrap"><table className="db-lab-table"><thead><tr><th>Name</th><th>ID</th>{cols.map(p=><th key={p.id}>{p.name}<small>{p.type}</small></th>)}</tr></thead>
      <tbody>{list.map(r=><tr key={r.record_id}><td><button className="db-lab-record-link" onClick={()=>setSelected(r.record_id)}>{label(r.record_id)} ↗</button></td>
       <td className="db-lab-id">{r.sequence_no}</td>{cols.map(p=><td key={p.id}>{renderCell(r,p)}</td>)}</tr>)}</tbody></table></div>}
     {!list.length&&<div className="db-lab-empty">No records yet. Add one above to test cloud persistence.</div>}</>}
   </>}
   <footer className="db-lab-footer">Connected to staging Supabase only · Sign-in required · No production database changes</footer>
  </section></div></main>;
}
