"use client";

import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {positionCompanionPopover} from "@/lib/companion-popover-position";

type TooltipPosition={label:string;left:number;top:number;width:number};
type TooltipTarget={element:HTMLElement;nativeTitle:string|null};

/**
 * One themed tooltip surface for existing titles and a handful of explicit
 * icon-only actions. Reuses the Companion's exact popup skin and positioning.
 * We remove the native title while hovered/focused to avoid browser tooltips
 * appearing over our themed version, then restore it on exit.
 */
export default function ThemedTooltips(){
  const [tooltip,setTooltip]=useState<TooltipPosition|null>(null);
  const active=useRef<TooltipTarget|null>(null);

  useEffect(()=>{
    let lastTouch=0;
    const restore=()=>{
      const previous=active.current;
      if(previous&&previous.nativeTitle!==null&&!previous.element.hasAttribute("title"))
        previous.element.setAttribute("title",previous.nativeTitle);
      active.current=null;
      setTooltip(null);
    };
    const find=(target:EventTarget|null):HTMLElement|null=>{
      if(!(target instanceof Element))return null;
      return target.closest<HTMLElement>("[data-aaa-tooltip], [title]");
    };
    const show=(element:HTMLElement|null)=>{
      if(!element||active.current?.element===element)return;
      const nativeTitle=element.getAttribute("title");
      const label=element.getAttribute("data-aaa-tooltip")||nativeTitle;
      if(!label)return;
      restore();
      if(nativeTitle!==null)element.removeAttribute("title");
      active.current={element,nativeTitle};
      const anchor=element.querySelector("svg, .aaa-brand-mark")??element;
      const rect=anchor.getBoundingClientRect();
      const width=Math.min(220,Math.max(58,Math.ceil(label.length*6.3+22)));
      const lines=Math.max(1,Math.ceil((label.length*6.3)/Math.max(38,width-20)));
      const estimatedHeight=Math.max(34,16+lines*14);
      const position=positionCompanionPopover(rect,
        {width:window.innerWidth,height:window.innerHeight},
        {width,height:estimatedHeight},"center");
      setTooltip({label,width,...position});
    };
    const enter=(event:PointerEvent)=>{
      if(event.pointerType==="touch")return;
      const target=find(event.target);
      if(target)show(target);
    };
    const leave=(event:PointerEvent)=>{
      const current=active.current?.element;
      if(!current)return;
      if(event.relatedTarget instanceof Node&&current.contains(event.relatedTarget))return;
      if(event.target instanceof Node&&current.contains(event.target))restore();
    };
    const pointerDown=(event:PointerEvent)=>{
      if(event.pointerType==="touch"){lastTouch=Date.now();restore();}
    };
    const focusIn=(event:FocusEvent)=>{
      if(Date.now()-lastTouch<800)return;
      show(find(event.target));
    };
    const focusOut=(event:FocusEvent)=>{
      const current=active.current?.element;
      if(!current)return;
      if(event.relatedTarget instanceof Node&&current.contains(event.relatedTarget))return;
      if(event.target instanceof Node&&current.contains(event.target))restore();
    };
    const keyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape")restore();
    };
    document.addEventListener("pointerover",enter,true);
    document.addEventListener("pointerout",leave,true);
    document.addEventListener("pointerdown",pointerDown,true);
    document.addEventListener("focusin",focusIn,true);
    document.addEventListener("focusout",focusOut,true);
    document.addEventListener("keydown",keyDown,true);
    document.addEventListener("scroll",restore,true);
    window.addEventListener("resize",restore);
    return()=>{
      restore();
      document.removeEventListener("pointerover",enter,true);
      document.removeEventListener("pointerout",leave,true);
      document.removeEventListener("pointerdown",pointerDown,true);
      document.removeEventListener("focusin",focusIn,true);
      document.removeEventListener("focusout",focusOut,true);
      document.removeEventListener("keydown",keyDown,true);
      document.removeEventListener("scroll",restore,true);
      window.removeEventListener("resize",restore);
    };
  },[]);

  return tooltip&&typeof document!=="undefined"
    ?createPortal(<div role="tooltip" className="aaa-companion-tab-tooltip aaa-app-theme-tooltip"
      style={{left:tooltip.left,top:tooltip.top,width:tooltip.width}}>{tooltip.label}</div>,document.body)
    :null;
}
