import type {CompanionTool, CompanionTarget, ContextScope} from "@/lib/companion-config";

export type CompanionSlot = "top" | "bottom";
export type ContextViewState = {
  locked: CompanionTarget | null;
  configure: boolean;
  scope: ContextScope;
  newSection: string;
  expanded: Record<string, boolean>;
};
export type ThoughtsViewState = {
  locked: CompanionTarget | null;
  filter: "related" | "all";
  draft: string;
  linkDraft: boolean;
};
export type CompanionPaneState = {
  agenda: { date: string; selected: string | null };
  context: ContextViewState;
  thoughts: ThoughtsViewState;
};

export function initialPaneState(today: string, quickLink: boolean): CompanionPaneState {
  return {
    agenda: {date: today, selected: null},
    context: {locked: null, configure: false, scope: "workspace", newSection: "", expanded: {}},
    thoughts: {locked: null, filter: "related", draft: "", linkDraft: quickLink}
  };
}

// Duplicate the selected view, not every tool or the whole pane.
// An unsubmitted Thought draft remains in the original pane to avoid duplicate submissions.
export function cloneCompanionView(source: CompanionPaneState, destination: CompanionPaneState, tool: CompanionTool): CompanionPaneState {
  if (tool === "agenda") return {...destination, agenda: {...source.agenda}};
  if (tool === "context") return {
    ...destination,
    context: {
      ...source.context,
      locked: source.context.locked ? {...source.context.locked,fields:source.context.locked.fields.map(f=>({...f}))} : null,
      expanded: {...source.context.expanded},
      configure: false,
      newSection: ""
    }
  };
  return {
    ...destination,
    thoughts: {
      ...source.thoughts,
      locked: source.thoughts.locked ? {...source.thoughts.locked,fields:source.thoughts.locked.fields.map(f=>({...f}))} : null,
      draft: ""
    }
  };
}

export function referenceForPane(locked: CompanionTarget | null, current: CompanionTarget): CompanionTarget {
  // When a locked record becomes active again, use its refreshed values.
  if (locked?.id === current.id) return current;
  return locked ?? current;
}

export function addRecentReference(previous: CompanionTarget[], target: CompanionTarget, limit=15): CompanionTarget[] {
  if (!target?.id) return previous;
  const existing = previous.find(t=>t.id===target.id);
  const same = existing && JSON.stringify(existing)===JSON.stringify(target);
  if (same && previous[0]?.id===target.id) return previous;
  return [target,...previous.filter(t=>t.id!==target.id)].slice(0,limit);
}