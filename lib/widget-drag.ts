/** A page instance can be returned to the Developer tray without deleting its source. */
export const PAGE_WIDGET_DRAG_TYPE="application/x-aaa-page-widget";
export const DEVELOPER_WIDGET_DRAG_TYPE="application/x-aaa-widget-definition";

export function isPageWidgetDrag(transfer:Pick<DataTransfer,"types">):boolean{
  return Array.from(transfer.types).includes(PAGE_WIDGET_DRAG_TYPE);
}

export function returnPageWidgetToDeveloper(transfer:Pick<DataTransfer,"getData">):boolean{
  const widgetId=transfer.getData(PAGE_WIDGET_DRAG_TYPE);
  if(!widgetId)return false;
  window.dispatchEvent(new CustomEvent("aaa-widget-return-to-developer",{detail:{widgetId}}));
  return true;
}
