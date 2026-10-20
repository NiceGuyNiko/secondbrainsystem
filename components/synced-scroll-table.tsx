"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";

/** Two usable horizontal tracks for a genuinely wide database.
 * ResizeObserver keeps the upper track's width equal to the table, even
 * when property columns are added, renamed or deleted.
 */
export default function SyncedScrollTable({children}:{children:ReactNode}){
 const upper=useRef<HTMLDivElement>(null);
 const lower=useRef<HTMLDivElement>(null);
 const [width,setWidth]=useState(0);
 useEffect(()=>{
  const sync=()=>{
   const container=lower.current;
   const table=container?.firstElementChild as HTMLElement|null;
   setWidth(table?.scrollWidth??0);
   if(upper.current&&container)upper.current.scrollLeft=container.scrollLeft;
  };
  sync();
  const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(sync):null;
  if(observer&&lower.current){
   observer.observe(lower.current);
   const table=lower.current.firstElementChild;
   if(table)observer.observe(table);
  }
  window.addEventListener("resize",sync);
  return()=>{observer?.disconnect();window.removeEventListener("resize",sync)};
 },[children]);
 return <>
  <div ref={upper} className="db-lab-top-scroll" tabIndex={0}
   role="region" aria-label="Scroll database columns horizontally from the top"
   onScroll={e=>{
     if(lower.current&&Math.abs(lower.current.scrollLeft-e.currentTarget.scrollLeft)>1)
       lower.current.scrollLeft=e.currentTarget.scrollLeft;
   }}>
   <div className="db-lab-top-scroll-inner" style={{width:width+"px"}}/>
  </div>
  <div ref={lower} className="db-lab-table-wrap" tabIndex={0}
   role="region" aria-label="Scrollable database table"
   onScroll={e=>{
     if(upper.current&&Math.abs(upper.current.scrollLeft-e.currentTarget.scrollLeft)>1)
       upper.current.scrollLeft=e.currentTarget.scrollLeft;
   }}>{children}</div>
 </>;
}
