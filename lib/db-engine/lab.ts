// Independent, typed database-engine acceptance model.
// Preview adapter only. These IDs and operations will also be used by the staged Supabase adapter.
// Nothing here writes legacy planning_records or production data.
export type PropertyType = "text" | "long_text" | "number" | "checkbox" | "select" | "date" | "relation";
export type ScalarValue = string | number | boolean | null;
export type LabDatabase = { id: string; name: string; icon: string; createdAt: string };
export type LabProperty = {
  id: string; databaseId: string; name: string; type: PropertyType; position: number;
  options?: string[]; targetDatabaseId?: string; multi?: boolean;
};
export type LabRecord = {
  id: string; databaseId: string; sequenceNo: number; title: string;
  values: Record<string, ScalarValue>; createdAt: string; updatedAt: string; archivedAt: string | null;
};
export type LabLink = { id: string; propertyId: string; sourceId: string; targetId: string };
export type LabView = {
  id: string; databaseId: string; name: string; layout: "table" | "gallery";
  visiblePropertyIds: string[]; sortPropertyId: string | null; sortDirection: "asc" | "desc";
};
export type LabState = { version: 1; databases: LabDatabase[]; properties: LabProperty[]; records: LabRecord[]; links: LabLink[]; views: LabView[] };
export const LAB_STORAGE_KEY = "aaa-engine-acceptance-v1";
const uuid = () => crypto.randomUUID();
const iso = () => new Date().toISOString();
const duplicate = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const cleanName = (value: string) => value.trim();
const need = (condition: unknown, message: string): asserts condition => { if (!condition) throw new Error(message); };

