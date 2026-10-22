/** Position a floating Companion menu or tooltip relative to its trigger, not the cursor. */
export type CompanionAnchor = {left:number;top:number;bottom:number;width:number};
export type CompanionViewport = {width:number;height:number};
export type CompanionPopover = {width:number;height:number};
export function positionCompanionPopover(
  anchor:CompanionAnchor, viewport:CompanionViewport, popover:CompanionPopover,
  alignment:"start"|"center"="start", gap=7
){
  const margin=8;
  const desiredLeft=alignment==="center"
    ?anchor.left+(anchor.width-popover.width)/2:anchor.left;
  const left=Math.max(margin,Math.min(desiredLeft,Math.max(margin,viewport.width-popover.width-margin)));
  const beneath=anchor.bottom+gap;
  const above=anchor.top-popover.height-gap;
  const top=beneath+popover.height>viewport.height-margin&&above>=margin
    ?above:Math.max(margin,Math.min(beneath,Math.max(margin,viewport.height-popover.height-margin)));
  return {left,top};
}
