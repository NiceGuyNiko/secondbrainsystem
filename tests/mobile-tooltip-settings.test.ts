import test from "node:test";
import assert from "node:assert/strict";
import {defaultSettings,parsePreferences,parseSettings,updateActivePreferences,activeProfile} from "../lib/settings/model";
import {DEFAULT_MOBILE_TOOLTIP_MODE,mobileGestureShowsTooltip,parseMobileTooltipMode} from "../lib/mobile-tooltip-settings";

test("mobile tooltip mode defaults to hold and repairs old or damaged profiles",()=>{
  assert.equal(DEFAULT_MOBILE_TOOLTIP_MODE,"hold");
  assert.equal(defaultSettings().profiles[0].preferences.mobileTooltipMode,"hold");
  assert.equal(parsePreferences({}).mobileTooltipMode,"hold");
  assert.equal(parsePreferences({mobileTooltipMode:"anything"}).mobileTooltipMode,"hold");
  assert.equal(parseMobileTooltipMode("tap"),"tap");
  assert.equal(parseMobileTooltipMode("off"),"off");
  assert.equal(parseMobileTooltipMode("hold"),"hold");
});
test("single taps never show mobile tooltips by default; explicit tap and off modes are respected",()=>{
  assert.equal(mobileGestureShowsTooltip("hold","tap"),false);
  assert.equal(mobileGestureShowsTooltip("hold","hold"),true);
  assert.equal(mobileGestureShowsTooltip("tap","tap"),true);
  assert.equal(mobileGestureShowsTooltip("tap","hold"),false);
  assert.equal(mobileGestureShowsTooltip("off","tap"),false);
  assert.equal(mobileGestureShowsTooltip("off","hold"),false);
});
test("mobile tooltip choice is a saved profile preference, not an account-wide switch",()=>{
  const old=defaultSettings();
  const changed=updateActivePreferences(old,()=>({mobileTooltipMode:"tap"}));
  assert.equal(activeProfile(old).preferences.mobileTooltipMode,"hold");
  assert.equal(activeProfile(changed).preferences.mobileTooltipMode,"tap");
  const restored=parseSettings(JSON.parse(JSON.stringify(changed)))!;
  assert.equal(activeProfile(restored).preferences.mobileTooltipMode,"tap");
  const oldSaved=JSON.parse(JSON.stringify(changed));
  delete oldSaved.profiles[0].preferences.mobileTooltipMode;
  assert.equal(activeProfile(parseSettings(oldSaved)!).preferences.mobileTooltipMode,"hold");
});
