"use client";
import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import BrandMark from "@/components/brand-mark";
import { updateFavicon } from "@/lib/favicon";
import AuthGate from "@/components/auth-gate";
import ThoughtWorkspace from "@/components/thought-workspace";
import PlanningWorkspace from "@/components/planning-workspace";
import WritingWorkspaceDemo from "@/components/writing-workspace-demo";
import DatabasesWorkspace from "@/components/databases-workspace";
import StagingDatabaseLab from "@/components/database-staging-lab";
import DatabaseLabErrorBoundary from "@/components/database-lab-error-boundary";
import { supabase } from "@/lib/supabase";
import { classifyDatabaseEngineProbe,type DatabaseEngineState } from "@/lib/db-engine/production-readiness";
import {setupWorldbuildingDatabases} from "@/lib/db-engine/worldbuilding-templates";
import { DATABASE_CATEGORIES, type DatabaseCategory } from "@/lib/database-categories";
import { resetDatabaseDemo } from "@/lib/database-property-store";
import CalendarWorkspace from "@/components/calendar-workspace";
import SettingsWorkspace, {settingsSections, type SettingsSection} from "@/components/settings-workspace";
import {openAgenda, type AgendaPreference} from "@/lib/agenda-state";
import { type AgendaMode } from "@/components/agenda";
import type {CompanionTarget,CompanionPreferences} from "@/lib/companion-config";
import { useProfile } from "@/components/profile-context";
import ProfileMenu from "@/components/profile-menu";
import { useSettings } from "@/lib/settings/use-settings";
import { updateAccount, updateActivePreferences, type ProfilePreferences } from "@/lib/settings/model";
import { ConfigurationError, isDemo } from "@/components/environment";
import { demoDatabase } from "@/lib/supabase";
import { environment } from "@/lib/environment";
import { thoughtStore } from "@/lib/thoughts";
import {
  appearanceKey,
  appearanceDefaults,
  applyAppearance,
  ownedPageTitle,
  type Appearance,
} from "@/lib/appearance";
import { categoryColours } from "@/lib/calendar-layout";
import {
  CalendarDays,
  Target,
  LibraryBig,
  Database,
  Plus,
  Settings2,
  Check,
  Menu,
  X,
  BookOpen,
  Layers3,
  Zap,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  PenLine,
  PanelRightOpen,
} from "lucide-react";
type Section =
  | "Calendar"
  | "Goals"
  | "Workspaces"
  | "Databases"
  | "Resources"
  | "Fluid Calendar"
  | "Think About It"
  | "Settings";
