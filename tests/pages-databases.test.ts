import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand,emptyState,pageTitle,recordPath,siblings,type Command} from '../lib/pages-databases/domain';
import {demoRepository} from '../lib/pages-databases/repository';
const id=()=>crypto.randomUUID();
test('canonical pages, nested moves, cycles, endpoints and independent view configuration',()=>{
 let s=emptyState();const send=(c:Command)=>s=applyCommand(s,c);
 const events=id(),characters=id(),era=id(),moment=id(),other=id(),alina=id(),rel=id(),perspective=id(),view=id(),page=id(),block=id();
 send({type:'database',id:events,name:'Events'});send({type:'database',id:characters,name:'Characters'});
 send({type:'record',id:era,databaseId:events,title:'Uprising',parentId:null});
 send({type:'record',id:moment,databaseId:events,title:'Blackout',parentId:era});
 send({type:'record',id:other,databaseId:events,title:'Before',parentId:era});
 send({type:'move',id:other,parentId:era,beforeId:moment});
 assert.deepEqual(siblings(s,events,era).map(x=>x.id),[other,moment]);
 assert.equal(recordPath(s,moment),'Uprising / Blackout');
 assert.throws(()=>send({type:'move',id:era,parentId:moment,beforeId:null}),/descendant/);
 assert.throws(()=>send({type:'record',id:id(),databaseId:characters,title:'Wrong parent',parentId:era}),/same database/);
 send({type:'record',id:alina,databaseId:characters,title:'Alina',parentId:null});
 send({type:'relatabase',id:rel,name:'Perspectives',leftDatabaseId:events,rightDatabaseId:characters});
 send({type:'link',id:perspective,relatabaseId:rel,leftId:moment,rightId:alina,title:'Alina at Blackout'});
 assert.equal(s.links.filter(l=>l.leftId===moment)[0].id,s.links.filter(l=>l.rightId===alina)[0].id);
 send({type:'edit-page',id:perspective,title:'Alina at Blackout',content:'She witnessed Otto die.'});
 assert.equal(s.pages.find(p=>p.id===perspective)?.content,'She witnessed Otto die.');
 send({type:'view',id:view,sourceKind:'database',sourceId:events,name:'History',mode:'nested'});
 send({type:'page',id:page,title:'World History'});send({type:'block',id:block,pageId:page,viewId:view});
 send({type:'default-view',id:events,viewId:view});assert.equal(s.blocks[0].viewId,view);
 send({type:'edit-view',id:view,name:'Shared History',mode:'gallery'});assert.equal(s.views.find(v=>v.id===s.blocks[0].viewId)?.mode,'gallery');
 send({type:'clone-view',id:id(),blockId:block,viewId:view});assert.notEqual(s.blocks[0].viewId,view);
 send({type:'edit-page',id:moment,title:'The Blackout',content:'Canonical text'});
 assert.equal(pageTitle(s,moment),'The Blackout');assert.equal(s.records.length,4);
});
test('demo persistence isolates profile and owner, prevents stale writes and replays retries',async()=>{
 const map=new Map<string,string>();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)}};
 const a=demoRepository(storage,'a','A'),b=demoRepository(storage,'a','B'),other=demoRepository(storage,'b','A');
 const s=await a.load(),c:Command={type:'database',id:id(),name:'History'},request=id();
 const saved=await a.send(s,c,request);assert.equal((await a.send(s,c,request)).revision,saved.revision);
 assert.equal((await demoRepository(storage,'a','A').load()).databases[0].name,'History');
 assert.equal((await b.load()).databases.length,0);assert.equal((await other.load()).databases.length,0);
 await assert.rejects(a.send(s,{type:'page',id:id(),title:'Stale'},id()),/changed/);
});

test('page-first properties: text/select conversion, stable field IDs, canonical view mappings, and atomic builder commands',()=>{
 let s=emptyState();const send=(c:Command)=>s=applyCommand(s,c);const db=id(),p=id(),r=id(),view=id(),page=id(),block=id();
 send({type:'database',id:db,name:'School Projects'});
 send({type:'property',id:p,sourceId:db,name:'Topics',propertyType:'text',options:[]});
 send({type:'record',id:r,databaseId:db,title:'Biology',parentId:null,values:{[p]:'Urgent, School'}});
 send({type:'property',id:p,sourceId:db,name:'Topics renamed',propertyType:'select',options:[]});
 const prop=s.properties.find(x=>x.id===p)!;assert.deepEqual(prop.options.map(o=>o.label),['Urgent','School']);assert.equal((s.records[0].values?.[p] as string[]).length,2);
 send({type:'property',id:p,sourceId:db,name:'Topics renamed',propertyType:'text',options:[]});assert.equal(s.records[0].values?.[p],'Urgent, School');
 assert.throws(()=>send({type:'property',id:p,sourceId:db,name:'Topics',propertyType:'number',options:[]}),/not valid numbers/);
 send({type:'batch',id:id(),commands:[{type:'view',id:view,sourceId:db,sourceKind:'database',name:'Nested',mode:'nested',config:{summaryField:p}},{type:'page',id:page,title:'My Semester',description:'Live page'},{type:'block',id:block,pageId:page,viewId:view},{type:'wizard',id:id(),wizard:{step:3,databaseId:db,viewId:view,pageId:page}}]});
 assert.equal(s.blocks[0].pageId,page);assert.equal(s.views[0].config?.summaryField,p);assert.equal(s.wizard?.step,3);
 const before=structuredClone(s);assert.throws(()=>send({type:'batch',id:id(),commands:[{type:'page',id:id(),title:'Should roll back'},{type:'record-values',id:r,values:{bad:'Invalid'}}]}),/Unknown property/);assert.deepEqual(s,before);
});

test('reference examples share Week and Perspective records across page views',async()=>{
 const {playgroundSeed}=await import('../lib/pages-databases/demo');const s=playgroundSeed();
 assert.equal(s.databases.length,4);assert.equal(s.pages.filter(p=>!s.records.some(r=>r.id===p.id)&&!s.links.some(l=>l.id===p.id)).length,4);
 const weeks=s.databases.find(d=>d.name==='Weeks')!,week=s.records.find(r=>r.databaseId===weeks.id&&pageTitle(s,r.id)==='Week 1')!;
 assert.equal(s.links.filter(l=>l.rightId===week.id).length,3);assert.equal(s.records.filter(r=>r.id===week.id).length,1);
 for(const v of s.views)assert.doesNotThrow(()=>applyCommand(s,{type:'edit-view',id:v.id,name:v.name,mode:v.mode,config:v.config}));
});
