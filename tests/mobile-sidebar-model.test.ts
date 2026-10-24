import test from "node:test";
import assert from "node:assert/strict";
import {toggleMobileSidebarMode,modeForMobileSidebarDivider,modeAfterSidebarPageSelection} from "../lib/mobile-sidebar-model";

test("mobile sidebar opens to contextual subpages and page heading toggles all pages",()=>{
  assert.equal(toggleMobileSidebarMode("subpages"),"pages");
  assert.equal(toggleMobileSidebarMode("pages"),"subpages");
  assert.equal(toggleMobileSidebarMode("split"),"pages");
  assert.equal(modeAfterSidebarPageSelection(),"subpages");
});
test("dragging the mobile divider exposes independent page and subpage panes",()=>{
  assert.equal(modeForMobileSidebarDivider(12),"subpages");
  assert.equal(modeForMobileSidebarDivider(38),"split");
  assert.equal(modeForMobileSidebarDivider(72),"split");
  assert.equal(modeForMobileSidebarDivider(85),"pages");
});
