"use client";
import {useEffect,useState} from "react";

// This setting controls only layout behavior, never canonical records or
// reusable widget definitions. Enabled by default for every profile.
export const WIDGET_GAP_FILL_KEY="aaa-widget-gap-fill";
export const WIDGET_GAP_FILL_EVENT="aaa-widget-gap-fill-changed";
export const WIDGET_FORMATION_KEY="aaa-widget-formation-v1";
export const WIDGET_FORMATION_EVENT="aaa-widget-formation-changed";
export type WidgetDisplacement="same-column"|"next-row";
export type WidgetGapBehavior="off"|"column-rise"|"left-to-right";
export type WidgetFormationPreferences={
  magneticSnapping:boolean;
  snapDistancePx:number;
  fillFreedSpace:WidgetGapBehavior;
  displacement:WidgetDisplacement;
};
export const defaultWidgetFormationPreferences:WidgetFormationPreferences={
  magneticSnapping:true,snapDistancePx:14,fillFreedSpace:"column-rise",displacement:"same-column"
};
export function readWidgetFormationPreferences():WidgetFormationPreferences{
  if(typeof window==="undefined")return defaultWidgetFormationPreferences;
  try{
    const stored=JSON.parse(window.localStorage.getItem(WIDGET_FORMATION_KEY)??"{}");
    const previousFill=readWidgetGapFill();
    return {
      magneticSnapping:typeof stored.magneticSnapping==="boolean"?stored.magneticSnapping:true,
      snapDistancePx:typeof stored.snapDistancePx==="number"&&Number.isFinite(stored.snapDistancePx)
        ?Math.min(40,Math.max(2,stored.snapDistancePx)):14,
      fillFreedSpace:["off","column-rise","left-to-right"].includes(stored.fillFreedSpace)
        ?stored.fillFreedSpace:previousFill?"column-rise":"off",
      displacement:stored.displacement==="next-row"?"next-row":"same-column"
    };
  }catch{return defaultWidgetFormationPreferences}
}
export function writeWidgetFormationPreferences(patch:Partial<WidgetFormationPreferences>){
  if(typeof window==="undefined")return;
  const next={...readWidgetFormationPreferences(),...patch};
  try{window.localStorage.setItem(WIDGET_FORMATION_KEY,JSON.stringify(next))}catch{}
  window.dispatchEvent(new Event(WIDGET_FORMATION_EVENT));
}
export function useWidgetFormationPreferences():[WidgetFormationPreferences,(patch:Partial<WidgetFormationPreferences>)=>void]{
  const [prefs,setPrefs]=useState(defaultWidgetFormationPreferences);
  useEffect(()=>{
    const update=()=>setPrefs(readWidgetFormationPreferences());
    update();window.addEventListener("storage",update);window.addEventListener(WIDGET_FORMATION_EVENT,update);
    window.addEventListener(WIDGET_GAP_FILL_EVENT,update);
    return()=>{window.removeEventListener("storage",update);window.removeEventListener(WIDGET_FORMATION_EVENT,update);
      window.removeEventListener(WIDGET_GAP_FILL_EVENT,update)}
  },[]);
  return [prefs,writeWidgetFormationPreferences];
}
export function readWidgetGapFill(){
  if(typeof window==="undefined")return true;
  try{return window.localStorage.getItem(WIDGET_GAP_FILL_KEY)!=="false"}catch{return true}
}
export function writeWidgetGapFill(value:boolean){
  if(typeof window==="undefined")return;
  try{window.localStorage.setItem(WIDGET_GAP_FILL_KEY,String(value))}catch{}
  window.dispatchEvent(new Event(WIDGET_GAP_FILL_EVENT));
  writeWidgetFormationPreferences({fillFreedSpace:value?"column-rise":"off"});
}
export function useWidgetGapFill():[boolean,(value:boolean)=>void]{
  const [enabled,setEnabled]=useState(true);
  useEffect(()=>{
    const update=()=>setEnabled(readWidgetGapFill());
    update();window.addEventListener("storage",update);window.addEventListener(WIDGET_GAP_FILL_EVENT,update);
    return()=>{window.removeEventListener("storage",update);window.removeEventListener(WIDGET_GAP_FILL_EVENT,update)}
  },[]);
  return [enabled,writeWidgetGapFill];
}
