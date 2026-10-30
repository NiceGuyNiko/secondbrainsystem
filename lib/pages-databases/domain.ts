// Independent domain. No dependencies on Widgets, legacy records, or browser state.
export type Database = {id:string; name:string; defaultViewId:string|null};
export type Page = {id:string; title:string; content:string};
export type RecordPage = {id:string; databaseId:string; pageId:string; parentId:string|null; order:number; summary:string};
export type Relatabase = {id:string; name:string; leftDatabaseId:string; rightDatabaseId:string};
export type LinkDetail = {id:string; relatabaseId:string; leftId:string; rightId:string; pageId:string; sequence:number};
export type SavedView = {id:string; sourceId:string; sourceKind:'database'|'relatabase'; name:string; mode:'nested'|'table'|'gallery'};
export type Block = {id:string; pageId:string; viewId:string};
export type State = {version:1; revision:number; databases:Database[]; pages:Page[]; records:RecordPage[]; relatabases:Relatabase[]; links:LinkDetail[]; views:SavedView[]; blocks:Block[]};
export type Command =
 | {type:'database'; id:string; name:string}
 | {type:'record'; id:string; databaseId:string; title:string; parentId:string|null}
 | {type:'page'; id:string; title:string}
 | {type:'edit-page'; id:string; title:string; content:string}
 | {type:'move'; id:string; parentId:string|null; beforeId:string|null}
 | {type:'relatabase'; id:string; name:string; leftDatabaseId:string; rightDatabaseId:string}
 | {type:'link'; id:string; relatabaseId:string; leftId:string; rightId:string; title:string}
 | {type:'view'; id:string; sourceId:string; sourceKind:'database'|'relatabase'; name:string; mode:SavedView['mode']}
 | {type:'edit-view'; id:string; name:string; mode:SavedView['mode']}
 | {type:'default-view'; id:string; viewId:string}
 | {type:'block'; id:string; pageId:string; viewId:string}
 | {type:'clone-view'; id:string; blockId:string; viewId:string};
export const emptyState = ():State => ({version:1,revision:0,databases:[],pages:[],records:[],relatabases:[],links:[],views:[],blocks:[]});
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
 const s:State=structuredClone(state);
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
  case 'database':{const name=label(c.name);need(!s.databases.some(d=>d.name.toLowerCase()===name.toLowerCase()),'Database already exists.');s.databases.push({id:c.id,name,defaultViewId:null});break}
  case 'page':s.pages.push({id:c.id,title:label(c.title),content:''});break;
  case 'record':{
   database(c.databaseId);if(c.parentId)need(record(c.parentId).databaseId===c.databaseId,'Parent must be in the same database.');
   s.pages.push({id:c.id,title:label(c.title),content:''});s.records.push({id:c.id,pageId:c.id,databaseId:c.databaseId,parentId:c.parentId,order:siblings(s,c.databaseId,c.parentId).length,summary:''});break;
  }
  case 'edit-page':{const p=page(c.id);p.title=label(c.title);need(typeof c.content==='string'&&c.content.length<=100000,'Content must be at most 100,000 characters.');p.content=c.content;break}
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
  case 'relatabase':database(c.leftDatabaseId);database(c.rightDatabaseId);s.relatabases.push({id:c.id,name:label(c.name),leftDatabaseId:c.leftDatabaseId,rightDatabaseId:c.rightDatabaseId});break;
  case 'link':{
   const d=s.relatabases.find(x=>x.id===c.relatabaseId);need(d,'Relatabase unavailable.');
   need(record(c.leftId).databaseId===d.leftDatabaseId&&record(c.rightId).databaseId===d.rightDatabaseId,'Endpoint belongs to the wrong database.');
   s.pages.push({id:c.id,title:label(c.title),content:''});s.links.push({id:c.id,pageId:c.id,relatabaseId:d.id,leftId:c.leftId,rightId:c.rightId,sequence:Math.max(0,...s.links.filter(l=>l.relatabaseId===d.id).map(l=>l.sequence))+1});break;
  }
  case 'view':need(['nested','table','gallery'].includes(c.mode),'Unsupported view mode.');need(c.sourceKind==='database'?s.databases.some(d=>d.id===c.sourceId):c.sourceKind==='relatabase'&&s.relatabases.some(d=>d.id===c.sourceId),'View source unavailable.');s.views.push({id:c.id,name:label(c.name),sourceId:c.sourceId,sourceKind:c.sourceKind,mode:c.mode});break;
  case 'edit-view':{const v=view(c.id);need(['nested','table','gallery'].includes(c.mode),'Unsupported view mode.');v.name=label(c.name);v.mode=c.mode;break}
  case 'default-view':{const d=database(c.id),v=view(c.viewId);need(v.sourceKind==='database'&&v.sourceId===d.id,'Default view must use this database.');d.defaultViewId=v.id;break}
  case 'block':page(c.pageId);view(c.viewId);s.blocks.push({id:c.id,pageId:c.pageId,viewId:c.viewId});break;
  case 'clone-view':{const b=s.blocks.find(b=>b.id===c.blockId);need(b&&b.viewId===c.viewId,'Block changed. Reload first.');const v=view(c.viewId);s.views.push({...v,id:c.id,name:v.name+' (independent)'});b.viewId=c.id;break}
 }
 s.revision++;return s;
}
export function findRecords(s:State,databaseId:string,query:string){const q=query.trim().toLowerCase();return s.records.filter(r=>r.databaseId===databaseId&&pageTitle(s,r.pageId).toLowerCase().includes(q))}
export const exactRecord=(s:State,databaseId:string,title:string)=>s.records.find(r=>r.databaseId===databaseId&&pageTitle(s,r.pageId).toLowerCase()===title.trim().toLowerCase());
