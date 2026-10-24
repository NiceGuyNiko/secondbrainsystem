"use client";
import {useEffect,useState} from "react";

// This setting controls only layout behavior, never canonical records or
// reusable widget definitions. Enabled by default for every profile.
export const WIDGET_GAP_FILL_KEY="aaa-widget-gap-fill";
export const WIDGET_GAP_FILL_EVENT="aaa-widget-gap-fill-changed";
export function readWidgetGapFill(){
  if(typeof window==="undefined")return true;
  try{return window.localStorage.getItem(WIDGET_GAP_FILL_KEY)!=="false"}catch{return true}
}
export function writeWidgetGapFill(value:boolean){
  if(typeof window==="undefined")return;
  try{window.localStorage.setItem(WIDGET_GAP_FILL_KEY,String(value))}catch{}
  window.dispatchEvent(new Event(WIDGET_GAP_FILL_EVENT));
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
