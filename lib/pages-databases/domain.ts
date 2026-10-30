// Independent domain. No dependencies on Widgets, legacy records, or browser state.
export type PropertyType='text'|'number'|'date'|'select'|'image'|'relation';
export type Property={id:string;sourceId:string;name:string;type:PropertyType;options:{id:string;label:string}[];targetDatabaseId?:string};
export type Value=string|number|string[]|null;
export type ViewConfig={summaryField?:string;coverField?:string;shownFields?:string[];relatedId?:string;groupBy?:string;showImage?:boolean};
export type Wizard={step:number;databaseId:string|null;viewId:string|null;pageId:string|null};
export type Database = {id:string; name:string; defaultViewId:string|null;description?:string;icon?:string};
export type Page = {id:string; title:string; content:string;description?:string;icon?:string};
export type RecordPage = {id:string; databaseId:string; pageId:string; parentId:string|null; order:number; summary:string;values?:Record<string,Value>};
export type Relatabase = {id:string; name:string; leftDatabaseId:string; rightDatabaseId:string;description?:string;leftLabel?:string;rightLabel?:string};
export type LinkDetail = {id:string; relatabaseId:string; leftId:string; rightId:string; pageId:string; sequence:number;values?:Record<string,Value>};
export type SavedView = {id:string; sourceId:string; sourceKind:'database'|'relatabase'; name:string; mode:'nested'|'table'|'gallery'|'grouped';config?:ViewConfig};
export type Block = {id:string; pageId:string; viewId:string};
export type State = {version:1; revision:number; databases:Database[]; pages:Page[]; records:RecordPage[]; relatabases:Relatabase[]; links:LinkDetail[]; views:SavedView[]; blocks:Block[];properties:Property[];wizard?:Wizard};
export type Command =
 | {type:'batch';id:string;commands:Command[]}
 | {type:'database'; id:string; name:string;description?:string;icon?:string}
 | {type:'record'; id:string; databaseId:string; title:string; parentId:string|null;values?:Record<string,Value>}
 | {type:'page'; id:string; title:string;description?:string;icon?:string}
 | {type:'edit-page'; id:string; title:string; content:string;description?:string;icon?:string}
 | {type:'move'; id:string; parentId:string|null; beforeId:string|null}
 | {type:'relatabase'; id:string; name:string; leftDatabaseId:string; rightDatabaseId:string;description?:string;leftLabel?:string;rightLabel?:string}
 | {type:'link'; id:string; relatabaseId:string; leftId:string; rightId:string; title:string;values?:Record<string,Value>}
 | {type:'view'; id:string; sourceId:string; sourceKind:'database'|'relatabase'; name:string; mode:SavedView['mode'];config?:ViewConfig}
 | {type:'edit-view'; id:string; name:string; mode:SavedView['mode'];config?:ViewConfig}
 | {type:'default-view'; id:string; viewId:string|null}
 | {type:'block'; id:string; pageId:string; viewId:string}
 | {type:'property';id:string;sourceId:string;name:string;propertyType:PropertyType;options:{id:string;label:string}[];targetDatabaseId?:string}
 | {type:'record-values';id:string;values:Record<string,Value>}
 | {type:'link-endpoints';id:string;leftId:string;rightId:string}
 | {type:'remove-block';id:string}
 | {type:'move-block';id:string;beforeId:string|null}
 | {type:'wizard';id:string;wizard:Wizard}
 | {type:'clone-view'; id:string; blockId:string; viewId:string};
