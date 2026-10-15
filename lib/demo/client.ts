// Demo Mode stand-in for the Supabase client used by the existing screens (Calendar, The Agenda,
// Think About It, profile). It keeps a small set of tables in browser storage and supports only the
// query shapes those screens use. It never performs a network request.
// The new database engine does NOT use this: it talks to its own persistence adapter interface.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;
export type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type Result = { data: unknown; error: { message: string; code?: string } | null; count: null; status: number; statusText: string };

export const DEMO_USER_ID = "00000000-0000-4000-8000-00000000de30";
export const DEMO_EMAIL = "demo@preview.allaboutaction";
export const DEMO_STORAGE_KEY = "aaa-demo-data-v1";

const primaryKeys: Record<string, string[]> = {
  user_items: ["id"],
  profiles: ["id"],
  thought_details: ["thought_id"],
  thought_memberships: ["collection_id", "thought_id"],
  thought_connections: ["id"],
  planning_records: ["thought_id"],
};
const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const ok = (data: unknown, status = 200): Result => ({ data, error: null, count: null, status, statusText: "OK" });
const failure = (message: string, code?: string): Result => ({ data: null, error: { message, code }, count: null, status: 400, statusText: "Bad Request" });
const unavailable = (what: string) => failure(`${what} is not available in Demo Mode.`);

export class DemoDatabase {
  tables: Tables;
  constructor(private storage: DemoStorage | null, private seed: () => Tables) {
    this.tables = this.load();
  }
  private load(): Tables {
    try {
      const saved = JSON.parse(this.storage?.getItem(DEMO_STORAGE_KEY) || "null");
      if (saved?.version === 1 && saved.tables && typeof saved.tables === "object") return saved.tables;
    } catch {}
    const tables = this.seed();
    this.persist(tables);
    return tables;
  }
  private persist(tables: Tables) {
    try {
      this.storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, tables }));
    } catch {}
  }
  save() {
    this.persist(this.tables);
  }
  reset() {
    this.tables = this.seed();
    this.save();
  }
  rows(table: string) {
    return (this.tables[table] ??= []);
  }
}

function withDefaults(table: string, input: Row): Row {
  const now = new Date().toISOString();
  const row: Row = { ...clone(input) };
  if (table === "user_items")
    return { id: crypto.randomUUID(), user_id: DEMO_USER_ID, thought_id: null, content: {}, created_at: now, updated_at: now, ...row };
  if (table === "thought_details")
    return {
      user_id: DEMO_USER_ID, parent_id: null, position: 0, archived_at: null, version: 1, collection: false, properties: [],
      views: [{ id: "list", name: "List", layout: "list" }, { id: "table", name: "Table", layout: "table" }, { id: "board", name: "Board", layout: "board" }],
      ...row,
    };
  if (table === "thought_memberships") return { user_id: DEMO_USER_ID, position: 0, values_json: {}, ...row };
  if (table === "thought_connections") {
    const out: Row = { id: crypto.randomUUID(), user_id: DEMO_USER_ID, ...row };
    // Mirror the database: symmetric connection types are stored in one canonical direction.
    if ((out.type === "relates_to" || out.type === "contradicts") && String(out.source_id) > String(out.target_id))
      [out.source_id, out.target_id] = [out.target_id, out.source_id];
    return out;
  }
  return row;
}

function project(row: Row, columns: string | null) {
  if (!columns || columns.trim() === "*") return clone(row);
  return Object.fromEntries(columns.split(",").map((c) => c.trim()).filter(Boolean).map((c) => [c, clone(row[c] ?? null)]));
}

class DemoQuery implements PromiseLike<Result> {
  private filters: ((row: Row) => boolean)[] = [];
  private action: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private columns: string | null = "*";
  private returning = false;
  private sorts: { column: string; ascending: boolean }[] = [];
  private window: [number, number] | null = null;
  private one: "single" | "maybe" | null = null;
  constructor(private db: DemoDatabase, private table: string) {}

