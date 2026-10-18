import { environment } from "./environment";
import { supabase } from "./supabase";
import { planningStore, type PlanningRecord } from "./planning";
import type { Thought } from "./thoughts";
import type { DatabaseCategory } from "./database-categories";
import { databaseById } from "./database-categories";
import {
  validateDefinition, withPropertyValue, type DatabaseProperty,
  type PropertyType, type PropertyConfig, type PropertyValues,
} from "./database-property-model";

export const DATABASE_DEMO_KEY = "aaa-databases-phase2-demo-v1";
export type DatabaseRecords = { records: PlanningRecord[]; thoughts: Thought[] };
export type DemoState = DatabaseRecords & { version: 1; definitions: DatabaseProperty[] };
export type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const demoMode = environment.ok && environment.data === "demo";
const storage = (): StoragePort | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
};
const now = "2026-10-18T12:00:00.000Z";

// Entirely fictitious, isolated browser fixtures for the Vercel Preview.
// These are never sent to Supabase and are not Nobody Special canon.
export function seedDatabaseDemo(): DemoState {
  const scene = [
    ["character", "Mira Vale", "A fictional navigator seeking a lost signal.", "developing"],
    ["character", "Rowan Finch", "A fictional archivist keeping the expedition notes.", "idea"],
    ["event", "The Lantern Festival", "A fictional meeting during the autumn celebration.", "canon"],
    ["event", "The Signal", "A fictional turning point in the expedition.", "developing"],
    ["perspective", "Mira Vale during The Signal", "Mira hears the signal but doesn't know its origin.", "developing"],
    ["scene", "An Unexpected Message", "A planned scene about a mysterious signal.", "idea"],
    ["project", "Draft the Opening", "Outline the fictional opening chapter.", "developing"],
  ] as const;
  const records: PlanningRecord[] = [];
  const thoughts: Thought[] = [];
  const ids = scene.map(() => crypto.randomUUID());
  const counts: Record<string, number> = {};
  scene.forEach(([kind, title, summary, status], index) => {
    counts[kind] = (counts[kind] || 0) + 1;
    records.push({
      thought_id: ids[index],
      kind,
      sequence_no: counts[kind],
      workspace_id: null, event_id: kind === "perspective" ? ids[3] : null,
      character_id: kind === "perspective" ? ids[0] : null,
      project_id: null, goal_id: null, working_id: null,
      data: { summary, status, databaseProperties: {} }, version: 1,
    });
    thoughts.push({
      id: ids[index], title, updated_at: now,
      content: { blocks: [] },
      details: { thought_id: ids[index], parent_id: null, position: index, archived_at: null, version: 1, collection: false, properties: [], views: [] },
    });
  });
  return { version: 1, records, thoughts, definitions: [] };
}
export function readDatabaseDemo(port: StoragePort | null = storage()): DemoState {
  try {
    const raw = port?.getItem(DATABASE_DEMO_KEY);
    if (raw) {
      const value = JSON.parse(raw) as DemoState;
      if (value?.version === 1 && Array.isArray(value.records) && Array.isArray(value.thoughts) && Array.isArray(value.definitions))
        return value;
    }
  } catch { /* Browser storage can be unavailable; continue in memory. */ }
  const initial = seedDatabaseDemo();
  writeDatabaseDemo(initial, port);
  return initial;
}
export function writeDatabaseDemo(value: DemoState, port: StoragePort | null = storage()) {
  try { port?.setItem(DATABASE_DEMO_KEY, JSON.stringify(value)); }
  catch { /* Browser storage may be full or disabled. */ }
}
export function resetDatabaseDemo(port: StoragePort | null = storage()) {
  try { port?.removeItem(DATABASE_DEMO_KEY); }
  catch { /* Best effort reset if browser storage is disabled. */ }
}

