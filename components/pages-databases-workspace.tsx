'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '@/lib/supabase';
import {environment} from '@/lib/environment';
import {applyCommand,emptyState,exactRecord,findRecords,pageTitle,recordPath,siblings,type Command,type State,type SavedView} from '@/lib/pages-databases/domain';
import {demoRepository,remoteRepository} from '@/lib/pages-databases/repository';
const uuid=()=>crypto.randomUUID();
type Run=(command:Command)=>Promise<boolean>;
export default function PagesDatabasesWorkspace({ownerId,profileId,area='pages'}:{ownerId:string;profileId:string;area?:string}){
 const repository=useMemo(()=>environment.ok&&environment.data==='demo'?demoRepository(window.localStorage,ownerId,profileId):remoteRepository(supabase,profileId),[ownerId,profileId]);
 const [state,setState]=useState<State>(emptyState),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [failed,setFailed]=useState<{command:Command;request:string}|null>(null);
 const current=useRef(state),inFlight=useRef(false);
 const [selection,setSelection]=useState<{kind:'database'|'relatabase'|'page'|'view';id:string}|null>(null);
 const [newChild,setNewChild]=useState<{databaseId:string;parentId:string|null}|null>(null);
 const [moving,setMoving]=useState<string|null>(null),[parent,setParent]=useState('');
 const [expanded,setExpanded]=useState<Set<string>>(new Set());
 const [embed,setEmbed]=useState(''),[mode,setMode]=useState<SavedView['mode']>('nested');
 const dragging=useRef<string|null>(null);
 const reload=useCallback(async()=>{if(inFlight.current)return;try{const s=await repository.load();current.current=s;setState(s);setLoaded(true);setError('');setFailed(null)}catch(e){setError(e instanceof Error?e.message:String(e))}},[repository]);
 useEffect(()=>{void reload()},[reload]);
 const execute=async(command:Command,request=uuid())=>{
  if(inFlight.current)return false;inFlight.current=true;setBusy(true);setError('');
  let attempted=false;
  try{applyCommand(current.current,command);attempted=true;const next=await repository.send(current.current,command,request);current.current=next;setState(next);setFailed(null);return true}
  catch(e){setError(e instanceof Error?e.message:String(e));setFailed(attempted?{command,request}:null);return false}
  finally{inFlight.current=false;setBusy(false)}
 };
 const run:Run=c=>execute(c);
 useEffect(()=>{setSelection(null);setNewChild(null);setMoving(null)},[area]);
 const locked=busy||!!failed;
 const open=(kind:NonNullable<typeof selection>['kind'],id:string)=>{setSelection({kind,id});if(kind==='database'){const db=current.current.databases.find(d=>d.id===id);const v=current.current.views.find(v=>v.id===db?.defaultViewId);setMode(v?.mode??'nested')}setNewChild(null);setMoving(null)};
 const page=selection?.kind==='page'?state.pages.find(p=>p.id===selection.id):undefined;
 const database=selection?.kind==='database'?state.databases.find(d=>d.id===selection.id):undefined;
 const rel=selection?.kind==='relatabase'?state.relatabases.find(d=>d.id===selection.id):undefined;
 const savedView=selection?.kind==='view'?state.views.find(v=>v.id===selection.id):undefined;
 const sources=area==='databases'?state.databases.map(d=>({kind:'database' as const,id:d.id,title:d.name})):area==='relatabases'?state.relatabases.map(d=>({kind:'relatabase' as const,id:d.id,title:d.name})):area==='views'?state.views.map(v=>({kind:'view' as const,id:v.id,title:v.name})):state.pages.filter(p=>!state.records.some(r=>r.pageId===p.id)&&!state.links.some(l=>l.pageId===p.id)).map(p=>({kind:'page' as const,id:p.id,title:p.title}));
 const createView=(sourceId:string,sourceKind:SavedView['sourceKind'],name:string)=>run({type:'view',id:uuid(),sourceId,sourceKind,name:name+' · '+mode,mode});
 const recordActions=(id:string)=>{const r=state.records.find(r=>r.id===id)!;const list=siblings(state,r.databaseId,r.parentId),at=list.findIndex(x=>x.id===id);return <div className="pd-actions">
  <button onClick={()=>open('page',r.pageId)}>Open page</button>
  <button disabled={locked} onClick={()=>{setExpanded(x=>new Set(x).add(id));setNewChild({databaseId:r.databaseId,parentId:id})}}>+ Add child</button>
  <button disabled={locked||at===0} aria-label={'Move '+pageTitle(state,id)+' up'} onClick={()=>void run({type:'move',id,parentId:r.parentId,beforeId:list[at-1]?.id??null})}>↑</button>
  <button disabled={locked||at===list.length-1} aria-label={'Move '+pageTitle(state,id)+' down'} onClick={()=>void run({type:'move',id,parentId:r.parentId,beforeId:list[at+2]?.id??null})}>↓</button>
  <button disabled={locked} onClick={()=>{setMoving(id);setParent(r.parentId??'')}}>Move…</button>
 </div>};
 const tree=(databaseId:string,parentId:string|null,depth=0):React.ReactNode=>depth>100?null:siblings(state,databaseId,parentId).map(r=>{
  const children=state.records.filter(c=>c.parentId===r.id),isOpen=expanded.has(r.id);
  return <article key={r.id} className="pd-card" draggable={!locked} onDragStart={e=>{dragging.current=r.id;e.dataTransfer.setData('text/plain',r.id);e.stopPropagation()}} onDragEnd={()=>dragging.current=null}
   onDragOver={e=>{if(dragging.current&&dragging.current!==r.id){e.preventDefault();e.stopPropagation()}}} onDrop={e=>{e.preventDefault();e.stopPropagation();const id=dragging.current;dragging.current=null;if(id&&id!==r.id)void run({type:'move',id,parentId:r.parentId,beforeId:r.id})}}>
   <button className="pd-card-expand" aria-expanded={isOpen} onClick={()=>setExpanded(old=>{const next=new Set(old);if(next.has(r.id))next.delete(r.id);else next.add(r.id);return next})}>
    <span>{isOpen?'▾':'▸'}</span><span><strong>{pageTitle(state,r.pageId)}</strong><small>{children.length} children · {state.links.filter(l=>l.leftId===r.id||l.rightId===r.id).length} detailed links</small></span>
   </button>
   {recordActions(r.id)}
   {isOpen&&<div className="pd-children">{tree(databaseId,r.id,depth+1)}{!children.length&&<p>No children yet. Add one here.</p>}</div>}
  </article>
 });
 const renderView=(v:SavedView)=>v.sourceKind==='relatabase'?<div className="pd-grid">{state.links.filter(l=>l.relatabaseId===v.sourceId).map(l=><button className="pd-card pd-link-card" key={l.id} onClick={()=>open('page',l.pageId)}><small>#{l.sequence} · {recordPath(state,l.leftId)} ↔ {recordPath(state,l.rightId)}</small><strong>{pageTitle(state,l.pageId)}</strong></button>)}</div>:v.mode==='nested'?tree(v.sourceId,null):v.mode==='table'?<div className="pd-table-scroll"><table><thead><tr><th>Name</th><th>Parent path</th><th>Actions</th></tr></thead><tbody>{state.records.filter(r=>r.databaseId===v.sourceId).map(r=><tr key={r.id}><td><button onClick={()=>open('page',r.pageId)}>{pageTitle(state,r.pageId)}</button></td><td>{r.parentId?recordPath(state,r.parentId):'Root'}</td><td>{recordActions(r.id)}</td></tr>)}</tbody></table></div>:<div className="pd-grid">{state.records.filter(r=>r.databaseId===v.sourceId).map(r=><article className="pd-card" key={r.id}><h3>{pageTitle(state,r.pageId)}</h3><p>{recordPath(state,r.id)}</p>{recordActions(r.id)}</article>)}</div>;
 return <section className="pd-workspace">
  <header className="pd-header"><div><small>PAGES & DATABASES · EARLY PREVIEW</small><h1>{page?.title??database?.name??rel?.name??savedView?.name??(area==='relatabases'?'Relatabases':area==='databases'?'Databases':area==='views'?'Views':'Pages')}</h1><p>One record. Many places to work with it.</p></div><button disabled={busy} onClick={()=>void reload()}>Reload</button></header>
  {environment.ok&&environment.data==='demo'&&<p className="pd-note">Demo data saves in this browser, separately for each profile.</p>}
  {error&&<div role="alert" className="pd-error">{error}{failed&&<button disabled={busy} onClick={()=>void execute(failed.command,failed.request)}>Retry same save</button>}<p>Reload to resolve a conflicting change. Your open form stays here.</p></div>}
  {!loaded?<p>{error?'The backend is not ready for this module.':'Loading workspace…'}</p>:<>
  <div className="pd-layout"><nav aria-label="Pages and database items" className="pd-items">
   <h2>{area==='databases'?'Databases':area==='relatabases'?'Relatabases':area==='views'?'Views':'Pages'}</h2>
   {sources.map(x=><button key={x.id} aria-current={selection?.id===x.id?'page':undefined} onClick={()=>open(x.kind,x.id)}>{x.title}</button>)}
   {!sources.length&&<p>Create your first {area==='databases'?'database':area==='relatabases'?'Relatabase':area==='views'?'saved view':'page'}.</p>}
   {area!=='views'&&<CreateItem key={area} area={area} state={state} locked={locked} run={run} onCreated={open}/>}
  </nav><div className="pd-content">
   {!selection&&<div className="pd-empty"><h2>Build from any starting point</h2><p>Create a database, add records inside one another, and place live views on a page. Detailed relationships get their own pages too.</p><p>Use Pages, Databases, Relatabases, and Views in AAA’s sidebar to explore this workspace.</p></div>}
   {database&&<>
    <div className="pd-toolbar"><button disabled={locked} onClick={()=>setNewChild({databaseId:database.id,parentId:null})}>+ Add root record</button><label>View layout<select value={mode} onChange={e=>setMode(e.target.value as SavedView['mode'])}><option value="nested">Nested Cards</option><option value="table">Table</option><option value="gallery">Gallery</option></select></label><button disabled={locked} onClick={()=>void createView(database.id,'database',database.name)}>Save view</button></div>
    {renderView({id:'live',sourceId:database.id,sourceKind:'database',mode,name:database.name})}
   </>}
   {newChild&&<NameForm key={newChild.databaseId+newChild.parentId} label={newChild.parentId?'Add child inside '+pageTitle(state,newChild.parentId):'Add root record'} locked={locked} onCancel={()=>setNewChild(null)} onSave={async title=>{const id=uuid();if(await run({type:'record',id,databaseId:newChild.databaseId,parentId:newChild.parentId,title})){setNewChild(null);return true}return false}}/>}
   {moving&&<form className="pd-form" onSubmit={async e=>{e.preventDefault();if(await run({type:'move',id:moving,parentId:parent||null,beforeId:null}))setMoving(null)}}><h3>Move {pageTitle(state,moving)}</h3><label>New parent<select value={parent} onChange={e=>setParent(e.target.value)}><option value="">Root</option>{state.records.filter(r=>r.databaseId===state.records.find(x=>x.id===moving)?.databaseId&&r.id!==moving).map(r=><option key={r.id} value={r.id}>{recordPath(state,r.id)}</option>)}</select></label><button disabled={locked}>Move to end</button><button type="button" onClick={()=>setMoving(null)}>Cancel</button></form>}
   {page&&<>
    <PageEditor key={page.id} page={page} locked={locked} run={run}/>
    {state.records.some(r=>r.pageId===page.id)&&<RelationshipPanel key={page.id} state={state} recordId={page.id} run={run} locked={locked} onOpen={id=>open('page',id)}/>}
    {state.links.filter(l=>l.pageId===page.id).map(l=><p key={l.id}><button onClick={()=>open('page',l.leftId)}>{recordPath(state,l.leftId)}</button> ↔ <button onClick={()=>open('page',l.rightId)}>{recordPath(state,l.rightId)}</button><small> · Detailed relationship #{l.sequence}</small></p>)}
    <h2>Live views</h2>
    {state.blocks.filter(b=>b.pageId===page.id).map(b=>{const v=state.views.find(v=>v.id===b.viewId);return v?<section className="pd-embedded" key={b.id}><div className="pd-toolbar"><h3>{v.name}</h3><button onClick={()=>open('view',v.id)}>Open view</button><button disabled={locked} onClick={()=>void run({type:'clone-view',id:uuid(),blockId:b.id,viewId:v.id})}>Independent copy</button></div>{renderView(v)}</section>:null})}
    <form className="pd-toolbar" onSubmit={async e=>{e.preventDefault();if(embed&&await run({type:'block',id:uuid(),pageId:page.id,viewId:embed}))setEmbed('')}}><label>Embed saved view<select value={embed} onChange={e=>setEmbed(e.target.value)}><option value="">Choose a view…</option>{state.views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><button disabled={locked||!embed}>Add live view</button></form>
   </>}
   {rel&&<><LinkForm key={rel.id} state={state} relatabaseId={rel.id} run={run} locked={locked}/><button disabled={locked} onClick={()=>void createView(rel.id,'relatabase',rel.name)}>Save relationship view</button>{renderView({id:'rel',sourceId:rel.id,sourceKind:'relatabase',mode:'table',name:rel.name})}</>}
   {savedView&&<><ViewEditor key={savedView.id} view={savedView} run={run} locked={locked}/><p>Used by {state.blocks.filter(b=>b.viewId===savedView.id).length} page blocks. Every embedding uses the same records.</p>{savedView.sourceKind==='database'&&<button disabled={locked} onClick={()=>void run({type:'default-view',id:savedView.sourceId,viewId:savedView.id})}>Make database default</button>}{renderView(savedView)}</>}
  </div></div></>}
 </section>;
}
function NameForm({label,locked,onSave,onCancel}:{label:string;locked:boolean;onSave:(name:string)=>Promise<boolean>;onCancel?:()=>void}){
 const [name,setName]=useState('');return <form className="pd-form" onSubmit={async e=>{e.preventDefault();if(await onSave(name))setName('')}}><label>{label}<input required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={locked||!name.trim()}>Create</button>{onCancel&&<button type="button" onClick={onCancel}>Cancel</button>}</form>
}
function CreateItem({area,state,locked,run,onCreated}:{area:string;state:State;locked:boolean;run:Run;onCreated:(kind:'page'|'database'|'relatabase',id:string)=>void}){
 const [name,setName]=useState(''),[left,setLeft]=useState(''),[right,setRight]=useState('');
 const kind=area==='databases'?'database':area==='relatabases'?'relatabase':'page';
 return <form className="pd-form" onSubmit={async e=>{e.preventDefault();const id=uuid();const c:Command=kind==='database'?{type:'database',id,name}:kind==='relatabase'?{type:'relatabase',id,name,leftDatabaseId:left,rightDatabaseId:right}:{type:'page',id,title:name};if(await run(c)){onCreated(kind,id);setName('')}}}>
  <label>New {kind}<input value={name} maxLength={160} required onChange={e=>setName(e.target.value)}/></label>
  {kind==='relatabase'&&<>{[[left,setLeft,'Left endpoint database'],[right,setRight,'Right endpoint database']].map(([value,setValue,label])=><label key={label as string}>{label as string}<select required value={value as string} onChange={e=>(setValue as (s:string)=>void)(e.target.value)}><option value="">Choose database…</option>{state.databases.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>)}</>}
  <button disabled={locked||!name.trim()}>+ Create {kind}</button>
 </form>
}
function PageEditor({page,locked,run}:{page:State['pages'][number];locked:boolean;run:Run}){
 const [title,setTitle]=useState(page.title),[content,setContent]=useState(page.content);
 return <form className="pd-form" onSubmit={async e=>{e.preventDefault();await run({type:'edit-page',id:page.id,title,content})}}><label>Page title<input required value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/></label><label>Content<textarea value={content} rows={7} maxLength={100000} onChange={e=>setContent(e.target.value)} placeholder="Write about this page…"/></label><button disabled={locked}>Save page</button><small>Stable page ID: {page.id}</small></form>
}
function RecordPicker({state,databaseId,value,onSelect,locked,run,label}:{state:State;databaseId:string;value:string;onSelect:(id:string)=>void;locked:boolean;run:Run;label:string}){
 const [query,setQuery]=useState('');const matches=findRecords(state,databaseId,query);
 return <div className="pd-picker"><label>{label}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find or create…"/></label>{value&&<p>Selected: {recordPath(state,value)}</p>}
 <div className="pd-results">{matches.slice(0,30).map(r=><button type="button" disabled={locked} key={r.id} aria-pressed={value===r.id} onClick={()=>onSelect(r.id)}>{recordPath(state,r.id)}</button>)}</div>
 {query.trim()&&!exactRecord(state,databaseId,query)&&<button disabled={locked} type="button" onClick={async()=>{const id=uuid();if(await run({type:'record',id,databaseId,title:query,parentId:null})){onSelect(id);setQuery('')}}}>+ Create “{query.trim()}”</button>}
 </div>
}
function LinkForm({state,relatabaseId,recordId,locked,run}:{state:State;relatabaseId:string;recordId?:string;locked:boolean;run:Run}){
 const rel=state.relatabases.find(r=>r.id===relatabaseId)!;const source=state.records.find(r=>r.id===recordId);
 const [left,setLeft]=useState(source?.databaseId===rel.leftDatabaseId?recordId??'':''),[right,setRight]=useState(source?.databaseId===rel.rightDatabaseId&&rel.leftDatabaseId!==rel.rightDatabaseId?recordId??'':''),[title,setTitle]=useState('');
 return <form className="pd-form" onSubmit={async e=>{e.preventDefault();if(await run({type:'link',id:uuid(),relatabaseId,leftId:left,rightId:right,title:title||rel.name})){setTitle('')}}}>
  <h3>Add detailed relationship · {rel.name}</h3>
  <RecordPicker state={state} databaseId={rel.leftDatabaseId} value={left} onSelect={setLeft} locked={locked} run={run} label={state.databases.find(d=>d.id===rel.leftDatabaseId)?.name??'Left endpoint'}/>
  <RecordPicker state={state} databaseId={rel.rightDatabaseId} value={right} onSelect={setRight} locked={locked} run={run} label={state.databases.find(d=>d.id===rel.rightDatabaseId)?.name??'Right endpoint'}/>
  <label>Relationship page title<input value={title} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder={rel.name}/></label><button disabled={locked||!left||!right}>Create detailed relationship</button>
 </form>
}
function RelationshipPanel({state,recordId,run,locked,onOpen}:{state:State;recordId:string;run:Run;locked:boolean;onOpen:(id:string)=>void}){
 const db=state.records.find(r=>r.id===recordId)?.databaseId;const rels=state.relatabases.filter(r=>r.leftDatabaseId===db||r.rightDatabaseId===db);const [selected,setSelected]=useState('');
 return <section><h2>Detailed relationships</h2>{state.links.filter(l=>l.leftId===recordId||l.rightId===recordId).map(l=><button className="pd-card pd-link-card" key={l.id} onClick={()=>onOpen(l.pageId)}><strong>{pageTitle(state,l.pageId)}</strong><small>{recordPath(state,l.leftId)} ↔ {recordPath(state,l.rightId)}</small></button>)}
 <label>Add link detail<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a Relatabase…</option>{rels.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
 {selected&&<LinkForm key={selected} state={state} relatabaseId={selected} recordId={recordId} locked={locked} run={run}/>}
 {!rels.length&&<p>Create a Relatabase for this database to add detailed relationships.</p>}</section>
}

function ViewEditor({view,run,locked}:{view:SavedView;run:Run;locked:boolean}){
 const [name,setName]=useState(view.name),[mode,setMode]=useState(view.mode);
 return <form className="pd-form" onSubmit={async e=>{e.preventDefault();await run({type:'edit-view',id:view.id,name,mode})}}><label>Saved view name<input required value={name} maxLength={160} onChange={e=>setName(e.target.value)}/></label><label>Layout<select value={mode} onChange={e=>setMode(e.target.value as SavedView['mode'])}><option value="nested">Nested Cards</option><option value="table">Table</option><option value="gallery">Gallery</option></select></label><button disabled={locked}>Save shared view</button><small>Saving changes every page block using this view. Make an independent copy on a page to change only that block.</small></form>
}
