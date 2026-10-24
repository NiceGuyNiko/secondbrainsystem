import test from "node:test";
import assert from "node:assert/strict";
import {isWidgetRecordExpanded,toggleWidgetRecordExpanded} from "../lib/widget-inline-details";

test("record detail toggles independently inside the same widget",()=>{
  let state={};
  state=toggleWidgetRecordExpanded(state,"character-gallery","michael");
  state=toggleWidgetRecordExpanded(state,"character-gallery","camilla");
  assert.equal(isWidgetRecordExpanded(state,"character-gallery","michael"),true);
  assert.equal(isWidgetRecordExpanded(state,"character-gallery","camilla"),true);
  state=toggleWidgetRecordExpanded(state,"character-gallery","michael");
  assert.equal(isWidgetRecordExpanded(state,"character-gallery","michael"),false);
  assert.equal(isWidgetRecordExpanded(state,"character-gallery","camilla"),true);
});
test("multiple widget instances do not share open record state",()=>{
  let state={};
  state=toggleWidgetRecordExpanded(state,"library-gallery","michael");
  assert.equal(isWidgetRecordExpanded(state,"goals-gallery","michael"),false);
  state=toggleWidgetRecordExpanded(state,"goals-gallery","michael");
  state=toggleWidgetRecordExpanded(state,"library-gallery","michael");
  assert.equal(isWidgetRecordExpanded(state,"goals-gallery","michael"),true);
});
