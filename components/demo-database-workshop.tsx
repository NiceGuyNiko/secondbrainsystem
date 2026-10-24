"use client";
import {formatDatabasePropertyValue,numberFormatOf,NUMBER_DISPLAY_OPTIONS} from "@/lib/db-property-format";
import DatabasePropertyValue from "@/components/database-property-value";
import {useCallback,useEffect,useState} from "react";
import {Check,ChevronRight,Database,LayoutGrid,Plus,RefreshCw,Settings2,Trash2,X} from "lucide-react";
import {supabase} from "@/lib/supabase";
import InlineRelationPicker from "@/components/db-inline-relation";

type Db={id:string;name:string;icon:string};
type Field={id:string;database_id:string;name:string;type:string;position:number;config:Record<string,unknown>};
type RecordRow={record_id:string;database_id:string;sequence_no:number;position:number;version:number;values_json:Record<string,unknown>};
type Relation={id?:string;property_id:string;source_record_id:string;target_record_id:string};
type NameRow={id:string;title:string};
type View="records"|"properties";
const types=["text","long_text","number","date","checkbox","select","relation"];
const valueText=(v:unknown)=>v===undefined||v===null?"":String(v);
const optionsOf=(field:Field)=>Array.isArray(field.config.options)?field.config.options.filter((x):x is string=>typeof x==="string"):[];

