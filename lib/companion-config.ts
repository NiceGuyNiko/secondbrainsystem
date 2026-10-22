export type CompanionTool = "agenda" | "context" | "thoughts";
export type CompanionLayout = "single" | "split";
export type CompanionJump = "first" | "midnight";
export type CompanionVisibility = "rules" | "empty" | "manual";
export type CompanionCondition = "always" | "nonempty" | "property" | "relation" | "workflow";
export type ContextScope = "database" | "workspace" | "record" | "record-workspace";
export type CompanionPreferences = {
  uiVersion: number;
  layout: CompanionLayout;
  primary: CompanionTool;
  secondary: CompanionTool;
  splitPercent: number;
  jump: CompanionJump;
  visibility: CompanionVisibility;
  follow: "page" | "workspace";
  quickLink: boolean;
  launcher: "top" | "edge";
};
export const defaultCompanion: CompanionPreferences = {
  uiVersion: 2,
  layout: "single", primary: "agenda", secondary: "context",
  splitPercent: 52, jump: "first", visibility: "rules",
  follow: "page", quickLink: true, launcher: "top"
};
export function parseCompanion(raw: unknown): CompanionPreferences {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const pick = <T extends string>(key: string, options: readonly T[], fallback: T): T =>
    options.includes(r[key] as T) ? r[key] as T : fallback;
  // Prior preview's untouched default placed Context above Agenda. For the new
  // tab design, migrate just that old default once; explicit V2 choices remain intact.
  const oldPreviewDefault = !(typeof r.uiVersion === "number" && r.uiVersion >= 2)
    && r.primary === "context" && r.secondary === "agenda"
    && r.layout === "split" && r.splitPercent === 52;
  const primary = oldPreviewDefault ? "agenda" : pick("primary", ["agenda", "context", "thoughts"] as const, defaultCompanion.primary);
  const secondary = oldPreviewDefault ? "context" : pick("secondary", ["agenda", "context", "thoughts"] as const, defaultCompanion.secondary);
  return {
    uiVersion: 2,
    layout: oldPreviewDefault ? "single" : pick("layout", ["single", "split"] as const, defaultCompanion.layout),
    primary,
    secondary: secondary === primary ? (primary === "agenda" ? "context" : "agenda") : secondary,
    splitPercent: typeof r.splitPercent === "number" && Number.isFinite(r.splitPercent)
      ? Math.min(75, Math.max(25, Math.round(r.splitPercent))) : defaultCompanion.splitPercent,
    jump: pick("jump", ["first", "midnight"] as const, defaultCompanion.jump),
    visibility: pick("visibility", ["rules", "empty", "manual"] as const, defaultCompanion.visibility),
    follow: pick("follow", ["page", "workspace"] as const, defaultCompanion.follow),
    quickLink: typeof r.quickLink === "boolean" ? r.quickLink : defaultCompanion.quickLink,
    launcher: pick("launcher", ["top", "edge"] as const, defaultCompanion.launcher)
  };
}
export type CompanionField = { id: string; label: string; value: string; kind?: "property" | "relation" };
export type CompanionTarget = {
  id: string;
  title: string;
  databaseId: string;
  databaseName: string;
  workspaceId: string;
  workspaceName: string;
  kind: "page" | "record";
  fields: CompanionField[];
};
export type ContextSection = {
  id: string;
  title: string;
  fieldIds: string[];
  text?: string;
  visible: boolean;
  condition: CompanionCondition;
  afterId?: string;
  origin?: string;
};
export type SectionPatch = Partial<Omit<ContextSection, "id">> & { id: string; removed?: boolean };
export type ContextConfigurations = Record<string, SectionPatch[]>;
export const contextKey = (profileKey: string) => "aaa-companion-context-v1:" + profileKey;
export function scopeKey(scope: ContextScope, target: CompanionTarget) {
  if (scope === "database") return "database:" + target.databaseId;
  if (scope === "workspace") return "workspace:" + target.workspaceId + ":" + target.databaseId;
  if (scope === "record") return "record:" + target.id;
  return "record-workspace:" + target.workspaceId + ":" + target.id;
}
export function defaultSections(target: CompanionTarget): ContextSection[] {
  const properties = target.fields.filter(f => f.kind !== "relation");
  const relations = target.fields.filter(f => f.kind === "relation");
  return [
    {id:"overview",title:"Overview",fieldIds:properties.slice(0,4).map(f=>f.id),visible:true,condition:"always",origin:"Database"},
    {id:"properties",title:"Reference properties",fieldIds:properties.slice(4).map(f=>f.id),visible:true,condition:"nonempty",origin:"Database"},
    {id:"relationships",title:"Relationships",fieldIds:relations.map(f=>f.id),visible:true,condition:"relation",origin:"Database"}
  ];
}
export function resolveSections(target: CompanionTarget, configs: ContextConfigurations) {
  const layers: ContextScope[] = ["database","workspace","record","record-workspace"];
  const sections = defaultSections(target);
  for (const scope of layers) {
    const patches = configs[scopeKey(scope,target)] || [];
    for (const patch of patches) {
      const index = sections.findIndex(s=>s.id===patch.id);
      if (patch.removed) {
        if (index>=0) sections.splice(index,1);
        continue;
      }
      const updated = {
        ...(index>=0 ? sections[index] : {id:patch.id,title:"New section",fieldIds:[],visible:true,condition:"always"}),
        ...patch,origin:scope
      } as ContextSection;
      if (index>=0) sections.splice(index,1);
      const after = updated.afterId ? sections.findIndex(s=>s.id===updated.afterId) : -1;
      if (updated.afterId === "__first") sections.unshift(updated);
      else if (after>=0) sections.splice(after+1,0,updated);
      else if (index>=0) sections.splice(Math.min(index,sections.length),0,updated);
      else sections.push(updated);
    }
  }
  return sections;
}
export function sectionVisible(section: ContextSection, target: CompanionTarget, strategy: CompanionVisibility) {
  if (!section.visible) return false;
  if (strategy === "manual") return true;
  const fields = target.fields.filter(f=>section.fieldIds.includes(f.id));
  const nonempty = fields.some(f=>f.value.trim()!=="") || !!section.text?.trim();
  if (strategy === "empty") return nonempty;
  if (section.condition === "always") return true;
  if (section.condition === "nonempty" || section.condition === "property") return nonempty;
  if (section.condition === "relation") return target.fields.some(f=>f.kind==="relation" && !!f.value.trim());
  return target.workspaceId !== "none";
}