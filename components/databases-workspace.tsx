"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ArrowUpRight, ArrowUpDown, BookOpen, Database, Eye, LayoutGrid,
  Link2, LockKeyhole, Plus, Rows3, Search, SlidersHorizontal,
} from "lucide-react";
import { isDemo } from "./environment";
import DatabasePropertyManager from "./database-property-manager";
import DatabasePropertyEditor from "./database-property-editor";
import DatabaseCompanion from "./database-companion";
import InlineDatabaseCell from "./database-inline-cell";
import HelpTip from "./database-help-tip";
import { databasePropertyStore } from "@/lib/database-property-store";
import { recordProperties, propertyDisplay, editable, type DatabaseProperty, type PropertyValues } from "@/lib/database-property-model";
import { recordCode, recordTitle, type PlanningRecord } from "@/lib/planning";
import type { Thought } from "@/lib/thoughts";
import { databaseById, type DatabaseCategory } from "@/lib/database-categories";

type Loaded = { records: PlanningRecord[]; thoughts: Thought[] };
const statuses = ["idea", "developing", "canon", "superseded"];
function valueText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  return "Structured value";
}

export default function DatabasesWorkspace({
  category, initialId, onOpenRecord, onOpenDocument,
}: {
  category: DatabaseCategory;
  initialId: string | null;
  onOpenRecord: (category: DatabaseCategory, id: string) => void;
  onOpenDocument?: (id: string) => void;
}) {
  const definition = databaseById(category);
  const [loaded, setLoaded] = useState<Loaded>({ records: [], thoughts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"table" | "gallery">("table");
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [pageId, setPageId] = useState<string | null>(initialId);
  const [properties, setProperties] = useState<DatabaseProperty[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionDocked, setCompanionDocked] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth > 1190) setCompanionOpen(true);
  }, []);

  useEffect(() => {
    setSelectedId(initialId);
    setPageId(initialId);
    setManagerOpen(false);
    setQuery("");
  }, [category, initialId]);

  useEffect(() => {
    let active = true;
    setError("");
    setLoaded({ records: [], thoughts: [] });
    setProperties([]);
    if (!definition.kind) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void Promise.all([databasePropertyStore.loadRecords(), databasePropertyStore.load(category)]).then(([result, defs]) => {
      if (active) { setLoaded(result); setProperties(defs); }
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Records or properties could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [category, definition.kind]);

  const rows = useMemo(() => {
    if (!definition.kind) return [];
    const needle = query.trim().toLocaleLowerCase();
    return loaded.records
      .filter((record) => record.kind === definition.kind)
      .filter((record) => !needle || [
        recordTitle(record, loaded.thoughts), recordCode(record),
        valueText(record.data.summary), valueText(record.data.status),
        ...Object.values(recordProperties(record)).map(valueText),
      ].some((value) => value.toLocaleLowerCase().includes(needle)))
      .sort((a,b)=>a.sequence_no-b.sequence_no);
  }, [definition.kind, loaded, query]);

  const columns=properties.filter(p=>p.visible&&!p.archived_at);
  const selected=loaded.records.find(r=>r.thought_id===selectedId&&r.kind===definition.kind) || null;
  const page=loaded.records.find(r=>r.thought_id===pageId&&r.kind===definition.kind) || null;
  const pageThought=loaded.thoughts.find(t=>t.id===page?.thought_id);

  const replaceRecord=(saved:PlanningRecord)=>{
    setLoaded(state=>({...state,records:state.records.map(r=>r.thought_id===saved.thought_id?saved:r)}));
    setNotice("Saved");
  };
  const saveField=async(record:PlanningRecord,field:"summary"|"status",value:string)=>{
    const saved=await databasePropertyStore.saveBuiltin(record,field,value);
    replaceRecord(saved);
  };
  const saveValue=async(record:PlanningRecord,property:DatabaseProperty,value:PropertyValues[string])=>{
    const saved=await databasePropertyStore.saveValue(record,property,value);
    replaceRecord(saved);
  };
  const rename=async(record:PlanningRecord,value:string)=>{
    const thought=loaded.thoughts.find(t=>t.id===record.thought_id);
    if(!thought)throw new Error("The source page could not be found.");
    const updated=await databasePropertyStore.renameRecord(record,thought,value);
    setLoaded(state=>({...state,thoughts:state.thoughts.map(t=>t.id===updated.id?updated:t)}));
    setNotice("Name saved");
  };
  const openPage=(id:string)=>{
    setSelectedId(id);setPageId(id);setNotice("");
  };
  const selectRow=(id:string)=>{setSelectedId(id);};
  const navigate=(target:DatabaseCategory,id:string)=>{
    if(target===category)openPage(id);else onOpenRecord(target,id);
  };
  const active=selected || page;

  return <section className="aaa-db" aria-label="Databases workspace">
    <div className="aaa-db-heading">
      <div className="aaa-db-heading-copy">
        <div className="aaa-db-eyebrow"><Database size={14}/> YOUR KNOWLEDGE SYSTEM <span> / </span> {definition.label}</div>
        <h1>{definition.label}</h1>
        <p>{definition.description}</p>
      </div>
      <div className="aaa-db-phase"><LockKeyhole size={14}/> Phase 2 · Inline editing + Companion {isDemo?"· Demo":""}{isDemo && <Link href="/database-lab" style={{marginLeft:12,color:"var(--accent-text)"}}>Open Engine Lab ↗</Link>}</div>
    </div>

    {page && <div className="aaa-db-record-navigation">
      <button type="button" onClick={()=>setPageId(null)}><ArrowLeft size={15}/> Back to {definition.label}</button>
      <span>{recordCode(page)} · Canonical page</span>
    </div>}

    {!page && <div className="aaa-db-commandbar">
      <div className="aaa-db-view-switch" aria-label="Record layout">
        <button type="button" className={layout==="table"?"active":""} aria-pressed={layout==="table"} onClick={()=>setLayout("table")}><Rows3 size={16}/> Table</button>
        <button type="button" className={layout==="gallery"?"active":""} aria-pressed={layout==="gallery"} onClick={()=>setLayout("gallery")}><LayoutGrid size={16}/> Gallery</button>
      </div>
      <label className="aaa-db-search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records" aria-label={"Search "+definition.label}/></label>
      <div className="aaa-db-actions">
        <button type="button" disabled title="Available in Phase 4"><SlidersHorizontal size={16}/> Filter</button>
        <button type="button" disabled title="Available in Phase 4"><ArrowUpDown size={16}/> Sort</button>
        <button type="button" disabled={!definition.kind||loading} onClick={()=>setManagerOpen(v=>!v)} aria-expanded={managerOpen}><Eye size={16}/> Properties</button>
        <button type="button" disabled title="Record creation comes in Phase 3" className="aaa-db-create"><Plus size={17}/> New</button>
      </div>
    </div>}

    {managerOpen && definition.kind && <DatabasePropertyManager category={category} definitions={properties}
      onChange={setProperties} onClose={()=>setManagerOpen(false)}/>}

    {notice&&<div className="aaa-db-save-notice" role="status">{notice}</div>}
    {error&&<div className="aaa-db-empty aaa-db-error" role="alert">{error}</div>}

    <div className={"aaa-db-body aaa-db-body-companion "+(!companionOpen||!companionDocked?"aaa-db-companion-closed":"")}>
      {page ? <article className="aaa-db-record-page">
        <div className="aaa-db-record-heading">
          <span className="aaa-db-code">{recordCode(page)}</span>
          <div className="aaa-db-record-name">
            {page.kind==="perspective" ? <h2>{recordTitle(page,loaded.thoughts)}</h2> :
              <InlineDatabaseCell label="Name" type="text" value={recordTitle(page,loaded.thoughts)}
                onSave={async(v)=>rename(page,String(v??""))}/>}
          </div>
          <p>Full database record · Changes sync with the table and The Companion.</p>
        </div>
        <div className="aaa-db-record-fields">
          <h3>Essential properties</h3>
          <div className="aaa-db-record-field"><strong>Status</strong><InlineDatabaseCell label="Status" type="select" options={statuses}
            value={page.data.status??"idea"} onSave={async(v)=>saveField(page,"status",String(v??"idea"))}/></div>
          <div className="aaa-db-record-field"><strong>Summary</strong><InlineDatabaseCell label="Summary" type="long_text"
            value={page.data.summary??""} onSave={async(v)=>saveField(page,"summary",String(v??""))}/></div>
          <h3>Custom properties</h3>
          {!properties.length&&<p className="aaa-db-no-content">Use Properties to create a field, then edit its value directly here or in the table.</p>}
          {properties.filter(p=>!p.archived_at).map(p=>editable(p)
            ? <DatabasePropertyEditor key={page.thought_id+":"+p.id} property={p}
                value={recordProperties(page)[p.id]} onSave={v=>saveValue(page,p,v)}/>
            : <div key={p.id} className="aaa-db-pending-property"><strong>{p.label}</strong><small>{p.type==="relation"?"Linked pages available in Phase 3":"Calculated Rollups available in Phases 3–4"}</small></div>)}
          <h3>Additional planning data</h3>
          <dl className="aaa-db-extra-fields">
            {Object.entries(page.data).filter(([key])=>!["summary","status","databaseProperties"].includes(key)).map(([key,value])=>
              <div key={key}><dt>{key}</dt><dd>{valueText(value)}</dd></div>)}
          </dl>
          <h3>Page notes</h3>
          {pageThought?.content.blocks?.filter(b=>b.text.trim()).map(b=><p className="aaa-db-note" key={b.id}>{b.text}</p>)}
          {!pageThought?.content.blocks?.some(b=>b.text.trim())&&<p className="aaa-db-no-content">This page has no notes yet.</p>}
          {onOpenDocument&&!isDemo&&<button type="button" className="aaa-db-open-document" onClick={()=>onOpenDocument(page.thought_id)}>
            <BookOpen size={15}/> Open page in Think About It / Resources <ArrowUpRight size={14}/>
          </button>}
        </div>
      </article> : <div className="aaa-db-results">
        <div className="aaa-db-list-heading"><strong>{definition.label}</strong>
          <span>{loading?"Loading…":rows.length+" records"} <HelpTip subject="Editable database cells">Click a Name to open its page. Click a Summary, Status or custom value to edit it here. Changes save back to the same record.</HelpTip></span>
        </div>
        {layout==="table" ? <div className="aaa-db-table-scroll"><table className="aaa-db-table">
          <thead><tr><th scope="col">Name</th><th scope="col">ID</th><th scope="col">Status</th><th scope="col">Summary</th>
            {columns.map(p=><th key={p.id} scope="col">{p.label}</th>)}</tr></thead>
          <tbody>{rows.map(record=><tr key={record.thought_id} className={selectedId===record.thought_id?"selected":""}>
            <td><button type="button" className="aaa-db-record-button" onClick={()=>openPage(record.thought_id)}>
              {recordTitle(record,loaded.thoughts)} <ArrowUpRight size={13}/>
            </button></td>
            <td className="aaa-db-code"><button type="button" onClick={()=>selectRow(record.thought_id)}>{recordCode(record)}</button></td>
            <td onClick={()=>selectRow(record.thought_id)}><InlineDatabaseCell label="Status" type="select" options={statuses}
              value={record.data.status??"idea"} onSave={v=>saveField(record,"status",String(v??"idea"))}/></td>
            <td onClick={()=>selectRow(record.thought_id)}><InlineDatabaseCell label="Summary" type="long_text" condensed
              value={record.data.summary??""} onSave={v=>saveField(record,"summary",String(v??""))}/></td>
            {columns.map(p=><td key={p.id} onClick={()=>selectRow(record.thought_id)} className="aaa-db-summary">
              {editable(p) ? <InlineDatabaseCell label={p.label} type={p.type as Exclude<DatabaseProperty["type"],"relation"|"rollup">} property={p}
                options={p.config.options||[]} value={recordProperties(record)[p.id]}
                onSave={v=>saveValue(record,p,v)}/>
                : <button className="aaa-db-cell-pending" type="button" onClick={()=>{selectRow(record.thought_id);setCompanionOpen(true)}}>
                  {p.type==="relation"?"Open Connections · Phase 3":"Rollup · Phase 3–4"}
                </button>}
            </td>)}
          </tr>)}</tbody>
        </table></div> : <div className="aaa-db-gallery">
          {rows.map(record=><button type="button" className="aaa-db-gallery-card" key={record.thought_id} onClick={()=>openPage(record.thought_id)}>
            <span className="aaa-db-code">{recordCode(record)}</span>
            <strong>{recordTitle(record,loaded.thoughts)} <ArrowUpRight size={13}/></strong>
            <small>{valueText(record.data.summary)}</small>
            {columns.slice(0,2).map(p=><small key={p.id}>{p.label}: {propertyDisplay(p,recordProperties(record)[p.id])}</small>)}
          </button>)}
        </div>}
        {!loading&&!error&&!rows.length&&<div className="aaa-db-empty">
          <Database size={30}/><h2>{query?"No matching records":!definition.kind?"Category coming in a later phase":"No records yet"}</h2>
          <p>{query?"Try a different search.":!definition.kind?"This category does not have canonical storage yet.":"Records appear here when they exist in the canonical database."}</p>
        </div>}
        <div className="aaa-db-footer">{definition.kind
          ? isDemo?"Fictional browser-only demo data · Click cells to edit · No production connection":"Same canonical records · Inline editing"
          :"Category placeholder · No records created"}</div>
      </div>}

      <DatabaseCompanion record={active} thoughts={loaded.thoughts} records={loaded.records} definitions={properties}
        open={companionOpen} docked={companionDocked} onOpen={()=>setCompanionOpen(true)}
        onClose={()=>setCompanionOpen(false)} onDocked={setCompanionDocked}
        onFullPage={()=>{if(active)openPage(active.thought_id)}}
        onSaveField={async(field,value)=>{if(active)await saveField(active,field,value)}}
        onSaveValue={async(prop,value)=>{if(active)await saveValue(active,prop,value)}}
        onNavigate={navigate}/>
    </div>
  </section>;
}
