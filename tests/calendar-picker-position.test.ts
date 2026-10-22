import assert from "node:assert/strict";
import {test} from "node:test";
import {positionCalendarPicker} from "../lib/calendar-picker-position";

test("calendar popover matches the field width and opens below when it fits",()=>{
  assert.deepEqual(
    positionCalendarPicker({left:75,top:80,bottom:123,width:232},{width:800,height:720},268),
    {left:75,top:129,width:232,maxHeight:268}
  );
});
test("time popup opens above only when the lower space cannot hold it",()=>{
  assert.deepEqual(
    positionCalendarPicker({left:300,top:500,bottom:543,width:176},{width:800,height:640},130),
    {left:300,top:364,width:176,maxHeight:130}
  );
});
test("a narrow viewport uses the available space without overflowing the screen",()=>{
  const result=positionCalendarPicker(
    {left:110,top:180,bottom:223,width:176},{width:300,height:350},268
  );
  assert.equal(result.left,110);
  assert.equal(result.width,176);
  assert.equal(result.maxHeight,166);
  assert.equal(result.top,8);
});
