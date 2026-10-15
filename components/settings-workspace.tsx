"use client";
import type { ComponentProps } from "react";
import { SlidersHorizontal, Palette, Clock3, Bell, UserRound, Shield, Code2, ChevronRight } from "lucide-react";
import AppearanceSettings from "./appearance-settings";
import type { AgendaPreference } from "@/lib/agenda-state";
export const settingsSections = [
  {name:"General",icon:SlidersHorizontal,description:"A quick overview of your workspace preferences."},
  {name:"Appearance",icon:Palette,description:"Themes, colours and how your workspace feels."},
  {name:"Calendar & Time",icon:Clock3,description:"Dates, times and The Agenda."},
  {name:"Notifications",icon:Bell,description:"Reminder and update preferences."},
  {name:"Account",icon:UserRound,description:"Your identity and account profile."},
  {name:"Privacy & Data",icon:Shield,description:"Account data and future export controls."},
  {name:"Developer Mode",icon:Code2,description:"Choose whether experimental features are visible."},
] as const;
export type SettingsSection = typeof settingsSections[number]["name"];
type Props = ComponentProps<typeof AppearanceSettings> & {
  section:SettingsSection; onSection:(s:SettingsSection)=>void;
  developer:boolean; onDeveloper:(v:boolean)=>void;
  agendaPreference:AgendaPreference; onAgendaPreference:(v:AgendaPreference)=>void;
  displayName:string; email:string; onProfile:()=>void;
};
export default function SettingsWorkspace(p:Props) {
  const info=settingsSections.find(s=>s.name===p.section)!;
  if(p.section==="Appearance")return <AppearanceSettings {...p}/>;
  return <section className="aaa-settings aaa-settings-page">
    <small className="aaa-eyebrow">SETTINGS / {p.section.toUpperCase()}</small>
    <h1>{p.section==="General"?"Your workspace, your way.":p.section}</h1>
    <p className="calendar-muted">{info.description}</p>
    {p.section==="General"&&<>
      <p className="aaa-preference-summary">{p.startDay} start · {p.clock} · Agenda: {p.agendaPreference} · Developer Mode {p.developer?"on":"off"}</p>
      <div className="aaa-settings-cards">{settingsSections.slice(1).map(({name,icon:Icon,description})=><button key={name} onClick={()=>p.onSection(name)}><span className="aaa-card-icon"><Icon size={22}/></span><span><strong>{name}</strong><small>{description}</small></span><ChevronRight size={17}/></button>)}</div>
    </>}
    {p.section==="Calendar & Time"&&<div className="aaa-settings-panel">
      <h2>Calendar preferences</h2>
      <p className="calendar-muted">Changes apply immediately and are saved for this account in this browser.</p>
      <label>Week starts on<select value={p.startDay} onChange={e=>p.onStartDay(e.target.value)}>{["Monday","Sunday","Saturday"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Time format<select value={p.clock} onChange={e=>p.onClock(e.target.value)}><option>12-hour</option><option>24-hour</option></select></label>
      <label>Agenda display mode<select value={p.agendaPreference} onChange={e=>p.onAgendaPreference(e.target.value as AgendaPreference)}><option value="column">Column</option><option value="pin">Pin</option><option value="toggle">Toggle</option></select></label>
      <p className="calendar-muted">{p.agendaPreference==="column"?"Always opens as a docked column.":p.agendaPreference==="pin"?"Opens as a pop-out; pin it temporarily for this opening.":"Remembers your last pinned or unpinned presentation."} Mobile always opens full-screen.</p>
      <h2>Ontario holidays</h2><p className="calendar-muted">Automatically shown in the Holiday calendar. Observances and common weekday observed dates are labelled separately. Workplace substitute dates may differ.</p>
    </div>}
    {p.section==="Developer Mode"&&<div className="aaa-settings-panel">
      <label className="aaa-check"><input type="checkbox" checked={p.developer} onChange={e=>p.onDeveloper(e.target.checked)}/>Enable Developer Mode</label>
      <p className="calendar-muted">Shows Fluid Calendar and Think About It in navigation. Experimental features may be unfinished. Turning this off preserves their saved data.</p>
      <div className="aaa-detail-row"><span>Fluid Calendar</span><small>BETA · experimental zoom</small></div>
      <div className="aaa-detail-row"><span>Think About It</span><small>BETA · thought editor</small></div>
    </div>}
    {p.section==="Account"&&<div className="aaa-settings-panel"><h2>Profile</h2><div className="aaa-detail-row"><span>Display name</span><strong>{p.displayName}</strong></div><div className="aaa-detail-row"><span>Email</span><strong>{p.email}</strong></div><button className="calendar-primary" onClick={p.onProfile}>Edit profile</button></div>}
    {p.section==="Notifications"&&<div className="aaa-settings-panel"><p className="calendar-muted">Notifications are planned. No notifications are sent yet.</p>{["Task reminders","Daily Agenda notifications","Progress notifications"].map(x=><div className="aaa-detail-row" key={x}><span>{x}</span><small>Planned</small></div>)}</div>}
    {p.section==="Privacy & Data"&&<div className="aaa-settings-panel"><p className="calendar-muted">Your existing data remains saved in your account.</p>{["Export account data","Manage account data","Delete account"].map(x=><div className="aaa-detail-row" key={x}><span>{x}</span><small>Planned</small></div>)}</div>}
  </section>;
}
