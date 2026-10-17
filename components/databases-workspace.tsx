"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown, Database, Eye, LayoutGrid, Link2, LockKeyhole,
  Plus, Rows3, Search, SlidersHorizontal, X,
} from "lucide-react";
import { isDemo } from "./environment";
import { planningStore, recordCode, recordTitle, type PlanningRecord } from "@/lib/planning";
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

  useEffect(() => {
    setSelectedId(initialId);
    setTab("properties");
    setQuery("");
  }, [category, initialId]);

  useEffect(() => {
    let active = true;
    setError("");
    setLoaded({ records: [], thoughts: [] });
    if (isDemo || !definition.kind) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void planningStore.load().then((result) => {
      if (active) setLoaded({ records: result.records, thoughts: result.thoughts });
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Records could not be loaded.");
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
      ].some((value) => value.toLocaleLowerCase().includes(needle)))
      .sort((a, b) => a.sequence_no - b.sequence_no);
  }, [definition.kind, loaded, query]);

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
        <div className="aaa-db-phase"><LockKeyhole size={14} /> Phase 1 · Read-only preview</div>
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
          <button type="button" disabled title="Available in Phase 2"><Eye size={16} /> Properties</button>
          <button type="button" disabled title="Record creation is planned for Phase 3" className="aaa-db-create"><Plus size={17} /> New</button>
        </div>
      </div>

      <div className="aaa-db-body">
        <div className="aaa-db-results">
          <div className="aaa-db-list-heading">
            <strong>{definition.label}</strong>
            <span>{loading ? "Loading…" : rows.length + " records"}</span>
          </div>
          {layout === "table" ? (
            <div className="aaa-db-table-scroll">
              <table className="aaa-db-table">
                <thead><tr><th scope="col">Name</th><th scope="col">ID</th><th scope="col">Status</th><th scope="col">Summary</th></tr></thead>
                <tbody>{rows.map((record) => (
                  <tr key={record.thought_id} className={selectedId === record.thought_id ? "selected" : ""}>
                    <td><button type="button" className="aaa-db-record-button" onClick={() => { setSelectedId(record.thought_id); setTab("properties"); }}>{recordTitle(record, loaded.thoughts)}</button></td>
                    <td className="aaa-db-code">{recordCode(record)}</td>
                    <td><span className="aaa-db-status">{valueText(record.data.status)}</span></td>
                    <td className="aaa-db-summary">{valueText(record.data.summary)}</td>
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
              </button>
            ))}</div>
          )}
          {error && <div className="aaa-db-empty aaa-db-error" role="alert">{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="aaa-db-empty">
              <Database size={31} strokeWidth={1.5} />
              <h2>{query ? "No matching records" : !definition.kind ? "Category coming in a later phase" : isDemo ? "Safe preview — no real account data" : "No records yet"}</h2>
              <p>{query ? "Try a different search." : !definition.kind ? "This category has no canonical planning model yet. It will not create duplicate or pretend records." : isDemo ? "Vercel Preview runs in browser-only Demo Mode. The live record loader will use your existing Supabase planning records only in an authorized environment." : "When canonical records exist, they will appear here without being copied."}</p>
            </div>
          )}
          <div className="aaa-db-footer">{definition.kind ? "Canonical planning records · No writes" : "Category placeholder · No schema or records created"}</div>
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
                  {Object.entries(selected.data).filter(([key]) => key !== "summary").map(([key, value]) => (
                    <div key={key}><dt>{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}</dt><dd>{valueText(value)}</dd></div>
                  ))}
                </dl>
                <p className="aaa-db-readonly"><LockKeyhole size={14} /> Editing becomes available after the property and record phases.</p>
              </div>}
              {tab === "relations" && <div className="aaa-db-inspector-section">
                {links.length ? links.map((link) => <div className="aaa-db-linkrow" key={link.key}>
                  <span>{link.label}</span>
                  {link.record && link.category ? <button type="button" onClick={() => openRelation(link.category!, link.id)}><Link2 size={14} /> {recordTitle(link.record, loaded.thoughts)}</button> : <small>{link.record ? recordTitle(link.record, loaded.thoughts) : link.id.slice(0, 8)}</small>}
                </div>) : <p className="aaa-db-no-content">No direct relations on this record.</p>}
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
