"use client";
import {useCallback,useEffect,useState} from "react";
import {Check,Database,Plus,RefreshCw,Trash2,X} from "lucide-react";
import {supabase} from "@/lib/supabase";
type Db={id:string;name:string;icon:string};
type Field={id:string;database_id:string;name:string;type:string;position:number;config:Record<string,unknown>};
type RecordRow={record_id:string;database_id:string;values_json:Record<string,unknown>};
const types=["text","number","date","checkbox","select","relation"];
export default function DemoDatabaseWorkshop(){
  const [databases,setDatabases]=useState<Db[]>([]),[fields,setFields]=useState<Field[]>([]),[records,setRecords]=useState<RecordRow[]>([]);
  const [selected,setSelected]=useState(""),[databaseName,setDatabaseName]=useState(""),[propertyName,setPropertyName]=useState(""),[propertyType,setPropertyType]=useState("text");
  const [creatingDatabase,setCreatingDatabase]=useState(false),[creatingProperty,setCreatingProperty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false),[typedName,setTypedName]=useState("");
  const refresh=useCallback(async()=>{
    const [d,f,r]=await Promise.all([
      supabase.from("db_databases").select("id,name,icon").is("archived_at",null).order("name"),
      supabase.from("db_properties").select("id,database_id,name,type,position,config").is("archived_at",null).order("position"),
      supabase.from("db_records").select("record_id,database_id,values_json").is("archived_at",null)
    ]);
    const firstError=d.error||f.error||r.error;if(firstError)throw new Error(firstError.message);
    const list=(d.data??[]) as Db[];setDatabases(list);setFields((f.data??[]) as Field[]);setRecords((r.data??[]) as RecordRow[]);
    setSelected(current=>list.some(x=>x.id===current)?current:list[0]?.id??"");
  },[]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e)))},[refresh]);
  const createDatabase=async()=>{
    const name=databaseName.trim();if(!name||busy)return;
    setBusy(true);setError("");
    try{
      const id=crypto.randomUUID();const {error}=await supabase.rpc("db_create_database",{p_id:id,p_name:name,p_dataset:"acceptance"});
      if(error)throw new Error(error.message);
      await refresh();setSelected(id);setCreatingDatabase(false);setDatabaseName("");
    }catch(e){setError(String(e))}finally{setBusy(false)}
  };
  const createProperty=async()=>{
    const name=propertyName.trim();if(!selected||!name||busy)return;
    setBusy(true);setError("");
    try{
      const position=fields.filter(f=>f.database_id===selected).length;
      const {error}=await supabase.from("db_properties").insert({id:crypto.randomUUID(),database_id:selected,name,type:propertyType,config:{},position,archived_at:null});
      if(error)throw new Error(error.message);
      await refresh();setCreatingProperty(false);setPropertyName("");
    }catch(e){setError(String(e))}finally{setBusy(false)}
  };
  const modifyField=async(id:string,patch:Partial<Field>)=>{
    const {error}=await supabase.from("db_properties").update(patch).eq("id",id);
    if(error)setError(error.message);else await refresh().catch(e=>setError(String(e)));
  };
  const current=databases.find(d=>d.id===selected),visibleFields=fields.filter(f=>f.database_id===selected);
  const deleteDatabase=async()=>{
    if(!current||typedName!==current.name||busy)return;
    setBusy(true);setError("");
    const {error}=await supabase.rpc("db_delete_database",{p_database_id:current.id,p_confirm_name:typedName});
    if(error)setError(error.message);
    else {await refresh();setConfirmDelete(false);setTypedName("")}
    setBusy(false);
  };
  return <section className="aaa-demo-database-studio">
    <header className="aaa-widget-hero"><div><span className="aaa-widget-eyebrow">DEVELOPING IT / DATABASES / DEVELOPER SANDBOX</span><h1>Database workshop</h1><p>Explore the sample source databases that power your widgets. Add new databases and properties here without changing real Supabase records.</p></div>
      <button className="aaa-widget-primary" onClick={()=>setCreatingDatabase(true)}><Plus size={16}/> New database</button></header>
    {error&&<div className="aaa-widget-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Close error"><X size={16}/></button></div>}
    {creatingDatabase&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createDatabase()}}><input autoFocus placeholder="Database name…" aria-label="New database name" value={databaseName} onChange={e=>setDatabaseName(e.target.value)}/><button disabled={busy||!databaseName.trim()}><Check size={15}/> Create</button><button type="button" onClick={()=>setCreatingDatabase(false)}><X size={15}/></button></form>}
    <div className="aaa-demo-db-stats"><span>{databases.length} <small>Databases</small></span><span>{fields.length} <small>Properties</small></span><span>{records.length} <small>Records</small></span><button onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button></div>
    <div className="aaa-demo-db-layout"><nav aria-label="Demo databases" className="aaa-demo-db-list">
      {databases.map(db=><button key={db.id} className={selected===db.id?"selected":""} onClick={()=>setSelected(db.id)}><Database size={17}/><span>{db.name}<small>{records.filter(r=>r.database_id===db.id).length} records</small></span></button>)}
    </nav><div className="aaa-demo-db-detail">
      {current?<><header><div><small>DATA SOURCE / {current.name.toUpperCase()}</small><h2>{current.name}</h2><p>This database is available to the widget Configure panel. All demo widgets refer to its records by ID.</p></div>
        <button className="aaa-widget-secondary" title="Delete central database and records" onClick={()=>{setConfirmDelete(true);setTypedName("")}}><Trash2 size={15}/> Delete database</button></header>
      {confirmDelete&&<div className="aaa-widget-dialog-backdrop"><section className="aaa-widget-dialog" role="alertdialog" aria-modal="true" aria-labelledby="database-delete-label">
        <div className="aaa-widget-dialog-icon"><Trash2/></div><h2 id="database-delete-label">Delete “{current.name}” and its records?</h2>
        <p><strong>This deletes the core database, its properties, records and linked views from every workspace.</strong> It is not the same as removing a widget. This cannot be undone.</p>
        <label>Type {current.name} to confirm<input autoFocus aria-label="Confirm database deletion" value={typedName} onChange={e=>setTypedName(e.target.value)}/></label>
        <div className="aaa-widget-dialog-actions"><button onClick={()=>setConfirmDelete(false)}>Cancel</button><button className="aaa-widget-danger-button" disabled={typedName!==current.name||busy} onClick={()=>void deleteDatabase()}>Delete source and records</button></div>
      </section></div>}
      <div className="aaa-demo-db-field-heading"><h3>Properties <small>{visibleFields.length}</small></h3><button onClick={()=>setCreatingProperty(true)}><Plus size={15}/> New property</button></div>
      {creatingProperty&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createProperty()}}><input autoFocus aria-label="Property name" placeholder="Property name…" value={propertyName} onChange={e=>setPropertyName(e.target.value)}/><select aria-label="Property type" value={propertyType} onChange={e=>setPropertyType(e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select><button disabled={busy||!propertyName.trim()}><Check size={15}/> Add</button><button type="button" onClick={()=>setCreatingProperty(false)}><X size={15}/></button></form>}
      <div className="aaa-demo-db-fields">{visibleFields.map(field=><div key={field.id}>
        <input aria-label={"Rename "+field.name} defaultValue={field.name} key={field.id+field.name} onBlur={e=>{const name=e.target.value.trim();if(name&&name!==field.name)void modifyField(field.id,{name})}}/>
        <select aria-label={"Type of "+field.name} value={field.type} onChange={e=>void modifyField(field.id,{type:e.target.value})}>{types.map(t=><option key={t}>{t}</option>)}</select>
      </div>)}{!visibleFields.length&&<p>No properties yet. Add one to start designing this source.</p>}</div>
      <p className="aaa-demo-db-note">Sample records can be viewed and edited through Library and Goals widgets. This isolated preview remembers changes in this browser.</p>
      </>:<p>Select or create a database to begin.</p>}
    </div></div>
  </section>;
}
