import fixture from './playground-fixture.json';
import {emptyState,type Property,type State,type ViewConfig} from './domain';
// Exact example content from the supplied reference, confined to Demo Mode.
export function playgroundSeed():State {
 const s=emptyState(),ids=new Map<string,string>();const id=(key:string)=>{if(!ids.has(key))ids.set(key,crypto.randomUUID());return ids.get(key)!};
 const sources=[...fixture.dbs,...fixture.relatabases];
 for(const d of sources){
  const rows='leftDb' in d?fixture.relRecords.filter(r=>r.relId===d.id):fixture.records.filter(r=>r.dbId===d.id);
  for(const field of d.fields){const p:Property={id:id(d.id+':'+field.key),sourceId:id(d.id),name:field.name,type:field.type as Property['type'],options:[]};
   if(p.type==='select')p.options=[...new Set(rows.flatMap(r=>String((r.properties as unknown as Record<string,string>)[field.key]??'').split(',').map(v=>v.trim()).filter(Boolean)))].map(label=>({id:crypto.randomUUID(),label}));s.properties.push(p);
  }
 }
 const values=(source:string,raw:object)=>Object.fromEntries(Object.entries(raw).map(([key,v])=>{const p=s.properties.find(p=>p.id===id(source+':'+key))!;return [p.id,p.type==='select'?String(v).split(',').map(v=>p.options.find(o=>o.label===v.trim())!.id):v]}));
 s.databases=fixture.dbs.map(d=>({id:id(d.id),name:d.name,defaultViewId:null,description:d.description,icon:d.icon}));
 for(const r of fixture.records){s.pages.push({id:id(r.id),title:r.title,content:'',icon:'◇',description:''});s.records.push({id:id(r.id),pageId:id(r.id),databaseId:id(r.dbId),parentId:r.parentId?id(r.parentId):null,order:r.order,summary:'',values:values(r.dbId,r.properties)})}
 s.relatabases=fixture.relatabases.map(r=>({id:id(r.id),name:r.name,leftDatabaseId:id(r.leftDb),rightDatabaseId:id(r.rightDb),description:r.description,leftLabel:r.leftLabel,rightLabel:r.rightLabel}));
 const seq=new Map<string,number>();for(const r of fixture.relRecords){const n=(seq.get(r.relId)??0)+1;seq.set(r.relId,n);s.pages.push({id:id(r.id),title:fixture.records.find(x=>x.id===r.rightId)!.title+' · '+fixture.records.find(x=>x.id===r.leftId)!.title,content:''});s.links.push({id:id(r.id),pageId:id(r.id),relatabaseId:id(r.relId),leftId:id(r.leftId),rightId:id(r.rightId),sequence:n,values:values(r.relId,r.properties)})}
 s.views=fixture.views.map(v=>{const config:ViewConfig={summaryField:v.summaryField?id(v.sourceId+':'+v.summaryField):'',coverField:v.coverField?id(v.sourceId+':'+v.coverField):'',shownFields:v.shownFields.map(k=>id(v.sourceId+':'+k)),relatedId:v.relatedId?id(v.relatedId):'',groupBy:v.groupBy==='left'||v.groupBy==='right'?v.groupBy:v.groupBy?id(v.sourceId+':'+v.groupBy):'',showImage:v.showImage};return {id:id(v.id),name:v.name,sourceId:id(v.sourceId),sourceKind:v.sourceType as 'database'|'relatabase',mode:v.mode as State['views'][number]['mode'],config}});
 for(const p of fixture.pages){s.pages.push({id:id(p.id),title:p.title,content:'',description:p.description,icon:p.icon});for(const b of p.blocks)s.blocks.push({id:id(b.id),pageId:id(p.id),viewId:id(b.viewId)})}
 return s;
}
