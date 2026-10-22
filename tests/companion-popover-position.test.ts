import assert from "node:assert/strict";
import {test} from "node:test";
import {positionCompanionPopover} from "../lib/companion-popover-position";

test("Companion menu stays anchored to the same tab regardless of cursor position",()=>{
  const tab={left:750,top:12,bottom:58,width:40};
  const viewport={width:1200,height:800};
  const expected=positionCompanionPopover(tab,viewport,{width:218,height:50});
  assert.deepEqual(expected,{left:750,top:65});
  assert.deepEqual(positionCompanionPopover({...tab},viewport,{width:218,height:50}),expected);
});
test("Companion popover flips above a lower tab and stays within the viewport",()=>{
  const viewport={width:380,height:320};
  const popup=positionCompanionPopover({left:350,top:267,bottom:300,width:28},viewport,{width:218,height:50});
  assert.deepEqual(popup,{left:154,top:210});
  assert.ok(popup.left>=8&&popup.top>=8);
});
test("Companion icon tooltip is centered around its tab and viewport-clamped",()=>{
  const tooltip=positionCompanionPopover({left:80,top:12,bottom:45,width:40},{width:500,height:300},{width:116,height:34},"center");
  assert.deepEqual(tooltip,{left:42,top:52});
  const corner=positionCompanionPopover({left:2,top:10,bottom:43,width:32},{width:130,height:300},{width:116,height:34},"center");
  assert.equal(corner.left,8);
});
