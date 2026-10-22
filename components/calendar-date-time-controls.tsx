"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {CalendarDays,ChevronLeft,ChevronRight,ChevronUp,ChevronDown} from "lucide-react";
import {formatCalendarDate,type CalendarDateFormat} from "@/lib/calendar-date-format";
import {positionCalendarPicker,type CalendarPickerPosition} from "@/lib/calendar-picker-position";

const iso=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const parse=(date:string)=>new Date(date+"T12:00:00");
const add=(date:string,days:number)=>{const next=parse(date);next.setDate(next.getDate()+days);return iso(next)};
const weekdays=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

type PickerPosition = CalendarPickerPosition;
function positionPicker(element:HTMLElement,estimatedHeight:number):PickerPosition {
  return positionCalendarPicker(element.getBoundingClientRect(),
    {width:window.innerWidth,height:window.innerHeight},estimatedHeight);
}
function PickerBackdrop({onClose}:{onClose:()=>void}){
  return <button type="button" className="aaa-event-picker-backdrop" tabIndex={-1}
    aria-label="Close calendar picker"
    onPointerDown={e=>{e.preventDefault();e.stopPropagation()}}
    onClick={e=>{e.preventDefault();e.stopPropagation();onClose()}}/>;
}
function usePickerDismiss(open:boolean,close:()=>void){
  // Capture Escape so the event editor behind the picker does not close as well.
  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{
      if(e.key!=="Escape")return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();close();
    };
    const onResize=()=>close();
    window.addEventListener("keydown",onKey,true);
    window.addEventListener("resize",onResize);
    return()=>{
      window.removeEventListener("keydown",onKey,true);
      window.removeEventListener("resize",onResize);
    };
  },[open,close]);
}
export function DateChoice({value,onChange,label,min,startDay,dateFormat="long"}:{
  value:string;
  onChange:(date:string)=>void;
  label:string;
  min?:string;
  startDay:string;
  dateFormat?:CalendarDateFormat;
}){
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const popup=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<PickerPosition>({left:0,top:0,width:240,maxHeight:280});
  const [month,setMonth]=useState(value||iso(new Date()));
  const close=()=>{setOpen(false);trigger.current?.focus()};
  usePickerDismiss(open,close);
  useLayoutEffect(()=>{
    if(!open||!trigger.current||!popup.current)return;
    const next=positionPicker(trigger.current,popup.current.scrollHeight+2);
    setPosition(prev=>prev.left===next.left&&prev.top===next.top&&prev.width===next.width&&prev.maxHeight===next.maxHeight?prev:next);
  },[open,month]);
  useEffect(()=>{
    const onOther=()=>setOpen(false);
    const onBatch=()=>{if(label==="Choose dates"||label==="Change selected date"){
      setMonth(value||iso(new Date()));
      if(trigger.current)setPosition(positionPicker(trigger.current,280));
      setOpen(true);
    }};
    window.addEventListener("calendar-date-open",onOther);
    window.addEventListener("calendar-time-open",onOther);
    window.addEventListener("calendar-batch-edit",onBatch);
    return()=>{
      window.removeEventListener("calendar-date-open",onOther);
      window.removeEventListener("calendar-time-open",onOther);
      window.removeEventListener("calendar-batch-edit",onBatch);
    };
  },[label,value]);
  const first=iso(new Date(parse(month).getFullYear(),parse(month).getMonth(),1));
  const start=Math.max(0,weekdays.indexOf(startDay));
  const offset=(parse(first).getDay()-start+7)%7;
  const dates=Array.from({length:42},(_,i)=>add(first,i-offset));
  const shift=(delta:number)=>{const d=parse(first);d.setMonth(d.getMonth()+delta);setMonth(iso(d))};
  const toggle=()=>{
    if(open){setOpen(false);return}
    window.dispatchEvent(new Event("calendar-date-open"));
    window.dispatchEvent(new Event("calendar-time-open"));
    setMonth(value||iso(new Date()));
    if(trigger.current)setPosition(positionPicker(trigger.current,280));
    setOpen(true);
  };
  return <>
    <div className="aaa-event-date-field min-w-0">
      <button type="button" ref={trigger} className="calendar-input aaa-event-date-trigger"
        aria-label={label+": "+formatCalendarDate(value,dateFormat)}
        aria-haspopup="dialog" aria-expanded={open} title={formatCalendarDate(value,dateFormat)}
        onClick={toggle}>
        <span>{formatCalendarDate(value,dateFormat)}</span><CalendarDays size={17} aria-hidden="true"/>
      </button>
    </div>
    {open&&typeof document!=="undefined"&&createPortal(<>
      <PickerBackdrop onClose={close}/>
      <div ref={popup} role="dialog" aria-modal="true" aria-label={label+" date picker"}
        className="aaa-event-calendar-popover"
        style={{left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight}}
        onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
        <div className="aaa-event-calendar-head">
          <button type="button" aria-label="Previous month" onClick={()=>shift(-1)}><ChevronLeft size={18}/></button>
          <strong>{parse(first).toLocaleDateString("en-CA",{month:"long",year:"numeric"})}</strong>
          <button type="button" aria-label="Next month" onClick={()=>shift(1)}><ChevronRight size={18}/></button>
        </div>
        <div className="aaa-event-calendar-grid">
          {Array.from({length:7},(_,i)=><span key={i} className="aaa-event-weekday">{weekdays[(start+i)%7].slice(0,2)}</span>)}
          {dates.map(d=><button type="button" key={d} disabled={!!min&&d<min}
            className={(d===value?"is-selected ":"")+(d.slice(0,7)!==first.slice(0,7)?"is-outside":"")}
            aria-label={formatCalendarDate(d,"long")}
            aria-pressed={d===value}
            onClick={()=>{onChange(d);close()}}>{parse(d).getDate()}</button>)}
        </div>
      </div>
    </>,document.body)}
  </>;
}

