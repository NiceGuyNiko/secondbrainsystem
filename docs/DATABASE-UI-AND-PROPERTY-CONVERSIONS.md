# Database polish, event chronology and safe property reconstruction

Status: staging implementation and next-phase specification. No production migration or merge approved.

## UI acceptance (this branch)
- Property headings show their user-defined name only. Their types are inspectable in the property menu, not redundantly printed under each column.
- Clicking a heading opens a floating editor that does not change table geometry. Clicking outside consumes the event and closes the menu without activating the underlying table cell.
- The table has synchronized horizontal scrollbars above and below the columns.
- Removing a property archives it. Archived property IDs and values remain stored. **No template setup or starter import may resurrect or repopulate it**; only explicit Restore may do so.
- Existing author data and relation edges must never be deleted during these UI changes.

## Event-first character context
- World chronology uses one Events database. Every Era, Major Event, Event or Moment is a record, including standalone Moments with no parent. Parent event is optional, not a requirement for chronology.
- A Character's Perspective/snapshot is the authoritative record for what they know, want, believe, and which Groups or Abilities they have *during* a particular Event/Moment.
- The backend's db_perspectives association retains a unique permanent record ID for each relevant Character × Event pair, but the ordinary sidebar does not expose Perspectives as an eighth worldbuilding database. Perspectives are opened from Characters and shown on their Events in a chronological view.
- A private meeting may be created as an unparented Moment then linked to one or more Character snapshots. If an umbrella Event becomes known later, set Parent event without changing any snapshot identity.
- Chronology order is optional. Do not invent exact dates or extrapolate status across Events. Blank order means placement is still unresolved.
- Automatic carry-forward of character state and conflict resolution between Events is not part of this build; events and snapshots remain editable canonical sources.

## Future: safe property type reconstruction
This is a design requirement, **not yet a shipped conversion UI**.

1. The user chooses a source property and target type (e.g. Select → Text; Relation → Text).
2. The engine produces a **non-destructive conversion preview** with before/after examples for every affected record and counts of exceptions. It must show human-readable linked record titles, never UUIDs.
3. Multi-value sources become readable delimited text (e.g. if Michael's Parents relation targets Rosalina and Theodore, preview `Rosalina, Theodore`). Single select values become plain text (e.g. `Canon`), with no loss of visible information.
4. The user explicitly confirms a conversion strategy. The operation records source property ID, value snapshot/version, order and relation titles; updates destination type/values and preserves the old data long enough for rollback.
5. Type conversions must be transactional, idempotent, owner-RLS protected, version checked, and auditable. Inverse links and historical snapshots must not be silently destroyed. Where conversion cannot be lossless, it should produce a new property rather than mutating the old one.
6. All operations need authenticated staging tests for two users, real PostgREST behavior and rollback before any production request.

In particular, converting a Relation to Text is **not** equivalent to changing metadata `type` in place; it requires gathering the display names of linked records and a deliberate decision about preserving the original graph.
