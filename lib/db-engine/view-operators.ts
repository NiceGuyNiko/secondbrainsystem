// Shared deterministic filter/sort semantics. View rules are serialized into
// db_views.config for per-user, per-database, per-view persistence.
export type ViewFilter = {id:string;field:string;operator:"is"|"is_not"|"contains"|"does_not_contain"|"is_empty"|"is_not_empty";value:string};
export type ViewSort = {id:string;field:string;direction:"asc"|"desc"};
export type QueryMode = "all"|"any";
export type ViewConfig = {filters:ViewFilter[];filterMode:QueryMode;sorts:ViewSort[]};
type RecordLike={record_id:string;sequence_no:number;values_json:Record<string,unknown>};
export const readViewConfig=(raw:unknown):ViewConfig=>{
 const config=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
 const list=Array.isArray(config.filters)?config.filters:[];
 const filters:ViewFilter[]=list.flatMap(v=>{
  if(!v||typeof v!=="object")return [];
  const x=v as Record<string,unknown>;
  const valid=["is","is_not","contains","does_not_contain","is_empty","is_not_empty"];
  return typeof x.id==="string"&&typeof x.field==="string"&&valid.includes(String(x.operator))
   ?[{id:x.id,field:x.field,operator:x.operator as ViewFilter["operator"],value:String(x.value??"")}]:[];
 });
 const sorts:ViewSort[]=(Array.isArray(config.sorts)?config.sorts:[]).flatMap(v=>{
  if(!v||typeof v!=="object")return [];
  const x=v as Record<string,unknown>;
  return typeof x.id==="string"&&typeof x.field==="string"&&(x.direction==="asc"||x.direction==="desc")
   ?[{id:x.id,field:x.field,direction:x.direction}]:[];
 });
 return {filters,sorts,filterMode:config.filterMode==="any"?"any":"all"};
};
export type ViewContext={
 name:(id:string)=>string;
 relationTargets:(recordId:string,propertyId:string)=>string[];
};
const texts=(record:RecordLike,field:string,ctx:ViewContext):string[]=>{
 if(field==="name")return [ctx.name(record.record_id)];
 if(field==="creation")return [String(record.sequence_no)];
 const relation=ctx.relationTargets(record.record_id,field);
 if(relation.length)return relation;
 const raw=record.values_json[field];
 return raw===null||raw===undefined||raw===""?[]:[String(raw)];
};
const evaluate=(record:RecordLike,rule:ViewFilter,ctx:ViewContext)=>{
 const values=texts(record,rule.field,ctx).map(v=>v.toLocaleLowerCase());
 const target=rule.value.trim().toLocaleLowerCase();
 if(rule.operator==="is_empty")return values.length===0;
 if(rule.operator==="is_not_empty")return values.length>0;
 if(rule.operator==="is")return values.some(v=>v===target);
 if(rule.operator==="is_not")return !values.some(v=>v===target);
 if(rule.operator==="contains")return values.some(v=>v.includes(target));
 if(rule.operator==="does_not_contain")return !values.some(v=>v.includes(target));
 return true;
};
export function applyViewRules<T extends RecordLike>(
 rows:readonly T[],config:ViewConfig,ctx:ViewContext,search="",
):T[]{
 const text=search.trim().toLocaleLowerCase();
 const filtered=rows.filter(r=>{
  if(text){
   const all=[ctx.name(r.record_id),...Object.values(r.values_json).map(String)];
   if(!all.some(v=>v.toLocaleLowerCase().includes(text)))return false;
  }
  if(!config.filters.length)return true;
  const matches=config.filters.map(f=>evaluate(r,f,ctx));
  return config.filterMode==="any"?matches.some(Boolean):matches.every(Boolean);
 });
 return filtered.sort((a,b)=>{
  for(const rule of config.sorts){
   const left=texts(a,rule.field,ctx)[0]??"";
   const right=texts(b,rule.field,ctx)[0]??"";
   const isNumber=left.trim()!==""&&right.trim()!==""&&Number.isFinite(Number(left))&&Number.isFinite(Number(right));
   const diff=isNumber?Number(left)-Number(right):left.localeCompare(right,undefined,{numeric:true,sensitivity:"base"});
   if(diff)return rule.direction==="desc"?-diff:diff;
  }
  return a.sequence_no-b.sequence_no;
 });
}

/** Initial render has neither a saved view nor a draft. Never compare two
 * optional IDs: undefined===undefined is true, but the draft remains null. */
export function activeViewConfig(
 view:{id:string;config:Record<string,unknown>}|undefined|null,
 draft:{id:string;config:Record<string,unknown>}|undefined|null,
):Record<string,unknown>|undefined {
 return draft!==null&&draft!==undefined&&view!==null&&view!==undefined&&draft.id===view.id
  ?draft.config
  :view?.config;
}
