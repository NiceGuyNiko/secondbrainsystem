"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {ChevronLeft,ChevronRight,LocateFixed,Plus,X} from "lucide-react";
import {occurrenceKey,timedLanes,type CalendarEvent,type CalendarTask,type Occurrence} from "@/lib/calendar-layout";
import type {CompanionJump} from "@/lib/companion-config";

const dateAtNoon=(iso:string)=>new Date(iso+"T12:00:00");
const dateISO=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const shiftDay=(iso:string,days:number)=>{const d=dateAtNoon(iso);d.setDate(d.getDate()+days);return dateISO(d);};
const minutes=(clock:string)=>Number(clock.slice(0,2))*60+Number(clock.slice(3,5));
const dateLabel=(iso:string)=>dateAtNoon(iso).toLocaleDateString("en-CA",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
type Props={
  date:string;today:string;now:Date;timeZone:string;jump:CompanionJump;
  onDate:(date:string)=>void;selected:string|null;onSelected:(id:string|null)=>void;
  occurrencesForDate:(date:string)=>Occurrence[];colour:(event:CalendarEvent)=>string;
  format:(time:string)=>string;onNew:(date:string)=>void;
  onToggleTask:(event:CalendarEvent,task:CalendarTask)=>Promise<void>;
  onOpenThought?:(id:string)=>void;
};
export default function CompanionAgendaView(p:Props){
  const scroller=useRef<HTMLDivElement>(null);
  const dateTrigger=useRef<HTMLButtonElement>(null);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [month,setMonth]=useState(()=>new Date(dateAtNoon(p.date).getFullYear(),dateAtNoon(p.date).getMonth(),1,12));
  const [position,setPosition]=useState({top:80,left:12});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const occurrences=p.occurrencesForDate(p.date);
  const blocks=timedLanes(occurrences,p.date);
  const selected=occurrences.find(o=>occurrenceKey(o)===p.selected);
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:p.timeZone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(p.now);
  const clock=(parts.find(x=>x.type==="hour")?.value||"00")+":"+(parts.find(x=>x.type==="minute")?.value||"00");
  const nowMinute=minutes(clock);
  const first=occurrences.filter(o=>!o.event.allDay).map(o=>minutes(o.start||o.event.start)).sort((a,b)=>a-b)[0]??0;
  const initialScroll=p.date===p.today?Math.max(0,nowMinute-120):p.jump==="midnight"?0:Math.max(0,first-80);
  const priorJump=useRef<string|null>(null);
  useEffect(()=>{
    const identifier=p.date+":"+p.jump;
    if(priorJump.current===identifier)return;
    priorJump.current=identifier;
    if(scroller.current)scroller.current.scrollTop=initialScroll;
  },[p.date,p.jump,initialScroll]);
  useEffect(()=>{
    if(!pickerOpen)return;
    const closeEscape=(e:KeyboardEvent)=>{
      if(e.key!=="Escape")return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      setPickerOpen(false);dateTrigger.current?.focus();
    };
    window.addEventListener("keydown",closeEscape,true);
    return()=>window.removeEventListener("keydown",closeEscape,true);
  },[pickerOpen]);
  const openPicker=()=>{
    if(!dateTrigger.current)return;
    const rect=dateTrigger.current.getBoundingClientRect();
    const left=Math.max(10,Math.min(rect.left,window.innerWidth-306));
    const top=rect.bottom+338>window.innerHeight?Math.max(10,rect.top-344):rect.bottom+7;
    const d=dateAtNoon(p.date);
    setMonth(new Date(d.getFullYear(),d.getMonth(),1,12));
    setPosition({left,top});setPickerOpen(true);
  };
  const choose=(iso:string)=>{
    p.onSelected(null);p.onDate(iso);setPickerOpen(false);dateTrigger.current?.focus();
  };
  const goNow=()=>{
    p.onSelected(null);setPickerOpen(false);
    if(p.date!==p.today)p.onDate(p.today);
    else if(scroller.current)scroller.current.scrollTop=Math.max(0,nowMinute-120);
  };
  const monthStart=useMemo(()=>{
    const d=new Date(month.getFullYear(),month.getMonth(),1,12);
    d.setDate(1-(d.getDay()+6)%7);
    return d;
  },[month]);
  const cells=useMemo(()=>Array.from({length:42},(_,i)=>{
    const d=new Date(monthStart);d.setDate(d.getDate()+i);
    return {iso:dateISO(d),day:d.getDate(),month:d.getMonth()};
  }),[monthStart]);
  return <div className="aaa-companion-agenda">
    <div className="aaa-companion-agenda-top">
      <div className="aaa-companion-date">
        <button ref={dateTrigger} type="button" className="aaa-companion-date-trigger"
          aria-haspopup="dialog" aria-expanded={pickerOpen}
          aria-label={"Choose date, currently "+dateLabel(p.date)} onClick={openPicker}>{dateLabel(p.date)}</button>
        <div className="aaa-companion-date-arrows">
          <button type="button" aria-label="Previous day" onClick={()=>choose(shiftDay(p.date,-1))}><ChevronLeft size={19}/></button>
          <button type="button" aria-label="Next day" onClick={()=>choose(shiftDay(p.date,1))}><ChevronRight size={19}/></button>
        </div>
      </div>
      <div className="aaa-companion-agenda-actions">
        <small>{occurrences.length} visible blocks</small>
        <button type="button" onClick={()=>p.onNew(p.date)}><Plus size={14}/> New event</button>
        <button type="button" onClick={goNow}><LocateFixed size={14}/> Now {p.format(clock)}</button>
      </div>
    </div>
    {occurrences.some(o=>o.event.allDay)&&<div className="aaa-companion-allday">
      <small>All day</small>
      {occurrences.filter(o=>o.event.allDay).map(o=><button key={occurrenceKey(o)}
        className={"event-chip event-"+p.colour(o.event)}
        onClick={()=>p.onSelected(occurrenceKey(o))}>{o.event.title}</button>)}
    </div>}
    <div ref={scroller} className="aaa-companion-timeline">
      <div className="aaa-companion-grid">
        {Array.from({length:24},(_,h)=><div className="aaa-companion-hour" style={{top:h*60}} key={h}>
          <span>{p.format(String(h).padStart(2,"0")+":00")}</span>
        </div>)}
        {blocks.map(({o,start,end,lane,lanes})=>{
          const duration=end-start;
          const compact=duration<54;
          const when=p.format(o.start||o.event.start)+" – "+p.format(o.end||o.event.end);
          return <button key={occurrenceKey(o)}
            className={"event-chip event-"+p.colour(o.event)+" aaa-companion-block"+(compact?" aaa-companion-block-compact":"")}
            title={o.event.title+" · "+when}
            aria-label={o.event.title+", "+when}
            style={{top:start,height:Math.max(24,duration),left:"calc(52px + (100% - 55px) * "+(lane/lanes)+")",width:"calc((100% - 55px) * "+(1/lanes)+")"}}
            onClick={()=>p.onSelected(occurrenceKey(o))}><strong>{o.event.title}</strong>
            {!compact&&<small>{when}</small>}
            {duration>=76&&!!o.event.tasks.length&&<small>{o.event.tasks.filter(t=>t.done).length}/{o.event.tasks.length} tasks</small>}
          </button>;
        })}
        {p.date===p.today&&<div className="aaa-companion-now" style={{top:nowMinute}}><i/></div>}
      </div>
    </div>
    {p.date!==p.today&&!occurrences.length&&<p className="aaa-companion-empty-day">No events or timed blocks this day.</p>}
    {selected&&<div className="aaa-companion-detail">
      <div className="aaa-companion-actions"><strong>{selected.event.title}</strong>
        <button onClick={()=>p.onSelected(null)} aria-label="Close block details"><X size={15}/></button></div>
      <small>{selected.event.allDay?"All day":p.format(selected.start||selected.event.start)+" – "+p.format(selected.end||selected.event.end)}</small>
      {selected.event.tasks.map(task=><label key={task.taskId||task.id} className="aaa-companion-task">
        <input type="checkbox" checked={task.done} disabled={busy} onChange={async()=>{
          setBusy(true);try{await p.onToggleTask(selected.event,task);setError("");}
          catch(e){setError(e instanceof Error?e.message:"Could not save task.");}
          finally{setBusy(false);}
        }}/>
        <span>{task.title}</span>
      </label>)}
      {selected.event.thoughtId&&p.onOpenThought&&<button onClick={()=>p.onOpenThought?.(selected.event.thoughtId!)}>Open linked working page ↗</button>}
      {error&&<small role="alert">{error}</small>}
    </div>}
    {pickerOpen&&typeof document!=="undefined"&&createPortal(<>
      <button type="button" className="aaa-companion-date-dismiss" tabIndex={-1}
        aria-label="Close date picker without selecting a date"
        onPointerDown={e=>{e.preventDefault();e.stopPropagation();}}
        onClick={e=>{e.preventDefault();e.stopPropagation();setPickerOpen(false);dateTrigger.current?.focus();}}/>
      <div className="aaa-companion-date-popover" role="dialog" aria-modal="true" aria-label="Choose Agenda date"
        style={{top:position.top,left:position.left}}
        onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
        <div className="aaa-companion-picker-head">
          <button type="button" aria-label="Previous month" onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()-1,1,12))}><ChevronLeft size={17}/></button>
          <strong>{month.toLocaleDateString("en-CA",{month:"long",year:"numeric"})}</strong>
          <button type="button" aria-label="Next month" onClick={()=>setMonth(d=>new Date(d.getFullYear(),d.getMonth()+1,1,12))}><ChevronRight size={17}/></button>
        </div>
        <div className="aaa-companion-picker-weekdays">{["M","T","W","T","F","S","S"].map((d,i)=><span key={i}>{d}</span>)}</div>
        <div className="aaa-companion-picker-days">
          {cells.map(cell=><button type="button" key={cell.iso}
            className={[cell.month!==month.getMonth()?"outside":"",cell.iso===p.date?"selected":"",cell.iso===p.today?"today":""].join(" ")}
            aria-pressed={cell.iso===p.date}
            aria-label={dateLabel(cell.iso)}
            onClick={()=>choose(cell.iso)}>{cell.day}</button>)}
        </div>
        <div className="aaa-companion-picker-footer">
          <button type="button" onClick={()=>choose(p.today)}>Today</button>
          <button type="button" onClick={()=>{setPickerOpen(false);dateTrigger.current?.focus();}}>Close</button>
        </div>
      </div>
    </>,document.body)}
  </div>;
}