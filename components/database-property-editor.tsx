"use client";
import { useEffect, useState } from "react";
import { Check, Save } from "lucide-react";
import { validateValue, type DatabaseProperty, type PropertyValues } from "@/lib/database-property-model";

export default function DatabasePropertyEditor({
  property, value, onSave,
}: {
  property: DatabaseProperty;
  value: unknown;
  onSave: (value: PropertyValues[string]) => Promise<void>;
}) {
  const format = (current: unknown) => property.type === "multi_select"
    ? Array.isArray(current) ? current as string[] : []
    : property.type === "checkbox" ? current === true
    : current === null || current === undefined ? "" : String(current);
  const [draft, setDraft] = useState<string | boolean | string[]>(() => format(value));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(format(value)); setSaved(false); setError(""); }, [property.id, property.type, value]);

  const save = async () => {
    let next: PropertyValues[string] = draft;
    if (property.type === "number") next = draft === "" ? null : Number(draft);
    if (property.type === "date" && draft === "") next = null;
    if (property.type === "select" && draft === "") next = null;
    const issue = validateValue(property, next);
    if (issue) { setError(issue); return; }
    setSaving(true); setSaved(false); setError("");
    try {
      await onSave(next);
      setSaved(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setSaving(false); }
  };

  const id = "aaa-db-value-" + property.id;
  return <div className="aaa-db-value-editor">
    <label htmlFor={id}>{property.label}</label>
    {(property.type === "text" || property.type === "number" || property.type === "date") &&
      <input id={id} type={property.type === "number" ? "number" : property.type === "date" ? "date" : "text"} value={String(draft)} onChange={(e) => { setDraft(e.target.value); setSaved(false); }} />}
    {property.type === "long_text" &&
      <textarea id={id} rows={3} value={String(draft)} onChange={(e) => {setDraft(e.target.value);setSaved(false);}} />}
    {property.type === "checkbox" &&
      <label className="aaa-db-checkbox"><input id={id} type="checkbox" checked={Boolean(draft)} onChange={(e) => {setDraft(e.target.checked);setSaved(false);}} />{draft ? "Yes" : "No"}</label>}
    {property.type === "select" &&
      <select id={id} value={String(draft)} onChange={(e) => {setDraft(e.target.value);setSaved(false);}}>
        <option value="">No selection</option>
        {(property.config.options||[]).map(o=><option key={o} value={o}>{o}</option>)}
      </select>}
    {property.type === "multi_select" &&
      <div className="aaa-db-multi-choices" id={id}>
        {(property.config.options||[]).map((option) => <label key={option}>
          <input type="checkbox" checked={Array.isArray(draft)&&draft.includes(option)}
            onChange={(e)=>{const previous=Array.isArray(draft)?draft:[];setDraft(e.target.checked?[...previous,option]:previous.filter(v=>v!==option));setSaved(false);}}/>{option}
        </label>)}
        {!(property.config.options||[]).length&&<small>Configure some options in the property manager.</small>}
      </div>}
    <div className="aaa-db-editor-actions">
      <button type="button" disabled={saving} onClick={()=>void save()}><Save size={13}/>{saving?"Saving…":"Save value"}</button>
      {saved&&<small className="aaa-db-saved"><Check size={13}/>Saved</small>}
    </div>
    {error&&<small className="aaa-db-form-error" role="alert">{error}</small>}
  </div>;
}
