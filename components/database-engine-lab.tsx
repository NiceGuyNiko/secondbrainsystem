"use client";
import { useEffect, useMemo, useState } from "react";
import {
  archiveRecord, createDatabase, createProperty, createRecord, editLab, freshLab, linkRecord,
  loadLab, renameRecord, saveLab, setValue, unlinkRecord, visibleRecords,
  type LabDatabase, type LabProperty, type LabRecord, type LabState, type LabView,
  type PropertyType, type ScalarValue,
} from "@/lib/db-engine/lab";

const propertyTypes: { id: PropertyType; label: string }[] = [
  { id: "text", label: "Text" }, { id: "long_text", label: "Long text" },
  { id: "number", label: "Number" }, { id: "checkbox", label: "Checkbox" },
  { id: "date", label: "Date" }, { id: "select", label: "Select" },
  { id: "relation", label: "Relation" },
];

function ScalarCell({ value, property, save }: {
  value: ScalarValue | undefined; property: LabProperty;
  save: (value: ScalarValue) => void;
}) {
  const [draft, setDraft] = useState(String(value ?? ""));
  useEffect(() => setDraft(String(value ?? "")), [value, property.id]);
  if (property.type === "checkbox") return (
    <input aria-label={property.name} type="checkbox" checked={value === true} onChange={e => save(e.target.checked)}/>
  );
  if (property.type === "select") return (
    <select aria-label={property.name} value={String(value ?? "")} onChange={e => save(e.target.value || null)}>
      <option value="">—</option>
      {(property.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  );
  const format = property.type === "number" ? "number" : property.type === "date" ? "date" : "text";
  const commit = () => {
    if (draft === String(value ?? "")) return;
    if (format === "number" && draft.trim() !== "" && !Number.isFinite(Number(draft))) return;
    save(draft.trim() === "" ? null : format === "number" ? Number(draft) : draft);
  };
  return <input aria-label={property.name} type={format} value={draft}
    placeholder="Empty" onChange={e => setDraft(e.target.value)} onBlur={commit}
    onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}/>;
}

function RelationCell({ lab, record, property, change }: {
  lab: LabState; record: LabRecord; property: LabProperty; change: (fn: (state: LabState) => void) => void;
}) {
  const links = lab.links.filter(l => l.sourceId === record.id && l.propertyId === property.id);
  const targets = lab.records.filter(r => !r.archivedAt && r.databaseId === property.targetDatabaseId && r.id !== record.id);
  return <div className="db-lab-relations">
    <div className="db-lab-relations-chips">
      {links.map(l => {
        const target = lab.records.find(r => r.id === l.targetId);
        return target ? <button key={l.id} type="button" title="Unlink" className="db-lab-chip"
          onClick={() => change(s => unlinkRecord(s, record.id, property.id, target.id))}>{target.title} ×</button> : null;
      })}
    </div>
    {(property.multi !== false || links.length === 0) && <select aria-label={"Link " + property.name}
      value="" onChange={e => { if (e.target.value) change(s => linkRecord(s, record.id, property.id, e.target.value)); }}>
      <option value="">+ Link a record</option>
      {targets.filter(r => !links.some(l => l.targetId === r.id)).map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
    </select>}
  </div>;
}

export default function DatabaseEngineLab() {
  const [lab, setLab] = useState<LabState | null>(null);
  const [databaseId, setDatabaseId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [newDb, setNewDb] = useState("");
  const [newRecord, setNewRecord] = useState("");
  const [newProperty, setNewProperty] = useState("");
  const [newType, setNewType] = useState<PropertyType>("text");
  const [optionsText, setOptionsText] = useState("Idea, Developing, Canon");
  const [targetDb, setTargetDb] = useState("");
  const [newView, setNewView] = useState("");
  const [viewId, setViewId] = useState("");
  const [query, setQuery] = useState("");
  const [propertyEditor, setPropertyEditor] = useState(false);
  const [newDbOpen, setNewDbOpen] = useState(false);
  const [viewEditor, setViewEditor] = useState(false);

  useEffect(() => {
    const initial = loadLab(window.localStorage);
    setLab(initial);
    setDatabaseId(initial.databases[0]?.id ?? "");
    setTargetDb(initial.databases[1]?.id ?? initial.databases[0]?.id ?? "");
  }, []);

  const db = lab?.databases.find(d => d.id === databaseId);
  const properties = useMemo(() => lab?.properties.filter(p => p.databaseId === databaseId).sort((a,b) => a.position - b.position) ?? [], [lab,databaseId]);
  const views = useMemo(() => lab?.views.filter(v => v.databaseId === databaseId) ?? [], [lab,databaseId]);
  const view = views.find(v => v.id === viewId) ?? views[0];
  const visible = properties.filter(p => !view?.visiblePropertyIds.length || view.visiblePropertyIds.includes(p.id));
  const rows = useMemo(() => lab ? visibleRecords(lab, databaseId, query, view?.sortPropertyId ?? null, view?.sortDirection === "desc") : [], [lab,databaseId,query,view?.sortPropertyId,view?.sortDirection]);
  const selected = lab?.records.find(r => r.id === selectedId && !r.archivedAt);
  const mutate = (fn: (state: LabState) => void, message = "Saved to this browser") => {
    if (!lab) return;
    try {
      const next = editLab(lab, fn);
      saveLab(next, window.localStorage);
      setLab(next); setError(""); setNotice(message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save.");
    }
  };
  const selectDatabase = (id: string) => {
    setDatabaseId(id); setSelectedId(null); setQuery(""); setViewId(""); setPropertyEditor(false);
    setTargetDb(id);
  };
  const addDatabase = () => {
    if (!lab) return;
    let nextId = "";
    mutate(s => { nextId = createDatabase(s, newDb).id; }, "Database created");
    if (nextId) { selectDatabase(nextId); setNewDb(""); setNewDbOpen(false); }
  };
  const addRecord = () => {
    if (!lab) return;
    mutate(s => createRecord(s, databaseId, newRecord), "Record created");
    setNewRecord("");
  };
  const addProperty = () => {
    if (!lab) return;
    mutate(s => createProperty(s, databaseId, newProperty, newType, {
      options: newType === "select" ? optionsText.split(",").map(s => s.trim()) : undefined,
      targetDatabaseId: newType === "relation" ? targetDb : undefined,
      multi: true,
    }), "Property created");
    // Keep the editor open so multiple fields can be added from a Notion screenshot.
    setNewProperty("");
  };
  const addView = () => {
    if (!lab) return;
    const name = newView.trim();
    if (!name || name.length > 80) { setError("View name must contain 1–80 characters."); return; }
    let id = "";
    mutate(s => {
      id = crypto.randomUUID();
      s.views.push({ id, databaseId, name, layout: "table", visiblePropertyIds: [], sortPropertyId: null, sortDirection: "asc" });
    }, "View created");
    if (id) setViewId(id);
    setNewView("");
  };
  const updateView = (patch: Partial<LabView>) => {
    if (!view) return;
    mutate(s => { const existing = s.views.find(v => v.id === view.id); if (existing) Object.assign(existing, patch); }, "View saved");
  };
  const allCharacters = lab?.databases.find(d => d.name === "Characters");
  const allEvents = lab?.databases.find(d => d.name === "Events");
  const characterRecords = lab?.records.filter(r => !r.archivedAt && r.databaseId === allCharacters?.id) ?? [];
  const eventRecords = lab?.records.filter(r => !r.archivedAt && r.databaseId === allEvents?.id) ?? [];
  const characterProps = lab?.properties.filter(p => p.databaseId === allCharacters?.id) ?? [];
  const checkpoints = [
    { title: "Characters database exists", done: Boolean(allCharacters) },
    { title: "Create at least one Character", done: characterRecords.length > 0 },
    { title: "Add a custom Character property", done: characterProps.some(p => !["Status","Summary"].includes(p.name)) },
    { title: "Save a Character property value", done: characterRecords.some(r => Object.values(r.values).some(v => v !== null)) },
    { title: "Create an Event", done: eventRecords.length > 0 },
    { title: "Connect a Character to another record", done: Boolean(lab?.links.some(l => characterRecords.some(r => r.id === l.sourceId))) },
  ];
  if (!lab || !db) return <main className="db-lab-loading">Preparing your isolated database lab…</main>;

  return <main className="db-lab">
    <header className="db-lab-header">
      <div><a href="/" className="db-lab-back">← All About Action</a><span className="db-lab-kicker">DATABASE ENGINE · ACCEPTANCE PREVIEW</span>
        <h1>Database Foundation Lab</h1><p>Build your Characters and test properties, records, and links before connecting a live backend.</p></div>
      <div className="db-lab-mode"><strong>ISOLATED DEMO DATA</strong><span>Saved in this browser only · Never sent to production Supabase</span></div>
    </header>
    <div className="db-lab-workspace">
      <aside className="db-lab-sidebar">
        <div className="db-lab-sidebar-heading"><strong>Your databases</strong><button type="button" onClick={() => setNewDbOpen(v => !v)}>+ New</button></div>
        {newDbOpen && <div className="db-lab-inline-form"><input aria-label="New database name" value={newDb} placeholder="Database name" onChange={e => setNewDb(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addDatabase();}}/><button type="button" onClick={addDatabase}>Create</button></div>}
        {lab.databases.map(d => <button type="button" key={d.id} onClick={() => selectDatabase(d.id)} className={d.id===db.id?"db-lab-nav active":"db-lab-nav"}>
          <span>{d.icon}</span><span>{d.name}</span><small>{lab.records.filter(r=>r.databaseId===d.id&&!r.archivedAt).length}</small></button>)}
        <section className="db-lab-checklist">
          <strong>Acceptance checklist</strong>
          <p>{checkpoints.filter(c=>c.done).length} of {checkpoints.length} steps ready</p>
          {checkpoints.map(c => <div className="db-lab-check" key={c.title}><span aria-hidden="true">{c.done?"✓":"○"}</span>{c.title}</div>)}
          <p>Refresh this page after saving. Your changes should still be here on the same browser.</p>
        </section>
        <button type="button" className="db-lab-reset" onClick={() => {
          if (!window.confirm("Reset only the isolated Database Lab? All its demo records will be deleted.")) return;
          const fresh = freshLab(); saveLab(fresh, window.localStorage);
          setLab(fresh); selectDatabase(fresh.databases[0].id); setNotice("Lab reset"); setError("");
        }}>Reset lab data</button>
      </aside>
      <section className="db-lab-main">
        <div className="db-lab-db-head"><div><span className="db-lab-kicker">DATABASE</span><h2>{db.icon} {db.name}</h2><p>One source of truth across Table, Gallery, and full record pages.</p></div></div>
        {error && <div role="alert" className="db-lab-error">{error}<button type="button" onClick={()=>setError("")}>Dismiss</button></div>}
        {notice && <div role="status" className="db-lab-notice">{notice}</div>}
        <div className="db-lab-toolbar">
          <label>View <select aria-label="Saved view" value={view?.id ?? ""} onChange={e=>{setViewId(e.target.value);setViewEditor(false);}}>
            {views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <button type="button" onClick={()=>setViewEditor(v=>!v)}>⚙ Views</button>
          <button type="button" onClick={()=>setPropertyEditor(v=>!v)}>+ Property</button>
          <label className="db-lab-query">Search <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filter visible records…"/></label>
        </div>
        {viewEditor && <div className="db-lab-editor">
          <strong>Saved view settings</strong>
          <div className="db-lab-form-grid">
            <label>Layout<select value={view?.layout ?? "table"} onChange={e=>updateView({layout:e.target.value as LabView["layout"]})}><option value="table">Table</option><option value="gallery">Gallery</option></select></label>
            <label>Sort by<select value={view?.sortPropertyId ?? ""} onChange={e=>updateView({sortPropertyId:e.target.value||null})}>
              <option value="">Creation order</option><option value="name">Name</option>{properties.filter(p=>p.type!=="relation").map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Order<select value={view?.sortDirection ?? "asc"} onChange={e=>updateView({sortDirection:e.target.value as "asc"|"desc"})}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
          </div>
          <strong>Visible properties</strong><div className="db-lab-visibility">{properties.map(p=><label key={p.id}><input type="checkbox" checked={!view?.visiblePropertyIds.length || view.visiblePropertyIds.includes(p.id)} onChange={e=>{
            const current=view?.visiblePropertyIds.length ? view.visiblePropertyIds : properties.map(x=>x.id);
            const next=e.target.checked?[...current,p.id]:current.filter(id=>id!==p.id);
            // All properties is represented by an empty array; ensure unselecting the last works.
            updateView({visiblePropertyIds:next});
          }}/>{p.name}</label>)}</div>
          <div className="db-lab-inline-form"><input aria-label="New saved view" value={newView} onChange={e=>setNewView(e.target.value)} placeholder="New view name"/><button type="button" onClick={addView}>Add saved view</button></div>
        </div>}
        {propertyEditor && <div className="db-lab-editor">
          <strong>Add a typed property to {db.name}</strong>
          <div className="db-lab-form-grid">
            <label>Property name<input value={newProperty} onChange={e=>setNewProperty(e.target.value)} placeholder="e.g., Affiliation"/></label>
            <label>Property type<select value={newType} onChange={e=>setNewType(e.target.value as PropertyType)}>{propertyTypes.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
            {newType === "select" && <label>Options (comma-separated)<input value={optionsText} onChange={e=>setOptionsText(e.target.value)}/></label>}
            {newType === "relation" && <label>Target database<select value={targetDb} onChange={e=>setTargetDb(e.target.value)}>{lab.databases.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
            <button type="button" onClick={addProperty}>Create property</button>
          </div>
          <p>Property IDs remain permanent when labels change. Relations store links separately from scalar values.</p>
        </div>}
        {selected && selected.databaseId === db.id ? <div className="db-lab-detail">
          <button type="button" className="db-lab-back" onClick={()=>setSelectedId(null)}>← Back to {db.name}</button>
          <span className="db-lab-kicker">RECORD · {db.name} #{selected.sequenceNo}</span>
          <label className="db-lab-detail-title">Name<input key={selected.id} defaultValue={selected.title} onBlur={e=>{if(e.target.value!==selected.title)mutate(s=>renameRecord(s,selected.id,e.target.value),"Name updated");}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></label>
          <div className="db-lab-detail-grid">{properties.map(p=><div className="db-lab-detail-field" key={p.id}>
            <label>{p.name} <small>{p.type}</small></label>
            {p.type === "relation" ? <RelationCell lab={lab} record={selected} property={p} change={mutate}/> :
              <ScalarCell property={p} value={selected.values[p.id]} save={v=>mutate(s=>setValue(s,selected.id,p.id,v))}/>}
          </div>)}</div>
          <div className="db-lab-detail-foot">Permanent record ID: <code>{selected.id}</code></div>
          <button type="button" className="db-lab-danger" onClick={()=>{
            if(window.confirm("Archive this demo record?")) {mutate(s=>archiveRecord(s,selected.id),"Record archived");setSelectedId(null);}
          }}>Archive record</button>
        </div> : <>
          <form className="db-lab-new-record" onSubmit={e=>{e.preventDefault();addRecord();}}>
            <input aria-label={"New "+db.name+" record name"} value={newRecord} onChange={e=>setNewRecord(e.target.value)} placeholder={"New "+db.name.slice(0,-1)+" name…"} required/>
            <button type="submit">+ New record</button>
          </form>
          {view?.layout === "gallery" ? <div className="db-lab-gallery">{rows.map(r=><button type="button" key={r.id} onClick={()=>setSelectedId(r.id)}>
            <small>{db.name} #{r.sequenceNo}</small><strong>{r.title}</strong>{visible.filter(p=>p.type!=="relation").slice(0,4).map(p=><span key={p.id}>{p.name}: {String(r.values[p.id]??"—")}</span>)}
          </button>)}</div> : <div className="db-lab-table-wrap"><table className="db-lab-table"><thead><tr><th>Name</th><th>ID</th>{visible.map(p=><th key={p.id}>{p.name}<small>{p.type}</small></th>)}</tr></thead>
            <tbody>{rows.map(record=><tr key={record.id}>
              <td><button type="button" className="db-lab-record-link" onClick={()=>setSelectedId(record.id)}>{record.title} ↗</button></td>
              <td className="db-lab-id">{db.name.slice(0,1).toUpperCase()}{record.sequenceNo}</td>
              {visible.map(p=><td key={p.id}>{p.type==="relation"?
                <RelationCell lab={lab} record={record} property={p} change={mutate}/>:
                <ScalarCell property={p} value={record.values[p.id]} save={v=>mutate(s=>setValue(s,record.id,p.id,v))}/>}</td>)}
            </tr>)}</tbody></table></div>}
          {rows.length===0 && <div className="db-lab-empty">No matching records yet. Create one above to start your real-world test.</div>}
        </>}
        <footer className="db-lab-footer">Acceptance preview · This browser only · No Supabase writes · No legacy data migration · Not production-ready</footer>
      </section>
    </div>
  </main>;
}
