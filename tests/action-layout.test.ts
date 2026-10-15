import { test } from "node:test";
import assert from "node:assert/strict";
import {
  packWeek,
  timedLanes,
  type CalendarEvent,
  type Occurrence,
} from "../lib/calendar-layout";
import {
  themeTokens,
  appearanceDefaults,
  ownedPageTitle,
  parseAppearance,
  palettes,
  foreground,
} from "../lib/appearance";
const days = [
  "2026-10-12",
  "2026-10-13",
  "2026-10-14",
  "2026-10-15",
  "2026-10-16",
  "2026-10-17",
  "2026-10-18",
];
const o = (
  id: number,
  date: string,
  endDate = date,
  allDay = false,
  start = "09:00",
  end = "10:00",
): Occurrence => ({
  event: {
    id,
    title: String(id),
    date,
    endDate,
    allDay,
    start,
    end,
    kind: "block",
    category: "Work",
    tasks: [],
  } as CalendarEvent,
  date,
  endDate,
});
test("month packs bullets into each day’s free lanes and counts hidden ribbons", () => {
  const events = [
    o(1, days[0], days[3], true),
    o(2, days[0], days[1], true),
    o(3, days[2]),
    o(4, days[2]),
    o(5, days[4]),
  ];
  const packed = packWeek(days, events, 3);
  assert.equal(packed.bars.length, 2);
  assert.deepEqual(
    packed.columns[2].shown.map((x) => x.lane),
    [1, 2],
  );
  assert.equal(packed.columns[4].shown[0].lane, 0);
  const crowded = packWeek(days, events, 1);
  assert.equal(crowded.columns[0].hidden.length, 1);
  assert.equal(crowded.columns[2].hidden.length, 2);
  assert.equal(packWeek(days, events, 0).columns[0].hidden.length, 2);
});
test("Agenda uses lanes for overlapping and cross-midnight timed events", () => {
  const events = [
    o(1, days[0], days[1], false, "23:00", "01:00"),
    o(2, days[1], days[1], false, "00:30", "02:00"),
    o(3, days[1], days[1], false, "02:00", "03:00"),
    o(4, days[1], days[1], true),
  ];
  const positions = timedLanes(events, days[1]);
  assert.equal(positions.length, 3);
  assert.equal(positions[0].start, 0);
  assert.equal(positions[0].end, 60);
  assert.equal(positions[0].lanes, 2);
  assert.equal(positions[1].lane, 1);
  assert.equal(positions[2].lanes, 1);
});
test("all presets preserve dark black panels, separate canvas and readable foregrounds", () => {
  for (const preset of palettes)
    for (const surface of ["flat", "layered", "defined"] as const) {
      const t = themeTokens({
        ...appearanceDefaults,
        preset: preset.id,
        surface,
      });
      assert.equal(t.sidebar, "#000000");
      assert.equal(t.agenda, "#000000");
      assert.notEqual(t.canvas, "#000000");
      assert.notEqual(t.canvas, t.calendar);
    }
  assert.equal(foreground("#C6A15C"), "#101310");
  assert.equal(foreground("#346851"), "#FFFFFF");
  assert.equal(ownedPageTitle("James", "Calendar"), "James' Calendar");
  assert.equal(ownedPageTitle("Niko", "Goals"), "Niko's Goals");
  assert.equal(ownedPageTitle("", "Resources"), "Your Resources");
  assert.deepEqual(
    parseAppearance({ preset: "bad", corners: "bad" }),
    appearanceDefaults,
  );
});
