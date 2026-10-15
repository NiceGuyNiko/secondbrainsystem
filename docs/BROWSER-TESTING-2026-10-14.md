# Authenticated browser testing — 14 October 2026

Tested the development preview `https://secondbrainsystem-git-feature-pr11-ui-sidebar-niceguyniko.vercel.app/` after live database activation. The user authorized browser testing and deferred Notion import and Think About It development. No application source changes were made in this pass.

## Verified in the signed-in desktop browser

| Flow | Evidence / outcome |
| --- | --- |
| Month viewport | At 1363 × 936 CSS pixels, document scroll dimensions matched the viewport; all five calendar weeks fit. |
| Sidebar collapse | Primary/contextual row y-coordinates and heights were identical before/after collapsing. Saved calendar visibility controls remained accessible. |
| Agenda modes | Overlay opened; pin changed it to an in-flow column and reduced calendar width without horizontal overflow; close worked. |
| Today / Now | Agenda showed today's full date, 24 hours through 11:59 PM, current clock/marker, and an initial scroll position showing the marker. |
| Shared filtering | Hiding the Important calendar removed its timed Agenda block and reduced visible count from four to three; restoring the calendar restored it. |
| Quick details | An existing block showed its task list and time/category without opening the structural editor. Existing tasks were not modified. |
| Existing event editor | A day-cell plus opened the retained date-prefilled editor. All-day hid time controls; batch mode exposed date-chip editing/removal. |
| Recurrence | Daily interval with three additional repetitions displayed four occurrences and the expected final date. No recurrence test series was saved. |
| Unsaved-change guard | Cancel after editor changes opened the discard confirmation; discard closed it. |
| Goal persistence | Created a marked QA goal, set outcome target 100 words, recorded 15 words, reloaded and reopened the same goal: 15/100 persisted. |
| Task → calendar → Agenda | Created a canonical QA task, linked it to the QA goal, scheduled it through the existing editor, completed it through Agenda and verified completion from the Tasks page after reload. Goal measurement remained 15/100. |
| Writing workspace | Created a marked QA workspace, Event and Character through normal UI. |
| Perspective matrix | Clicking the relevant empty cell created P1; summary and before/after fields saved. Swapping axes retained P1 and its content. Axis headers opened canonical records. |
| Character timeline | The character's timeline showed P1; opening it returned the same saved summary. |
| Turning point | Different before/after states produced `suggested`, not automatic author confirmation/canon. |
| Black & Gold | Selection produced gold primary accent `#C6A15C`, dark button foreground `#101310`, black sidebar and non-black canvas `rgb(18,15,11)`. Restored Midnight Forest afterwards. |

## Cleanup and data preservation

Eight QA records were created with the unique prefix `QA_BROWSER_20261014_2042`: seven canonical thoughts/planning records and one calendar block. Cleanup used an exact eight-UUID allowlist with a prefix/count guard and a single transaction, removing only those authored QA records and their dependencies. No existing user record was deleted or modified. Sequential display counters were not reset or reused.

Verified after cleanup: zero matching QA records remain, the original calendar has 66 rows, and its title/content fingerprint is unchanged from before activation and testing. Real goals/projects created by the user during this session were preserved.

## Remaining / limitations

- Real phone-width and mobile-device testing remain unverified. The exposed browser APIs did not provide viewport resizing; keyboard shortcuts did not produce a measurable phone-width viewport. Desktop results are not presented as mobile verification.
- This pass did not exhaustively test every repeat/delete/duplicate/exception/time-zone/DST combination, drag/resizing, 200% zoom, assistive technology, light mode, CSS clipboard export, all appearance controls or multi-tab concurrency.
- Initial loading briefly shows the placeholder possessive `My's Calendar` before the actual profile resolves. This is a minor text polish item; the loaded user's possessive rendered correctly.
- One rapid navigation attempt immediately after reload returned to the Goals tab before the Tasks locator settled; navigation and persisted state worked after the page finished loading. Loading/hydration timing deserves a separate repeatable check.
- Notion import and changes to Think About It are intentionally out of scope for this pass.
