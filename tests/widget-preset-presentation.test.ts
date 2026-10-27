import test from "node:test";
import assert from "node:assert/strict";
import {modeAtWidth,modeWithHysteresis} from "../lib/widget-preset-presentation";
test("all preset display thresholds use measured content pixels",()=>{
 const widths=[900,700,699,450,449,280,279];
 assert.deepEqual(widths.map(modeAtWidth),
 ["expanded","expanded","comfortable","comfortable","compact","compact","minimal"]);
});
test("hysteresis holds until twelve pixels past a boundary",()=>{
 assert.equal(modeWithHysteresis(697,"expanded"),"expanded");
 assert.equal(modeWithHysteresis(688,"expanded"),"expanded");
 assert.equal(modeWithHysteresis(687,"expanded"),"comfortable");
 assert.equal(modeWithHysteresis(711,"comfortable"),"comfortable");
 assert.equal(modeWithHysteresis(712,"comfortable"),"expanded");
 assert.equal(modeWithHysteresis(267,"compact"),"minimal");
 assert.equal(modeWithHysteresis(292,"minimal"),"compact");
});
test("final settled mode is direct and never persisted",()=>{
 assert.equal(modeAtWidth(690),"comfortable");
 assert.equal(modeWithHysteresis(690,null),"comfortable");
});
