"use client";
import type { ComponentProps } from "react";
import { SlidersHorizontal, Palette, Clock3, Bell, UserRound, Shield, Code2, ChevronRight, PanelRight, LayoutGrid } from "lucide-react";
import AppearanceSettings from "./appearance-settings";
import CompanionSettings from "./companion-settings";
import type {CompanionPreferences} from "@/lib/companion-config";
import type {CalendarDateFormat} from "@/lib/calendar-date-format";
import type { AgendaPreference } from "@/lib/agenda-state";
import Switch from "./switch";
import {useWidgetFormationPreferences} from "@/lib/widget-layout-preferences";
import type {MobileTooltipMode} from "@/lib/mobile-tooltip-settings";
import type {WidgetDoubleClickAction} from "@/lib/widget-layout";
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
  widgetStyle:"classic"|"studio"|"blend"; onWidgetStyle:(v:"classic"|"studio"|"blend")=>void;
  widgetHeaderPosition:"top"|"bottom"; onWidgetHeaderPosition:(v:"top"|"bottom")=>void;
  widgetCornerDoubleClick:WidgetDoubleClickAction; onWidgetCornerDoubleClick:(v:WidgetDoubleClickAction)=>void;
  widgetBottomDoubleClick:WidgetDoubleClickAction; onWidgetBottomDoubleClick:(v:WidgetDoubleClickAction)=>void;
  mobileTooltipMode:MobileTooltipMode; onMobileTooltipMode:(v:MobileTooltipMode)=>void;
  dateFormat:CalendarDateFormat; onDateFormat:(format:CalendarDateFormat)=>void;
  displayName:string; email:string; onProfile:()=>void;
};
export default function SettingsWorkspace(p:Props) {
  const [formation,setFormation]=useWidgetFormationPreferences();
  const info=settingsSections.find(s=>s.name===p.section)!;
  if(p.section==="Appearance")return <AppearanceSettings {...p}/>;
  return <section className="aaa-settings aaa-settings-page">
    <small className="aaa-eyebrow">SETTINGS / {p.section.toUpperCase()}</small>
    <h1>{p.section==="General"?"Your workspace, your way.":p.section}</h1>
    <p className="calendar-muted">{info.description}</p>
    {p.section==="General"&&<>
      <p className="aaa-preference-summary">{p.startDay} start · {p.clock} · Agenda: {p.agendaPreference} · Developer Mode {p.effective.developerMode?"on":"off"}</p>
      <section className="aaa-settings-panel aaa-mobile-tooltip-settings" aria-labelledby="mobile-tooltip-heading">
        <h2 id="mobile-tooltip-heading">Tooltips & help</h2>
        <p className="calendar-muted">Choose how help labels appear on eligible icon-only controls when using a phone. Ordinary taps and page navigation continue to work normally.</p>
        <label htmlFor="aaa-mobile-tooltip-mode">Mobile tooltips
          <select id="aaa-mobile-tooltip-mode" value={p.mobileTooltipMode}
            onChange={e=>p.onMobileTooltipMode(e.target.value as MobileTooltipMode)}>
            <option value="hold">Press and hold (default)</option>
            <option value="tap">Single tap</option>
            <option value="off">Off</option>
          </select>
        </label>
        <p className="calendar-muted">{p.mobileTooltipMode==="hold"
          ?"Hold an eligible icon briefly for its tooltip. A normal tap performs the button's usual action without showing help."
          :p.mobileTooltipMode==="tap"
          ?"Tapping an eligible icon can show its tooltip while the button still works. Tap anywhere else to dismiss it and perform that action."
          :"Mobile help tooltips are hidden; accessible labels remain available to screen readers."}</p>
        <p className="calendar-muted">A tooltip closes on the next tap elsewhere without blocking that tap. On a PC, tooltips always appear on hover, regardless of this preference. Your choice is saved to your current profile.</p>
      </section>
      <div className="aaa-settings-cards">{settingsSections.slice(1).map(({name,icon:Icon,description})=><button key={name} onClick={()=>p.onSection(name)}><span className="aaa-card-icon"><Icon size={22}/></span><span><strong>{name}</strong><small>{description}</small></span><ChevronRight size={17}/></button>)}</div>
    </>}
    {p.section==="The Companion"&&<CompanionSettings options={p.companion} onChange={p.onCompanion} preference={p.agendaPreference} onPreference={p.onAgendaPreference}/>}
    {p.section==="Widgets"&&<section className="aaa-settings-card aaa-widget-style-settings" aria-labelledby="widget-style-heading">
      <header><h2 id="widget-style-heading">Widget design</h2><p>Change the presentation of widgets in Library, Goals and Developing IT. Your data, saved views, page layouts and theme stay the same.</p></header>
      <div className="aaa-widget-style-options" role="group" aria-label="Widget design style">
        {(["classic","studio","blend"] as const).map(style=><button key={style} type="button" aria-pressed={p.widgetStyle===style} className={p.widgetStyle===style?"active":""} onClick={()=>p.onWidgetStyle(style)}>
          <span className={"aaa-widget-style-thumbnail aaa-widget-style-thumbnail-"+style} aria-hidden="true"><i/><i/><i/></span>
          <strong>{style==="classic"?"Classic":style==="studio"?"Studio":"Blend"}</strong>
          <small>{style==="classic"?"Clean, practical cards with distinct surfaces.":style==="studio"?"Layered dashboards with richer accent treatments.":"Widget content stays visible, while its background and border blend into your page."}</small>
        </button>)}
      </div>
      <p className="calendar-muted">Both styles inherit your selected Appearance theme. This choice is saved to your current test profile.</p>
      <div className="aaa-widget-gap-setting">
        <h3>Widget control placement</h3>
        <Switch label="Put widget title and controls at the bottom" checked={p.widgetHeaderPosition==="bottom"}
          onChange={value=>p.onWidgetHeaderPosition(value?"bottom":"top")}
          description="Move the title, Configure, duplicate and other widget controls below the widget contents. Individual widget lock buttons can hide the control strip in Use Mode while keeping whichever title and labels you enabled."/>
        <h3>Double-click actions</h3>
        <p className="calendar-muted">Choose what a double-click does in Arrange Mode. These choices apply to widgets in Library and Goals and are saved to your current profile. Dragging still resizes normally.</p>
        <div className="aaa-widget-double-click-grid">
          <label htmlFor="aaa-widget-corner-double-click">Corner triangle
            <select id="aaa-widget-corner-double-click" value={p.widgetCornerDoubleClick}
              onChange={e=>p.onWidgetCornerDoubleClick(e.target.value as WidgetDoubleClickAction)}>
              <option value="fit-content">Fit content height (default)</option>
              <option value="match-height">Match neighboring height</option>
              <option value="full-width">Move to full-width row</option>
              <option value="none">Do nothing</option>
            </select>
          </label>
          <label htmlFor="aaa-widget-bottom-double-click">Bottom height divider
            <select id="aaa-widget-bottom-double-click" value={p.widgetBottomDoubleClick}
              onChange={e=>p.onWidgetBottomDoubleClick(e.target.value as WidgetDoubleClickAction)}>
              <option value="match-height">Match neighboring height (default)</option>
              <option value="fit-content">Fit content height</option>
              <option value="full-width">Move to full-width row</option>
              <option value="none">Do nothing</option>
            </select>
          </label>
        </div>
        <p className="calendar-muted">Fit content height reveals the whole record view without changing its width. Match neighboring height adjusts the clicked widget. Full-width row changes its placement. You can always use the separate full-width button.</p>
        <h3>Widget sizing &amp; placement</h3>
        <Switch label="Preset widget widths" checked={formation.presetWidths}
          onChange={value=>setFormation({presetWidths:value})}
          description="Use the 20–100% preset widths in Library and Goals. Enabled by default. Turn off to return to the existing freeform widget resizing without changing saved layouts."/>
        <Switch label="Intelligent shrinking" checked={formation.intelligentShrinking}
          onChange={value=>setFormation({intelligentShrinking:value})}
          description="When placing a widget alongside another, shrink the hovered widget first if it can accommodate the insertion. If it is constrained, other unlocked widgets may share the adjustment; locked sizes never change."/>
        <p className="calendar-muted">Individual widget width limits and locks are configured in that widget&apos;s Configure panel. These defaults apply across widget pages; they do not alter source records.</p>
        <h3>Fluid layout</h3>
        <Switch label="Fill Freed Space" checked={formation.fillFreedSpace!=="off"}
          onChange={value=>setFormation({fillFreedSpace:value?"column-rise":"off"})}
          description="Enable automatic filling after a widget shrinks or a column becomes free. Row and widget locks take priority."/>
        <label className="aaa-widget-field">Filling method
          <select value={formation.fillFreedSpace} onChange={e=>setFormation({fillFreedSpace:e.target.value as typeof formation.fillFreedSpace})}>
            <option value="off">Off · preserve empty space</option>
            <option value="column-rise">Column Rise</option>
            <option value="left-to-right">Left-to-Right Reflow</option>
          </select>
        </label>
        <p className="calendar-muted">Individual widget heights remain independent. You can also change snapping and replacement behavior in Developing IT → Widgets.</p>
      </div>
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