export function freshLab(): LabState {
  const characters = uuid(), events = uuid();
  return {
    version: 1,
    databases: [
      { id: characters, name: "Characters", icon: "👤", createdAt: iso() },
      { id: events, name: "Events", icon: "📅", createdAt: iso() },
    ],
    properties: [
      { id: uuid(), databaseId: characters, name: "Status", type: "select", options: ["Idea", "Developing", "Canon"], position: 0 },
      { id: uuid(), databaseId: characters, name: "Summary", type: "long_text", position: 1 },
      { id: uuid(), databaseId: events, name: "Status", type: "select", options: ["Idea", "Developing", "Canon"], position: 0 },
      { id: uuid(), databaseId: events, name: "Summary", type: "long_text", position: 1 },
    ],
    records: [], links: [], views: [
      { id: uuid(), databaseId: characters, name: "All Characters", layout: "table", visiblePropertyIds: [], sortPropertyId: null, sortDirection: "asc" },
      { id: uuid(), databaseId: events, name: "All Events", layout: "table", visiblePropertyIds: [], sortPropertyId: null, sortDirection: "asc" },
    ],
  };
}
export function loadLab(store?: Pick<Storage, "getItem" | "setItem">): LabState {
  if (!store) return freshLab();
  try {
    const raw = store.getItem(LAB_STORAGE_KEY);
    if (raw) {
      const state: unknown = JSON.parse(raw);
      if (isLabState(state)) return state;
    }
  } catch { /* corrupted or blocked storage: offer a fresh isolated workspace */ }
  const state = freshLab();
  store.setItem(LAB_STORAGE_KEY, JSON.stringify(state));
  return state;
}
export function saveLab(state: LabState, store: Pick<Storage, "setItem">) {
  store.setItem(LAB_STORAGE_KEY, JSON.stringify(state));
}
export function isLabState(v: unknown): v is LabState {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<LabState>;
  return s.version === 1 && Array.isArray(s.databases) && Array.isArray(s.properties)
    && Array.isArray(s.records) && Array.isArray(s.links) && Array.isArray(s.views);
}
export function editLab(state: LabState, operation: (next: LabState) => void): LabState {
  const next = duplicate(state);
  operation(next);
  return next;
}
export function createDatabase(state: LabState, name: string): LabDatabase {
  const label = cleanName(name);
  need(label.length > 0 && label.length <= 80, "Database name must contain 1–80 characters.");
  need(!state.databases.some(d => d.name.toLowerCase() === label.toLowerCase()), "A database with this name already exists.");
  const db: LabDatabase = { id: uuid(), name: label, icon: "🗃️", createdAt: iso() };
  state.databases.push(db);
  state.views.push({ id: uuid(), databaseId: db.id, name: "All records", layout: "table", visiblePropertyIds: [], sortPropertyId: null, sortDirection: "asc" });
  return db;
}
export function createProperty(
  state: LabState, databaseId: string, name: string, type: PropertyType,
  configuration: { options?: string[]; targetDatabaseId?: string; multi?: boolean } = {},
): LabProperty {
  need(state.databases.some(d => d.id === databaseId), "Database not found.");
  const label = cleanName(name);
  need(label.length > 0 && label.length <= 80, "Property name must contain 1–80 characters.");
  need(label.toLowerCase() !== "name" && label.toLowerCase() !== "id", "Name and ID are built-in properties.");
  need(!state.properties.some(p => p.databaseId === databaseId && p.name.toLowerCase() === label.toLowerCase()), "Property name already exists.");
  need(["text", "long_text", "number", "checkbox", "select", "date", "relation"].includes(type), "Unsupported property type.");
  if (type === "relation") need(state.databases.some(d => d.id === configuration.targetDatabaseId), "Choose a target database.");
  if (type === "select") {
    need(Array.isArray(configuration.options) && configuration.options.length > 0, "Select needs at least one option.");
    const options = configuration.options.map(cleanName);
    need(options.length <= 60 && options.every(o => o.length >= 1 && o.length <= 80), "Choose 1–60 valid options.");
    need(new Set(options.map(o => o.toLowerCase())).size === options.length, "Select options must be unique.");
    configuration.options = options;
  }
  const property: LabProperty = {
    id: uuid(), databaseId, name: label, type,
    position: state.properties.filter(p => p.databaseId === databaseId).length,
    ...(type === "select" ? { options: configuration.options } : {}),
    ...(type === "relation" ? { targetDatabaseId: configuration.targetDatabaseId, multi: configuration.multi !== false } : {}),
  };
  state.properties.push(property);
  return property;
}
export function createRecord(state: LabState, databaseId: string, name: string): LabRecord {
  need(state.databases.some(d => d.id === databaseId), "Database not found.");
  const title = cleanName(name);
  need(title.length > 0 && title.length <= 160, "Record name must contain 1–160 characters.");
  const record: LabRecord = {
    id: uuid(), databaseId, title,
    sequenceNo: Math.max(0, ...state.records.filter(r => r.databaseId === databaseId).map(r => r.sequenceNo)) + 1,
    values: {}, createdAt: iso(), updatedAt: iso(), archivedAt: null,
  };
  state.records.push(record);
  return record;
}
export function renameRecord(state: LabState, recordId: string, name: string) {
  const record = state.records.find(r => r.id === recordId && !r.archivedAt);
  need(record, "Record not found.");
  const title = cleanName(name);
  need(title.length > 0 && title.length <= 160, "Name must contain 1–160 characters.");
  record.title = title;
  record.updatedAt = iso();
}
export function setValue(state: LabState, recordId: string, propertyId: string, value: ScalarValue) {
  const record = state.records.find(r => r.id === recordId && !r.archivedAt);
  need(record, "Record not found.");
  const property = state.properties.find(p => p.id === propertyId && p.databaseId === record.databaseId);
  need(property, "Property does not belong to this record.");
  need(property.type !== "relation", "Use linkRecord for relations.");
  if (value !== null) {
    switch (property.type) {
      case "text": case "long_text":
        need(typeof value === "string" && value.length <= 10000, "Expected text up to 10,000 characters."); break;
      case "date":
        need(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)), "Expected a valid YYYY-MM-DD date."); break;
      case "number": need(typeof value === "number" && Number.isFinite(value), "Expected a finite number."); break;
      case "checkbox": need(typeof value === "boolean", "Expected true or false."); break;
      case "select": need(typeof value === "string" && (property.options ?? []).includes(value), "Unknown select option."); break;
    }
  }
  if (value === null || value === "") delete record.values[propertyId];
  else record.values[propertyId] = value;
  record.updatedAt = iso();
}
export function linkRecord(state: LabState, sourceId: string, propertyId: string, targetId: string) {
  const source = state.records.find(r => r.id === sourceId && !r.archivedAt);
  const target = state.records.find(r => r.id === targetId && !r.archivedAt);
  const property = state.properties.find(p => p.id === propertyId);
  need(source && target && property, "Record or relation not found.");
  need(property.type === "relation" && property.databaseId === source.databaseId, "Invalid relation property.");
  need(target.databaseId === property.targetDatabaseId, "Relation must target the configured database.");
  need(sourceId !== targetId, "A record cannot link to itself.");
  if (!property.multi) need(!state.links.some(l => l.sourceId === sourceId && l.propertyId === propertyId && l.targetId !== targetId), "This property permits only one target.");
  if (!state.links.some(l => l.sourceId === sourceId && l.propertyId === propertyId && l.targetId === targetId)) {
    state.links.push({ id: uuid(), sourceId, propertyId, targetId });
  }
  source.updatedAt = iso();
}
export function unlinkRecord(state: LabState, sourceId: string, propertyId: string, targetId: string) {
  const source = state.records.find(r => r.id === sourceId);
  need(source, "Source record unavailable.");
  state.links = state.links.filter(l => !(l.sourceId === sourceId && l.propertyId === propertyId && l.targetId === targetId));
  source.updatedAt = iso();
}
export function archiveRecord(state: LabState, recordId: string) {
  const record = state.records.find(r => r.id === recordId && !r.archivedAt);
  need(record, "Record not found.");
  record.archivedAt = iso();
  state.links = state.links.filter(l => l.sourceId !== recordId && l.targetId !== recordId);
}
export function visibleRecords(state: LabState, databaseId: string, query: string, sortPropertyId: string | null, descending: boolean) {
  const properties = state.properties;
  const q = query.trim().toLowerCase();
  return state.records.filter(r => r.databaseId === databaseId && !r.archivedAt)
    .filter(r => !q || r.title.toLowerCase().includes(q) || Object.values(r.values).some(v => String(v ?? "").toLowerCase().includes(q)))
    .sort((a, b) => {
      const av = sortPropertyId === "name" ? a.title : sortPropertyId ? a.values[sortPropertyId] : a.sequenceNo;
      const bv = sortPropertyId === "name" ? b.title : sortPropertyId ? b.values[sortPropertyId] : b.sequenceNo;
      const diff = typeof av === "number" && typeof bv === "number" ? av - bv :
        String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" });
      return descending ? -diff : diff;
    });
}
export function checkIntegrity(state: LabState) {
  for (const record of state.records) {
    need(state.databases.some(d => d.id === record.databaseId), "Record references a missing database.");
    for (const [propertyId, value] of Object.entries(record.values)) {
      const copy = duplicate(state);
      setValue(copy, record.id, propertyId, value);
    }
  }
  for (const edge of state.links) {
    const copy = duplicate(state);
    unlinkRecord(copy, edge.sourceId, edge.propertyId, edge.targetId);
    linkRecord(copy, edge.sourceId, edge.propertyId, edge.targetId);
  }
  return true;
}
