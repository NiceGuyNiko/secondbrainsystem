import type {ViewFilter,ViewSort,QueryMode} from "@/lib/db-engine/view-operators";
import {readViewConfig} from "@/lib/db-engine/view-operators";

export type WidgetRenderer="table"|"list"|"cards"|"timeline";
export type WidgetConfig={
  renderer:WidgetRenderer;
  density:"comfortable"|"compact";
  color:"theme"|"gold"|"blue"|"green";
  showTitle:boolean;
  editable:boolean;
  allowCreate:boolean;
  exposeFilters:boolean;
  exposeSorts:boolean;
  visibleProperties:string[];
  openBehavior:"detail"|"source";
  scopeField:string;
  scopeValue:string;
  filters:ViewFilter[];
  filterMode:QueryMode;
  sorts:ViewSort[];
};
export const defaultWidgetConfig:WidgetConfig={
  renderer:"table",density:"comfortable",color:"theme",showTitle:true,
  editable:true,allowCreate:false,exposeFilters:false,exposeSorts:false,
  visibleProperties:[],openBehavior:"detail",scopeField:"",scopeValue:"",
  filters:[],filterMode:"all",sorts:[]
};
export function widgetConfig(raw:unknown):WidgetConfig{
  const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const pick=<T extends string>(field:string,allowed:readonly T[],fallback:T)=>
    allowed.includes(obj[field] as T)?obj[field] as T:fallback;
  return {
    ...defaultWidgetConfig,
    ...readViewConfig(obj),
    renderer:pick("renderer",["table","list","cards","timeline"] as const,"table"),
    density:pick("density",["comfortable","compact"] as const,"comfortable"),
    color:pick("color",["theme","gold","blue","green"] as const,"theme"),
    showTitle:typeof obj.showTitle==="boolean"?obj.showTitle:true,
    editable:typeof obj.editable==="boolean"?obj.editable:true,
    allowCreate:obj.allowCreate===true,
    exposeFilters:obj.exposeFilters===true,
    exposeSorts:obj.exposeSorts===true,
    visibleProperties:Array.isArray(obj.visibleProperties)?obj.visibleProperties.filter((s):s is string=>typeof s==="string"):[],
    openBehavior:pick("openBehavior",["detail","source"] as const,"detail"),
    scopeField:typeof obj.scopeField==="string"?obj.scopeField:"",
    scopeValue:typeof obj.scopeValue==="string"?obj.scopeValue:""
  };
}

export type WidgetDefinition={id:string;name:string;database_id:string|null;view_id:string|null;config:Record<string,unknown>};
export type LibraryPage={id:string;area:"library"|"goals";title:string;position:number};
export type PageWidget={id:string;page_id:string;definition_id:string|null;kind:"database"|"goals";title:string|null;config:Record<string,unknown>;width:number;height:number;position:number};
export type WidgetDatabase={id:string;name:string;icon:string};
export type WidgetView={id:string;database_id:string;name:string;layout:string;config:Record<string,unknown>};
export type WidgetProperty={id:string;database_id:string;name:string;type:string;config:Record<string,unknown>;position:number};
export type WidgetRecord={record_id:string;database_id:string;sequence_no:number;version:number;values_json:Record<string,unknown>;position:number};
export type WidgetRelation={source_record_id:string;target_record_id:string;property_id:string};

export type WidgetConfigureTarget={
  id:string;kind:"definition"|"instance";title:string;
  databaseId:string|null;viewId:string|null;config:WidgetConfig;
  width?:number;height?:number;
  databases:WidgetDatabase[];views:WidgetView[];properties:WidgetProperty[];
  onConfig:(patch:Partial<WidgetConfig>)=>void;
  onSource:(databaseId:string|null,viewId:string|null)=>void;
  onRename:(name:string)=>void;
  onSize?:(width:number,height:number)=>void;
  onSaveToDefinition?:()=>void;
};
