'use client';
import { useMemo, useState } from 'react';
import { CalendarDays, Target, LibraryBig, Plus, Settings2, Check, Clock3, FolderKanban, Link2, Inbox } from 'lucide-react';

type Section = 'Scheduling' | 'Goals' | 'Resources';
type View = 'Day' | 'Week' | 'Month';
type Task = { id: number; title: string; done: boolean; project: string };
type WorkBlock = { id: number; title: string; start: string; end: string; tasks: Task[] };

const initialBlocks: WorkBlock[] = [
  { id: 1, title: 'Work shift', start: '09:00', end: '17:00', tasks: [
    { id: 1, title: 'Send email to manager', done: false, project: 'Store operations' },
    { id: 2, title: 'Check product orders', done: false, project: 'Inventory' }
  ] },
  { id: 2, title: 'Creative work', start: '19:00', end: '21:00', tasks: [
    { id: 3, title: "Work on Michael's backstory", done: false, project: 'Book development' }
  ] }
];
const navigation = [{ name: 'Scheduling' as const, icon: CalendarDays }, { name: 'Goals' as const, icon: Target }, { name: 'Resources' as const, icon: LibraryBig }];

export default function Home() {
 const [section, setSection] = useState<Section>('Scheduling');
 const [view, setView] = useState<View>('Day');
 const [blocks, setBlocks] = useState<WorkBlock[]>(initialBlocks);
 const [newTitle, setNewTitle] = useState('');
 const [showNew, setShowNew] = useState(false);
 const [startDay, setStartDay] = useState('Monday');
 const [clock, setClock] = useState('12-hour');
 const [settings, setSettings] = useState(false);
 const today = useMemo(() => new Date(), []);
 const dateLabel = today.toLocaleDateString('en-CA', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
 const formatTime = (value:string) => {
   if (clock === '24-hour') return value;
   const [hour,min] = value.split(':').map(Number);
   return `${hour%12||12}:${String(min).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
 };
 function addBlock(){
   if(!newTitle.trim()) return;
   setBlocks(old => [...old,{id:Date.now(),title:newTitle.trim(),start:'09:00',end:'10:00',tasks:[]}]);
   setNewTitle(''); setShowNew(false);
 }
 function addTask(blockId:number, title:string) {
   if(!title.trim()) return;
   setBlocks(current => current.map(block => block.id===blockId ? {...block,tasks:[...block.tasks,{id:Date.now(),title:title.trim(),done:false,project:'Unassigned'}]} : block));
 }
 function toggleTask(blockId:number,taskId:number) {
   setBlocks(current => current.map(block => block.id===blockId ? {...block,tasks:block.tasks.map(task=>task.id===taskId?{...task,done:!task.done}:task)} : block));
 }
 return <div className="min-h-screen md:flex">
  <aside className="w-full border-b border-white/10 bg-[#101829] p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
    <div className="mb-8"><div className="text-xl font-bold tracking-tight">Think About It<span className="text-teal-400">.</span></div><div className="mt-1 text-xs text-slate-400">Connected information · Contextual action</div></div>
    <nav className="flex gap-2 md:flex-col">{navigation.map(({name,icon:Icon}) => <button key={name} onClick={()=>setSection(name)} className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-3 text-sm md:flex-none ${section===name?'bg-teal-400/15 text-teal-200':'text-slate-400 hover:bg-white/5'}`}><Icon size={18}/><span>{name}</span></button>)}</nav>
    <button onClick={()=>setSettings(!settings)} className="mt-6 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-400 hover:text-white"><Settings2 size={17}/> Settings</button>
    {settings && <div className="mt-3 space-y-3 rounded-xl border border-white/10 p-3 text-sm"><div className="font-semibold">Calendar</div><label className="block text-xs text-slate-400">Week starts on<select value={startDay} onChange={e=>setStartDay(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-2 text-white">{['Monday','Sunday','Saturday'].map(d=><option key={d}>{d}</option>)}</select></label><label className="block text-xs text-slate-400">Clock format<select value={clock} onChange={e=>setClock(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-2 text-white"><option value="12-hour">12-hour</option><option value="24-hour">24-hour</option></select></label></div>}
  </aside>
  <main className="mx-auto w-full max-w-6xl p-5 md:p-10">
   <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">My workspace</p><h1 className="text-3xl font-semibold md:text-4xl">{section}</h1><p className="mt-2 text-sm text-slate-400">{section==='Scheduling'?dateLabel:section==='Goals'?'Turn long-term visions into achievable projects.':'Capture thoughts and build an interconnected knowledge system.'}</p></div>{section==='Scheduling'&&<button onClick={()=>setShowNew(!showNew)} className="flex items-center gap-2 rounded-xl bg-teal-400 px-4 py-2.5 text-sm font-semibold text-slate-950"><Plus size={18}/> New block</button>}</header>
   {section==='Scheduling' && <>
    <div className="mb-6 flex w-fit rounded-xl border border-white/10 bg-white/5 p-1">{(['Day','Week','Month'] as View[]).map(v=><button key={v} onClick={()=>setView(v)} className={`rounded-lg px-5 py-2 text-sm ${view===v?'bg-slate-700 text-white':'text-slate-400'}`}>{v}</button>)}</div>
    {showNew&&<form onSubmit={e=>{e.preventDefault();addBlock()}} className="mb-5 flex gap-2"><input aria-label="Block name" autoFocus value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Block name" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-800 px-4 py-3"/><button className="rounded-xl bg-teal-400 px-4 text-slate-950">Add</button></form>}
    {view==='Day' ? <div className="space-y-4">{blocks.sort((a,b)=>a.start.localeCompare(b.start)).map(block=><BlockCard key={block.id} block={block} formatTime={formatTime} toggleTask={toggleTask} addTask={addTask} updateTime={(key,value)=>setBlocks(old=>old.map(b=>b.id===block.id?{...b,[key]:value}:b))}/>)}</div> : <div className="rounded-2xl border border-white/10 bg-white/5 p-6"><p className="text-lg font-medium">{view} planning</p><p className="mt-2 text-sm text-slate-400">This view is the next feature to build. It will help you arrange your {view==='Week'?'work shifts, activities, due dates and blocks':'paydays, events, commitments and project deadlines'}.</p><p className="mt-5 text-sm text-teal-300">Week starts on {startDay} · {clock} clock</p></div>}
   </>}
   {section==='Goals'&&<Placeholder icon={<FolderKanban size={24}/>} title="Goals and projects" description="A home for long-term visions, 13-week sprints, projects and actionable tasks. We'll build this section next."/>}
   {section==='Resources'&&<Placeholder icon={<Inbox size={24}/>} title="Your thought inbox" description="Capture ideas, build collections, and connect reusable resource pages to projects and tasks. We'll build this section next."/>}
   <p className="mt-10 text-xs text-slate-500">Prototype v0.1 · Example content only · Changes currently reset on refresh</p>
  </main>
 </div>;
}
function BlockCard({block,formatTime,toggleTask,addTask,updateTime}:{block:WorkBlock;formatTime:(v:string)=>string;toggleTask:(b:number,t:number)=>void;addTask:(b:number,t:string)=>void;updateTime:(k:'start'|'end',v:string)=>void}) {
 const [taskName,setTaskName]=useState('');
 const completed=block.tasks.filter(t=>t.done).length;
 return <section className="rounded-2xl border border-white/10 bg-[#151e30] p-5 shadow-lg shadow-black/10">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{block.title}</h2><div className="mt-1 flex items-center gap-2 text-sm text-slate-400"><Clock3 size={15}/>{formatTime(block.start)} – {formatTime(block.end)}</div></div><span className="rounded-lg bg-white/5 px-3 py-1 text-xs text-slate-300">{completed}/{block.tasks.length} done</span></div>
  <div className="mb-4 flex gap-4 text-xs text-slate-400"><label>Start <input aria-label={`${block.title} start`} type="time" value={block.start} onChange={e=>updateTime('start',e.target.value)} className="ml-2 rounded bg-slate-800 p-1 text-white"/></label><label>End <input aria-label={`${block.title} end`} type="time" value={block.end} onChange={e=>updateTime('end',e.target.value)} className="ml-2 rounded bg-slate-800 p-1 text-white"/></label></div>
  <div className="space-y-2">{block.tasks.map(task=><label key={task.id} className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/[.035] p-3"><input type="checkbox" checked={task.done} onChange={()=>toggleTask(block.id,task.id)} className="mt-1 accent-teal-400"/><span className="flex-1"><span className={task.done?'text-slate-500 line-through':''}>{task.title}</span><span className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Link2 size={12}/>{task.project}</span></span>{task.done&&<Check className="text-teal-400" size={17}/>}</label>)}</div>
  <form onSubmit={e=>{e.preventDefault();addTask(block.id,taskName);setTaskName('')}} className="mt-4 flex gap-2"><input aria-label={`New task in ${block.title}`} value={taskName} onChange={e=>setTaskName(e.target.value)} placeholder="Add a task…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-800 px-3 py-2 text-sm"/><button aria-label="Add task" className="rounded-xl border border-white/10 px-3 hover:bg-white/10"><Plus size={18}/></button></form>
 </section>;
}
function Placeholder({icon,title,description}:{icon:React.ReactNode;title:string;description:string}) {return <div className="rounded-2xl border border-dashed border-white/20 bg-white/[.03] p-10"><div className="mb-4 text-teal-300">{icon}</div><h2 className="mb-2 text-xl font-semibold">{title}</h2><p className="max-w-lg text-sm leading-6 text-slate-400">{description}</p></div>}
