# Phase 2.1 — Inline Editing & The Companion

**Branch:** `feature/databases-phase-2-companion-inline-fixes` (based on Phase 2 preview, NOT merged into `main`).  
**Scope:** Preview-only frontend improvement plus additional demo-store methods. No new migration, production SQL, data import, merge, or production deploy.

## User-reported issues fixed

1. Existing Phase 2 table showed new custom properties but did not let you enter their values directly. Inline editors now appear on click for Summary, Status, and custom scalar property cells. Text input/long text save on blur or Enter/Ctrl+Enter, selects save on choice, checkboxes toggle, multi-select uses an explicit Save. Failures keep the editor available and show an error. All save to the same canonical `planning_records` row with version checks.
2. Clicking a Character/Event/Scene/etc. Name now opens its full canonical record page in the Databases workspace. Use Back to return. Built-in name/summary/status and custom properties are editable. Generated Perspective titles remain protected. In authenticated mode the original Thought page can also be opened in the existing document editor. The fake sample records in Demo Mode intentionally do not offer an unavailable document link.
3. Restored **The Companion** concept recovered from earlier design conversations: contextual Properties, Connections, Thoughts, Feedback, and Questions. The first three show supported real source data and editing; Feedback/Questions are explicit future placeholders (no fake writes). The panel supports docked/overlay and close/reopen; it uses the existing canonical records, not copies. The Agenda remains separately accessible and unchanged. The Companion currently lives in the Databases area; cross-workspace Companion integration is a later step.
4. Hover/focus **?** icons explain Cardinality (one page vs multiple pages), allowed target types, reciprocal relations, property IDs, type, select options, relation paths, Rollup calculations, and table column visibility. Hover/focus native `title` also works as a fallback.
5. Narrow screens do not automatically overlay the table with the Companion. Users can open the panel explicitly; mobile presents it full-screen when requested.

## Validation and safety

- Reuses `databasePropertyStore` and the original `planningStore.save` / `thoughtStore.save` RPCs for canonical optimistic record versions.
- The new demo-only `saveBuiltin` and `renameRecord` methods persist into isolated browser storage, with conflict checking and strict validation.
- Demo scalar writes reject unknown property definitions; the existing demo reset removes these changes.
- Existing Phase 1 and 2 preview branches are untouched. Production data and `main` must remain unchanged.
- Regression test `tests/database-companion-inline.test.ts` checks ID stability, rename, summary/status edits, custom-property preservation, stale-write rejection, and demo reset.

## Still deliberately deferred

- Actual Relations page picker and reciprocals: Phase 3.
- Rollup calculations and filtered multi-hop paths: Phases 3–4.
- Cross-workspace Companion and feedback/question editors: future approved integration.
- Authenticated staging Supabase validation: required before production schema application. Current preview remains browser-only Demo Mode.