  select(columns = "*") {
    this.columns = columns;
    if (this.action !== "select") this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    return (this.action = "insert"), (this.payload = rows), this;
  }
  upsert(rows: Row | Row[]) {
    return (this.action = "upsert"), (this.payload = rows), this;
  }
  update(patch: Row) {
    return (this.action = "update"), (this.payload = patch), this;
  }
  delete() {
    return (this.action = "delete"), this;
  }
  eq(column: string, value: unknown) {
    return this.filters.push((r) => r[column] === value), this;
  }
  neq(column: string, value: unknown) {
    return this.filters.push((r) => r[column] !== value), this;
  }
  is(column: string, value: unknown) {
    return this.filters.push((r) => (r[column] ?? null) === value), this;
  }
  in(column: string, values: unknown[]) {
    return this.filters.push((r) => values.includes(r[column])), this;
  }
  order(column: string, options: { ascending?: boolean } = {}) {
    return this.sorts.push({ column, ascending: options.ascending !== false }), this;
  }
  range(from: number, to: number) {
    return (this.window = [from, to]), this;
  }
  limit(count: number) {
    return (this.window = [0, count - 1]), this;
  }
  single() {
    return (this.one = "single"), this;
  }
  maybeSingle() {
    return (this.one = "maybe"), this;
  }
  then<A = Result, B = never>(resolve?: ((value: Result) => A | PromiseLike<A>) | null, reject?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.execute()).then(resolve, reject);
  }

  private matches(row: Row) {
    return this.filters.every((f) => f(row));
  }
  private shape(rows: Row[]): Result {
    const out = rows.map((r) => project(r, this.columns));
    if (this.one === "single") return out.length === 1 ? ok(out[0]) : failure("JSON object requested, multiple (or no) rows returned", "PGRST116");
    if (this.one === "maybe") return out.length > 1 ? failure("Multiple rows returned", "PGRST116") : ok(out[0] ?? null);
    return ok(out);
  }
  private execute(): Result {
    if (!(this.table in primaryKeys)) return unavailable(`The "${this.table}" table`);
    const table = this.db.rows(this.table);
    if (this.action === "select") {
      let rows = table.filter((r) => this.matches(r));
      for (const { column, ascending } of [...this.sorts].reverse())
        rows = [...rows].sort((a, b) => (String(a[column] ?? "") < String(b[column] ?? "") ? -1 : String(a[column] ?? "") > String(b[column] ?? "") ? 1 : 0) * (ascending ? 1 : -1));
      if (this.window) rows = rows.slice(this.window[0], this.window[1] + 1);
      return this.shape(rows);
    }
    if (this.action === "insert" || this.action === "upsert") {
      const keys = primaryKeys[this.table];
      const written: Row[] = [];
      for (const input of Array.isArray(this.payload) ? this.payload : [this.payload!]) {
        const row = withDefaults(this.table, input);
        const existing = table.find((r) => keys.every((k) => r[k] === row[k]));
        if (existing && this.action === "insert") return failure("duplicate key value violates unique constraint", "23505");
        if (this.table === "thought_connections" && table.some((r) => r.source_id === row.source_id && r.target_id === row.target_id && r.type === row.type))
          return failure("duplicate key value violates unique constraint", "23505");
        if (existing) Object.assign(existing, clone(input));
        else table.push(row);
        written.push(existing ?? row);
      }
      this.db.save();
      return this.returning ? this.shape(written) : ok(null, 201);
    }
    const matched = table.filter((r) => this.matches(r));
    if (this.action === "update") for (const r of matched) Object.assign(r, clone(this.payload));
    else this.db.tables[this.table] = table.filter((r) => !matched.includes(r));
    this.db.save();
    return this.returning ? this.shape(matched) : ok(null, 204);
  }
}

function rpc(db: DemoDatabase, name: string, args: Row): Result {
  const items = db.rows("user_items"), details = db.rows("thought_details");
  const createThought = (id: string, title: string, content: unknown) => {
    if (items.some((r) => r.id === id)) throw new Error("duplicate key value violates unique constraint");
    items.push(withDefaults("user_items", { id, item_type: "thought", title, content }));
    details.push(withDefaults("thought_details", { thought_id: id }));
  };
  try {
    if (name === "create_thought") {
      createThought(String(args.p_id), String(args.p_title ?? ""), args.p_content ?? {});
      db.save();
      return ok(args.p_id);
    }
    if (name === "create_thought_collection") {
      const members = (args.p_members as string[]) ?? [];
      if (members.some((m) => !details.some((d) => d.thought_id === m))) return failure("Collection or member unavailable");
      createThought(String(args.p_id), String(args.p_title ?? ""), { blocks: [] });
      details.find((d) => d.thought_id === args.p_id)!.collection = true;
      for (const thought_id of members) db.rows("thought_memberships").push(withDefaults("thought_memberships", { collection_id: args.p_id, thought_id }));
      db.save();
      return ok(args.p_id);
    }
    if (name === "save_thought") {
      const detail = details.find((d) => d.thought_id === args.p_id);
      if (!detail || detail.version !== args.p_version) return failure("Thought changed elsewhere. Reload before saving.");
      for (let parent = args.p_parent as string | null; parent; parent = (details.find((d) => d.thought_id === parent)?.parent_id as string | null) ?? null)
        if (parent === args.p_id) return failure("A thought cannot contain itself");
      Object.assign(detail, { version: (detail.version as number) + 1, parent_id: args.p_parent ?? null, position: args.p_position ?? 0, archived_at: args.p_archive ?? null });
      const now = new Date().toISOString();
      const item = items.find((r) => r.id === args.p_id);
      if (item) Object.assign(item, { title: args.p_title, content: clone(args.p_content), updated_at: now });
      const title = String(args.p_title || "Untitled");
      for (const block of items.filter((r) => r.thought_id === args.p_id)) Object.assign(block, { title, content: { ...(block.content as Row), title }, updated_at: now });
      db.save();
      return ok(null);
    }
  } catch (e) {
    return failure(e instanceof Error ? e.message : String(e));
  }
  return unavailable(`"${name}"`);
}

export function createDemoClient(db: DemoDatabase): SupabaseClient {
  const user = { id: DEMO_USER_ID, email: DEMO_EMAIL, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: { display_name: "Demo" }, created_at: "2026-01-01T00:00:00Z" };
  const session = { access_token: "demo", refresh_token: "demo", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user };
  const signInOff = async () => ({ data: { user: null, session: null }, error: { message: "Sign-in is turned off in Demo Mode." } });
  const channel = { on: () => channel, subscribe: () => channel, unsubscribe: async () => "ok" };
  const client = {
    from: (table: string) => new DemoQuery(db, table),
    rpc: (name: string, args: Row = {}) => Promise.resolve(rpc(db, name, args)),
    channel: () => channel,
    removeChannel: async () => "ok",
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: signInOff,
      signUp: signInOff,
      resetPasswordForEmail: signInOff,
      signOut: async () => ({ error: null }),
    },
  };
  return client as unknown as SupabaseClient;
}
