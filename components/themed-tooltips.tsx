"use client";

import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {positionCompanionPopover} from "@/lib/companion-popover-position";
import {mobileGestureShowsTooltip,type MobileTooltipMode} from "@/lib/mobile-tooltip-settings";

type TooltipPosition={label:string;left:number;top:number;width:number};
type TooltipTarget={element:HTMLElement;nativeTitle:string|null};
type TouchPress={element:HTMLElement;pointerId:number;x:number;y:number;activated:boolean};

/**
 * The shared tooltip skin is the Companion's icon-tab tooltip.
 *
 * Desktop: hover or keyboard focus; blur and pointer exit dismiss.
 * Mobile: never synthesize a tooltip from focus, hover or a normal tap unless
 * the profile explicitly opts into "tap". "Hold" (the default) needs a deliberate
 * long press on an eligible icon-only control. A subsequent tap anywhere closes
 * the tooltip and continues to perform that tap's usual action.
 */
export default function ThemedTooltips({mobileMode="hold"}:{mobileMode?:MobileTooltipMode}){
  const [tooltip,setTooltip]=useState<TooltipPosition|null>(null);
  const active=useRef<TooltipTarget|null>(null);

  useEffect(()=>{
    let lastTouch=0;
    let pending:TouchPress|null=null;
    let pressTimer:ReturnType<typeof setTimeout>|null=null;
    let tapDismissTimer:ReturnType<typeof setTimeout>|null=null;
    let suppressOriginClick:HTMLElement|null=null;
    let desktopClicked:HTMLElement|null=null;
    let desktopClickedTitle:string|null=null;
    const restoreDesktopClick=()=>{
      if(desktopClicked&&desktopClickedTitle!==null&&!desktopClicked.hasAttribute("title"))
        desktopClicked.setAttribute("title",desktopClickedTitle);
      desktopClicked=null;desktopClickedTitle=null;
    };
    // Removing titles for icon buttons on touch prevents Safari's own tooltip
    // from lingering even after our React tooltip closes. The originals are
    // restored only when switching back to desktop or on component cleanup.
    const mobileTitles=new Map<HTMLElement,string>();
    const mobileViewport=()=>window.matchMedia("(max-width:767px), (hover:none) and (pointer:coarse)").matches;
    const stopTimer=()=>{if(pressTimer!==null){clearTimeout(pressTimer);pressTimer=null;}};
    const stopTapDismiss=()=>{if(tapDismissTimer!==null){clearTimeout(tapDismissTimer);tapDismissTimer=null;}};
    const hide=()=>{
      stopTapDismiss();
      const previous=active.current;
      if(previous?.nativeTitle!==null&&previous?.nativeTitle!==undefined
         &&!previous.element.hasAttribute("title")
         &&!mobileTitles.has(previous.element)){
        previous.element.setAttribute("title",previous.nativeTitle);
      }
      active.current=null;
      setTooltip(null);
    };
    const reinstateMobileTitles=()=>{
      for(const [element,title] of mobileTitles){
        if(element.isConnected&&!element.hasAttribute("title"))element.setAttribute("title",title);
      }
      mobileTitles.clear();
    };
    const titleOrLabel=(element:HTMLElement)=>{
      return element.getAttribute("data-aaa-tooltip")
        ||element.getAttribute("title")
        ||mobileTitles.get(element)
        ||element.getAttribute("aria-label")
        ||"";
    };
    const findDesktop=(target:EventTarget|null)=>{
      if(!(target instanceof Element))return null;
      const sidebar=target.closest(".aaa-sidebar");
      if(sidebar){
        // Expanded navigation already has labels; the AAA emblem never
        // receives a tooltip. The collapse control does, at any width.
        if(target.closest(".aaa-brand-toggle"))return null;
        if(target.closest(".aaa-desktop-collapse-control"))
          return target.closest<HTMLElement>(".aaa-desktop-collapse-control");
        if(!sidebar.closest(".aaa-collapsed"))return null;
      }
      return target.closest<HTMLElement>("[data-aaa-tooltip], [title]");
    };
    const findMobile=(target:EventTarget|null):HTMLElement|null=>{
      if(!(target instanceof Element))return null;
      const button=target.closest<HTMLElement>("button");
      if(!button||button.matches(":disabled, [aria-disabled='true'], [role='separator']"))return null;
      // Only genuine icon controls receive help on touch. Text buttons,
      // drag grips, form fields and general navigation rows keep their normal
      // press/scroll interactions.
      if(!button.querySelector("svg, .aaa-brand-mark"))return null;
      if(button.textContent?.trim())return null;
      return titleOrLabel(button)?button:null;
    };
    const suppressNativeTitle=(button:HTMLElement)=>{
      button.setAttribute("data-aaa-touch-help","");
      const title=button.getAttribute("title");
      if(title!==null&&!mobileTitles.has(button)){
        mobileTitles.set(button,title);
        button.removeAttribute("title");
      }
    };
    const show=(element:HTMLElement,onMobile:boolean)=>{
      if(!element.isConnected)return;
      if(active.current?.element===element)return;
      hide();
      const label=titleOrLabel(element);
      if(!label)return;
      const nativeTitle=onMobile?null:element.getAttribute("title");
      if(nativeTitle!==null&&!onMobile)element.removeAttribute("title");
      active.current={element,nativeTitle};
      const glyph=element.querySelector("svg, .aaa-brand-mark")??element;
      const rect=glyph.getBoundingClientRect();
      // PC help is a one-line label beside the icon, never a narrow wrapped
      // popover that cuts off names such as Databases.
      const width=Math.min(360,Math.max(64,Math.ceil(label.length*7.1+26)));
      const height=34;
      const viewport={width:window.innerWidth,height:window.innerHeight};
      const besideLeft=rect.right+10;
      const left=!onMobile&&besideLeft+width<=viewport.width-8
        ?besideLeft
        :!onMobile&&rect.left-width-10>=8
          ?rect.left-width-10
          :positionCompanionPopover(rect,viewport,{width,height},"center").left;
      const top=onMobile
        ?positionCompanionPopover(rect,viewport,{width,height},"center").top
        :Math.max(8,Math.min(rect.top+(rect.height-height)/2,viewport.height-height-8));
      const position={left,top};
      setTooltip({label,width,...position});
      // In tap mode the triggering action can navigate away. Never leave a
      // tooltip attached to an icon that React removed from the page.
      if(onMobile){
        window.requestAnimationFrame(()=>{
          if(active.current?.element===element&&!element.isConnected)hide();
        });
        if(mobileMode==="tap"){
          // Tap-mode labels fade on their own after a brief reading window.
          tapDismissTimer=setTimeout(()=>{
            if(active.current?.element===element)hide();
          },2600);
        }
      }
    };
    const onPointerOver=(event:PointerEvent)=>{
      if(mobileViewport()||Date.now()-lastTouch<1500||event.pointerType==="touch")return;
      const target=findDesktop(event.target);
      if(target===desktopClicked)return;
      if(desktopClicked&&target!==desktopClicked)restoreDesktopClick();
      if(target)show(target,false);
    };
    const onPointerOut=(event:PointerEvent)=>{
      if(mobileViewport()||Date.now()-lastTouch<1500)return;
      if(desktopClicked&&event.target instanceof Node&&desktopClicked.contains(event.target)&&
         !(event.relatedTarget instanceof Node&&desktopClicked.contains(event.relatedTarget)))
        restoreDesktopClick();
      const current=active.current?.element;
      if(!current)return;
      if(event.relatedTarget instanceof Node&&current.contains(event.relatedTarget))return;
      if(event.target instanceof Node&&current.contains(event.target))hide();
    };
    const onFocusIn=(event:FocusEvent)=>{
      // Touch focusing a button is not an intent to see a tooltip.
      if(mobileViewport()||Date.now()-lastTouch<1500)return;
      const target=findDesktop(event.target);
      if(target&&target!==desktopClicked)show(target,false);
    };
    const onFocusOut=(event:FocusEvent)=>{
      if(mobileViewport())return;
      const current=active.current?.element;
      if(!current)return;
      if(event.relatedTarget instanceof Node&&current.contains(event.relatedTarget))return;
      if(event.target instanceof Node&&current.contains(event.target))hide();
    };
    const onPointerDown=(event:PointerEvent)=>{
      if(event.pointerType!=="touch"){
        const target=findDesktop(event.target);
        if(target&&active.current?.element===target){
          const original=active.current.nativeTitle;
          hide();
          desktopClicked=target;
          desktopClickedTitle=original;
          if(original!==null)target.removeAttribute("title");
        }
        return;
      }
      // A fresh touch must not inherit the previous long-press click guard.
      suppressOriginClick=null;
      lastTouch=Date.now();
      stopTimer();pending=null;
      // Dismissal must not absorb or cancel this pointer event: outside buttons,
      // links, inputs and navigation still react to the same touch.
      hide();
      const button=findMobile(event.target);
      if(!button)return;
      suppressNativeTitle(button);
      if(mobileMode==="off")return;
      pending={element:button,pointerId:event.pointerId,
        x:event.clientX,y:event.clientY,activated:false};
      if(mobileGestureShowsTooltip(mobileMode,"hold")){
        pressTimer=setTimeout(()=>{
          const press=pending;
          if(!press||press.element!==button||press.pointerId!==event.pointerId)return;
          press.activated=true;
          suppressOriginClick=button;
          // iOS/Safari sometimes selects text during a held icon press.
          // Restrict selection suppression to this deliberate help gesture.
          window.getSelection()?.removeAllRanges();
          show(button,true);
        },520);
      }
    };
    const onPointerMove=(event:PointerEvent)=>{
      if(!pending||pending.pointerId!==event.pointerId)return;
      const distance=Math.hypot(event.clientX-pending.x,event.clientY-pending.y);
      if(distance>11){
        stopTimer();
        // A scroll or drag is not a tooltip request.
        if(!pending.activated)pending=null;
      }
    };
    const onPointerUp=(event:PointerEvent)=>{
      if(!pending||pending.pointerId!==event.pointerId)return;
      const press=pending;
      stopTimer();pending=null;
      if(!press.activated&&mobileGestureShowsTooltip(mobileMode,"tap")
         &&Math.hypot(event.clientX-press.x,event.clientY-press.y)<=11
         &&press.element.isConnected){
        show(press.element,true);
      }
      // A completed hold leaves its tooltip visible until the next press.
    };
    const onPointerCancel=(event:PointerEvent)=>{
      if(!pending||pending.pointerId!==event.pointerId)return;
      stopTimer();pending=null;
      hide();
    };
    const onClick=(event:MouseEvent)=>{
      if(!suppressOriginClick)return;
      const origin=suppressOriginClick;
      suppressOriginClick=null;
      if(event.target instanceof Node&&origin.contains(event.target)){
        // A long press is for help, not an accidental action on release.
        // This does NOT intercept a later/outside tap used to dismiss help.
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };
    const onContextMenu=(event:MouseEvent)=>{
      if(!mobileViewport())return;
      const eligible=findMobile(event.target);
      if(eligible){
        event.preventDefault();
        if(mobileMode!=="off")window.getSelection()?.removeAllRanges();
      }
    };
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){stopTimer();pending=null;hide();}
    };
    const onScroll=()=>{
      stopTimer();
      if(!pending?.activated)pending=null;
      // The tooltip is fixed relative to its icon, so scrolling dismisses it.
      hide();
    };
    const onResize=()=>{
      stopTimer();pending=null;hide();
      if(!mobileViewport())reinstateMobileTitles();
    };
    document.addEventListener("pointerover",onPointerOver,true);
    document.addEventListener("pointerout",onPointerOut,true);
    document.addEventListener("pointerdown",onPointerDown,true);
    document.addEventListener("pointermove",onPointerMove,true);
    document.addEventListener("pointerup",onPointerUp,true);
    document.addEventListener("pointercancel",onPointerCancel,true);
    document.addEventListener("click",onClick,true);
    document.addEventListener("contextmenu",onContextMenu,true);
    document.addEventListener("focusin",onFocusIn,true);
    document.addEventListener("focusout",onFocusOut,true);
    document.addEventListener("keydown",onKeyDown,true);
    document.addEventListener("scroll",onScroll,true);
    window.addEventListener("resize",onResize);
    return()=>{
      stopTimer();pending=null;hide();restoreDesktopClick();reinstateMobileTitles();
      document.removeEventListener("pointerover",onPointerOver,true);
      document.removeEventListener("pointerout",onPointerOut,true);
      document.removeEventListener("pointerdown",onPointerDown,true);
      document.removeEventListener("pointermove",onPointerMove,true);
      document.removeEventListener("pointerup",onPointerUp,true);
      document.removeEventListener("pointercancel",onPointerCancel,true);
      document.removeEventListener("click",onClick,true);
      document.removeEventListener("contextmenu",onContextMenu,true);
      document.removeEventListener("focusin",onFocusIn,true);
      document.removeEventListener("focusout",onFocusOut,true);
      document.removeEventListener("keydown",onKeyDown,true);
      document.removeEventListener("scroll",onScroll,true);
      window.removeEventListener("resize",onResize);
    };
  },[mobileMode]);

  return tooltip&&typeof document!=="undefined"
    ?createPortal(<div role="tooltip" className="aaa-companion-tab-tooltip aaa-app-theme-tooltip"
      style={{left:tooltip.left,top:tooltip.top,width:tooltip.width}}>{tooltip.label}</div>,document.body)
    :null;
}
