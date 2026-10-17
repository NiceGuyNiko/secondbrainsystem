import type { PlanningKind } from "./planning";

// One canonical planning record per entity. Categories without an existing kind
// stay visible for design review but cannot create or pretend to load records.
type SupportedKind = Extract<PlanningKind, "character" | "event" | "perspective" | "scene" | "project">;
type Definition = { id: string; label: string; kind: SupportedKind | null; description: string };
export const DATABASE_CATEGORIES = [
  { id: "Characters", label: "Characters", kind: "character", description: "People and their changing roles in the story." },
  { id: "Events", label: "Events", kind: "event", description: "World history, major events, and consequential moments." },
  { id: "Groups", label: "Groups", kind: null, description: "Teams and other collections of people." },
  { id: "Locations", label: "Locations", kind: null, description: "Places in the world." },
  { id: "Perspectives", label: "Perspectives", kind: "perspective", description: "What characters experience and know during events." },
  { id: "Scenes", label: "Scenes", kind: "scene", description: "Narrative scenes referencing canonical events." },
  { id: "Chapters", label: "Chapters", kind: null, description: "Chapters and their scene arrangements." },
  { id: "Books", label: "Books", kind: null, description: "Books and manuscripts." },
  { id: "Projects", label: "Projects", kind: "project", description: "Projects already in the planning system." },
  { id: "Themes", label: "Themes", kind: null, description: "Recurring thematic questions and ideas." },
  { id: "Factions", label: "Factions", kind: null, description: "Organizations and their interests." },
  { id: "Items", label: "Items", kind: null, description: "Important objects and artifacts." },
  { id: "Species", label: "Species / Races", kind: null, description: "Species and cultures." },
  { id: "Magic", label: "Magic / Powers", kind: null, description: "Systems, abilities, and limitations." },
  { id: "Concepts", label: "Concepts", kind: null, description: "Ideas requiring future canonical type mapping." },
  { id: "Notes", label: "Notes", kind: null, description: "Reference notes requiring future Thoughts mapping." },
] as const satisfies readonly Definition[];

export type DatabaseCategory = (typeof DATABASE_CATEGORIES)[number]["id"];
export const databaseById = (id: DatabaseCategory) =>
  DATABASE_CATEGORIES.find((definition) => definition.id === id)!;
export const categoryForKind = (kind: PlanningKind): DatabaseCategory | null =>
  DATABASE_CATEGORIES.find((definition) => definition.kind === kind)?.id ?? null;
