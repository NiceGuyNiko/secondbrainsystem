export type AgendaPreference = "column" | "pin" | "toggle";
export type Presentation = "closed" | "overlay" | "pinned";
export function openAgenda(preference: AgendaPreference, pinned: boolean): Presentation {
  return preference === "column" || (preference === "toggle" && pinned) ? "pinned" : "overlay";
}
export function canPin(preference: AgendaPreference, mode: Presentation) {
  // The permanent Column presentation has no pin/unpin controls. Toggle
  // remembers its last docked state; Pin starts as a pullout and may dock.
  return mode!=="closed"&&(preference === "toggle" || preference === "pin");
}
