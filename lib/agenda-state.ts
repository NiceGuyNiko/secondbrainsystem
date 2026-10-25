export type AgendaPreference = "column" | "pin" | "toggle";
export type Presentation = "closed" | "overlay" | "pinned";
export function openAgenda(preference: AgendaPreference, pinned: boolean): Presentation {
  return preference === "column" || (preference === "toggle" && pinned) ? "pinned" : "overlay";
}
export function canPin(preference: AgendaPreference, mode: Presentation) {
  // Column is still the launch/default presentation, but the user can
  // temporarily unpin it into a pull-out without changing Settings.
  return preference === "column" || preference === "toggle" || (preference === "pin" && mode === "overlay");
}
