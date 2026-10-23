import type { DatabaseCategory } from "./database-categories";
import type { PlanningRecord } from "./planning";
import {formatDatabasePropertyValue} from "./db-property-format";

export type PropertyType =
  | "text" | "long_text" | "number" | "date" | "checkbox"
  | "select" | "multi_select" | "relation" | "rollup";

export type PropertyConfig = {
  options?: string[];
  target_databases?: DatabaseCategory[];
  cardinality?: "one" | "many";
  inverse_label?: string;
  relation_path?: string[];
  target_property_id?: string;
  calculation?: "show_original" | "count_records" | "count_nonempty" | "count_unique" | "sum" | "average" | "min" | "max" | "earliest" | "latest";
  filters?: unknown[];
  numberFormat?:"number"|"percent"|"bar"|"currency";
  decimalPlaces?:number;
  currencyCode?:string;
  dateFormat?:"iso"|"short"|"long";
  checkboxFormat?:"yes-no"|"done"|"icon";
};

export type DatabaseProperty = {
  id: string;
  database_key: DatabaseCategory;
  label: string;
  type: PropertyType;
  config: PropertyConfig;
  position: number;
  visible: boolean;
  is_system: boolean;
  archived_at: string | null;
  version: number;
};

export type PropertyValues = Record<string, string | number | boolean | string[] | null>;

export const PROPERTY_TYPES: { id: PropertyType; label: string; phase: string }[] = [
  { id: "text", label: "Text", phase: "2" },
  { id: "long_text", label: "Long text", phase: "2" },
  { id: "number", label: "Number", phase: "2" },
  { id: "date", label: "Date", phase: "2" },
  { id: "checkbox", label: "Checkbox", phase: "2" },
  { id: "select", label: "Select", phase: "2" },
  { id: "multi_select", label: "Multi-select", phase: "2" },
  { id: "relation", label: "Relation", phase: "3 (definition in 2)" },
  { id: "rollup", label: "Rollup", phase: "3–4 (definition in 2)" },
];

export const editable = (p: DatabaseProperty) =>
  !p.is_system && !p.archived_at && p.type !== "relation" && p.type !== "rollup";

const RESERVED = new Set(["name", "id", "record id", "status", "summary"]);
const MAX_OPTIONS = 60;
export function validateDefinition(
  item: Pick<DatabaseProperty, "label" | "type" | "config">,
  existing: DatabaseProperty[],
  exceptId?: string,
): string {
  const label = item.label.trim();
  if (!label || label.length > 80) return "Give the property a name between 1 and 80 characters.";
  if (RESERVED.has(label.toLowerCase())) return "This name is reserved for a protected built-in property.";
  if (existing.some((p) => p.id !== exceptId && !p.archived_at && p.label.trim().toLowerCase() === label.toLowerCase())) return "A property with this name already exists.";
  if (!PROPERTY_TYPES.some((type) => type.id === item.type)) return "Unsupported property type.";
  if (item.type === "select" || item.type === "multi_select") {
    const options = item.config.options ?? [];
    if (!Array.isArray(options) || options.length > MAX_OPTIONS || !options.every((o) => typeof o === "string" && !!o.trim() && o.length <= 80) ||
        new Set(options.map((o) => o.trim().toLowerCase())).size !== options.length) return "Choose up to 60 unique, nonempty options.";
  }
  if (item.type === "relation") {
    if (!item.config.target_databases?.length || new Set(item.config.target_databases).size !== item.config.target_databases.length) return "Choose at least one allowed destination database.";
    if (!["one", "many"].includes(item.config.cardinality || "")) return "Choose single or multiple linked pages.";
  }
  if (item.type === "rollup") {
    if ((item.config.relation_path?.length || 0) > 3) return "A Rollup can traverse a maximum of three relation hops.";
    if (item.config.calculation && !["show_original", "count_records", "count_nonempty", "count_unique", "sum", "average", "min", "max", "earliest", "latest"].includes(item.config.calculation)) return "Invalid Rollup calculation.";
  }
  return "";
}

export function validateValue(prop: DatabaseProperty, value: unknown): string {
  if (!editable(prop)) return "This property is not directly editable.";
  if (value === null || value === undefined || value === "") return "";
  switch (prop.type) {
    case "text":
    case "long_text":
      return typeof value === "string" && value.length <= 10000 ? "" : "Enter valid text (10,000 characters maximum).";
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? "" : "Enter a finite number.";
    case "date":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? "" : "Enter a valid date.";
    case "checkbox":
      return typeof value === "boolean" ? "" : "Checkbox values must be true or false.";
    case "select":
      return typeof value === "string" && (prop.config.options || []).includes(value) ? "" : "Choose one of this property's options.";
    case "multi_select":
      return Array.isArray(value) && new Set(value).size === value.length && value.every((v) => typeof v === "string" && (prop.config.options || []).includes(v)) ? "" : "Choose only configured options.";
    default:
      return "This type does not support direct values yet.";
  }
}

export function recordProperties(record: PlanningRecord): PropertyValues {
  const raw = record.data.databaseProperties;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as PropertyValues : {};
}

export function withPropertyValue(record: PlanningRecord, prop: DatabaseProperty, value: PropertyValues[string]): PlanningRecord {
  const error = validateValue(prop, value);
  if (error) throw new Error(error);
  const databaseProperties = { ...recordProperties(record) };
  if (value === null || value === "") delete databaseProperties[prop.id];
  else databaseProperties[prop.id] = value;
  return { ...record, data: { ...record.data, databaseProperties } };
}

export function propertyDisplay(prop: DatabaseProperty, value: unknown) {
  return formatDatabasePropertyValue(prop,value);
}

export const builtinProperties = [
  { id: "name", label: "Name", type: "text", required: true },
  { id: "record_code", label: "ID", type: "text", required: true },
  { id: "status", label: "Status", type: "select", required: true },
  { id: "summary", label: "Summary", type: "long_text", required: true },
] as const;