export type PropertyDraft = {
  label: string; type: PropertyType; config: PropertyConfig; visible: boolean;
};

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export const databasePropertyStore = {
  async loadRecords(): Promise<DatabaseRecords> {
    if (demoMode) {
      const { records, thoughts } = readDatabaseDemo();
      return { records, thoughts };
    }
    const result = await planningStore.load();
    return { records: result.records, thoughts: result.thoughts };
  },
  async load(category: DatabaseCategory): Promise<DatabaseProperty[]> {
    if (demoMode) return readDatabaseDemo().definitions.filter((p) => p.database_key === category && !p.archived_at).sort((a,b) => a.position - b.position);
    const rows = check((await supabase.from("database_property_definitions").select("*").eq("database_key",category).is("archived_at",null).order("position")) as {data:DatabaseProperty[];error:{message:string}|null});
    return rows || [];
  },
  async create(category: DatabaseCategory, draft: PropertyDraft, existing: DatabaseProperty[]): Promise<DatabaseProperty> {
    if (!databaseById(category).kind) throw new Error("This category is not yet backed by canonical planning records.");
    const problem = validateDefinition(draft, existing);
    if (problem) throw new Error(problem);
    const value: DatabaseProperty = {
      id: crypto.randomUUID(), database_key: category, label: draft.label.trim(), type: draft.type, config: draft.config,
      position: existing.reduce((max,p) => Math.max(max,p.position), -1) + 1,
      visible: draft.visible, is_system: false, archived_at: null, version: 1,
    };
    if (demoMode) {
      const state = readDatabaseDemo();
      state.definitions.push(value);
      writeDatabaseDemo(state);
      return value;
    }
    return check((await supabase.from("database_property_definitions").insert(value).select("*").single()) as {data:DatabaseProperty;error:{message:string}|null});
  },
  async update(item: DatabaseProperty, patch: Partial<Pick<DatabaseProperty,"label"|"type"|"config"|"position"|"visible"|"archived_at">>, siblings: DatabaseProperty[]): Promise<DatabaseProperty> {
    if (item.is_system) throw new Error("Built-in properties cannot be modified.");
    const next: DatabaseProperty = { ...item, ...patch, label: (patch.label ?? item.label).trim(), version: item.version + 1 };
    const problem = validateDefinition(next, siblings, item.id);
    if (problem) throw new Error(problem);
    if (demoMode) {
      const state = readDatabaseDemo();
      const index = state.definitions.findIndex(p => p.id === item.id && p.version === item.version && p.database_key === item.database_key);
      if (index < 0) throw new Error("Property changed elsewhere. Reload before saving.");
      if (patch.type && patch.type !== item.type && state.records.some(r => r.data.databaseProperties && Object.prototype.hasOwnProperty.call(r.data.databaseProperties,item.id)))
        throw new Error("Clear existing values before changing this property's type.");
      state.definitions[index] = next;
      writeDatabaseDemo(state);
      return next;
    }
    const { data, error } = await supabase.from("database_property_definitions").update(patch).eq("id",item.id).eq("database_key",item.database_key).eq("version",item.version).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Property changed elsewhere. Reload before saving.");
    return data as DatabaseProperty;
  },
  async saveValue(record: PlanningRecord, property: DatabaseProperty, value: PropertyValues[string]): Promise<PlanningRecord> {
    const category = record.kind === "character" ? "Characters" : record.kind === "event" ? "Events" :
      record.kind === "perspective" ? "Perspectives" : record.kind === "scene" ? "Scenes" :
      record.kind === "project" ? "Projects" : null;
    if (!category || category !== property.database_key) throw new Error("Property and record belong to different databases.");
    const next = withPropertyValue(record,property,value);
    if (demoMode) {
      const state = readDatabaseDemo();
      const index = state.records.findIndex(r=>r.thought_id===record.thought_id && r.version===record.version);
      if(index<0) throw new Error("Record changed elsewhere. Reload before saving.");
      const result={...next,version:record.version+1};
      state.records[index]=result;
      writeDatabaseDemo(state);
      return result;
    }
    await planningStore.save(next);
    return { ...next, version: record.version + 1 };
  },
};
