/** Only shortcuts which leave an active drag without its ordinary release,
 * or the user's explicit cancellation, should abort the transient drag UI. */
export function widgetDragInterruptedByKey(event:{
  key:string;shiftKey:boolean;ctrlKey:boolean;metaKey:boolean
}):boolean{
  return event.key==="Escape"||
    (event.key.toLowerCase()==="s"&&event.shiftKey&&(event.ctrlKey||event.metaKey));
}
