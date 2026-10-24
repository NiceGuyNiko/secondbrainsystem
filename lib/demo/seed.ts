// Fictional sample data for Demo Mode. Dates are relative to the day the demo data is created,
// so the calendar and The Agenda always have something to show around "today".
import { DEMO_EMAIL, DEMO_USER_ID, type Row, type Tables } from "./client";
import {widgetDemoFixtures} from "./widget-fixtures";

const localDate = (base: Date, offset: number) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const block = (text: string, type = "paragraph", checked?: boolean) => ({ id: crypto.randomUUID(), type, text, ...(checked === undefined ? {} : { checked }) });

export function demoSeed(now = new Date()): Tables {
  const {user_items:widgetItems,...widgetTables}=widgetDemoFixtures(now);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const created = now.toISOString();
  let n = 0;
  const event = (offset: number, title: string, start: string, end: string, category: string, extra: Row = {}): Row => {
    const date = localDate(now, offset);
    const id = Date.now() + ++n;
    return {
      id: crypto.randomUUID(), user_id: DEMO_USER_ID, item_type: "block", title, thought_id: null,
      created_at: new Date(now.getTime() + n).toISOString(), updated_at: created,
      content: { id, title, date, endDate: date, start, end, category, kind: "block", locked: false, repeat: "none", repeatEvery: 1, repeatUntil: "", allDay: false, travelMinutes: 0, timeZone, exceptions: [], tasks: [], ...extra },
    };
  };
  const thought = (title: string, blocks: Row[]) => {
    const id = crypto.randomUUID();
    return {
      item: { id, user_id: DEMO_USER_ID, item_type: "thought", title, thought_id: null, content: { blocks }, created_at: created, updated_at: created },
      detail: { thought_id: id, user_id: DEMO_USER_ID, parent_id: null, position: 0, archived_at: null, version: 1, collection: false, properties: [], views: [{ id: "list", name: "List", layout: "list" }, { id: "table", name: "Table", layout: "table" }, { id: "board", name: "Board", layout: "board" }] },
    };
  };

  const welcome = thought("Welcome to the All About Action demo", [
    block("This is a preview with sample data. Nothing here is connected to your real account."),
    block("Changes are saved in this browser only. Use “Reset demo data” in the profile menu to start over."),
  ]);
  const outline = thought("Nobody Special — Book 1 outline", [
    block("Act one", "heading"),
    block("Opening scene at the harbour", "checklist", true),
    block("Introduce the mentor", "checklist", false),
    block("Inciting incident", "checklist", false),
  ]);
  const notes = thought("Research notes: 1920s shipping routes", [block("Collect sources on transatlantic liners and port schedules.")]);
  const research = thought("Research", []);
  research.detail.collection = true;
  const thoughts = [welcome, outline, notes, research];

  return {
    profiles: [{ id: DEMO_USER_ID, username: DEMO_EMAIL, display_name: "Niko" }],
    user_items: [
      {
        id: crypto.randomUUID(), user_id: DEMO_USER_ID, item_type: "resource", title: "__calendar_categories__", thought_id: null, created_at: created, updated_at: created,
        content: { categories: [{ name: "Beta Tests", color: "teal" }, { name: "Personal", color: "blue" }, { name: "Work", color: "orange" }, { name: "Health", color: "green" }, { name: "Important", color: "purple" }, { name: "Holiday", color: "pink" }] },
      },
      event(-1, "Reading: research notes", "20:00", "21:00", "Personal"),
      event(0, "Morning planning", "08:30", "09:00", "Personal"),
      event(0, "Deep work: Chapter 3 draft", "10:00", "12:00", "Work", { tasks: [{ id: 1, title: "Finish the harbour scene", done: false, project: "" }, { id: 2, title: "Check continuity notes", done: true, project: "" }] }),
      event(0, "Lunch with Sam", "12:30", "13:30", "Personal"),
      event(0, "Run", "18:00", "18:45", "Health"),
      event(1, "Team sync", "09:30", "10:00", "Work", { repeat: "weekly" }),
      event(1, "Dentist", "14:00", "15:00", "Important"),
      event(2, "Write 1,000 words", "07:00", "08:00", "Personal", { repeat: "daily", repeatCount: 5 }),
      event(3, "Book fair", "00:00", "23:59", "Personal", { allDay: true }),
      event(4, "Yoga", "17:30", "18:30", "Health"),
      ...thoughts.map((t) => t.item),
      ...widgetItems,
    ],
    thought_details: thoughts.map((t) => t.detail),
    thought_memberships: [
      { collection_id: research.detail.thought_id, thought_id: notes.detail.thought_id, user_id: DEMO_USER_ID, position: 0, values_json: {} },
      { collection_id: research.detail.thought_id, thought_id: outline.detail.thought_id, user_id: DEMO_USER_ID, position: 1, values_json: {} },
    ],
    thought_connections: [{ id: crypto.randomUUID(), user_id: DEMO_USER_ID, source_id: notes.detail.thought_id, target_id: outline.detail.thought_id, type: "supports" }],
    planning_records: [],
    ...widgetTables,
  };
}
