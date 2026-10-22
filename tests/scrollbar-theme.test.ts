import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {themeTokens,appearanceDefaults} from "../lib/appearance";

const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
const lab=readFileSync(new URL("../app/database-lab/lab.css",import.meta.url),"utf8");

test("Black & Gold theme provides a gold scrollbar accent",()=>{
  const tokens=themeTokens({...appearanceDefaults,preset:"black-gold"});
  assert.equal(tokens.accent,"#C6A15C");
  assert.equal(tokens.text,"#F6F1E7");
});

test("custom select scrollbar uses theme accent and clips to rounded menu",()=>{
  const block=css.slice(css.indexOf("/* Theme-consistent dropdown scrollbars:"));
  assert.match(block,/scrollbar-color:var\(--accent\) var\(--surface-2\)/);
  assert.match(block,/clip-path:inset\(0 round 10px\)/);
  assert.doesNotMatch(block,/::picker\(select\)\{scrollbar-color:auto\}/);
  assert.match(block, /::-webkit-scrollbar-thumb\{\s*background:var\(--accent\)/);
  assert.match(block, /::-webkit-scrollbar-button:vertical:increment/);
  assert.match(block, /::-webkit-scrollbar-button:vertical:decrement/);
});

test("scrollable workspaces, database tables and range sliders use theme accent",()=>{
  assert.match(css, /:root\{\s*scrollbar-color:var\(--accent\) var\(--surface-2\)/);
  assert.match(css, /input\[type="range"\]\{\s*accent-color:var\(--accent\)/);
  assert.match(lab, /\.db-lab-top-scroll::-webkit-scrollbar-thumb.*background:var\(--accent\)/);
});
