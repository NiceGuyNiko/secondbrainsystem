'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import AuthGate from '@/components/auth-gate';
import CalendarWorkspace from '@/components/calendar-workspace';
import { useProfile } from '@/components/profile-context';
import { CalendarDays, Target, LibraryBig, Plus, Settings2, Check, Clock3, FolderKanban, Link2, Inbox, Menu, X, UserRound, LogOut, ChevronDown, BookOpen, Layers3, Zap } from 'lucide-react';

type Section = 'Scheduling' | 'Calendar' | 'Goals' | 'Resources' | 'Fluid Calendar' | 'Workspaces' | 'Think About It';
type View = 'Day' | 'Week' | 'Month';
type Task = { id: number; title: string; done: boolean; project: string };
type WorkBlock = { dbId?: string; id: number; title: string; start: string; end: string; tasks: Task[]; date?:string; endDate?:string; category?:string; kind?:string; locked?:boolean };


export default function Home() { return <AuthGate><Workspace /></AuthGate>; }
function Workspace() {
 const {displayName,email,openProfile,signOut}=useProfile();
 const [profileMenu,setProfileMenu]=useState(false);
 const [globalDayOpen,setGlobalDayOpen]=useState(false);
 const [hiddenSidebarCalendars,setHiddenSidebarCalendars]=useState<string[]>([]);
 const [section, setSection] = useState<Section>('Calendar');
  const [mobileMenu,setMobileMenu]=useState(false);
 const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
 useEffect(()=>{setSidebarCollapsed(localStorage.getItem('think-sidebar-collapsed')==='true')},[]);
 const toggleSidebar=()=>setSidebarCollapsed(v=>{localStorage.setItem('think-sidebar-collapsed',String(!v));return !v});
 const [view, setView] = useState<View>('Day');
 const [blocks, setBlocks] = useState<WorkBlock[]>([]);
 const [loadingBlocks,setLoadingBlocks]=useState(true);
 const [saveError,setSaveError]=useState('');
 const [newTitle, setNewTitle] = useState('');
 const [showNew, setShowNew] = useState(false);
 const [startDay, setStartDay] = useState('Monday');
 const [clock, setClock] = useState('12-hour');
 const [settings, setSettings] = useState(false);
 const [theme,setTheme]=useState<'system'|'light'|'dark'>('system');
 useEffect(()=>{const saved=localStorage.getItem('think-theme');if(saved==='light'||saved==='dark')setTheme(saved)},[]);
 useEffect(()=>{if(theme==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('think-theme',theme)},[theme]);
 const today = useMemo(() => new Date(), []);
 const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
 const dateLabel = today.toLocaleDateString('en-CA', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
 const formatTime = (value:string) => {
   if (clock === '24-hour') return value;
   const [hour,min] = value.split(':').map(Number);
   return `${hour%12||12}:${String(min).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
 };
 useEffect(()=>{
  let active=true;
  async function load(){
   const {data,error}=await supabase.from('user_items').select('id,content').eq('item_type','block').order('created_at',{ascending:true});
   if(!active)return;
   if(error)setSaveError(error.message);
   else setBlocks((data??[]).map(row=>({...row.content as WorkBlock,dbId:row.id})).filter(b=>!b.date||b.date<=todayKey&&(b.endDate||b.date)>=todayKey));
   setLoadingBlocks(false);
  }
  void load();
  const channel=supabase.channel('schedule-sync').on('postgres_changes',{event:'*',schema:'public',table:'user_items'},()=>{void load()}).subscribe();
  const onFocus=()=>{void load()};
  window.addEventListener('focus',onFocus);
  return()=>{active=false;window.removeEventListener('focus',onFocus);void supabase.removeChannel(channel)};
 },[]);
 async function saveBlock(block:WorkBlock){
  if(!block.dbId)return;
  const {data:current,error:readError}=await supabase.from('user_items').select('content').eq('id',block.dbId).single();
  if(readError){setSaveError(readError.message);return}
  const {error}=await supabase.from('user_items').update({title:block.title,content:{...(current.content as Record<string,unknown>),id:block.id,title:block.title,start:block.start,end:block.end,tasks:block.tasks},updated_at:new Date().toISOString()}).eq('id',block.dbId);
  if(error)setSaveError(error.message);
 }
 async function addBlock(){
  if(!newTitle.trim())return;
  const date=todayKey;
  const block:WorkBlock={id:Date.now(),title:newTitle.trim(),start:'09:00',end:'10:00',date,endDate:date,category:'Personal',kind:'block',locked:false,tasks:[]};
  const {data,error}=await supabase.from('user_items').insert({title:block.title,item_type:'block',content:block}).select('id').single();
  if(error){setSaveError(error.message);return}
  setBlocks(old=>[...old,{...block,dbId:data.id}]);setNewTitle('');setShowNew(false);
 }
 function changeBlock(blockId:number,change:(block:WorkBlock)=>WorkBlock){
  setBlocks(current=>current.map(block=>{if(block.id!==blockId)return block;const updated=change(block);void saveBlock(updated);return updated}));
 }
 function addTask(blockId:number,title:string){
  if(!title.trim())return;
  changeBlock(blockId,block=>({...block,tasks:[...block.tasks,{id:Date.now(),title:title.trim(),done:false,project:'Unassigned'}]}));
 }
 function toggleTask(blockId:number,taskId:number){
  changeBlock(blockId,block=>({...block,tasks:block.tasks.map(task=>task.id===taskId?{...task,done:!task.done}:task)}));
 }
 return <div className="app-shell min-h-screen md:flex">
  <aside className={`calendar-sidebar pr11-sidebar w-full min-w-0 border-b md:min-h-screen md:shrink-0 md:border-b-0 md:border-r transition-[width] duration-200 ${sidebarCollapsed?"md:w-[64px]":"md:w-[276px]"}`}>
    <div className={`pr11-brand flex items-center justify-between gap-2 py-5 ${sidebarCollapsed?"px-2":"px-4"}`}><div className="flex min-w-0 items-center gap-3"><div className="pr11-brand-mark"><Zap size={22}/></div><div className={`${sidebarCollapsed?"hidden":"min-w-0"}`}><div className="truncate text-lg font-semibold tracking-tight">All About Action</div><div className="calendar-subtle text-[11px] uppercase tracking-wide">{displayName}&apos;s calendar</div></div></div><button type="button" className="pr11-icon-button md:hidden" aria-label={mobileMenu?"Close navigation":"Open navigation"} aria-expanded={mobileMenu} onClick={()=>setMobileMenu(v=>!v)}>{mobileMenu?<X size={20}/>:<Menu size={20}/>}</button><button type="button" className="pr11-icon-button hidden md:flex" aria-label={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!sidebarCollapsed} onClick={toggleSidebar}><Menu size={20}/></button></div>
    <div className={`${mobileMenu?"block":"hidden"} pr11-sidebar-content pb-4 md:flex md:flex-col ${sidebarCollapsed?"px-1":"px-3"}`}>
      <nav className="space-y-1" aria-label="Main navigation">
        {([{name:'Goals',icon:Target,badge:'NA'},{name:'Calendar',icon:CalendarDays},{name:'Fluid Calendar',icon:Zap,badge:'Beta'},{name:'Workspaces',icon:Layers3,badge:'NA'},{name:'Resources',icon:BookOpen,badge:'NA'},{name:'Think About It',icon:LibraryBig,badge:'NA'}] as const).map(({name,icon:Icon,...rest})=><button key={name} onClick={()=>{setSection(name);setMobileMenu(false)}} title={sidebarCollapsed?name:undefined} aria-label={name} className={`calendar-nav pr11-nav flex w-full items-center gap-3 rounded-lg py-3 text-left text-sm ${sidebarCollapsed?"justify-center px-1":"px-3"} ${section===name?'active':''}`}><Icon size={21}/>{!sidebarCollapsed&&<span className="flex-1">{name}</span>}{!sidebarCollapsed&&'badge' in rest&&<span className={`pr11-badge ${rest.badge==='Beta'?'pr11-beta':''}`}>{rest.badge}</span>}</button>)}
      </nav>
      {(section==='Calendar'||section==='Fluid Calendar')&&<>
      <div className="pr11-sidebar-divider my-5"/>
      <div className={`flex items-center justify-between pb-3 ${sidebarCollapsed?"px-1":"px-3"}`}><span className={`text-sm font-semibold ${sidebarCollapsed?"sr-only":""}`}>Calendars</span><button className="pr11-icon-button" title="Manage calendars" onClick={()=>{setSection('Calendar');setMobileMenu(false)}}><Plus size={20}/></button></div>
      <div className={`space-y-2 text-sm ${sidebarCollapsed?"px-1":"px-3"}`}>{[['Personal','#1688ff'],['Work','#ff994b'],['Health','#ff354a'],['Relationship','#9c50f4'],['Appointment','#ef5ac3'],['Sprints','#74808f'],['Beta Tests','#18b8cb']].map(([label,color])=><button type="button" key={label} aria-pressed={!hiddenSidebarCalendars.includes(label)} onClick={()=>{setHiddenSidebarCalendars(old=>old.includes(label)?old.filter(c=>c!==label):[...old,label]);window.dispatchEvent(new CustomEvent('pr11-toggle-calendar',{detail:label}))}} title={label} aria-label={`Toggle ${label} calendar`} className={`flex w-full items-center gap-3 text-left ${sidebarCollapsed?"justify-center":""} ${hiddenSidebarCalendars.includes(label)?'opacity-40':''}`}><span className="pr11-calendar-key" style={{background:color}}>{!hiddenSidebarCalendars.includes(label)&&<Check size={14} strokeWidth={3}/>}</span>{!sidebarCollapsed&&<span>{label}</span>}</button>)}</div>
      </>}
      <div className="mt-auto pt-8 relative">
        <button type="button" aria-haspopup="menu" aria-expanded={profileMenu} onClick={()=>{setProfileMenu(v=>!v);setSettings(false)}} className="pr11-profile-trigger flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left"><span className="pr11-avatar"><UserRound size={18}/></span>{!sidebarCollapsed&&<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{displayName}</span><span className="calendar-subtle block truncate text-xs">{email}</span></span>}{!sidebarCollapsed&&<ChevronDown size={16}/>}</button>
        {profileMenu&&<div className="pr11-profile-menu" role="menu"><button role="menuitem" onClick={()=>{openProfile();setProfileMenu(false);setMobileMenu(false)}}><UserRound size={17}/> View profile</button><button role="menuitem" onClick={()=>{setSettings(v=>!v);setProfileMenu(false)}}><Settings2 size={17}/> Settings</button><div className="pr11-menu-divider"/><button role="menuitem" onClick={()=>{setProfileMenu(false);void signOut()}}><LogOut size={17}/> Sign out</button></div>}
        {settings&&<div className="pr11-profile-menu pr11-settings-menu"><div className="flex items-center justify-between px-2 py-1"><strong>Settings</strong><button aria-label="Close settings" onClick={()=>setSettings(false)}><X size={16}/></button></div><label>Week starts on<select value={startDay} onChange={e=>setStartDay(e.target.value)} className="calendar-input w-full rounded-lg p-2">{['Monday','Sunday','Saturday'].map(d=><option key={d}>{d}</option>)}</select></label><label>Clock format<select value={clock} onChange={e=>setClock(e.target.value)} className="calendar-input w-full rounded-lg p-2"><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></select></label><label>Appearance<select value={theme} onChange={e=>setTheme(e.target.value as typeof theme)} className="calendar-input w-full rounded-lg p-2"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div>}
      </div>
    </div>
  </aside>
  <main className={`calendar-main min-w-0 w-full flex-1 ${section==='Calendar'||section==='Fluid Calendar'?'p-2 md:p-4':'p-3 pt-6 sm:p-5 md:p-6'}`}>
   {section!=='Calendar'&&section!=='Fluid Calendar'&&<header className="calendar-header mb-6 flex flex-wrap items-start justify-between gap-4"><div><p className="calendar-accent mb-2 text-xs font-semibold uppercase tracking-[0.15em]">{displayName === 'My' ? 'My workspace' : displayName + (displayName.trim().toLowerCase().endsWith('s') ? '\u2019 workspace' : '\u2019s workspace')}</p><h1 className="text-3xl font-semibold md:text-4xl">{section}</h1><p className="calendar-subtle mt-2 text-sm">{section==='Scheduling'?dateLabel:section==='Goals'?'Turn long-term visions into achievable projects.':'Capture thoughts and build an interconnected knowledge system.'}</p></div>{section==='Scheduling'&&<button onClick={()=>setShowNew(!showNew)} className="calendar-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"><Plus size={18}/> New block</button>}</header>}
   {section==='Scheduling' && <>
    <div className="calendar-segment mb-6 flex w-fit rounded-xl p-1">{(['Day','Week','Month'] as View[]).map(v=><button key={v} onClick={()=>setView(v)} className={`rounded-lg px-5 py-2 text-sm ${view===v?'active':''}`}>{v}</button>)}</div>
    {showNew&&<form onSubmit={e=>{e.preventDefault();addBlock()}} className="mb-5 flex gap-2"><input aria-label="Block name" autoFocus value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Block name" className="calendar-input min-w-0 flex-1 rounded-xl px-4 py-3"/><button className="calendar-primary rounded-xl px-4">Add</button></form>}
    {saveError&&<p role="alert" className="mb-3 text-sm" style={{color:"var(--danger)"}}>Save error: {saveError}</p>}{loadingBlocks&&<p className="calendar-subtle mb-3 text-sm">Loading saved schedule…</p>}{view==='Day' ? <div className="calendar-panel overflow-hidden p-3 md:p-5"><div className="calendar-subtle mb-4 flex items-center gap-2 text-sm"><CalendarDays size={16}/>{dateLabel} · Daily timeline</div><div className="calendar-grid">{Array.from({length:24},(_,hour)=><div key={hour} className="calendar-hour"><div className="calendar-time">{formatTime(String(hour).padStart(2,'0')+':00')}</div><div className="calendar-slot">{[...blocks].filter(b=>Number(b.start.split(':')[0])===hour).sort((a,b)=>a.start.localeCompare(b.start)).map(block=><div className="calendar-event mb-2" key={block.id}><BlockCard block={block} formatTime={formatTime} toggleTask={toggleTask} addTask={addTask} updateTime={(key,value)=>changeBlock(block.id,b=>({...b,[key]:value}))}/></div>)}</div></div>)}</div>{!loadingBlocks&&blocks.length===0&&<p className="calendar-subtle py-5 text-center text-sm">No blocks yet. Select New block to start planning your day.</p>}</div> : <div className="calendar-panel p-6"><p className="text-lg font-medium">{view} planning</p><p className="calendar-subtle mt-2 text-sm">This view is the next feature to build. It will help you arrange your {view==='Week'?'work shifts, activities, due dates and blocks':'paydays, events, commitments and project deadlines'}.</p><p className="calendar-accent mt-5 text-sm">Week starts on {startDay} · {clock} clock</p></div>}
   </>}
   {(section==='Calendar'||section==='Fluid Calendar')&&<CalendarWorkspace key={section} startDay={startDay} clock={clock} fluidOnly={section==='Fluid Calendar'}/>}
   {section!=='Calendar'&&section!=='Fluid Calendar'&&<><button type="button" className="pr11-global-day-button" aria-label="Open today's day calendar" onClick={()=>setGlobalDayOpen(v=>!v)}><CalendarDays size={19}/> Day calendar</button>{globalDayOpen&&<aside className="pr11-day-sidepanel" aria-label="Day calendar details"><div className="pr11-sidepanel-head"><div><span className="calendar-muted text-xs">DAY CALENDAR</span><h3 className="text-lg font-semibold">{dateLabel}</h3></div><button aria-label="Close day calendar" onClick={()=>setGlobalDayOpen(false)}><X size={20}/></button></div><div className="pr11-sidepanel-list"><div className="pr11-day-timeline">{Array.from({length:24},(_,hour)=><div key={hour} className="pr11-hour-row"><span>{hour%12||12} {hour<12?'AM':'PM'}</span><div>{blocks.filter(b=>Number(b.start?.slice(0,2))===hour).map(b=><div key={b.dbId||b.id} className="pr11-hour-event"><strong>{b.title}</strong><small>{formatTime(b.start)} – {formatTime(b.end)}</small></div>)}</div></div>)}</div></div></aside>}</>}
   {(section==='Goals'||section==='Workspaces')&&<Placeholder icon={<FolderKanban size={24}/>} title="Goals and projects" description="A home for long-term visions, 13-week sprints, projects and actionable tasks. We'll build this section next."/>}
   {(section==='Resources'||section==='Think About It')&&<Placeholder icon={<Inbox size={24}/>} title="Your thought inbox" description="Capture ideas, build collections, and connect reusable resource pages to projects and tasks. We'll build this section next."/>}
   {section!=='Calendar'&&section!=='Fluid Calendar'&&<p className="calendar-muted mt-10 text-xs">Scheduling blocks and tasks saved to your account · Goals and Resources coming soon</p>}
  </main>
 </div>;
}
function BlockCard({block,formatTime,toggleTask,addTask,updateTime}:{block:WorkBlock;formatTime:(v:string)=>string;toggleTask:(b:number,t:number)=>void;addTask:(b:number,t:string)=>void;updateTime:(k:'start'|'end',v:string)=>void}) {
 const [taskName,setTaskName]=useState('');
 const completed=block.tasks.filter(t=>t.done).length;
 return <section className="calendar-card">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{block.title}</h2><div className="calendar-subtle mt-1 flex items-center gap-2 text-sm"><Clock3 size={15}/>{formatTime(block.start)} – {formatTime(block.end)}</div></div><span className="calendar-subtle rounded-lg px-3 py-1 text-xs">{completed}/{block.tasks.length} done</span></div>
  <div className="calendar-subtle mb-4 flex gap-4 text-xs"><label>Start <input aria-label={`${block.title} start`} type="time" value={block.start} onChange={e=>updateTime('start',e.target.value)} className="calendar-input ml-2 rounded p-1"/></label><label>End <input aria-label={`${block.title} end`} type="time" value={block.end} onChange={e=>updateTime('end',e.target.value)} className="calendar-input ml-2 rounded p-1"/></label></div>
  <div className="space-y-2">{block.tasks.map(task=><label key={task.id} className="calendar-task flex cursor-pointer items-start gap-3 rounded-xl p-3"><input type="checkbox" checked={task.done} onChange={()=>toggleTask(block.id,task.id)} className="mt-1 accent-teal-400"/><span className="flex-1"><span className={task.done?'calendar-muted line-through':''}>{task.title}</span><span className="calendar-muted mt-1 flex items-center gap-1 text-xs"><Link2 size={12}/>{task.project}</span></span>{task.done&&<Check className="calendar-accent" size={17}/>}</label>)}</div>
  <form onSubmit={e=>{e.preventDefault();addTask(block.id,taskName);setTaskName('')}} className="mt-4 flex gap-2"><input aria-label={`New task in ${block.title}`} value={taskName} onChange={e=>setTaskName(e.target.value)} placeholder="Add a task…" className="calendar-input min-w-0 flex-1 rounded-xl px-3 py-2 text-sm"/><button aria-label="Add task" className="calendar-panel rounded-xl px-3"><Plus size={18}/></button></form>
 </section>;
}
function Placeholder({icon,title,description}:{icon:React.ReactNode;title:string;description:string}) {return <div className="calendar-panel p-10"><div className="calendar-accent mb-4">{icon}</div><h2 className="mb-2 text-xl font-semibold">{title}</h2><p className="calendar-subtle max-w-lg text-sm leading-6">{description}</p></div>}
