"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import type { DatabaseProperty, PropertyValues } from "@/lib/database-property-model";
import { propertyDisplay, validateValue } from "@/lib/database-property-model";

type CellType = "text" | "long_text" | "number" | "date" | "checkbox" | "select" | "multi_select";
type Props = {
  label: string;
  type: CellType;
  value: unknown;
  options?: string[];
  property?: DatabaseProperty;
  onSave: (next: PropertyValues[string]) => Promise<void>;
  condensed?: boolean;
};

export default function InlineDatabaseCell({ label, type, value, options = [], property, onSave, condensed = false }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | string[]>(Array.isArray(value) ? value : value == null ? "" : String(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const cancelling = useRef(false);
  const current = Array.isArray(value) ? value.join(", ") : value == null ? "" : String(value);

  useEffect(() => {
    if (!editing) setDraft(Array.isArray(value) ? value : value == null ? "" : String(value));
  }, [value, editing]);

  const dismiss = () => {
    cancelling.current = true;
    setEditing(false);
    setError("");
    setDraft(Array.isArray(value) ? value : value == null ? "" : String(value));
  };
  const save = async (raw: string | string[] = draft) => {
    if (busy || cancelling.current) return;
    let next: PropertyValues[string] = raw;
    if (type === "number") next = raw === "" ? null : Number(raw);
    if (type === "date" || type === "select") next = raw === "" ? null : String(raw);
    if (type === "checkbox") next = raw === "true";
    if (property) {
      const issue = validateValue(property, next);
      if (issue) { setError(issue); return; }
    }
    if (JSON.stringify(next) === JSON.stringify(value ?? null)) {
      setEditing(false); setError(""); return;
    }
    setBusy(true); setError(""); setSaved(false);
    try {
      await onSave(next);
      setEditing(false);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const display = property ? propertyDisplay(property, value) : value == null || value === "" ? "—" : String(value);
  if (type === "checkbox") return <button type="button"
    className="aaa-db-inline-cell aaa-db-inline-check" title={"Toggle "+label}
    aria-label={label+": "+(value === true ? "Yes" : "No")}
    disabled={busy} onClick={() => { const next = value === true ? "false" : "true"; void save(next); }}>
    <input tabIndex={-1} type="checkbox" checked={value === true} readOnly aria-hidden="true" />
    <span>{value === true ? "Yes" : "No"}</span>
  </button>;

  if (!editing) return <button type="button" className={"aaa-db-inline-cell"+(condensed?" aaa-db-inline-condensed":"")}
    title={"Edit "+label} aria-label={"Edit "+label+": "+display}
    onClick={() => { cancelling.current = false; setSaved(false); setError(""); setEditing(true); }}>
    <span className={display === "—" ? "aaa-db-cell-empty" : undefined}>{display === "—" ? "Add "+label.toLowerCase() : display}</span>
    <Pencil size={12} aria-hidden="true" />
    {saved && <Check size={12} color="currentColor" aria-label="Saved" />}
  </button>;

  return <div className="aaa-db-inline-editor" onClick={(event) => event.stopPropagation()}>
    {type === "multi_select" ? (
      <div className="aaa-db-inline-multi">
        {options.map((option) => <label key={option}>
          <input type="checkbox" checked={Array.isArray(draft) && draft.includes(option)}
            onChange={(event) => setDraft((old) => {
              const prev = Array.isArray(old) ? old : [];
              return event.target.checked ? [...prev, option] : prev.filter((item) => item !== option);
            })} />
          {option}
        </label>)}
        {!options.length && <span>No options configured.</span>}
      </div>
    ) : type === "select" ? <select autoFocus aria-label={label} value={String(draft)}
      onBlur={() => { if (!busy) setEditing(false); }}
      onChange={(event) => { const v=event.target.value;setDraft(v);void save(v); }}>
      <option value="">Empty</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select> : type === "long_text" ? (
      <textarea autoFocus aria-label={label} rows={3} value={String(draft)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => { if (!cancelling.current) void save(); }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); dismiss(); }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(); } }}/>
    ) : (
      <input autoFocus aria-label={label} type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={String(draft)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => { if (!cancelling.current) void save(); }}
        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); dismiss(); }
          if (event.key === "Enter") { event.preventDefault(); void save(); } }}/>
    )}
    {(type === "multi_select" || error) && <div className="aaa-db-inline-controls">
      {type === "multi_select" && <button type="button" disabled={busy} onClick={() => void save()}>Save</button>}
      <button type="button" aria-label="Cancel editing" onMouseDown={(event) => event.preventDefault()} onClick={dismiss}><X size={13}/></button>
    </div>}
    {error && <small className="aaa-db-inline-error" role="alert">{error}</small>}
  </div>;
}
