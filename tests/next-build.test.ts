import test from "node:test";
import assert from "node:assert/strict";
import {ontarioHolidays} from "../lib/ontario-holidays";
import {openAgenda,canPin} from "../lib/agenda-state";
test("Agenda modes reopen with their specified presentation",()=>{
  for(const last of [true,false]){
    assert.equal(openAgenda("column",last),"pinned");
    assert.equal(openAgenda("pin",last),"overlay");
    assert.equal(openAgenda("toggle",last),last?"pinned":"overlay");
  }
  assert.equal(canPin("column","pinned"),true);
  assert.equal(canPin("column","overlay"),true);
  assert.equal(canPin("pin","overlay"),true);
  assert.equal(canPin("pin","pinned"),false);
  assert.equal(canPin("toggle","overlay"),true);
  assert.equal(canPin("toggle","pinned"),true);
});
test("Ontario movable holidays, classifications, and observed collisions",()=>{
  const h=ontarioHolidays(2026);
  for(const [title,date] of [["Good Friday","2026-04-03"],["Easter Sunday","2026-04-05"],["Family Day","2026-02-16"],["Victoria Day","2026-05-18"],["Thanksgiving Day","2026-10-12"],["Boxing Day (observed)","2026-12-28"]]){
    assert.equal(h.find(x=>x.title===title)?.date,date);
  }
  assert.equal(h.filter(x=>x.classification==="Ontario public holiday").length,9);
  assert.equal(h.find(x=>x.title==="Civic Holiday")?.classification,"Observance");
  const next=ontarioHolidays(2027);
  assert.equal(next.find(x=>x.title==="Christmas Day (observed)")?.date,"2027-12-27");
  assert.equal(next.find(x=>x.title==="Boxing Day (observed)")?.date,"2027-12-28");
  assert.equal(ontarioHolidays(2028).find(x=>x.title==="Canada Day (observed)")?.date,"2028-07-03");
});
test("Holiday generation is stable and unique over leap years",()=>{
  for(let y=2024;y<=2040;y++){
    const rows=ontarioHolidays(y);
    assert.deepEqual(rows,ontarioHolidays(y));
    assert.equal(new Set(rows.map(h=>h.id)).size,rows.length);
    assert.ok(rows.every(h=>h.date.startsWith(String(y))&&!Number.isNaN(Date.parse(h.date))));
  }
});
