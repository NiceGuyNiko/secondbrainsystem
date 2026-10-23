"use client";
import type { ComponentProps } from "react";
import { SlidersHorizontal, Palette, Clock3, Bell, UserRound, Shield, Code2, ChevronRight, PanelRight, LayoutGrid } from "lucide-react";
import AppearanceSettings from "./appearance-settings";
import CompanionSettings from "./companion-settings";
import type {CompanionPreferences} from "@/lib/companion-config";
import type {CalendarDateFormat} from "@/lib/calendar-date-format";
import type { AgendaPreference } from "@/lib/agenda-state";
import Switch from "./switch";
import type { BetaFeatures, EffectiveFeatures, Settings } from "@/lib/settings/model";
import { activeProfile } from "@/lib/settings/model";
import { networkGuard } from "@/lib/demo/network-guard";
import {environment} from "@/lib/environment";
export const settingsSections = [
  {name:"General",icon:SlidersHorizontal,description:"A quick overview of your workspace preferences."},
  {name:"Appearance",icon:Palette,description:"Themes, colours and how your workspace feels."},
  {name:"Calendar & Time",icon:Clock3,description:"Dates and calendar time preferences."},
  {name:"The Companion",icon:PanelRight,description:"Play-test tool layouts, Context, Agenda and Thoughts."},
  {name:"Widgets",icon:LayoutGrid,description:"Choose how Library, Goals and reusable widgets look."},
  {name:"Notifications",icon:Bell,description:"Reminder and update preferences."},
  {name:"Account",icon:UserRound,description:"Your identity and account profile."},
  {name:"Privacy & Data",icon:Shield,description:"Account data and future export controls."},
  {name:"Developer Mode",icon:Code2,description:"Choose whether experimental features are visible."},
] as const;
export type SettingsSection = typeof settingsSections[number]["name"];
type Props = ComponentProps<typeof AppearanceSettings> & {
  section:SettingsSection; onSection:(s:SettingsSection)=>void;
  settings:Settings; effective:EffectiveFeatures;
  onDeveloperMode:(v:boolean)=>void; onTestProfiles:(v:boolean)=>void;
  onBetaFeature:(feature:keyof BetaFeatures,on:boolean)=>void;
  demoIsolation:boolean;
  agendaPreference:AgendaPreference; onAgendaPreference:(v:AgendaPreference)=>void;
  companion:CompanionPreferences; onCompanion:(p:Partial<CompanionPreferences>)=>void;
  widgetStyle:"classic"|"studio"; onWidgetStyle:(v:"classic"|"studio")=>void;
  dateFormat:CalendarDateFormat; onDateFormat:(format:CalendarDateFormat)=>void;
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
      <p className="aaa-preference-summary">{p.startDay} start · {p.clock} · Agenda: {p.agendaPreference} · Developer Mode {p.effective.developerMode?"on":"off"}</p>
      <div className="aaa-settings-cards">{settingsSections.slice(1).map(({name,icon:Icon,description})=><button key={name} onClick={()=>p.onSection(name)}><span className="aaa-card-icon"><Icon size={22}/></span><span><strong>{name}</strong><small>{description}</small></span><ChevronRight size={17}/></button>)}</div>
    </>}
    {p.section==="The Companion"&&<CompanionSettings options={p.companion} onChange={p.onCompanion} preference={p.agendaPreference} onPreference={p.onAgendaPreference}/>}
    {p.section==="Widgets"&&<section className="aaa-settings-card aaa-widget-style-settings" aria-labelledby="widget-style-heading">
      <header><h2 id="widget-style-heading">Widget design</h2><p>Change the presentation of widgets in Library, Goals and Developing IT. Your data, saved views, page layouts and theme stay the same.</p></header>
      <Switch label="Use Studio design" checked={p.widgetStyle==="studio"} onChange={on=>p.onWidgetStyle(on?"studio":"classic")} description="Inspired by the Templates Lab: richer surfaces, graphic accents, dashboard summaries and workshop-style cards."/>
      <div className="aaa-widget-style-options" role="group" aria-label="Widget design style">
        {(["classic","studio"] as const).map(style=><button key={style} type="button" aria-pressed={p.widgetStyle===style} className={p.widgetStyle===style?"active":""} onClick={()=>p.onWidgetStyle(style)}>
          <span className={"aaa-widget-style-thumbnail aaa-widget-style-thumbnail-"+style} aria-hidden="true"><i/><i/><i/></span>
          <strong>{style==="classic"?"Classic":"Studio"}</strong>
          <small>{style==="classic"?"The original clean, practical widget canvas.":"The Templates Lab-inspired layered dashboard."}</small>
        </button>)}
      </div>
      <p className="calendar-muted">Both styles inherit your selected Appearance theme. This choice is saved to your current test profile.</p>
    </section>}
    {p.section==="Calendar & Time"&&<div className="aaa-settings-panel">
      <h2>Calendar preferences</h2>
      <p className="calendar-muted">Changes apply immediately and are saved to your current profile.</p>
      <label>Week starts on<select value={p.startDay} onChange={e=>p.onStartDay(e.target.value)}>{["Monday","Sunday","Saturday"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Time format<select value={p.clock} onChange={e=>p.onClock(e.target.value)}><option>12-hour</option><option>24-hour</option></select></label>
      <label>Event date display<select value={p.dateFormat} onChange={e=>p.onDateFormat(e.target.value as CalendarDateFormat)}>
        <option value="long">Full — Wednesday, October 7, 2026</option>
        <option value="friendly">Month first — October 7, 2026</option>
        <option value="compact">ISO — 2026-10-07</option>
      </select></label>
      <p className="calendar-muted">Controls how dates appear when creating or editing calendar events. Agenda dates keep their familiar full-date style.</p>
      <label>Agenda display mode<select value={p.agendaPreference} onChange={e=>p.onAgendaPreference(e.target.value as AgendaPreference)}><option value="column">Column</option><option value="pin">Pin</option><option value="toggle">Toggle</option></select></label>
      <p className="calendar-muted">{p.agendaPreference==="column"?"Always opens as a docked column.":p.agendaPreference==="pin"?"Opens as a pop-out; pin it temporarily for this opening.":"Remembers your last pinned or unpinned presentation."} Mobile always opens full-screen.</p>
      <h2>Ontario holidays</h2><p className="calendar-muted">Automatically shown in the Holiday calendar. Observances and common weekday observed dates are labelled separately. Workplace substitute dates may differ.</p>
    </div>}
    {p.section==="Developer Mode"&&<DeveloperSettings {...p}/>}
    {p.section==="Account"&&<div className="aaa-settings-panel"><h2>Profile</h2><div className="aaa-detail-row"><span>Display name</span><strong>{p.displayName}</strong></div><div className="aaa-detail-row"><span>Email</span><strong>{p.email}</strong></div><button className="calendar-primary" onClick={p.onProfile}>Edit profile</button></div>}
    {p.section==="Notifications"&&<div className="aaa-settings-panel"><p className="calendar-muted">Notifications are planned. No notifications are sent yet.</p>{["Task reminders","Daily Agenda notifications","Progress notifications"].map(x=><div className="aaa-detail-row" key={x}><span>{x}</span><small>Planned</small></div>)}</div>}
    {p.section==="Privacy & Data"&&<div className="aaa-settings-panel"><p className="calendar-muted">Your existing data remains saved in your account.</p>{["Export account data","Manage account data","Delete account"].map(x=><div className="aaa-detail-row" key={x}><span>{x}</span><small>Planned</small></div>)}</div>}
  </section>;
}

const beta=<small className="aaa-badge aaa-badge-beta">BETA</small>;
function DeveloperSettings(p:Props){
  const dev=p.settings.account.developerMode, saved=activeProfile(p.settings).preferences.betaFeatures;
  const off=dev?undefined:"Turn on Developer Mode to use this.";
  return <>
    <section className="aaa-settings-card" aria-labelledby="developer-mode-heading">
      <header><h2 id="developer-mode-heading">Developer Mode</h2><p>Shows experimental features that are still being built. They may be unfinished or change. Turning this off hides them without deleting anything, and your beta choices below are kept.</p></header>
      <Switch label="Enable Developer Mode" checked={dev} onChange={p.onDeveloperMode} description="Applies to your whole account."/>
    </section>
    <section className="aaa-settings-card" aria-labelledby="beta-features-heading">
      <header><h2 id="beta-features-heading">Beta Features</h2><p>Choose each experimental feature separately. {dev?"Changes apply immediately.":"These are saved but unavailable while Developer Mode is off."}</p></header>
      <Switch label="Fluid Calendar" badge={beta} checked={saved.fluidCalendar} disabled={!dev} onChange={v=>p.onBetaFeature("fluidCalendar",v)} description={off??"Experimental zoomable calendar. Adds Fluid Calendar to the sidebar."}/>
      <Switch label="Think About It" badge={beta} checked={saved.thinkAboutIt} disabled={!dev} onChange={v=>p.onBetaFeature("thinkAboutIt",v)} description={off??"Thought editor. Adds Think About It to the sidebar."}/>
      <Switch label="Test Profiles" badge={beta} checked={p.settings.account.testProfilesEnabled} disabled={!dev} onChange={p.onTestProfiles} description={off??"Interface profiles for trying different settings. Applies to your whole account. Profile management arrives in the next preview."}/>
    </section>
    {environment.ok&&environment.data==="staging"&&
      <section className="aaa-settings-card">
       <h2>Your permanent Developer Preview</h2>
       <p>Use this same address for new builds. Supabase remembers the signed-in staging account on this address and refreshes its session without asking for your password on every deployment.</p>
       <a href="https://secondbrainsystem-git-feature-database-engin-824c27-niceguyniko.vercel.app/database-lab">
        Open the permanent Database Lab ↗
       </a>
       <p>Slate is your saved starting theme on this staging account. Signing out or clearing site data will still require signing in again.</p>
      </section>}
    {p.demoIsolation&&<p className="aaa-isolation" role="status">Demo Mode: this preview uses sample data stored only in this browser. No connection to your real account is made. Supabase requests blocked on this page: {networkGuard.blocked}.</p>}
  </>;
}
