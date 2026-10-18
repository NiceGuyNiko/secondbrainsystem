"use client";
import { useEffect, useState } from "react";
import { Archive, ArrowDown, ArrowUp, Eye, EyeOff, LockKeyhole, Plus, Save, X } from "lucide-react";
import { DATABASE_CATEGORIES, type DatabaseCategory } from "@/lib/database-categories";
import {
  PROPERTY_TYPES, builtinProperties, type DatabaseProperty,
  type PropertyConfig, type PropertyType,
} from "@/lib/database-property-model";
import { databasePropertyStore, type PropertyDraft } from "@/lib/database-property-store";

const defaultDraft = (): PropertyDraft => ({ label: "", type: "text", visible: true, config: {} });
const choices = (p: PropertyDraft) => (p.config.options || []).join("\n");

export default function DatabasePropertyManager({
  category, definitions, onChange, onClose,
}: {
  category: DatabaseCategory;
  definitions: DatabaseProperty[];
  onChange: (properties: DatabaseProperty[]) => void;
  onClose: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PropertyDraft>(defaultDraft);
  const [optionText, setOptionText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = definitions.find((p) => p.id === activeId);

  useEffect(() => {
    setActiveId(null); setDraft(defaultDraft()); setOptionText(""); setError("");
  }, [category]);

  const select = (prop: DatabaseProperty | null) => {
    setActiveId(prop?.id ?? null);
    const value: PropertyDraft = prop ? { label: prop.label, type: prop.type, config: structuredClone(prop.config), visible: prop.visible } : defaultDraft();
    setDraft(value);
    setOptionText(choices(value));
    setError("");
  };
  const patch = (changes: Partial<PropertyDraft>) => setDraft((old) => ({ ...old, ...changes }));
  const config = (changes: Partial<PropertyConfig>) => patch({ config: { ...draft.config, ...changes } });
  const save = async () => {
    setBusy(true); setError("");
    try {
      const normalized: PropertyDraft = {
        ...draft,
        config: draft.type === "select" || draft.type === "multi_select"
          ? { options: optionText.split("\n").map((o) => o.trim()).filter(Boolean) }
          : draft.config,
      };
      const result = active
        ? await databasePropertyStore.update(active,normalized,definitions)
        : await databasePropertyStore.create(category,normalized,definitions);
      onChange(active ? definitions.map((p) => p.id === result.id ? result : p) : [...definitions,result]);
      select(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(false); }
  };
  const update = async (item: DatabaseProperty, patch: Partial<DatabaseProperty>) => {
    setBusy(true); setError("");
    try {
      const result = await databasePropertyStore.update(item,patch,definitions);
      onChange(definitions.map(p=>p.id===result.id ? result : p).filter(p=>!p.archived_at));
      if (result.archived_at) select(null);
      else if (result.id === activeId) select(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const ordered = [...definitions].sort((a,b)=>a.position-b.position);
  const move = (item: DatabaseProperty, direction: "up"|"down") => {
    const index=ordered.findIndex((p)=>p.id===item.id);
    if ((direction==="up" && index<=0) || (direction==="down" && index>=ordered.length-1)) return;
    const position=direction==="up"
      ? index===1 ? ordered[0].position-1 : (ordered[index-2].position+ordered[index-1].position)/2
      : index===ordered.length-2 ? ordered[index+1].position+1 : (ordered[index+1].position+ordered[index+2].position)/2;
    void update(item,{position});
  };
  const relationProperties = definitions.filter((p) => p.type === "relation");

  return (
    <section className="aaa-db-property-manager" aria-label="Manage database properties">
      <header className="aaa-db-property-header">
        <div><span>DATABASE SCHEMA</span><h2>Manage {category} properties</h2><p>Properties are specific to this database. Names may change; IDs remain permanent.</p></div>
        <button type="button" onClick={onClose} aria-label="Close property manager"><X size={19}/></button>
      </header>
      <div className="aaa-db-property-grid">
        <div className="aaa-db-property-list">
          <strong>Built-in properties</strong>
          {builtinProperties.map((prop)=>(
            <div className="aaa-db-property-item" key={prop.id}>
              <span>{prop.label}<small>{prop.type.replace("_"," ")}</small></span><LockKeyhole size={14} aria-label="Protected"/>
            </div>
          ))}
          <strong>Custom properties <small>({ordered.length})</small></strong>
          {ordered.map((prop,index)=>(
            <div className={"aaa-db-property-item "+(prop.id===activeId?"selected":"")} key={prop.id}>
              <button className="aaa-db-property-pick" type="button" onClick={()=>select(prop)}>
                <span>{prop.label}<small>{prop.type.replace("_"," ")}</small></span>
              </button>
              <button type="button" disabled={busy} title={prop.visible?"Hide column":"Show column"} aria-label={(prop.visible?"Hide ":"Show ")+prop.label} onClick={()=>void update(prop,{visible:!prop.visible})}>{prop.visible?<Eye size={15}/>:<EyeOff size={15}/>}</button>
              <button type="button" disabled={busy||index===0} title="Move up" aria-label={"Move "+prop.label+" up"} onClick={()=>move(prop,"up")}><ArrowUp size={14}/></button>
              <button type="button" disabled={busy||index===ordered.length-1} title="Move down" aria-label={"Move "+prop.label+" down"} onClick={()=>move(prop,"down")}><ArrowDown size={14}/></button>
            </div>
          ))}
          {!ordered.length && <p className="aaa-db-no-content">No custom properties in this database yet.</p>}
          <button className="aaa-db-add-property" type="button" onClick={()=>select(null)}><Plus size={16}/> New custom property</button>
        </div>
        <div className="aaa-db-property-edit">
          <h3>{active?"Edit property":"Create property"}</h3>
          <label>Property name<input autoFocus={false} value={draft.label} maxLength={80} placeholder="e.g. Narrative Importance" onChange={(e)=>patch({label:e.target.value})}/></label>
          <label>Type
            <select value={draft.type} onChange={(e)=>{const type=e.target.value as PropertyType;patch({type,config:type==="relation"?{target_databases:["Characters"],cardinality:"many"}:type==="rollup"?{relation_path:[],target_property_id:"name",calculation:"show_original",filters:[]}:type==="select"||type==="multi_select"?{options:[]}: {}});setOptionText("");}}>
              {PROPERTY_TYPES.map((type)=><option key={type.id} value={type.id}>{type.label}{type.phase!=="2"?" · configure now, enable later":""}</option>)}
            </select>
          </label>
          {(draft.type==="select"||draft.type==="multi_select")&&<label>Options (one per line)<textarea rows={5} value={optionText} onChange={(e)=>setOptionText(e.target.value)} placeholder={"High\nMedium\nLow"}/></label>}
          {draft.type==="relation"&&<div className="aaa-db-property-extra">
            <strong>Allowed destination databases</strong>
            <div className="aaa-db-targets">
              {DATABASE_CATEGORIES.map((category)=><label key={category.id}><input type="checkbox" checked={(draft.config.target_databases||[]).includes(category.id)} onChange={(e)=>{
                const old=draft.config.target_databases||[];
                config({target_databases:e.target.checked?[...old,category.id]:old.filter(x=>x!==category.id)});
              }}/>{category.label}</label>)}
            </div>
            <label>Cardinality<select value={draft.config.cardinality||"many"} onChange={(e)=>config({cardinality:e.target.value as "one"|"many"})}><option value="one">Single page</option><option value="many">Multiple pages</option></select></label>
            <label>Reciprocal label (optional)<input value={draft.config.inverse_label||""} onChange={(e)=>config({inverse_label:e.target.value})} placeholder="Appears In"/></label>
            <p>Links will display the target page Name. Selecting and storing canonical links is activated in Phase 3.</p>
          </div>}
          {draft.type==="rollup"&&<div className="aaa-db-property-extra">
            <strong>Rollup blueprint</strong>
            <label>First relation in path
              <select value={draft.config.relation_path?.[0]||""} onChange={(e)=>config({relation_path:e.target.value?[e.target.value]:[]})}>
                <option value="">Choose a relation (can be configured later)</option>
                {relationProperties.filter((p)=>p.id!==activeId).map((p)=><option value={p.id} key={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label>Target property ID<input value={draft.config.target_property_id||"name"} onChange={(e)=>config({target_property_id:e.target.value})}/></label>
            <label>Calculation<select value={draft.config.calculation||"show_original"} onChange={(e)=>config({calculation:e.target.value as PropertyConfig["calculation"]})}>
              {(["show_original","count_records","count_nonempty","count_unique","sum","average","min","max","earliest","latest"] as const).map((v)=><option key={v} value={v}>{v.replace(/_/g," ")}</option>)}
            </select></label>
            <p>Multi-hop paths, typed filtered Rollups and live calculations are implemented in Phases 3–4. This phase saves the blueprint only.</p>
          </div>}
          <label className="aaa-db-checkbox"><input type="checkbox" checked={draft.visible} onChange={(e)=>patch({visible:e.target.checked})}/> Show as a table column</label>
          {error&&<p className="aaa-db-form-error" role="alert">{error}</p>}
          <div className="aaa-db-form-actions">
            <button type="button" className="aaa-db-save" disabled={busy} onClick={()=>void save()}><Save size={15}/>{busy?"Saving…":active?"Save changes":"Create property"}</button>
            {active&&<button type="button" disabled={busy} className="aaa-db-archive" onClick={()=>{if(window.confirm("Archive '"+active.label+"'? Existing values are retained and the column will be hidden."))void update(active,{archived_at:new Date().toISOString()});}}><Archive size={15}/> Archive</button>}
          </div>
        </div>
      </div>
    </section>
  );
}