export const emptyState = ():State => ({version:1,revision:0,databases:[],pages:[],records:[],relatabases:[],links:[],views:[],blocks:[],properties:[]});
const need:(v:unknown,m:string)=>asserts v = (v,m)=>{if(!v)throw new Error(m)};
const label=(s:string)=>{need(typeof s==='string'&&s.trim().length>0&&s.trim().length<=160,'Enter a name of 1–160 characters.');return s.trim()};
export function pageTitle(s:State,id:string){return s.pages.find(p=>p.id===id)?.title??'Untitled'}
export function recordPath(s:State,id:string):string {
 const parts:string[]=[];const seen=new Set<string>();let r=s.records.find(r=>r.id===id);
 while(r&&!seen.has(r.id)){seen.add(r.id);parts.unshift(pageTitle(s,r.pageId));r=s.records.find(p=>p.id===r?.parentId)}
 return parts.join(' / ');
}
export function siblings(s:State,databaseId:string,parentId:string|null){return s.records.filter(r=>r.databaseId===databaseId&&r.parentId===parentId).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id))}
export function applyCommand(state:State,c:Command):State {
 if(c.type==='batch'){need(c.commands.length>0&&c.commands.length<=20&&!c.commands.some(x=>x.type==='batch'),'A batch must contain 1–20 commands.');let next=state;for(const command of c.commands)next=applyCommand(next,command);return {...next,revision:next.revision+1}}
 const s:State=structuredClone(state);s.properties??=[];
 const page=(id:string)=>{const p=s.pages.find(p=>p.id===id);need(p,'Page unavailable.');return p};
 const database=(id:string)=>{const d=s.databases.find(d=>d.id===id);need(d,'Database unavailable.');return d};
 const record=(id:string)=>{const r=s.records.find(r=>r.id===id);need(r,'Record unavailable.');return r};
 const view=(id:string)=>{const v=s.views.find(v=>v.id===id);need(v,'View unavailable.');return v};
 // UUIDs supplied by callers are stable across a retry; an existing ID is never overwritten.
 if(['database','record','page','relatabase','link','view','block','clone-view'].includes(c.type)) {
  const all=[...s.databases,...s.pages,...s.relatabases,...s.views,...s.blocks];
  need(!all.some(x=>x.id===c.id),'This creation ID already exists. Reload before retrying.');
 }
 switch(c.type){
  case 'database':{const name=label(c.name);need(!s.databases.some(d=>d.name.toLowerCase()===name.toLowerCase()),'Database already exists.');s.databases.push({id:c.id,name,defaultViewId:null,description:c.description??'',icon:c.icon??'▤'});break}
  case 'page':s.pages.push({id:c.id,title:label(c.title),content:'',description:c.description??'',icon:c.icon??'◇'});break;
  case 'record':{
   database(c.databaseId);if(c.parentId)need(record(c.parentId).databaseId===c.databaseId,'Parent must be in the same database.');
   s.pages.push({id:c.id,title:label(c.title),content:''});s.records.push({id:c.id,pageId:c.id,databaseId:c.databaseId,parentId:c.parentId,order:siblings(s,c.databaseId,c.parentId).length,summary:'',values:validateValues(s,c.databaseId,c.values??{})});break;
  }
  case 'edit-page':{const p=page(c.id);p.title=label(c.title);need(typeof c.content==='string'&&c.content.length<=100000,'Content must be at most 100,000 characters.');p.content=c.content;if(c.description!==undefined)p.description=c.description;if(c.icon!==undefined)p.icon=c.icon;break}
  case 'move':{
   const r=record(c.id),oldParent=r.parentId;
   if(c.parentId){let p:RecordPage|undefined=record(c.parentId);need(p.databaseId===r.databaseId,'Parent must be in the same database.');let depth=0;
    while(p){need(p.id!==r.id,'A record cannot be moved under itself or a descendant.');need(++depth<=100,'Hierarchy is too deep.');p=p.parentId?record(p.parentId):undefined}
   }
   const targets=siblings(s,r.databaseId,c.parentId).filter(x=>x.id!==r.id);
   let at=targets.length;if(c.beforeId){at=targets.findIndex(x=>x.id===c.beforeId);need(at>=0,'Move target must be a sibling.')}
   r.parentId=c.parentId;targets.splice(at,0,r);targets.forEach((x,i)=>x.order=i);
   if(oldParent!==c.parentId)siblings(s,r.databaseId,oldParent).forEach((x,i)=>x.order=i);break;
  }
  case 'relatabase':database(c.leftDatabaseId);database(c.rightDatabaseId);s.relatabases.push({id:c.id,name:label(c.name),leftDatabaseId:c.leftDatabaseId,rightDatabaseId:c.rightDatabaseId,description:c.description??'',leftLabel:c.leftLabel,rightLabel:c.rightLabel});break;
  case 'link':{
   const d=s.relatabases.find(x=>x.id===c.relatabaseId);need(d,'Relatabase unavailable.');
   need(record(c.leftId).databaseId===d.leftDatabaseId&&record(c.rightId).databaseId===d.rightDatabaseId,'Endpoint belongs to the wrong database.');
   s.pages.push({id:c.id,title:label(c.title),content:''});s.links.push({id:c.id,pageId:c.id,relatabaseId:d.id,leftId:c.leftId,rightId:c.rightId,sequence:Math.max(0,...s.links.filter(l=>l.relatabaseId===d.id).map(l=>l.sequence))+1,values:validateValues(s,d.id,c.values??{})});break;
  }
  case 'view':need(['nested','table','gallery','grouped'].includes(c.mode),'Unsupported view mode.');need(c.sourceKind==='database'?s.databases.some(d=>d.id===c.sourceId):c.sourceKind==='relatabase'&&s.relatabases.some(d=>d.id===c.sourceId),'View source unavailable.');s.views.push({id:c.id,name:label(c.name),sourceId:c.sourceId,sourceKind:c.sourceKind,mode:c.mode,config:validateViewConfig(s,c.sourceId,c.config??{})});break;
  case 'edit-view':{const v=view(c.id);need(['nested','table','gallery','grouped'].includes(c.mode),'Unsupported view mode.');v.name=label(c.name);v.mode=c.mode;if(c.config)v.config=validateViewConfig(s,v.sourceId,c.config);break}
  case 'default-view':{const d=database(c.id);if(c.viewId===null){d.defaultViewId=null;break}const v=view(c.viewId);need(v.sourceKind==='database'&&v.sourceId===d.id,'Default view must use this database.');d.defaultViewId=v.id;break}
  case 'block':page(c.pageId);view(c.viewId);s.blocks.push({id:c.id,pageId:c.pageId,viewId:c.viewId});break;
  case 'property':{
   need(s.databases.some(d=>d.id===c.sourceId)||s.relatabases.some(d=>d.id===c.sourceId),'Property source unavailable.');
   const existing=s.properties.find(p=>p.id===c.id);need(!existing||existing.sourceId===c.sourceId,'Property source cannot change.');
   need(['text','number','date','select','image','relation'].includes(c.propertyType),'Unsupported property type.');
   need(!s.properties.some(p=>p.sourceId===c.sourceId&&p.id!==c.id&&p.name.toLowerCase()===label(c.name).toLowerCase()),'Property name already exists.');
   need(!['name','parent page'].includes(label(c.name).toLowerCase()),'This property is built in.');
   if(c.propertyType==='relation')database(c.targetDatabaseId??'');
   need(new Set(c.options.map(o=>o.id)).size===c.options.length&&new Set(c.options.map(o=>label(o.label).toLowerCase())).size===c.options.length,'Options must be unique.');
   const next:Property={id:c.id,sourceId:c.sourceId,name:label(c.name),type:c.propertyType,options:c.options,...(c.propertyType==='relation'?{targetDatabaseId:c.targetDatabaseId}:{})};
   const rows=[...s.records.filter(r=>r.databaseId===c.sourceId),...s.links.filter(l=>l.relatabaseId===c.sourceId)];
   if(existing&&existing.type!==next.type){for(const row of rows){const val=row.values?.[existing.id];if(val!==undefined&&val!==null&&val!==''){
    const text=valueText(s,existing,val);let converted:Value=text;
    if(next.type==='select'){const names=text.split(',').map(t=>t.trim()).filter(Boolean);converted=names.map(name=>{let option=next.options.find(o=>o.label.toLowerCase()===name.toLowerCase());if(!option){option={id:crypto.randomUUID(),label:name};next.options.push(option)}return option.id})}
    else if(next.type==='number'){need(text.trim()!==''&&Number.isFinite(Number(text)),'Some values are not valid numbers. Correct them before converting.');converted=Number(text)}
    else if(next.type==='date'){need(/^\d{4}-\d{2}-\d{2}$/.test(text)&&new Date(text).toISOString().slice(0,10)===text,'Some values are not valid dates.');converted=text}
    else if(next.type==='relation'){const r=exactRecord(s,next.targetDatabaseId??'',text);need(r,'A value has no matching record in the target database.');converted=r.id}
    row.values={...row.values,[existing.id]:converted};
   }}}
   if(existing)s.properties=s.properties.map(p=>p.id===c.id?next:p);else s.properties.push(next);
   for(const row of rows)validateValues(s,c.sourceId,row.values??{});break;
  }
  case 'record-values':{const r=s.records.find(r=>r.id===c.id),l=s.links.find(l=>l.id===c.id);need(r||l,'Record unavailable.');const row=(r??l)!;row.values=validateValues(s,r?.databaseId??l!.relatabaseId,c.values);break}
  case 'link-endpoints':{const l=s.links.find(l=>l.id===c.id);need(l,'Detailed link unavailable.');const d=s.relatabases.find(d=>d.id===l.relatabaseId)!;need(record(c.leftId).databaseId===d.leftDatabaseId&&record(c.rightId).databaseId===d.rightDatabaseId,'Invalid endpoint database.');l.leftId=c.leftId;l.rightId=c.rightId;break}
  case 'remove-block':need(s.blocks.some(b=>b.id===c.id),'Block unavailable.');s.blocks=s.blocks.filter(b=>b.id!==c.id);break;
  case 'move-block':{const b=s.blocks.find(b=>b.id===c.id);need(b,'Block unavailable.');const list=s.blocks.filter(x=>x.pageId===b.pageId&&x.id!==b.id);const at=c.beforeId?list.findIndex(x=>x.id===c.beforeId):list.length;need(at>=0,'Block target unavailable.');list.splice(at,0,b);s.blocks=[...s.blocks.filter(x=>x.pageId!==b.pageId),...list];break}
  case 'wizard':need(Number.isInteger(c.wizard.step)&&c.wizard.step>=0&&c.wizard.step<=3,'Invalid builder stage.');if(c.wizard.databaseId)database(c.wizard.databaseId);if(c.wizard.viewId)view(c.wizard.viewId);if(c.wizard.pageId)page(c.wizard.pageId);s.wizard=c.wizard;break;
  case 'clone-view':{const b=s.blocks.find(b=>b.id===c.blockId);need(b&&b.viewId===c.viewId,'Block changed. Reload first.');const v=view(c.viewId);s.views.push({...v,id:c.id,name:v.name+' (independent)'});b.viewId=c.id;break}
 }
 if(c.type==='record'||c.type==='move'){let depth=0,cursor:RecordPage|undefined=record(c.id);while(cursor){need(++depth<=100,'Hierarchy is too deep.');cursor=cursor.parentId?record(cursor.parentId):undefined}const queue=[{id:c.id,depth}];for(let i=0;i<queue.length;i++){const item=queue[i];need(item.depth<=100,'Hierarchy is too deep.');for(const child of s.records.filter(r=>r.parentId===item.id))queue.push({id:child.id,depth:item.depth+1})}}
 s.revision++;return s;
}
export function findRecords(s:State,databaseId:string,query:string){const q=query.trim().toLowerCase();return s.records.filter(r=>r.databaseId===databaseId&&pageTitle(s,r.pageId).toLowerCase().includes(q))}
export const exactRecord=(s:State,databaseId:string,title:string)=>s.records.find(r=>r.databaseId===databaseId&&pageTitle(s,r.pageId).toLowerCase()===title.trim().toLowerCase());

