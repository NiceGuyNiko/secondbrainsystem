import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import type {Command,State} from '../lib/pages-databases/domain';
const id=()=>crypto.randomUUID();
test('SQL write boundary: normalized persistence, retry, cycles, profile/account isolation, no direct or anonymous writes',async()=>{
 const db=new PGlite();try{
 const a=id(),b=id();await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 insert into auth.users values('${a}'),('${b}');`);
 for(const file of readdirSync('supabase/migrations').filter(x=>x.includes('_pages_databases_foundation')||x.includes('_pages_canvas_properties')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
 const workspace=(await db.query<{id:string}>("select public.pd_open_workspace('A') id")).rows[0].id;
 assert.equal((await db.query<{id:string}>("select public.pd_open_workspace('A') id")).rows[0].id,workspace);
 const w2=(await db.query<{id:string}>("select public.pd_open_workspace('B') id")).rows[0].id;
 let revision=0;
 const send=async(c:Command,request=id(),expected=revision)=>{
  const result=await db.query<{s:State}>('select public.pd_command($1,$2,$3,$4::jsonb) s',[workspace,expected,request,JSON.stringify(c)]);revision=result.rows[0].s.revision;return result.rows[0].s;
 };
 const events=id(),characters=id(),era=id(),moment=id(),before=id(),alina=id(),rel=id(),link=id(),v=id(),p=id(),block=id();
 const cmd:Command={type:'database',id:events,name:'Events'},req=id();await send(cmd,req);await send(cmd,req,0);assert.equal(revision,1);
 await assert.rejects(send({type:'database',id:id(),name:'Duplicate request'},req),/reused/);
 await assert.rejects(send({type:'page',id:id(),title:'Stale'},id(),0),/changed/);
 await send({type:'database',id:characters,name:'Characters'});
 await send({type:'record',id:era,databaseId:events,title:'Era',parentId:null});
 await send({type:'record',id:moment,databaseId:events,title:'Moment',parentId:era});
 await send({type:'record',id:before,databaseId:events,title:'Before',parentId:era});
 let s=await send({type:'move',id:before,parentId:era,beforeId:moment});
 assert.deepEqual(s.records.filter(r=>r.parentId===era).map(r=>r.id),[before,moment]);
 await assert.rejects(send({type:'move',id:era,parentId:moment,beforeId:null}),/cycle/);
 await assert.rejects(send({type:'record',id:id(),databaseId:characters,title:'Invalid',parentId:era}),/foreign key/);
 assert.equal((await db.query<{n:number}>('select count(*)::int n from public.pd_pages')).rows[0].n,3,'failed creation rolls back orphan page');
 await send({type:'record',id:alina,databaseId:characters,title:'Alina',parentId:null});
 await send({type:'relatabase',id:rel,name:'Perspectives',leftDatabaseId:events,rightDatabaseId:characters});
 await assert.rejects(send({type:'link',id:id(),relatabaseId:rel,leftId:alina,rightId:moment,title:'Invalid'}),/endpoint/);
 await send({type:'link',id:link,relatabaseId:rel,leftId:moment,rightId:alina,title:'Alina at Moment'});
 s=await send({type:'edit-page',id:link,title:'Perspective',content:'One page from both endpoints'});
 assert.equal(s.links[0].sequence,1);assert.equal(s.pages.find(p=>p.id===link)?.content,'One page from both endpoints');
 await send({type:'view',id:v,sourceId:events,sourceKind:'database',name:'History',mode:'nested'});
 await send({type:'page',id:p,title:'History page'});await send({type:'block',id:block,pageId:p,viewId:v});
 s=await send({type:'default-view',id:events,viewId:v});assert.equal(s.blocks[0].viewId,v);
 s=await send({type:'edit-view',id:v,name:'Shared History',mode:'gallery'});assert.equal(s.views.find(v=>v.id===s.blocks[0].viewId)?.mode,'gallery');
 s=await send({type:'clone-view',id:id(),blockId:block,viewId:v});assert.notEqual(s.blocks[0].viewId,v);assert.equal(s.records.length,4);
 const isolated=(await db.query<{s:State}>('select public.pd_load($1) s',[w2])).rows[0].s;assert.equal(isolated.records.length,0);
 await assert.rejects(db.query('insert into public.pd_pages values($1,$2,$3,$4)',[id(),workspace,'Bypass','']),/permission denied/);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
 assert.equal((await db.query('select * from public.pd_pages')).rows.length,0);
 await assert.rejects(db.query('select public.pd_load($1)',[workspace]),/unavailable/);
 await assert.rejects(db.query('select public.pd_command($1,0,$2,$3::jsonb)',[workspace,id(),JSON.stringify({type:'page',id:id(),title:'No'})]),/unavailable/);
 await db.exec('set role anon');await assert.rejects(db.query('select * from public.pd_pages'),/permission denied/);
 await assert.rejects(db.query("select public.pd_open_workspace('X')"),/permission denied/);
 }finally{await db.close()}
});

test('SQL page canvas: typed properties, lossless conversions, view settings and atomic builder batches',async()=>{
 const db=new PGlite();try{
 const owner=id();await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${owner}');`);
 for(const file of readdirSync('supabase/migrations').filter(x=>x.includes('_pages_databases_foundation')||x.includes('_pages_canvas_properties')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);
 const w=(await db.query<{id:string}>("select public.pd_open_workspace('canvas') id")).rows[0].id;let rev=0;
 const send=async(c:Command)=>{const result=(await db.query<{s:State}>('select public.pd_command($1,$2,$3,$4::jsonb) s',[w,rev,id(),JSON.stringify(c)])).rows[0].s;rev=result.revision;return result};
 const d=id(),field=id(),r=id(),view=id(),p=id(),block=id();
 await send({type:'database',id:d,name:'Projects',description:'One collection',icon:'◫'});
 await send({type:'property',id:field,sourceId:d,name:'Summary',propertyType:'text',options:[]});
 await send({type:'record',id:r,databaseId:d,title:'Biology',parentId:null,values:{[field]:'Urgent, School'}});
 let s=await send({type:'property',id:field,sourceId:d,name:'Topics',propertyType:'select',options:[]});
 assert.deepEqual(s.properties[0].options.map(o=>o.label),['Urgent','School']);assert.equal((s.records[0].values?.[field] as string[]).length,2);
 s=await send({type:'property',id:field,sourceId:d,name:'Topics',propertyType:'text',options:[]});assert.equal(s.records[0].values?.[field],'Urgent, School');
 await assert.rejects(send({type:'property',id:field,sourceId:d,name:'Topics',propertyType:'number',options:[]}),/not valid numbers/);
 await assert.rejects(send({type:'record-values',id:r,values:{[id()]:'Wrong field'}}),/Unknown property/);
 await assert.rejects(db.query('select public.pd_command_v1($1,$2,$3,$4::jsonb)',[w,rev,id(),JSON.stringify({type:'page',id:id(),title:'Bypass'})]),/permission denied/);
 const transaction:Command={type:'batch',id:id(),commands:[{type:'view',id:view,sourceId:d,sourceKind:'database',name:'Grouped Projects',mode:'grouped',config:{summaryField:field,shownFields:[field],groupBy:field}},{type:'page',id:p,title:'My Semester',description:'Live dashboard',icon:'◇'},{type:'block',id:block,pageId:p,viewId:view},{type:'wizard',id:id(),wizard:{step:3,databaseId:d,viewId:view,pageId:p}}]};
 s=await send(transaction);assert.equal(s.views[0].config?.summaryField,field);assert.equal(s.views[0].mode,'grouped');assert.equal(s.pages.find(x=>x.id===p)?.description,'Live dashboard');assert.equal(s.wizard?.pageId,p);
 const invalidPage=id();await assert.rejects(send({type:'batch',id:id(),commands:[{type:'page',id:invalidPage,title:'Must roll back'},{type:'record-values',id:r,values:{invalid:'No'}}]}));
 assert.equal((await db.query('select * from public.pd_pages where id=$1',[invalidPage])).rows.length,0);
 assert.equal((await db.query('select * from public.pd_property_history')).rows.length,2,'failed conversion does not leave history or partial data');
 s=await send({type:'remove-block',id:block});assert.equal(s.blocks.length,0);assert.equal(s.records.length,1);
 }finally{await db.close()}
});
