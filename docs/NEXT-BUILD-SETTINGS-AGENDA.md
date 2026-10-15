# Branding, Settings, Ontario Holidays and Agenda

## Changes

- Supplied gold logo in desktop sidebar, collapsed rail, mobile header, favicon and Apple icon. Brand gold remains fixed across themes.
- Settings sits directly under Resources with GO badge. Seven contextual settings categories stay accessible as icons when the sidebar collapses. General links to settings cards; Account opens the existing profile editor. Notification and data controls are explicitly planned.
- Appearance retains the working theme studio; adds Midnight and Slate without removing previous palettes or overriding event calendar colours.
- Calendar & Time owns week start, clock and Column / Pin / Toggle Agenda preferences. New preferences, Toggle pin state, Developer Mode and calendar visibility persist per account in this browser. Existing appearance persistence is retained. Preferences are not yet synced between devices.
- Developer Mode defaults off and hides beta navigation. Linked canonical working pages remain accessible through Resources without exposing the beta navigation entry. Disabling Developer Mode does not delete data.
- Ontario holidays are deterministic generated all-day events on the existing Holiday/Holidays calendar, with a fallback Holiday calendar if absent. Movable dates recalculate per year; generated records do not write to the personal calendar or database. Existing matching holiday occurrences are not duplicated. Generated holidays are read-only and show classification details.
- Actual holidays, observances and common weekday observed dates are distinct. Common observed dates are labelled as a convention; actual ESA substitute days depend on employment arrangements. Christmas/Boxing Day collisions are handled. Ontario timezone is attached to every generated holiday.
- Month uses left titles/right start times and compact overflow links. Week and Day share the chronological time grid. Groups exceeding three overlap lanes become an interval-labelled event group that opens the full day list; calendar positions and original durations are retained.
- Agenda control lives beside the panel, including when closed. Column always docks and has no desktop pin or X. Pin always reopens as an overlay, with temporary docking. Toggle retains pin/unpin in both states and remembers the choice across reloads. Edge gestures open/close; header right-swipes close. Mobile overrides presentation to full-screen and retains desktop preferences.

## Validation

- Ten automated tests pass, including holiday dates/classifications, observed-date collisions, stable generation across leap years, Agenda mode rules, existing layout tests and isolated database regressions.
- TypeScript and production build pass. Lint has warnings but no errors.
- Browser interaction/visual checks are unverified: the local browser executable is unavailable and the cloud browser cannot reach localhost. This includes real device swipe verification and phone-width screenshots. No production test records were created.
- No database schema changes, migrations or authentication changes are required.

## Holiday sources

- https://www.ontario.ca/document/your-guide-employment-standards-act-0/public-holidays
- https://www.ontario.ca/document/employment-standard-act-policy-and-interpretation-manual/part-i-definitions
- https://www.ontario.ca/laws/regulation/900977 (public-service weekday observance convention; not universal ESA substitute dates)