export default function DemoDatabaseWorkshop({selectedDatabaseId,onSelectDatabase,onDatabasesChange,onBuildWidget}:{
  selectedDatabaseId?:string;onSelectDatabase?:(id:string)=>void;onDatabasesChange?:()=>void;onBuildWidget?:(id:string)=>void;
}={}){
  const [databases,setDatabases]=useState<Db[]>([]),[fields,setFields]=useState<Field[]>([]),[records,setRecords]=useState<RecordRow[]>([]);
  const [links,setLinks]=useState<Relation[]>([]),[titles,setTitles]=useState<Record<string,string>>({});
  const [selected,setSelected]=useState(""),[view,setView]=useState<View>("records"),[openRecord,setOpenRecord]=useState<string|null>(null);
  const [databaseName,setDatabaseName]=useState(""),[propertyName,setPropertyName]=useState(""),[propertyType,setPropertyType]=useState("text");
  const [propertyOptions,setPropertyOptions]=useState(""),[propertyTarget,setPropertyTarget]=useState("");
  const [newRecordName,setNewRecordName]=useState("");
  const [creatingDatabase,setCreatingDatabase]=useState(false),[creatingProperty,setCreatingProperty]=useState(false),[creatingRecord,setCreatingRecord]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false),[typedName,setTypedName]=useState("");

  const refresh=useCallback(async()=>{
    const [d,f,r,l,n]=await Promise.all([
      supabase.from("db_databases").select("id,name,icon").is("archived_at",null).order("name"),
      supabase.from("db_properties").select("id,database_id,name,type,position,config").is("archived_at",null).order("position"),
      supabase.from("db_records").select("record_id,database_id,sequence_no,position,version,values_json").is("archived_at",null),
      supabase.from("db_relations").select("id,property_id,source_record_id,target_record_id"),
      supabase.from("user_items").select("id,title").eq("item_type","thought")
    ]);
    const failure=d.error||f.error||r.error||l.error||n.error;if(failure)throw new Error(failure.message);
    const list=(d.data??[]) as Db[];
    setDatabases(list);setFields((f.data??[]) as Field[]);setRecords((r.data??[]) as RecordRow[]);
    setLinks((l.data??[]) as Relation[]);setTitles(Object.fromEntries(((n.data??[]) as NameRow[]).map(item=>[item.id,item.title])));
    setSelected(current=>list.some(x=>x.id===selectedDatabaseId)?selectedDatabaseId!:list.some(x=>x.id===current)?current:list[0]?.id??"");
  },[selectedDatabaseId]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e)))},[refresh]);
  useEffect(()=>{if(selectedDatabaseId&&databases.some(db=>db.id===selectedDatabaseId)){setSelected(selectedDatabaseId);setOpenRecord(null)}},[selectedDatabaseId,databases]);
  const current=databases.find(d=>d.id===selected);
  const visibleFields=fields.filter(f=>f.database_id===selected);
  const visibleRecords=records.filter(r=>r.database_id===selected).sort((a,b)=>a.position-b.position||a.sequence_no-b.sequence_no);
  const detail=visibleRecords.find(r=>r.record_id===openRecord);
  const titleFor=(recordId:string)=>titles[recordId]||"Record #"+(records.find(r=>r.record_id===recordId)?.sequence_no??"?");
  const targetDatabase=(field:Field)=>{
    const configured=field.config.target_database_id;
    if(typeof configured==="string"&&databases.some(db=>db.id===configured))return configured;
    const link=links.find(l=>l.property_id===field.id);
    if(link)return records.find(r=>r.record_id===link.target_record_id)?.database_id??"";
    const name=field.name.toLowerCase().replace(/s$/,"");
    return databases.find(db=>db.name.toLowerCase().replace(/s$/,"")===name)?.id??"";
  };
  const linkedNames=(record:RecordRow,field:Field)=>links.filter(l=>l.source_record_id===record.record_id&&l.property_id===field.id).map(l=>titleFor(l.target_record_id)).join(", ");
  const cellText=(record:RecordRow,field:Field)=>field.type==="relation"?linkedNames(record,field):formatDatabasePropertyValue(field,record.values_json[field.id]);
  const showError=(e:unknown)=>setError(e instanceof Error?e.message:String(e));

  const createDatabase=async()=>{
    const name=databaseName.trim();if(!name||busy)return;
    setBusy(true);setError("");
    try{
      const id=crypto.randomUUID();const {error}=await supabase.rpc("db_create_database",{p_id:id,p_name:name,p_dataset:"acceptance"});
      if(error)throw new Error(error.message);
      await refresh();setSelected(id);onSelectDatabase?.(id);onDatabasesChange?.();setCreatingDatabase(false);setDatabaseName("");setView("records");
    }catch(e){showError(e)}finally{setBusy(false)}
  };
  const createRecord=async()=>{
    if(!selected||!newRecordName.trim()||busy)return;
    setBusy(true);
    try{
      const id=crypto.randomUUID();
      const {error}=await supabase.rpc("db_create_record",{p_id:id,p_database_id:selected,p_name:newRecordName.trim()});
      if(error)throw error;
      setNewRecordName("");setCreatingRecord(false);await refresh();setOpenRecord(id);
    }catch(e){showError(e)}finally{setBusy(false)}
  };
  const createProperty=async()=>{
    if(!selected||!propertyName.trim()||busy||(propertyType==="relation"&&!propertyTarget))return;
    setBusy(true);
    try{
      const config=propertyType==="select"?{options:propertyOptions.split(",").map(s=>s.trim()).filter(Boolean)}
        :propertyType==="relation"?{target_database_id:propertyTarget,multi:true}:{};
      const {error}=await supabase.from("db_properties").insert({
        id:crypto.randomUUID(),database_id:selected,name:propertyName.trim(),type:propertyType,
        config,position:visibleFields.length,archived_at:null
      });
      if(error)throw error;
      await refresh();setCreatingProperty(false);setPropertyName("");setPropertyOptions("");
    }catch(e){showError(e)}finally{setBusy(false)}
  };
  const modifyField=async(id:string,patch:Partial<Field>)=>{
    const {error}=await supabase.from("db_properties").update(patch).eq("id",id);
    if(error)setError(error.message);else await refresh().catch(showError);
  };
  const saveValue=async(record:RecordRow,field:Field,raw:unknown)=>{
    let value:unknown=raw;
    if(field.type==="number")value=String(raw).trim()===""?null:Number(raw);
    if(field.type==="checkbox")value=Boolean(raw);
    if(value===record.values_json[field.id])return;
    const {error}=await supabase.rpc("db_set_value",{p_record_id:record.record_id,p_property_id:field.id,p_value:value,p_version:record.version});
    if(error)showError(error);else await refresh().catch(showError);
  };
  const renameRecord=async(record:RecordRow,name:string)=>{
    const title=name.trim();
    if(!title||title===titleFor(record.record_id))return;
    const {error}=await supabase.from("user_items").update({title}).eq("id",record.record_id);
    if(error)showError(error);else await refresh().catch(showError);
  };
  const addLink=async(record:RecordRow,field:Field,targetId:string)=>{
    const dbId=targetDatabase(field);
    if(!dbId){setError("Choose a related database in Properties before linking records.");return}
    if(field.config.target_database_id!==dbId){
      const {error:configError}=await supabase.from("db_properties").update({config:{...field.config,target_database_id:dbId,multi:field.config.multi!==false}}).eq("id",field.id);
      if(configError){showError(configError);return}
    }
    const {error}=await supabase.from("db_relations").insert({property_id:field.id,source_record_id:record.record_id,target_record_id:targetId});
    if(error)showError(error);else await refresh().catch(showError);
  };
  const removeLink=async(record:RecordRow,field:Field,targetId:string)=>{
    const {error}=await supabase.from("db_relations").delete().eq("property_id",field.id).eq("source_record_id",record.record_id).eq("target_record_id",targetId);
    if(error)showError(error);else await refresh().catch(showError);
  };
  const deleteDatabase=async()=>{
    if(!current||typedName!==current.name||busy)return;
    setBusy(true);setError("");
    const {error}=await supabase.rpc("db_delete_database",{p_database_id:current.id,p_confirm_name:typedName});
    if(error)showError(error);
    else{await refresh();onDatabasesChange?.();setConfirmDelete(false);setTypedName("");setOpenRecord(null)}
    setBusy(false);
  };
  const propertyControl=(record:RecordRow,field:Field)=>{
    if(field.type==="relation"){
      const targetId=targetDatabase(field);
      const candidates=records.filter(row=>row.database_id===targetId&&row.record_id!==record.record_id)
        .map(row=>({id:row.record_id,name:titleFor(row.record_id)}));
      const assigned=links.filter(l=>l.source_record_id===record.record_id&&l.property_id===field.id).map(l=>({id:l.target_record_id,targetId:l.target_record_id}));
      return <div className="aaa-demo-db-relation-editor">
        <InlineRelationPicker name={field.name} selected={assigned} candidates={candidates} multi={field.config.multi!==false}
          onLink={target=>void addLink(record,field,target)} onUnlink={target=>void removeLink(record,field,target)}/>
        <small>Options from {databases.find(d=>d.id===targetId)?.name||"the target database (set it in Properties)"}</small>
      </div>;
    }
    const value=record.values_json[field.id];
    if(field.type==="checkbox")return <input type="checkbox" aria-label={field.name} checked={value===true} onChange={e=>void saveValue(record,field,e.target.checked)}/>;
    if(field.type==="select")return <select aria-label={field.name} value={valueText(value)} onChange={e=>void saveValue(record,field,e.target.value)}>
      <option value="">None</option>{[...new Set([...optionsOf(field),...(value?[String(value)]:[])])].map(option=><option key={option} value={option}>{option}</option>)}
    </select>;
    if(field.type==="long_text")return <textarea key={record.record_id+field.id+record.version} aria-label={field.name} defaultValue={valueText(value)} rows={3} onBlur={e=>void saveValue(record,field,e.target.value)}/>;
    return <div className="aaa-demo-db-value-editor">
      <input key={record.record_id+field.id+record.version} aria-label={field.name} type={field.type==="number"?"number":field.type==="date"?"date":"text"}
        defaultValue={valueText(value)} placeholder="Empty" onBlur={e=>void saveValue(record,field,e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
      {field.type==="number"&&numberFormatOf(field)!=="number"&&<small>Displayed as {formatDatabasePropertyValue(field,value)} · stored as a number</small>}
    </div>;
  };

  return <section className="aaa-demo-database-studio aaa-demo-db-workshop-v2">
    <header className="aaa-widget-hero"><div><span className="aaa-widget-eyebrow">DEVELOPING IT / DATABASES / DEVELOPER SANDBOX</span><h1>Database workshop</h1>
      <p>Build the original databases, edit their records and properties, then create reusable views with widgets.</p></div>
      <button className="aaa-widget-primary" onClick={()=>setCreatingDatabase(true)}><Plus size={16}/> New database</button>
    </header>
    {error&&<div className="aaa-widget-alert" role="alert">{error}<button onClick={()=>setError("")} aria-label="Close error"><X size={16}/></button></div>}
    {notice&&<div className="aaa-widget-alert" role="status">{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss notice"><X size={16}/></button></div>}
    {creatingDatabase&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createDatabase()}}>
      <input autoFocus placeholder="Database name…" aria-label="New database name" value={databaseName} onChange={e=>setDatabaseName(e.target.value)}/>
      <button disabled={busy||!databaseName.trim()}><Check size={15}/> Create</button>
      <button type="button" onClick={()=>setCreatingDatabase(false)} aria-label="Cancel"><X size={15}/></button>
    </form>}
    <div className="aaa-demo-db-stats"><span>{databases.length} <small>Databases</small></span><span>{fields.length} <small>Properties</small></span>
      <span>{records.length} <small>Records</small></span><button onClick={()=>void refresh()}><RefreshCw size={15}/> Refresh</button></div>
    {current?<div className="aaa-demo-db-detail">
      <header><div><h2>{current.name}</h2><p>{visibleRecords.length} records · {visibleFields.length} properties · canonical source</p></div>
        <div className="aaa-widget-db-build-actions">
          <button className="aaa-widget-primary" title="Build and configure a widget while keeping this database open" onClick={()=>onBuildWidget?.(current.id)}><LayoutGrid size={15}/> Build widget</button>
          <button className="aaa-widget-secondary" title="Delete original database and records" onClick={()=>{setConfirmDelete(true);setTypedName("")}}><Trash2 size={15}/> Delete database</button>
        </div>
      </header>
      <nav className="aaa-demo-db-view-tabs" aria-label="Database views">
        <button className={view==="records"?"active":""} aria-current={view==="records"?"page":undefined} onClick={()=>setView("records")}><Database size={15}/> Records <span>{visibleRecords.length}</span></button>
        <button className={view==="properties"?"active":""} aria-current={view==="properties"?"page":undefined} onClick={()=>setView("properties")}><Settings2 size={15}/> Properties <span>{visibleFields.length}</span></button>
      </nav>
      {view==="records"?<div className="aaa-demo-db-record-view">
        <div className="aaa-demo-db-view-heading"><div><h3>{current.name} records</h3><p>Each row is a database page. Open it to edit its values and linked records.</p></div>
          <button onClick={()=>setCreatingRecord(v=>!v)}><Plus size={15}/> New record</button>
        </div>
        {creatingRecord&&<form className="aaa-widget-create-row" onSubmit={e=>{e.preventDefault();void createRecord()}}>
          <input autoFocus aria-label="New record title" placeholder={"Name your "+current.name+" record…"} value={newRecordName} onChange={e=>setNewRecordName(e.target.value)}/>
          <button type="submit" disabled={busy||!newRecordName.trim()}><Check size={14}/> Create page</button>
          <button type="button" onClick={()=>setCreatingRecord(false)}><X size={15}/></button>
        </form>}
        <div className="aaa-demo-db-table-wrap"><table className="aaa-demo-db-record-table">
          <thead><tr><th>Name</th>{visibleFields.map(field=><th key={field.id}>{field.name}</th>)}<th aria-label="Open page"/></tr></thead>
          <tbody>{visibleRecords.map(record=><tr key={record.record_id} className={openRecord===record.record_id?"selected":""}>
            <td><button className="aaa-demo-db-record-name" onClick={()=>setOpenRecord(openRecord===record.record_id?null:record.record_id)}>{titleFor(record.record_id)}</button></td>
            {visibleFields.map(field=><td key={field.id}>{field.type==="number"&&numberFormatOf(field)==="bar"
              ?<DatabasePropertyValue property={field} value={record.values_json[field.id]}/>:cellText(record,field)}</td>)}
            <td><button aria-label={"Open "+titleFor(record.record_id)} onClick={()=>setOpenRecord(record.record_id)}><ChevronRight size={15}/></button></td>
          </tr>)}</tbody>
        </table></div>
        {!visibleRecords.length&&<p className="aaa-demo-db-blank">No records yet. Create a database page to start adding values.</p>}
        {detail&&<article className="aaa-demo-db-record-page" aria-label={titleFor(detail.record_id)+" database page"}>
          <header><div><small>DATABASE PAGE · {current.name.toUpperCase()}</small><input key={detail.record_id+titles[detail.record_id]} aria-label="Record page title"
            defaultValue={titleFor(detail.record_id)} onBlur={e=>void renameRecord(detail,e.target.value)} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur()}}/>
            <p>Record #{detail.sequence_no} · editable properties below</p></div>
            <button onClick={()=>setOpenRecord(null)} aria-label="Close record page"><X size={17}/></button>
          </header>
          <div className="aaa-demo-db-record-properties">{visibleFields.map(field=><div key={field.id} className="aaa-demo-db-record-property">
            <div><strong>{field.name}</strong><small>{field.type.replace("_"," ")}</small></div>
            <div>{propertyControl(detail,field)}</div>
          </div>)}
          {!visibleFields.length&&<p>No fields yet. Open Properties to design this database.</p>}</div>
        </article>}
      </div>:<div className="aaa-demo-db-property-view">
        <div className="aaa-demo-db-view-heading"><div><h3>Property builder</h3><p>Configure the original schema. Every widget using this database inherits these fields.</p></div>
          <button onClick={()=>setCreatingProperty(v=>!v)}><Plus size={15}/> New property</button>
        </div>
        {creatingProperty&&<form className="aaa-widget-create-row aaa-demo-db-new-property" onSubmit={e=>{e.preventDefault();void createProperty()}}>
          <input autoFocus aria-label="Property name" placeholder="Property name…" value={propertyName} onChange={e=>setPropertyName(e.target.value)}/>
          <select aria-label="Property type" value={propertyType} onChange={e=>setPropertyType(e.target.value)}>{types.map(t=><option key={t}>{t}</option>)}</select>
          {propertyType==="select"&&<input aria-label="Select options" placeholder="Options, comma-separated" value={propertyOptions} onChange={e=>setPropertyOptions(e.target.value)}/>}
          {propertyType==="relation"&&<select aria-label="Related database" value={propertyTarget} onChange={e=>setPropertyTarget(e.target.value)}><option value="">Link to database…</option>
            {databases.map(db=><option key={db.id} value={db.id}>{db.name}</option>)}</select>}
          <button type="submit" disabled={busy||!propertyName.trim()||(propertyType==="relation"&&!propertyTarget)}><Check size={15}/> Add</button>
          <button type="button" onClick={()=>setCreatingProperty(false)}><X size={15}/></button>
        </form>}
        <div className="aaa-demo-db-property-list">{visibleFields.map(field=><div className="aaa-demo-db-property-row" key={field.id}>
          <div className="aaa-demo-db-property-primary"><label>Property name<input aria-label={"Rename "+field.name} defaultValue={field.name} key={field.id+field.name}
            onBlur={e=>{const name=e.target.value.trim();if(name&&name!==field.name)void modifyField(field.id,{name})}}/></label>
            <label>Type<select aria-label={"Type of "+field.name} value={field.type} onChange={e=>{
              if(e.target.value==="relation"){
                const target=targetDatabase(field);
                if(!target){setError("Create a relation property with its target database, or rename this field to match an existing database first.");return}
                void modifyField(field.id,{type:"relation",config:{...field.config,target_database_id:target,multi:true}});
              }else void modifyField(field.id,{type:e.target.value});
            }}>
              {types.map(t=><option key={t} value={t}>{t.replace("_"," ")}</option>)}</select></label></div>
          {field.type==="number"&&<div className="aaa-demo-db-property-extra aaa-demo-db-display-settings">
            <label>Display numbers as<select aria-label={"Display format for "+field.name} value={numberFormatOf(field)}
              onChange={e=>void modifyField(field.id,{config:{...field.config,numberFormat:e.target.value}})}>
              {NUMBER_DISPLAY_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
            </select></label>
            <label>Decimal places<select aria-label={"Decimal places for "+field.name}
              value={typeof field.config.decimalPlaces==="number"?field.config.decimalPlaces:0}
              onChange={e=>void modifyField(field.id,{config:{...field.config,decimalPlaces:Number(e.target.value)}})}>
              {[0,1,2,3].map(n=><option key={n} value={n}>{n}</option>)}
            </select></label>
            {numberFormatOf(field)==="currency"&&<label>Currency<select aria-label={"Currency for "+field.name}
              value={typeof field.config.currencyCode==="string"?field.config.currencyCode:"CAD"}
              onChange={e=>void modifyField(field.id,{config:{...field.config,currencyCode:e.target.value}})}>
              {["CAD","USD","EUR","GBP"].map(code=><option key={code}>{code}</option>)}
            </select></label>}
            {(numberFormatOf(field)==="percent"||numberFormatOf(field)==="bar")&&<small>65 is shown as 65%. Enter values from 0 to 100; the stored number is unchanged.</small>}
          </div>}
          {field.type==="date"&&<label className="aaa-demo-db-property-extra">Date display
            <select aria-label={"Date display for "+field.name} value={typeof field.config.dateFormat==="string"?field.config.dateFormat:"iso"}
              onChange={e=>void modifyField(field.id,{config:{...field.config,dateFormat:e.target.value}})}>
              <option value="iso">2026-10-23</option><option value="short">Oct 23, 2026</option><option value="long">October 23, 2026</option>
            </select>
          </label>}
          {field.type==="checkbox"&&<label className="aaa-demo-db-property-extra">Checkbox display
            <select aria-label={"Checkbox display for "+field.name} value={typeof field.config.checkboxFormat==="string"?field.config.checkboxFormat:"yes-no"}
              onChange={e=>void modifyField(field.id,{config:{...field.config,checkboxFormat:e.target.value}})}>
              <option value="yes-no">Yes / No</option><option value="done">Done / Not done</option><option value="icon">✓ / ○</option>
            </select>
          </label>}
          {field.type==="select"&&<label className="aaa-demo-db-property-extra">Options<input key={field.id+JSON.stringify(field.config)} aria-label={"Options for "+field.name}
            defaultValue={optionsOf(field).join(", ")} placeholder="e.g. Next, Doing, Done" onBlur={e=>{
              const options=[...new Set(e.target.value.split(",").map(x=>x.trim()).filter(Boolean))];
              if(JSON.stringify(options)!==JSON.stringify(optionsOf(field)))void modifyField(field.id,{config:{...field.config,options}});
            }}/></label>}
          {field.type==="relation"&&<label className="aaa-demo-db-property-extra">Related database<select aria-label={"Target database for "+field.name} value={targetDatabase(field)}
            onChange={e=>void modifyField(field.id,{config:{...field.config,target_database_id:e.target.value,multi:true}})}>
            <option value="">Choose a database</option>{databases.map(db=><option key={db.id} value={db.id}>{db.name}</option>)}</select>
            <small>Records in this database appear as options when editing a relation.</small></label>}
        </div>)}
        {current.name.toLowerCase()==="events"&&<div className="aaa-demo-db-computed"><strong>Hierarchy position</strong><span>Computed · Read only</span>
          <small>Era → Event → Moment numbering follows hierarchy position. Perspectives display the path and character name. Permanent IDs do not change.</small></div>}
        {!visibleFields.length&&<p className="aaa-demo-db-blank">No properties yet. Add one to design your database.</p>}</div>
      </div>}
      {confirmDelete&&<div className="aaa-widget-dialog-backdrop"><section className="aaa-widget-dialog" role="alertdialog" aria-modal="true" aria-labelledby="database-delete-label">
        <div className="aaa-widget-dialog-icon"><Trash2/></div><h2 id="database-delete-label">Delete “{current.name}” and its records?</h2>
        <p><strong>This deletes the core database, its properties, records and linked views from every workspace.</strong> It is not the same as removing a widget. This cannot be undone.</p>
        <label>Type {current.name} to confirm<input autoFocus aria-label="Confirm database deletion" value={typedName} onChange={e=>setTypedName(e.target.value)}/></label>
        <div className="aaa-widget-dialog-actions"><button onClick={()=>setConfirmDelete(false)}>Cancel</button>
          <button className="aaa-widget-danger-button" disabled={typedName!==current.name||busy} onClick={()=>void deleteDatabase()}>Delete source and records</button></div>
      </section></div>}
    </div>:<div className="aaa-demo-db-blank"><Database size={24}/> Select a database from the left sidebar or create a new one to begin.</div>}
  </section>;
}