export function valueText(s:State,p:Property|undefined,v:Value|undefined):string {
 if(v===undefined||v===null)return '';
 if(p?.type==='select')return (Array.isArray(v)?v:[String(v)]).map(id=>p.options.find(o=>o.id===id)?.label??id).join(', ');
 if(p?.type==='relation')return pageTitle(s,String(v));return String(v);
}
export function validateValues(s:State,sourceId:string,values:Record<string,Value>){
 need(values&&typeof values==='object'&&!Array.isArray(values),'Expected property values.');
 for(const [id,v] of Object.entries(values)){
  const p=s.properties.find(p=>p.id===id&&p.sourceId===sourceId);need(p,'Unknown property.');if(v===null||v==='')continue;
  if(p.type==='number')need(typeof v==='number'&&Number.isFinite(v),'Expected a finite number.');
  else if(p.type==='select')need(Array.isArray(v)&&v.every(id=>p.options.some(o=>o.id===id)),'Unknown selection.');
  else if(p.type==='relation')need(typeof v==='string'&&s.records.some(r=>r.id===v&&r.databaseId===p.targetDatabaseId),'Invalid related record.');
  else {need(typeof v==='string'&&v.length<=100000,'Expected text.');if(p.type==='date')need(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Expected a valid date.');}
 }return structuredClone(values);
}
export function validateViewConfig(s:State,sourceId:string,c:ViewConfig):ViewConfig{
 const fields=s.properties.filter(p=>p.sourceId===sourceId).map(p=>p.id);
 need([c.summaryField,c.coverField,...(c.shownFields??[])].every(id=>!id||fields.includes(id)),'View references an unknown property.');
 if(c.relatedId)need(s.relatabases.some(r=>r.id===c.relatedId&&(r.leftDatabaseId===sourceId||r.rightDatabaseId===sourceId)),'Invalid related section.');return structuredClone(c);
}
export function normalizeState(s:State):State{return {...s,properties:s.properties??[],databases:s.databases.map(d=>({...d,description:d.description??'',icon:d.icon??'▤'})),pages:s.pages.map(p=>({...p,description:p.description??'',icon:p.icon??'◇'}))}}
