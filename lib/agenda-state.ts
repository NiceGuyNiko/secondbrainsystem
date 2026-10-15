export type AgendaPreference = "column" | "pin" | "toggle";
export type Presentation = "closed" | "overlay" | "pinned";
export function openAgenda(preference: AgendaPreference, pinned: boolean): Presentation {
  return preference === "column" || (preference === "toggle" && pinned) ? "pinned" : "overlay";
}
export function canPin(preference: AgendaPreference, mode: Presentation) {
  return preference === "toggle" || (preference === "pin" && mode === "overlay");
}
