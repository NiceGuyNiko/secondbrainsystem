# The Companion V5 — Preview Review

Branch: feature/companion-hybrid-context-v5 (never merge without review).

## Confirmed product decisions
- Keep the current toggle/pin/column placement concept, including remembering a pinned Toggle position.
- Move the launcher to a square at the top-right (edge position is a testable alternative).
- Companion owns three tools: The Agenda, Context and Thoughts.
- Hybrid Single/Split layout with two vertically resizable tools (one tool per section).
- Agenda follows today's clock; navigating to a different day jumps near its first timed block. All-day blocks stay separate above the timeline.
- Context follows the active page by default and can be locked. Workspace context is an optional view.
- Context layout inheritance: database template → workspace override → record-global override → record-within-workspace override → personal display state.
- Sections support property/reference blocks and configurable visibility (always, not empty, has a property value, has relationships, in a workspace).
- Thoughts show related or general items; quick capture supports linking to the current Context reference.

## Developer-selected defaults and alternatives
| Choice | Implemented default | Alternative in Settings |
|---|---|---|
| Initial layout | Split (Context top, Agenda bottom) | Single |
| Top section size | 52% | Slider 25% to 75%, draggable separator |
| Launcher | Top-right square | Right-edge handle |
| Panel opening | Toggle, remember pin state | Pin; Column |
| Agenda new-day alignment | First timed event | Midnight |
| Context scope | Follow active page | Workspace overview |
| Section visibility | Rules | Hide empties; manual only |
| Thought capture | Link checkbox enabled | Disabled |
| Section configuration scope | Workspace | Database, Record, Record-in-workspace |

## Architecture and boundaries
- This preview reads canonical database records using their existing stable IDs; it does not create duplicated canonical records.
- Context layouts and record-specific overrides are browser-local, profile-keyed experiment data. They do NOT yet sync across devices or write to production Supabase.
- Context values are sourced from the active database view. If a locked record is changed while not actively open, refreshing/reopening the source may be necessary for the latest value.
- Thought capture uses the existing Thought backend; it creates actual Thoughts for the signed-in account. Treat experimental Thoughts accordingly.
- No schema migrations or legacy data migrations are included.
- The existing older per-record DatabaseCompanion remains in place in legacy planning surfaces; the new global Companion is the new right-hand shell.

## On-device review checklist
1. Open and close the Companion from the top-right button; test right-edge alternative.
2. Test Toggle, Pin and Column settings; verify which modes remember placement.
3. Single/Hybrid changes; swap tools; pin a tool; resize divider; reload and test persistence.
4. Select today, tomorrow, a day with all-day items, a day with several timed blocks and a totally empty day; test first-block and midnight alignments.
5. Complete a task from a calendar block and open any linked working page.
6. Go Databases → Characters → an existing record. Verify property labels/values update when choosing another record.
7. Lock Context, navigate elsewhere and unlock; compare page-follow with workspace-overview behavior.
8. Configure Overview, Properties and Relationships; add a record-specific section; test rule types and Reset Scope.
9. Compare database, workspace, record and record-in-workspace scope precedence. Test hidden sections, ordering, and browser refresh.
10. Capture one generic Thought and one linked Thought. Verify Related/All filters and that the full Thought page opens.
11. Change test profiles; check that Companion settings are separately remembered.
12. Check narrow screens, light and dark themes, keyboard tabbing, reduced motion and high zoom.
13. Verify canonical records and calendars remain unchanged after altering only Context layout.
14. Report any failed state changes, missing records, stale locked-reference values or other behavior differences.

## Known preview limitations
- Section builder supports selected canonical properties, simple inline notes and configurable conditional visibility, but does not yet embed the full database-query view builder.
- Context source editing is performed in the existing record editor, not inline from this panel.
- Browser-local Context configurations are intentionally not durable server-side templates.
- Locking follows the stable target ID, but remote mutations to an inactive locked record are not live-subscribed.
- Tool pinning is an experimental control; it fixes the selected section's tool, not its record reference.
- The preview's visual and interaction behavior still requires human review; successful Vercel build does not constitute full end-to-end testing.
