/** Inline widget details are view-local UI state, never canonical database data. */
export type ExpandedWidgetRecords=Record<string,string[]>;
export function isWidgetRecordExpanded(state:ExpandedWidgetRecords,widgetId:string,recordId:string):boolean{
  return (state[widgetId]??[]).includes(recordId);
}
export function toggleWidgetRecordExpanded(state:ExpandedWidgetRecords,widgetId:string,recordId:string):ExpandedWidgetRecords{
  const current=state[widgetId]??[];
  const next=current.includes(recordId)?current.filter(id=>id!==recordId):[...current,recordId];
  return {...state,[widgetId]:next};
}