type ContextItem = { id: string; title: string };
export default function Home() {
  if (!environment.ok) return <ConfigurationError reason={environment.reason} />;
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  );
}
function Workspace() {
  const { displayName, email, userId, openProfile, signOut } = useProfile();
  const { settings, preferences, effective, update, error: settingsError, dismissError } = useSettings(email, userId);
  const [section, setSection] = useState<Section>("Calendar"),
    [mobileOpen, setMobileOpen] = useState(false),
    [profileMenu, setProfileMenu] = useState(false),
    [mobileCalendars, setMobileCalendars] = useState(false),
    [activeThought, setActiveThought] = useState<string | undefined>(),
    [contextId, setContextId] = useState<string | undefined>(),
    [returnSection, setReturnSection] = useState<Section>("Calendar"),
    [notice, setNotice] = useState("");
  const [settingsSection,setSettingsSection]=useState<SettingsSection>("General");
  const [companionRecord,setCompanionRecord]=useState<CompanionTarget|null>(null);
  const onCompanionRecord=useCallback((value:CompanionTarget|null)=>setCompanionRecord(previous=>JSON.stringify(previous)===JSON.stringify(value)?previous:value),[]);
  const [databaseCategory, setDatabaseCategory] = useState<DatabaseCategory>("Characters");
  const [databaseRecordId, setDatabaseRecordId] = useState<string | null>(null);
  const [stagingDatabases,setStagingDatabases]=useState<{id:string;name:string}[]>([]);
  const [stagingDatabaseId,setStagingDatabaseId]=useState("");
  const [writingExpanded,setWritingExpanded]=useState(true);
  const [newDatabaseOpen,setNewDatabaseOpen]=useState(false);
  const [newDatabaseName,setNewDatabaseName]=useState("");
  const [creatingDatabase,setCreatingDatabase]=useState(false);
  const staging=environment.ok&&environment.data==="staging";
  const production=environment.ok&&environment.data==="production";
  const [productionEngineState,setProductionEngineState]=useState<DatabaseEngineState>("checking");
  const [engineProbeError,setEngineProbeError]=useState("");
  const [settingUpDatabases,setSettingUpDatabases]=useState(false);
  useEffect(()=>{
    if(!production)return;
    let live=true;
    void Promise.resolve(supabase.rpc("db_engine_ready")).then(({data,error})=>{
      if(!live)return;
      const status=classifyDatabaseEngineProbe(data,error);
      setProductionEngineState(status);
      if(status==="error")setEngineProbeError(error?.message||"Unable to check the database backend.");
    }).catch(err=>{
      if(live){setProductionEngineState("error");setEngineProbeError(err instanceof Error?err.message:String(err))}
    });
    return()=>{live=false};
  },[production]);
  const engineEnabled=staging||(production&&productionEngineState==="ready");
  const stagingDatabaseName=stagingDatabases.find(d=>d.id===stagingDatabaseId)?.name||"Characters";
  const refreshStagingDatabases=useCallback(async()=>{
    const {data,error}=await supabase.from("db_databases").select("id,name")
      .is("archived_at",null).order("name").limit(150);
    if(error)throw new Error(error.message);
    const rows=(data??[]).filter(d=>d.name.toLowerCase()!=="perspectives");
    setStagingDatabases(rows);
    setStagingDatabaseId(id=>rows.some(x=>x.id===id)?id:(rows.find(x=>x.name.toLowerCase()==="characters")??rows[0])?.id??"");
  },[]);
  const createStagingDatabase=async()=>{
    const name=newDatabaseName.trim();
    if(creatingDatabase||!name)return;
    if(stagingDatabases.some(d=>d.name.toLowerCase()===name.toLowerCase())){
      setNotice("A database with that name already exists.");return;
    }
    setCreatingDatabase(true);
    try{
      const id=crypto.randomUUID();
      const {error}=await supabase.rpc("db_create_database",{p_id:id,p_name:name,p_dataset:production?"primary":"acceptance"});
      if(error)throw error;
      await refreshStagingDatabases();
      setStagingDatabaseId(id);
      setNewDatabaseName("");
      setNewDatabaseOpen(false);
      setNotice(name+" database created.");
    }catch(e){setNotice(e instanceof Error?e.message:"Could not create database.");}
    finally{setCreatingDatabase(false)}
  };
  const setupMissingWorldbuilding=async()=>{
    if(!engineEnabled||settingUpDatabases)return;
    if(!window.confirm("Create the worldbuilding database templates and their linked properties? Existing data will remain untouched. No sample records will be imported."))return;
    setSettingUpDatabases(true);
    try{
      const result=await setupWorldbuildingDatabases(supabase,()=>{},production?"primary":"acceptance");
      await refreshStagingDatabases();
      setNotice(result.databasesCreated+" databases and "+result.propertiesCreated+" properties created. Existing records preserved.");
    }catch(err){setNotice(err instanceof Error?err.message:String(err))}
    finally{setSettingUpDatabases(false)}
  };
  useEffect(()=>{
    if(!engineEnabled||section!=="Databases")return;
    void refreshStagingDatabases().catch(e=>setNotice(e instanceof Error?e.message:"Could not load database navigation."));
  },[engineEnabled,section,refreshStagingDatabases]);
  const { agendaPreference, lastPinned, startDay, clock, eventDateFormat, hiddenCalendars: hidden, appearance, sidebarCollapsed: collapsed } = preferences;
  const setPreferences = useCallback((patch: (p: ProfilePreferences) => Partial<ProfilePreferences>) => update((s) => updateActivePreferences(s, patch)), [update]);
  const setAgendaPreference = (agendaPreference: AgendaPreference) => setPreferences(() => ({ agendaPreference }));
  const setCompanion = (patch:Partial<CompanionPreferences>)=>setPreferences(p=>({companion:{...p.companion,...patch}}));
  const setLastPinned = useCallback((lastPinned: boolean) => setPreferences(() => ({ lastPinned })), [setPreferences]);
  const setStartDay = (startDay: string) => setPreferences(() => ({ startDay: startDay as ProfilePreferences["startDay"] }));
  const setClock = (clock: string) => setPreferences(() => ({ clock: clock as ProfilePreferences["clock"] }));
  const setEventDateFormat = (eventDateFormat: ProfilePreferences["eventDateFormat"]) => setPreferences(() => ({ eventDateFormat }));
  const setHidden = (change: (old: string[]) => string[]) => setPreferences((p) => ({ hiddenCalendars: change(p.hiddenCalendars) }));
  const setAppearance = (appearance: Appearance) => setPreferences(() => ({ appearance }));
  useEffect(() => { if (!isDemo) return; try { if (localStorage.getItem("aaa-demo-slate-initialized")) return; localStorage.setItem("aaa-demo-slate-initialized","1"); setPreferences(() => ({ appearance: {...appearanceDefaults, preset:"slate"} })); } catch {} }, [setPreferences]);
  const [agendaMode, setAgendaMode] = useState<AgendaMode>("closed"),
    [categories, setCategories] = useState<{ name: string; color: string }[]>(
      [],
    ),
    [context, setContext] = useState<ContextItem[]>([]),
    [resources, setResources] = useState<ContextItem[]>([]);
  const [command, setCommand] = useState<{
    id: number;
    type: "new" | "calendars";
    task?: { id: string; title: string; workingId?: string };
  }>();
  const changeAgenda=useCallback((next:AgendaMode)=>{
    setAgendaMode(next=== "closed"?"closed":agendaPreference==="column"?"pinned":next);
    if(next!=="closed"&&agendaPreference==="toggle")setLastPinned(next==="pinned");
  },[agendaPreference,setLastPinned]);
  const toggleAgenda=()=>changeAgenda(agendaMode==="closed"?openAgenda(agendaPreference,lastPinned):"closed");
  useEffect(()=>{setAgendaMode(m=>m==="closed"?m:openAgenda(agendaPreference,lastPinned));},[agendaPreference,lastPinned]);
  // Leaving a beta destination when its switch (or Developer Mode) is turned off. Nothing is deleted.
  useEffect(()=>{
    if((section==="Fluid Calendar"&&!effective.fluidCalendar)||(section==="Think About It"&&!effective.thinkAboutIt)){
      setNotice(`${section} is turned off, so you're back on the Calendar. Its data is kept.`);
      setSection("Calendar");
    }
  },[section,effective.fluidCalendar,effective.thinkAboutIt]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(""),6000);return()=>clearTimeout(t);},[notice]);
  // Applies the active profile's theme before paint, so switching profiles never shows the old theme.
  // Themes are manual: the device's light/dark setting is never consulted. The values written here
  // are a start-up cache for the next page load (see app/layout.tsx).
  useLayoutEffect(() => {
    if (!settings) return;
    const tokens = applyAppearance(appearance);
    void updateFavicon(tokens);
    try {
      localStorage.setItem(appearanceKey, JSON.stringify(appearance));
    } catch {}
  }, [settings, appearance]);
  useEffect(() => {
    if (!mobileOpen && !mobileCalendars) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setMobileCalendars(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [mobileOpen, mobileCalendars]);
  useEffect(() => {
    if (section !== "Resources" && section !== "Think About It") return;
    let live = true;
    void thoughtStore
      .load()
      .then((d) => {
        if (live)
          setResources(
            d.thoughts
              .filter((t) => t.details.collection && !t.details.archived_at)
              .map((t) => ({ id: t.id, title: t.title || "Untitled" })),
          );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [section]);
  useEffect(()=>{if(!mobileOpen)return;const previous=document.activeElement as HTMLElement;const panel=document.querySelector<HTMLElement>('[aria-label="Workspace navigation"]');panel?.querySelector('button')?.focus();const trap=(e:KeyboardEvent)=>{if(e.key!=='Tab')return;const controls=panel?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled])');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}};window.addEventListener('keydown',trap);return()=>{window.removeEventListener('keydown',trap);previous?.focus()}},[mobileOpen]);
  const setPlanningContext = useCallback(
    (rows: ContextItem[]) => setContext(rows),
    [],
  );
  const nav = (s: Section) => {
    if((s==="Fluid Calendar"&&!effective.fluidCalendar)||(s==="Think About It"&&!effective.thinkAboutIt))return;
    setSection(s);
    setContextId(s==="Workspaces"&&engineEnabled?"writing":undefined);
    if(s==="Workspaces"&&engineEnabled)setWritingExpanded(true);
    setContext([]);
    setDatabaseRecordId(null);
    setCompanionRecord(null);
    setMobileOpen(false);
    setMobileCalendars(false);
    setProfileMenu(false);
  };
  const toggleSidebar = () => setPreferences((p) => ({ sidebarCollapsed: !p.sidebarCollapsed }));
  const openThought = (id: string) => {
    setReturnSection(section);
    setActiveThought(id);
    setSection(effective.thinkAboutIt?"Think About It":"Resources");
  };
  const calendarSection =
    section === "Calendar" || section === "Fluid Calendar";
  const contextual = calendarSection
    ? categories.map((c) => ({ id: c.name, title: c.name }))
    : section === "Databases"
      ? engineEnabled?stagingDatabases.map(d=>({id:d.id,title:d.name})):DATABASE_CATEGORIES.map((c) => ({ id: c.id, title: c.label }))
    : section==="Workspaces"&&engineEnabled
      ? [{id:"writing",title:"Writing"},...(writingExpanded?[{id:"writing-events",title:"Events"}]:[]),...context.filter(c=>c.id!=="writing"&&c.id!=="writing-events")]
    : section === "Resources" || section === "Think About It"
      ? resources
      : context;
  const contextualTitle = calendarSection
    ? "Calendars"
    : section === "Databases"
      ? "Databases"
    : section === "Resources" || section === "Think About It"
      ? "Collections"
      : section === "Settings"
        ? "Settings"
        : section;
  const contextClick = (id: string) => {
    if (calendarSection)
      setHidden((old) =>
        old.includes(id) ? old.filter((c) => c !== id) : [...old, id],
      );
    else if (section === "Databases") {
      if(engineEnabled)setStagingDatabaseId(id);
      else setDatabaseCategory(id as DatabaseCategory);
      setDatabaseRecordId(null);
    } else if (section === "Resources" || section === "Think About It")
      setActiveThought(id);
    else if(section==="Workspaces"&&engineEnabled&&id==="writing"){
      setWritingExpanded(open=>!open);setContextId("writing");
    } else setContextId(id);
  };
  const manage = () => {
    setCommand({ id: Date.now(), type: "calendars" });
    setMobileOpen(false);
    setMobileCalendars(false);
  };
  const calendarControls = (
    <>
      {categories.map((c) => (
        <button
          className="aaa-context-row"
          type="button"
          key={c.name}
          title={c.name}
          aria-label={`Toggle ${c.name} calendar`}
          aria-pressed={!hidden.includes(c.name)}
          onClick={() => contextClick(c.name)}
        >
          <span className="aaa-icon-slot">
            <span
              className="aaa-calendar-key"
              style={{
                borderColor: categoryColours[c.color] || c.color,
                background: hidden.includes(c.name)
                  ? "transparent"
                  : categoryColours[c.color] || c.color,
              }}
            >
              {!hidden.includes(c.name) && <Check size={13} />}
            </span>
          </span>
          <span className="aaa-sidebar-label">{c.name}</span>
        </button>
      ))}
    </>
  );
  const companionTarget: CompanionTarget = companionRecord && ((section==="Databases"&&engineEnabled)||(section==="Workspaces"&&contextId==="writing-events")) ? companionRecord : {
    id: section==="Databases"?(engineEnabled?stagingDatabaseId:databaseCategory):(contextId||section),
    title: section==="Databases"?(engineEnabled?stagingDatabaseName:databaseCategory):section==="Workspaces"&&contextId==="writing-events"?"Events":section==="Workspaces"&&contextId==="writing"?"Writing":section==="Settings"?settingsSection:section,
    databaseId: section==="Databases"?(engineEnabled?stagingDatabaseId:databaseCategory):section,
    databaseName: section==="Databases"?(engineEnabled?stagingDatabaseName:databaseCategory):section,
    workspaceId: section==="Workspaces"||section==="Databases"?"nobody-special":"general",
    workspaceName: section==="Workspaces"||section==="Databases"?"Nobody Special":"All About Action",
    kind:"page",
    fields:[
      {id:"location",label:"Current location",value:section},
      ...(contextId?[{id:"selection",label:"Selected area",value:contextId}]:[]),
      ...(section==="Databases"?[{id:"database",label:"Database",value:engineEnabled?stagingDatabaseName:databaseCategory}]:[])
    ]
  };
  if (!settings) return <main className="grid min-h-screen place-items-center">Loading your workspace…</main>;
  return (
    <div className={`app-shell aaa-shell ${collapsed ? "aaa-collapsed" : ""}`}>
      {(notice || settingsError) && (
        <div className={`aaa-toast ${settingsError ? "aaa-toast-error" : ""}`} role={settingsError ? "alert" : "status"}>
          <span>{settingsError || notice}</span>
          <button aria-label="Dismiss" onClick={() => { setNotice(""); dismissError(); }}><X size={16} /></button>
        </div>
      )}
      <header className="aaa-mobile-header">
        <button
          aria-label="Open navigation menu"
          onClick={() => {
            setMobileOpen(true);
            setMobileCalendars(false);
          }}
        >
          <Menu size={21} />
        </button>
        <strong>
          <BrandMark size={28} />
          All About Action
        </strong>
        <button
          aria-label="Calendar visibility"
          onClick={() => setMobileCalendars(!mobileCalendars)}
        >
          <CalendarDays size={20} />
        </button>
      </header>
      <aside
        className={`aaa-sidebar ${mobileOpen ? "aaa-sidebar-open" : ""}`}
        aria-label="Workspace navigation"
      >
        <div className="aaa-brand">
          <button
            className="aaa-icon-slot"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              if (matchMedia("(max-width:767px)").matches) setMobileOpen(false);
              else toggleSidebar();
            }}
          >
            <span className="aaa-logo">
              <BrandMark size={34} label="All About Action" />
            </span>
          </button>
          <div className="aaa-sidebar-label aaa-wordmark">
            <strong>All About Action</strong>
            <small>{ownedPageTitle(displayName, section)}</small>
          </div>
          <button
            className="aaa-collapse-control"
            aria-label="Close navigation"
            onClick={() => {
              if (matchMedia("(max-width:767px)").matches) setMobileOpen(false);
              else toggleSidebar();
            }}
          >
            <Menu size={18} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {(
            [
              { name: "Calendar", icon: CalendarDays, badge: "GO" },
              { name: "Goals", icon: Target, badge: "NA" },
              { name: "Workspaces", icon: Layers3, badge: engineEnabled ? "BETA" : "NA" },
              { name: "Databases", icon: Database, badge: "BETA" },
              { name: "Resources", icon: BookOpen, badge: "NA" },
              { name: "Settings", icon: Settings2, badge: "GO" },
              { name: "Fluid Calendar", icon: Zap, badge: "BETA" },
              { name: "Think About It", icon: LibraryBig, badge: "BETA" },
            ] as const
          ).filter(x=>x.name==="Fluid Calendar"?effective.fluidCalendar:x.name==="Think About It"?effective.thinkAboutIt:true).map(({ name, icon: Icon, badge }) => (
            <button
              key={name}
              title={name}
              aria-label={name}
              aria-current={section === name ? "page" : undefined}
              className={`aaa-nav-row ${section === name ? "active" : ""}`}
              onClick={() => nav(name)}
            >
              <span className="aaa-icon-slot">
                <Icon size={21} />
              </span>
              <span className="aaa-sidebar-label">{name}</span>
              <small
                className={`aaa-badge aaa-sidebar-label aaa-badge-${badge.toLowerCase()}`}
              >
                {badge}
              </small>
            </button>
          ))}
        </nav>
        <div className="aaa-context">
          <div className="aaa-context-heading">
            <button
              className="aaa-icon-slot"
              title={calendarSection ? "Manage calendars" : contextualTitle}
              aria-label={
                calendarSection ? "Manage calendars" : contextualTitle
              }
              onClick={() => {
                if (calendarSection) manage();
                else if(engineEnabled&&section==="Databases")setNewDatabaseOpen(open=>!open);
              }}
            >
              {calendarSection||engineEnabled&&section==="Databases" ? <Plus size={19} /> : <Layers3 size={18} />}
            </button>
            <strong className="aaa-sidebar-label">{contextualTitle}</strong>
          </div>
          {engineEnabled&&section==="Databases"&&newDatabaseOpen&&
           <form className="aaa-context-create" onSubmit={e=>{e.preventDefault();void createStagingDatabase()}}>
            <input value={newDatabaseName} autoFocus maxLength={80}
              placeholder="New database name…" aria-label="New database name"
              onChange={e=>setNewDatabaseName(e.target.value)}/>
            <button type="submit" disabled={!newDatabaseName.trim()||creatingDatabase}>
              {creatingDatabase?"Saving…":"Create"}</button>
           </form>}
          {engineEnabled&&section==="Databases"&&stagingDatabases.length===0&&
            <button type="button" className="aaa-context-setup" disabled={settingUpDatabases}
              onClick={()=>void setupMissingWorldbuilding()}>
              {settingUpDatabases?"Setting up databases…":"Set up worldbuilding databases"}
            </button>}
          <div className="aaa-context-scroll">
            {calendarSection ? (
              calendarControls
            ) : section === "Settings" ? (
              settingsSections.map(({name,icon:Icon})=><button key={name} className={`aaa-context-row ${settingsSection===name?'active':''}`} title={name} aria-pressed={settingsSection===name} onClick={()=>{setSettingsSection(name);setMobileOpen(false)}}><span className="aaa-icon-slot"><Icon size={18}/></span><span className="aaa-sidebar-label">{name}</span></button>)
            ) : (
              contextual.map((c) => (
                <button
                  key={c.id}
                  className={"aaa-context-row " + (
                    (section==="Databases"&&(engineEnabled?stagingDatabaseId===c.id:databaseCategory===c.id))||
                    (section==="Workspaces"&&contextId===c.id)?"active":""
                  ) + (c.id==="writing-events"?" aaa-context-nested":"")}
                  title={c.title}
                  aria-pressed={section === "Databases"?(engineEnabled?stagingDatabaseId===c.id:databaseCategory===c.id):contextId===c.id||activeThought===c.id}
                  onClick={() => contextClick(c.id)}
                >
                  <span className="aaa-icon-slot">
                    {c.id==="writing"?(writingExpanded?<ChevronDown size={18}/>:<ChevronRight size={18}/>)
                     :c.id==="writing-events"?<CalendarDays size={17}/>
                     :section==="Databases"?<Database size={17}/>:<BookOpen size={18}/>}
                  </span>
                  <span className="aaa-sidebar-label">{c.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <ProfileMenu
          displayName={displayName}
          email={email}
          settings={settings}
          effective={effective}
          open={profileMenu}
          onOpenChange={setProfileMenu}
          update={update}
          onNotice={setNotice}
          onAccount={() => {
            openProfile();
            setMobileOpen(false);
          }}
          onSettings={() => nav("Settings")}
          demo={isDemo}
          onResetDemo={() => {
            if (!window.confirm("Reset all demo data on this device? Sample events, thoughts and settings return to the original Primary-only setup.")) return;
            demoDatabase?.reset();
            resetDatabaseDemo();
            window.location.reload();
          }}
          onSignOut={() => void signOut()}
        />
      </aside>
      {mobileCalendars && (
        <div className="aaa-mobile-calendars">
          <div className="aaa-options">
            <strong>Calendars</strong>
            <button
              aria-label="Close calendar visibility"
              onClick={() => setMobileCalendars(false)}
            >
              <X size={20} />
            </button>
          </div>
          {calendarControls}
          <button onClick={manage}>+ Manage calendars</button>
        </div>
      )}
      <main className="aaa-workspace" inert={mobileOpen}>
        <CalendarWorkspace
          startDay={startDay}
          clock={clock}
          dateFormat={eventDateFormat}
          fluidOnly={section === "Fluid Calendar"}
          hiddenCategories={hidden}
          onCategoriesChange={setCategories}
          command={command}
          agendaMode={agendaMode}
          onAgendaMode={changeAgenda}
          agendaPreference={agendaPreference}
          onToggleAgenda={toggleAgenda}
          onOpenThought={openThought}
          companion={preferences.companion}
          onCompanion={setCompanion}
          companionTarget={companionTarget}
          companionProfileKey={userId+":"+settings.account.activeProfileId}
        >
          {!calendarSection && (
            <>
              <div className="aaa-page-toolbar">
                {section === "Workspaces" && isDemo ? <div id="aaa-writing-demo-header" style={{flex:"1 1 auto",minWidth:0}} /> : <span>{ownedPageTitle(displayName, section)}</span>}
                {preferences.companion.launcher==="top"&&<button type="button" className="calendar-panel pr11-toolbar-icon aaa-companion-toolbar-button" aria-label={agendaMode==="closed"?"Open The Companion":"Close The Companion"} title="The Companion" aria-expanded={agendaMode!=="closed"} onClick={toggleAgenda}><PanelRightOpen size={20}/></button>}

              </div>
              {section === "Settings" ? (
                <SettingsWorkspace
                  section={settingsSection} onSection={setSettingsSection}
                  settings={settings!}
                  effective={effective}
                  onDeveloperMode={(developerMode) => update((s) => updateAccount(s, { developerMode }))}
                  onTestProfiles={(testProfilesEnabled) => update((s) => updateAccount(s, { testProfilesEnabled }))}
                  onBetaFeature={(feature, on) => setPreferences((p) => ({ betaFeatures: { ...p.betaFeatures, [feature]: on } }))}
                  demoIsolation={isDemo}
                  agendaPreference={agendaPreference} onAgendaPreference={setAgendaPreference}
                  companion={preferences.companion} onCompanion={setCompanion}
                  displayName={displayName} email={email} onProfile={openProfile}
                  value={appearance}
                  onChange={setAppearance}
                  startDay={startDay}
                  onStartDay={setStartDay}
                  clock={clock}
                  onClock={setClock}
                  dateFormat={eventDateFormat}
                  onDateFormat={setEventDateFormat}
                  onBack={() => nav("Calendar")}
                />
              ) : section === "Databases" && engineEnabled ? (
                <DatabaseLabErrorBoundary>
                  <StagingDatabaseLab key={"database-"+stagingDatabaseName} surface="database"
                    databaseName={stagingDatabaseName}
                    onDatabasesChange={()=>void refreshStagingDatabases().catch(e=>setNotice(String(e)))} onContextRecord={onCompanionRecord}/>
                </DatabaseLabErrorBoundary>
              ) : section==="Workspaces" && engineEnabled && contextId==="writing-events" ? (
                <DatabaseLabErrorBoundary>
                  <StagingDatabaseLab key="writing-events" surface="writing-events" databaseName="Events" onContextRecord={onCompanionRecord}/>
                </DatabaseLabErrorBoundary>
              ) : section==="Workspaces" && engineEnabled && contextId==="writing" ? (
                <section className="aaa-writing-home">
                  <div className="aaa-writing-eyebrow"><PenLine size={15}/> WRITING WORKSPACE</div>
                  <h1>Writing</h1>
                  <p>Build your world history in Events. Eras, major events, moments and
                    their character perspectives are organized chronologically without duplicating the database.</p>
                  <button type="button" className="aaa-writing-link"
                    onClick={()=>{setContextId("writing-events");setWritingExpanded(true);}}>
                    <span><CalendarDays size={22}/><strong>Events</strong>
                    <small>World chronology · Eras → Events → Moments → Perspectives</small></span>
                    <ChevronRight size={18}/>
                  </button>
                </section>
              ) : section === "Databases" && production && productionEngineState!=="ready" ? (
                <section className="aaa-db-backend-wait">
                  <strong>{productionEngineState==="checking"?"Checking database backend…":
                    "Database creation is not enabled on production yet"}</strong>
                  <p>{productionEngineState==="missing"?
                    "The live Supabase project is missing the new database schema. Existing planning records remain available below, but creating new database files, records and properties requires the approved production migration.":
                    productionEngineState==="error"?engineProbeError:
                    "Checking your authenticated database configuration."}</p>
                  {productionEngineState!=="checking"&&<DatabasesWorkspace
                    category={databaseCategory} onOpenRecord={(category,id)=>{setDatabaseCategory(category);setDatabaseRecordId(id);}}
                    initialId={databaseRecordId}
                    onOpenDocument={openThought}
                    creationUnavailable/>}
                </section>
              ) : section === "Databases" ? (
                <DatabasesWorkspace
                  category={databaseCategory}
                  initialId={databaseRecordId}
                  onOpenRecord={(target, id) => {
                    setDatabaseCategory(target);
                    setDatabaseRecordId(id);
                  }}
                  onOpenDocument={openThought}
                />
              ) : section === "Workspaces" && isDemo ? (
                <WritingWorkspaceDemo />
              ) : section === "Goals" && isDemo ? (
                <div className="aaa-settings-panel aaa-demo-notice" role="note">
                  <h2>Goals aren&apos;t available in Demo Mode</h2>
                  <p className="calendar-muted">Existing goals, projects and tasks require a real account database and remain unchanged.</p>
                </div>
              ) : section === "Goals" || section === "Workspaces" ? (
                <PlanningWorkspace
                  key={section}
                  section={section}
                  initialId={contextId}
                  onContext={setPlanningContext}
                  onOpenPage={openThought}
                  onSchedule={(task) => {
                    setCommand({ id: Date.now(), type: "new", task });
                  }}
                />
              ) : (
                <>
                  <div className="aaa-resource-heading">
                    <h1>{section}</h1>
                    {activeThought && (
                      <button
                        onClick={() => {
                          nav(returnSection);
                          setActiveThought(undefined);
                        }}
                      >
                        <ArrowLeft size={15} />
                        Back to {returnSection}
                      </button>
                    )}
                  </div>
                  <ThoughtWorkspace
                    key={section + String(activeThought)}
                    collectionsOnly={section === "Resources" && !activeThought}
                    initialId={activeThought}
                    onNavigate={() => nav("Calendar")}
                  />
                </>
              )}
            </>
          )}
        </CalendarWorkspace>
      </main>
    </div>
  );
}
