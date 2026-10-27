import test from "node:test";
import assert from "node:assert/strict";
import {widgetDragInterruptedByKey} from "../lib/widget-drag-interruptions";

const key=(key:string,ctrlKey=false,shiftKey=false,metaKey=false)=>
  ({key,ctrlKey,shiftKey,metaKey});

test("Ctrl+Shift+S cancels an active widget drag instead of stranding the ghost",()=>{
  assert.equal(widgetDragInterruptedByKey(key("s",true,true)),true);
  assert.equal(widgetDragInterruptedByKey(key("S",true,true)),true);
});
test("Windows/macOS alternate screenshot and Escape keys also cancel",()=>{
  assert.equal(widgetDragInterruptedByKey(key("s",false,true,true)),true);
  assert.equal(widgetDragInterruptedByKey(key("Escape")),true);
});
test("ordinary typing, shortcuts and scrolling do not cancel a widget drag",()=>{
  assert.equal(widgetDragInterruptedByKey(key("s")),false);
  assert.equal(widgetDragInterruptedByKey(key("s",true,false)),false);
  assert.equal(widgetDragInterruptedByKey(key("ArrowUp")),false);
});
