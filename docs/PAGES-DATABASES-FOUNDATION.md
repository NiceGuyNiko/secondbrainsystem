# Page canvas and integrated databases

## Design correction

The supplied all-about-action-playground-final(1).html is the concrete UI and interaction reference. The initial separate “Pages & Databases” explorer has been replaced. Pages are now the primary destination; their saved views occupy the content canvas. There is no extra navigation column inside the canvas. AAA’s native sidebar lists individual pages and management destinations; the Companion follows the current page or edited record. Legacy Widgets remain independently available.

The reference’s scoped CSS, proportions, serif page/card typography, timeline rails, nested levels, card badges, actions, expanded related details, page view headers, View Studio, database tables and modal editing flows have been translated into React components. Colors inherit AAA’s selected theme. No iframe, standalone demo sidebar, or document-level template renderer is embedded in AAA.

## Data and behavior

- A canonical record is a page. Parenting and manual sibling order belong to the database; visible card layout belongs to a saved view.
- A page can embed multiple saved views. Customization updates shared config; Independent copy rebinds just that block. Database defaults do not rewrite blocks.
- Nested Cards supports expand/collapse, before/after/inside drag zones, keyboard-accessible arrows, Move dialog, and Add inside the current card.
- Detailed relationship records retain independent IDs and sequences. They appear under either endpoint, in standalone tables, or grouped by either side.
- Properties have stable IDs and typed values (Text, Number, Date, Select, Image, Relation). Select options use stable IDs. Relations and select inputs share an accessible find/create picker. Creating an endpoint preserves the unfinished form.
- Property renames retain identity. Type changes display a conversion preview and require explicit confirmation; incompatible values reject the conversion. Server snapshots preserve previous schema and values.
- The Guided Builder uses the same commands, with persisted actual-object milestones. Database creation/schema, view/milestone creation and page/view embedding use atomic command batches.
- Native partial-width mobile navigation retains outside-tap/Escape dismissal and focus handling.
- Owner/profile workspace isolation, revision checks, idempotent retries and server validation remain in the independent pd_* namespace. Direct client writes to those tables are revoked.

## Example data

The reference’s four databases, two Relatabases, four pages and six saved views are included only as fresh Demo Mode fixtures. Existing demo workspaces are preserved. Hosted workspaces are empty until the user creates content. Shared Week 1 and Perspective rows retain the same canonical IDs wherever displayed. No legacy production records are migrated.

## Rollout

Branch: feat/pages-databases-foundation; draft PR #30. Preview remains Demo Mode. Enable NEXT_PUBLIC_AAA_PAGES_DATABASES=true only on a staging build to use the remote adapter. Production continues to hide the new module until acceptance and explicit production activation.

Migrations, in order:
1. 20261030010539_pages_databases_foundation.sql
2. 20261030014841_pages_canvas_properties.sql

The second migration is additive: it extends only the new module. Internal v1 write execution is revoked from authenticated callers; the current endpoint enforces ownership, typed property validation, conversions and atomic batches. Authenticated SECURITY DEFINER endpoints are intentional, use an empty search_path and explicit auth.uid checks. Anonymous execution remains revoked.

## Verification and limits

Domain and PGlite integration tests cover canonical identities, bidirectional details, shared view mappings, clone behavior, property conversions, rollback on invalid batches, creation retries, stale revisions, profile/account isolation and revoked direct writes. The reference fixture is checked for shared Week IDs and valid view field mappings.

Browser and remote verification results are recorded in the PR after deployment. Browser-local Demo Mode does not prove authenticated hosted persistence. Production activation still requires the checks in docs/DB-SCHEMA-RELEASE-GATE.md.

Remaining beyond this redesign: import/export UI, rich text/page block types beyond text and live database views, free-page navigation-parent relationships, advanced sorting/filtering, pagination, offline synchronization and collaboration. Type migration history is stored but a user-facing undo/history browser is not yet provided. These are not represented as completed acceptance gates.

### Acceptance evidence

- All 296 repository tests pass; TypeScript, source schema contract, and the production build pass.
- Staging's authenticated, rolled-back SQL smoke test passes atomic batches, typed values, Text-to-Select conversion, grouped view config, page embedding, and persisted builder state. No production DDL was applied.
- Deployed Demo Mode browser acceptance passes native Pages navigation, direct page opening, Era → Event → Moment expansion, opening a linked Perspective, creating A Hidden Warning inside The Blackout with a selected Type and Summary, and persistence after Reload.
- The browser completed all four Guided Builder stages: created a database and Summary property, created Semester 1, saved a Nested Cards view with the Summary mapping, and created a finished page containing that live view.
- Browser inspection caught and corrected explicit picker accessible names and theme contrast on badges/actions. Mobile touch gestures and authenticated hosted-browser persistence remain unverified.
