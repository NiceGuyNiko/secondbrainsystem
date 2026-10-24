import test from "node:test";
import assert from "node:assert/strict";
import {formatDatabasePropertyValue,numberFormatOf,percentageValue} from "../lib/db-property-format";

test("progress stores a numeric 0-100 value but displays percentage by default",()=>{
  const progress={name:"Outcome progress",type:"number",config:{}};
  assert.equal(numberFormatOf(progress),"percent");
  assert.equal(formatDatabasePropertyValue(progress,65),"65%");
  assert.equal(formatDatabasePropertyValue(progress,42),"42%");
  assert.equal(percentageValue(110),100);
  assert.equal(percentageValue(-15),0);
  assert.equal(percentageValue(null),null);
  assert.equal(formatDatabasePropertyValue({...progress,config:{numberFormat:"number"}},65),"65");
  assert.equal(formatDatabasePropertyValue({...progress,config:{numberFormat:"bar"}},65),"65%");
});
test("number display preferences support precision and currency without mutating values",()=>{
  const number={name:"Cost",type:"number",config:{numberFormat:"number",decimalPlaces:2}};
  assert.equal(formatDatabasePropertyValue(number,1299.5),"1,299.50");
  assert.equal(formatDatabasePropertyValue({...number,config:{numberFormat:"currency",decimalPlaces:2,currencyCode:"CAD"}},25),"$25.00");
  assert.equal(formatDatabasePropertyValue({name:"Progress",type:"number",config:{numberFormat:"percent",decimalPlaces:1}},65.5),"65.5%");
});
test("dates and checkboxes have independent display options",()=>{
  assert.equal(formatDatabasePropertyValue({type:"date",config:{dateFormat:"iso"}},"2026-10-23"),"2026-10-23");
  assert.match(formatDatabasePropertyValue({type:"date",config:{dateFormat:"long"}},"2026-10-23"),/October/);
  assert.equal(formatDatabasePropertyValue({type:"checkbox",config:{checkboxFormat:"done"}},true),"Done");
  assert.equal(formatDatabasePropertyValue({type:"checkbox",config:{checkboxFormat:"icon"}},false),"○");
  assert.equal(formatDatabasePropertyValue({type:"number",config:{}},null),"—");
});
