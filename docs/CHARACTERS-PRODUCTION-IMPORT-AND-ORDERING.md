# Character migration and database table controls — October 20, 2026

## Character import completed

Source Supabase project: `secondbrainsystem-staging` (isolated acceptance dataset). Destination: the existing production `secondbrainsystem` Supabase project, under the authenticated owner's corresponding account. The owner's email was verified by comparing its SHA-256 hash in both projects; no credentials or user emails are stored here.

The source Characters database contained 23 active records and 18 property definitions (9 active, 9 archived). Production Characters initially contained zero records. Import was run in one SQL transaction with collision checks and created:

- 23 Character thought-backed pages and their `db_records`, retaining the source record IDs and original names, summaries, scalar values and permanent sequence order.
- 15 missing property definitions; the three matching properties were reused, preserving production IDs and configurations.
- 21 relational links: 12 between Characters and 9 from Characters to existing production Events. All 9 Event links were matched by exact normalized Event title, so the Event records were not duplicated.
- Archived/hidden status for 9 properties, respecting the author's prior deletions. Existing values in archived properties remain stored and may be recovered explicitly.

**Post-import verification:** Production: 23 Characters, 21 Character links, 18 Character property definitions, 9 archived property definitions, 17 unchanged production Events. The original planning and calendar datasets were not migrated. Four staging Perspectives were intentionally excluded because this request was specifically a Character import and their Event identities need separate review.

The import must NOT be run again blindly. It contains an explicit destination-empty and ID-collision precondition. Re-running it after success would be rejected.

## Database table interactions

- Archive a record using its row action or the detail page. Archives are reversible, preserving stable record IDs and relation links.
- Restore from the Archived records section. When restored, the original record identity and links remain.
- Drag columns by their handle (or use left/right buttons); drag records by their handle (or use up/down buttons). These reorders change `position`, **not** `sequence_no` or IDs.
- Reorder requests use owner-scoped, security-invoker RPCs with an advisory lock and an exact active-ID permutation check. Malformed, stale, duplicate, cross-account and partial orders fail.
- Existing archived properties can be restored from the Properties panel. Removing a property is reversible and the setup templates must not recreate a manually archived property.
- When a saved view has an explicit sort, the sort is authoritative for display; manual order is the fallback when no sort is configured.

No hard deletion of canonical thought pages is included, to avoid breaking dependent links or snapshots.
