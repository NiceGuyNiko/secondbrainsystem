import assert from "node:assert/strict";
import {test} from "node:test";
import {formatCalendarDate,parseCalendarDateFormat,defaultCalendarDateFormat} from "../lib/calendar-date-format";

test("event date default matches Agenda's full weekday, month and year",()=>{
  assert.equal(defaultCalendarDateFormat,"long");
  assert.equal(formatCalendarDate("2026-10-07"),"Wednesday, October 7, 2026");
  assert.equal(formatCalendarDate("2026-10-22","long"),"Thursday, October 22, 2026");
});
test("event editor supports month-first and unambiguous ISO preferences",()=>{
  assert.equal(formatCalendarDate("2026-10-07","friendly"),"October 7, 2026");
  assert.equal(formatCalendarDate("2026-10-07","compact"),"2026-10-07");
});
test("invalid or legacy preference falls back without breaking date values",()=>{
  assert.equal(parseCalendarDateFormat(undefined),"long");
  assert.equal(parseCalendarDateFormat("other"),"long");
  assert.equal(parseCalendarDateFormat("compact"),"compact");
  assert.equal(formatCalendarDate(""),"Choose date");
  assert.equal(formatCalendarDate("nonsense"),"nonsense");
});
