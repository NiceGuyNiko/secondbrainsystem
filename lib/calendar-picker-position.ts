export type CalendarPickerAnchor = {left:number;top:number;bottom:number;width:number};
export type CalendarPickerViewport = {width:number;height:number};
export type CalendarPickerPosition = {left:number;top:number;width:number;maxHeight:number};

/** Match the trigger's width; prefer below and constrain tall pickers to the available space. */
export function positionCalendarPicker(
  anchor:CalendarPickerAnchor, viewport:CalendarPickerViewport, preferredHeight:number
):CalendarPickerPosition {
  const margin=8, gap=6;
  const width=Math.min(anchor.width,Math.max(0,viewport.width-margin*2));
  const below=Math.max(0,viewport.height-anchor.bottom-gap-margin);
  const above=Math.max(0,anchor.top-gap-margin);
  const openAbove=below<preferredHeight && above>below;
  const available=openAbove?above:below;
  const maxHeight=Math.max(24,Math.min(preferredHeight,available));
  const top=openAbove?anchor.top-gap-maxHeight:anchor.bottom+gap;
  return {
    left:Math.max(margin,Math.min(anchor.left,viewport.width-width-margin)),
    top:Math.max(margin,Math.min(top,viewport.height-maxHeight-margin)),
    width,
    maxHeight
  };
}
