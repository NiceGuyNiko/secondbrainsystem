import { supabase } from "./supabase";
import { thoughtStore, type Thought, canParent } from "./thoughts";
export type PlanningKind =
  | "workspace"
  | "event"
  | "character"
  | "perspective"
  | "goal"
  | "project"
  | "task"
  | "scene"
  | "activity";
export type PlanningData = {
  summary?: string;
  status?: "idea" | "developing" | "canon" | "superseded";
  chronology?: number;
  turning?: "ordinary" | "suggested" | "confirmed" | "dismissed";
  before?: string;
  after?: string;
  witnessed?: string;
  told?: string;
  inferred?: string;
  remembered?: string;
  motivation?: string;
  goalType?: "outcome" | "milestone";
  target?: number;
  unit?: string;
  deadline?: string;
  amount?: number;
  done?: boolean;
  firstThoughts?: string;
  sceneOrder?: number;
  sceneStatus?: "planned" | "outlined" | "drafted" | "revised";
  [key: string]: unknown;
};
export type PlanningRecord = {
  thought_id: string;
  kind: PlanningKind;
  sequence_no: number;
  workspace_id: string | null;
  event_id: string | null;
  character_id: string | null;
  project_id: string | null;
  goal_id: string | null;
  working_id: string | null;
  data: PlanningData;
  version: number;
};
export const recordCode = (r: PlanningRecord) =>
  ({
    event: "E",
    character: "C",
    perspective: "P",
    workspace: "W",
    goal: "G",
    project: "PR",
    task: "T",
    scene: "S",
    activity: "A",
  })[r.kind] + r.sequence_no;
export function recordTitle(r: PlanningRecord, thoughts: Thought[]) {
  const title = (id: string | null) =>
    thoughts.find((t) => t.id === id)?.title || "Untitled";
  return r.kind === "perspective"
    ? `${title(r.character_id)} during ${title(r.event_id)}`
    : title(r.thought_id);
}
export function eventDescendants(thoughts: Thought[], root: string) {
  const ids = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of thoughts)
      if (
        t.details.parent_id &&
        ids.has(t.details.parent_id) &&
        !ids.has(t.id)
      ) {
        ids.add(t.id);
        changed = true;
      }
  }
  return ids;
}
export function chronology(a: PlanningRecord, b: PlanningRecord) {
  return (
    (a.data.chronology ?? 0) - (b.data.chronology ?? 0) ||
    a.sequence_no - b.sequence_no
  );
}
export function measuredProgress(
  goal: PlanningRecord,
  records: PlanningRecord[],
) {
  return records
    .filter((r) => r.kind === "activity" && r.goal_id === goal.thought_id)
    .reduce((sum, r) => sum + (r.data.amount || 0), 0);
}
export function suggestedTurningPoint(data: PlanningData) {
  return (
    !!data.before?.trim() &&
    !!data.after?.trim() &&
    data.before.trim() !== data.after.trim()
  );
}
export { canParent };
const checked = <T>(result: { data: T; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message);
  return result.data;
};
export const planningStore = {
  async load() {
    const all: PlanningRecord[] = [];
    for (let offset = 0; ; offset += 500) {
      const rows =
        checked(
          await supabase
            .from("planning_records")
            .select("*")
            .order("thought_id")
            .range(offset, offset + 499),
        ) || [];
      all.push(...rows);
      if (rows.length < 500) break;
    }
    const thoughts = await thoughtStore.load();
    return { ...thoughts, records: all };
  },
  async create(
    title: string,
    kind: PlanningKind,
    refs: Partial<PlanningRecord> = {},
    data: PlanningData = {},
    existingId?: string,
  ) {
    return checked(
      await supabase.rpc("create_planning_record", {
        p_id: existingId || crypto.randomUUID(),
        p_title: title,
        p_kind: kind,
        p_workspace: refs.workspace_id || null,
        p_event: refs.event_id || null,
        p_character: refs.character_id || null,
        p_project: refs.project_id || null,
        p_goal: refs.goal_id || null,
        p_working: refs.working_id || null,
        p_data: data,
      }),
    ) as string;
  },
  async save(r: PlanningRecord) {
    checked(
      await supabase.rpc("save_planning_record", {
        p_id: r.thought_id,
        p_version: r.version,
        p_data: r.data,
        p_workspace: r.workspace_id,
        p_project: r.project_id,
        p_goal: r.goal_id,
        p_working: r.working_id,
      }),
    );
    window.dispatchEvent(new CustomEvent("aaa-planning-change"));
  },
};
