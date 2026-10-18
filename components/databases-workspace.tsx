"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown, Database, Eye, LayoutGrid, Link2, LockKeyhole,
  Plus, Rows3, Search, SlidersHorizontal, X,
} from "lucide-react";
import { isDemo } from "./environment";
import DatabasePropertyManager from "./database-property-manager";
import DatabasePropertyEditor from "./database-property-editor";
import { databasePropertyStore } from "@/lib/database-property-store";
import { recordProperties, propertyDisplay, editable, type DatabaseProperty } from "@/lib/database-property-model";
import { recordCode, recordTitle, type PlanningRecord } from "@/lib/planning";
import type { Thought } from "@/lib/thoughts";
import {
  databaseById, categoryForKind, type DatabaseCategory,
} from "@/lib/database-categories";

type Loaded = { records: PlanningRecord[]; thoughts: Thought[] };
type InspectorTab = "properties" | "relations" | "notes";
const relationFields = [
  ["workspace_id", "Workspace"], ["event_id", "Event"], ["character_id", "Character"],
  ["project_id", "Project"], ["goal_id", "Goal"], ["working_id", "Working page"],
] as const;

function valueText(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  return "Structured value";
}

export default function DatabasesWorkspace({
  category, initialId, onOpenRecord,
}: {
  category: DatabaseCategory;
  initialId: string | null;
  onOpenRecord: (category: DatabaseCategory, id: string) => void;
}) {
  const definition = databaseById(category);
  const [loaded, setLoaded] = useState<Loaded>({ records: [], thoughts: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"table" | "gallery">("table");
  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const [tab, setTab] = useState<InspectorTab>("properties");
  const [properties, setProperties] = useState<DatabaseProperty[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    setSelectedId(initialId);
    setTab("properties");
    setQuery("");
    setManagerOpen(false);
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
      .sort((a, b) => a.sequence_no - b.sequence_no);
  }, [definition.kind, loaded, query]);
  const columns = properties.filter((property) => property.visible && !property.archived_at);

  const selected = loaded.records.find((record) => record.thought_id === selectedId && record.kind === definition.kind);
  const thought = loaded.thoughts.find((item) => item.id === selected?.thought_id);
  const links = selected ? relationFields
    .map(([key, label]) => {
      const id = selected[key];
      if (!id) return null;
      const record = loaded.records.find((candidate) => candidate.thought_id === id);
      return { key, label, id, record, category: record ? categoryForKind(record.kind) : null };
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null) : [];

  const openRelation = (target: DatabaseCategory, id: string) => {
    if (target === category) {
      setSelectedId(id);
      setTab("properties");
    } else {
      onOpenRecord(target, id);
    }
  };
  const noteBlocks = thought?.content.blocks?.filter((block) => block.text.trim()) || [];

  return (
    <section className="aaa-db" aria-label="Databases workspace">
      <div className="aaa-db-heading">
        <div className="aaa-db-heading-copy">
          <div className="aaa-db-eyebrow"><Database size={14} /> YOUR KNOWLEDGE SYSTEM <span> / </span> {definition.label}</div>
          <h1>{definition.label}</h1>
          <p>{definition.description}</p>
        </div>
        <div className="aaa-db-phase"><LockKeyhole size={14} /> Phase 2 · Custom properties {isDemo ? "· Demo data" : ""}</div>
      </div>

      <div className="aaa-db-commandbar">
        <div className="aaa-db-view-switch" aria-label="Record layout">
          <button type="button" className={layout === "table" ? "active" : ""} aria-pressed={layout === "table"} onClick={() => setLayout("table")}><Rows3 size={16} /> Table</button>
          <button type="button" className={layout === "gallery" ? "active" : ""} aria-pressed={layout === "gallery"} onClick={() => setLayout("gallery")}><LayoutGrid size={16} /> Gallery</button>
        </div>
        <label className="aaa-db-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" aria-label={"Search " + definition.label} /></label>
        <div className="aaa-db-actions">
          <button type="button" disabled title="Available in Phase 4"><SlidersHorizontal size={16} /> Filter</button>
          <button type="button" disabled title="Available in Phase 4"><ArrowUpDown size={16} /> Sort</button>
          <button type="button" disabled={!definition.kind || loading} onClick={() => setManagerOpen((open) => !open)} aria-expanded={managerOpen}><Eye size={16} /> Properties</button>
          <button type="button" disabled title="Record creation is planned for Phase 3" className="aaa-db-create"><Plus size={17} /> New</button>
        </div>
      </div>

      {managerOpen && definition.kind && <DatabasePropertyManager category={category} definitions={properties} onChange={setProperties} onClose={() => setManagerOpen(false)}/>}
      <div className="aaa-db-body">
        <div className="aaa-db-results">
          <div className="aaa-db-list-heading">
            <strong>{definition.label}</strong>
            <span>{loading ? "Loading…" : rows.length + " records"}</span>
          </div>
          {layout === "table" ? (
            <div className="aaa-db-table-scroll">
              <table className="aaa-db-table">
                <thead><tr><th scope="col">Name</th><th scope="col">ID</th><th scope="col">Status</th><th scope="col">Summary</th>{columns.map((property)=><th key={property.id} scope="col">{property.label}</th>)}</tr></thead>
                <tbody>{rows.map((record) => (
                  <tr key={record.thought_id} className={selectedId === record.thought_id ? "selected" : ""}>
                    <td><button type="button" className="aaa-db-record-button" onClick={() => { setSelectedId(record.thought_id); setTab("properties"); }}>{recordTitle(record, loaded.thoughts)}</button></td>
                    <td className="aaa-db-code">{recordCode(record)}</td>
                    <td><span className="aaa-db-status">{valueText(record.data.status)}</span></td>
                    <td className="aaa-db-summary">{valueText(record.data.summary)}</td>
                    {columns.map((property)=><td key={property.id} className="aaa-db-summary">{property.type==="relation"?"Linked pages · Phase 3":property.type==="rollup"?"Computed · Phase 3–4":propertyDisplay(property,recordProperties(record)[property.id])}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div className="aaa-db-gallery">{rows.map((record) => (
              <button type="button" className="aaa-db-gallery-card" key={record.thought_id} onClick={() => { setSelectedId(record.thought_id); setTab("properties"); }}>
                <span className="aaa-db-code">{recordCode(record)}</span>
                <strong>{recordTitle(record, loaded.thoughts)}</strong>
                <small>{valueText(record.data.summary)}</small>
                {columns.slice(0,2).map((property)=><small key={property.id}>{property.label}: {propertyDisplay(property, recordProperties(record)[property.id])}</small>)}
              </button>
            ))}</div>
          )}
          {error && <div className="aaa-db-empty aaa-db-error" role="alert">{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="aaa-db-empty">
              <Database size={31} strokeWidth={1.5} />
              <h2>{query ? "No matching records" : !definition.kind ? "Category coming in a later phase" : "No records yet"}</h2>
              <p>{query ? "Try a different search." : !definition.kind ? "This category has no canonical planning model yet. It will not create duplicate or pretend records." : "When canonical records exist, they will appear here without being copied."}</p>
            </div>
          )}
          <div className="aaa-db-footer">{definition.kind ? (isDemo ? "Fictional browser-only demo records · No production connection" : "Canonical planning records · Custom properties stored on the source record") : "Category placeholder · No schema or records created"}</div>
        </div>

        <aside className="aaa-db-inspector" aria-label="Record inspector">
          {selected ? (
            <>
              <div className="aaa-db-inspector-top"><span>RECORD INSPECTOR</span><button type="button" aria-label="Close inspector" onClick={() => setSelectedId(null)}><X size={17} /></button></div>
              <div className="aaa-db-inspector-title"><div className="aaa-db-code">{recordCode(selected)}</div><h2>{recordTitle(selected, loaded.thoughts)}</h2><small>Canonical ID: {selected.thought_id}</small></div>
              <div className="aaa-db-inspector-tabs">
                {(["properties", "relations", "notes"] as const).map((name) => <button type="button" key={name} aria-pressed={tab === name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name === "relations" && <Link2 size={14} />}{name[0].toUpperCase() + name.slice(1)}</button>)}
              </div>
              {tab === "properties" && <div className="aaa-db-inspector-section">
                <dl>
                  <div><dt>Record type</dt><dd>{selected.kind}</dd></div>
                  <div><dt>Stable ID</dt><dd>{recordCode(selected)}</dd></div>
                  {Object.entries(selected.data).filter(([key]) => key !== "summary" && key !== "databaseProperties").map(([key, value]) => (
                    <div key={key}><dt>{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</dt><dd>{valueText(value)}</dd></div>
                  ))}
                </dl>
                {properties.filter((property)=>!property.archived_at).map((property)=>editable(property)
                  ? <DatabasePropertyEditor key={property.id} property={property} value={recordProperties(selected)[property.id]} onSave={async(value)=>{
                      const updated=await databasePropertyStore.saveValue(selected,property,value);
                      setLoaded((state)=>({...state,records:state.records.map((row)=>row.thought_id===updated.thought_id?updated:row)}));
                    }}/>
                  : property.type==="rollup" ? <div className="aaa-db-pending-property" key={property.id}><strong>{property.label}</strong><small>Rollup blueprint saved · Evaluation begins in Phases 3–4</small></div> : null)}
                <p className="aaa-db-readonly"><LockKeyhole size={14} /> Built-in planning fields remain protected; custom scalar properties are editable.</p>
              </div>}
              {tab === "relations" && <div className="aaa-db-inspector-section">
                {properties.filter((p)=>p.type==="relation").map((property)=><div className="aaa-db-linkrow" key={property.id}>
                  <span>{property.label}</span>
                  <small>Allowed: {(property.config.target_databases||[]).map(id=>databaseById(id).label).join(", ") || "Not configured"} · {property.config.cardinality==="one"?"Single":"Multiple"}</small>
                  <small className="aaa-db-relation-pending">No linked pages · Page picker in Phase 3</small>
                </div>)}
                {links.length ? links.map((link) => <div className="aaa-db-linkrow" key={link.key}>
                  <span>{link.label}</span>
                  {link.record && link.category ? <button type="button" onClick={() => openRelation(link.category!, link.id)}><Link2 size={14} /> {recordTitle(link.record, loaded.thoughts)}</button> : <small>{link.record ? recordTitle(link.record, loaded.thoughts) : link.id.slice(0, 8)}</small>}
                </div>) : properties.some((property)=>property.type==="relation") ? null : <p className="aaa-db-no-content">No direct relations on this record.</p>}
              </div>}
              {tab === "notes" && <div className="aaa-db-inspector-section">
                {selected.data.summary && <p className="aaa-db-note">{valueText(selected.data.summary)}</p>}
                {noteBlocks.map((block) => <p className="aaa-db-note" key={block.id}>{block.text}</p>)}
                {!selected.data.summary && noteBlocks.length === 0 && <p className="aaa-db-no-content">No notes on this record yet.</p>}
              </div>}
            </>
          ) : (
            <div className="aaa-db-inspector-placeholder"><Link2 size={26} /><h2>Record details</h2><p>Choose a record to see its properties, relationships and notes.</p></div>
          )}
        </aside>
      </div>
    </section>
  );
}