export function TimeChoice({value,onChange,label,clock="12-hour"}:{
  value:string;
  onChange:(time:string)=>void;
  label:string;
  clock?:string;
}){
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const popup=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState<PickerPosition>({left:0,top:0,width:176,maxHeight:130});
  const close=()=>{setOpen(false);trigger.current?.focus()};
  usePickerDismiss(open,close);
  useLayoutEffect(()=>{
    if(!open||!trigger.current||!popup.current)return;
    const next=positionPicker(trigger.current,popup.current.scrollHeight+2);
    setPosition(prev=>prev.left===next.left&&prev.top===next.top&&prev.width===next.width&&prev.maxHeight===next.maxHeight?prev:next);
  },[open,clock]);
  useEffect(()=>{
    const onOther=()=>setOpen(false);
    window.addEventListener("calendar-date-open",onOther);
    window.addEventListener("calendar-time-open",onOther);
    return()=>{
      window.removeEventListener("calendar-date-open",onOther);
      window.removeEventListener("calendar-time-open",onOther);
    };
  },[]);
  const [hour,minute]=value.split(":").map(Number);
  const change=(h:number,m:number)=>{
    const total=((h*60+m)%(24*60)+24*60)%(24*60);
    onChange(String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0"));
  };
  const toggle=()=>{
    if(open){setOpen(false);return}
    window.dispatchEvent(new Event("calendar-date-open"));
    window.dispatchEvent(new Event("calendar-time-open"));
    if(trigger.current)setPosition(positionPicker(trigger.current,130));
    setOpen(true);
  };
  const fields=[
    {name:"Hour",value:clock==="24-hour"?hour:hour%12||12,
     up:()=>change(hour+1,minute),down:()=>change(hour-1,minute),
     set:(n:number)=>change(clock==="24-hour"?n:(hour>=12?12:0)+(n%12),minute)},
    {name:"Minute",value:minute,
     up:()=>change(hour,minute+1),down:()=>change(hour,minute-1),
     set:(n:number)=>change(hour,n)}
  ];
  const valueLabel=String(clock==="24-hour"?hour:hour%12||12).padStart(2,"0")
    +":"+String(minute).padStart(2,"0")+(clock==="24-hour"?"":hour>=12?" PM":" AM");
  return <>
    <div className="aaa-event-time-field min-w-0">
      <button ref={trigger} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open}
        className="calendar-input aaa-event-time-trigger" onClick={toggle}>{valueLabel}</button>
    </div>
    {open&&typeof document!=="undefined"&&createPortal(<>
      <PickerBackdrop onClose={close}/>
      <div ref={popup} className="aaa-event-time-popover" role="dialog" aria-label={label+" time picker"} aria-modal="true"
        style={{left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight}}
        onClick={e=>e.stopPropagation()} onPointerDown={e=>e.stopPropagation()}>
        {fields.map(field=><div key={field.name} className="aaa-event-time-spinner">
          <button type="button" aria-label={"Increase "+field.name} onClick={field.up}><ChevronUp size={17}/></button>
          <input aria-label={field.name} type="number"
            min="0" max={field.name==="Hour"?(clock==="24-hour"?23:12):59}
            value={String(field.value).padStart(2,"0")}
            onChange={e=>{if(e.target.value)field.set(Number(e.target.value))}}/>
          <button type="button" aria-label={"Decrease "+field.name} onClick={field.down}><ChevronDown size={17}/></button>
        </div>)}
        {clock!=="24-hour"&&<div className="aaa-event-time-spinner">
          <button type="button" aria-label="Toggle AM PM" onClick={()=>change(hour+12,minute)}><ChevronUp size={17}/></button>
          <button type="button" className="aaa-event-ampm" aria-label="Toggle AM PM" onClick={()=>change(hour+12,minute)}>{hour>=12?"PM":"AM"}</button>
          <button type="button" aria-label="Toggle AM PM" onClick={()=>change(hour+12,minute)}><ChevronDown size={17}/></button>
        </div>}
      </div>
    </>,document.body)}
  </>;
}
