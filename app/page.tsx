"use client";
import { useEffect, useLayoutEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import BrandMark from "@/components/brand-mark";
import ThemedTooltips from "@/components/themed-tooltips";
import {toggleMobileSidebarMode,modeForMobileSidebarDivider,modeAfterSidebarPageSelection,type MobileSidebarMode} from "@/lib/mobile-sidebar-model";
import { updateFavicon } from "@/lib/favicon";
import AuthGate from "@/components/auth-gate";
import DemoDatabaseWorkshop from "@/components/demo-database-workshop";
import ThoughtWorkspace from "@/components/thought-workspace";
import PlanningWorkspace from "@/components/planning-workspace";
import DatabasesWorkspace from "@/components/databases-workspace";
import StagingDatabaseLab from "@/components/database-staging-lab";
import WidgetStudio from "@/components/widget-studio";
import {isPageWidgetDrag,returnPageWidgetToDeveloper} from "@/lib/widget-drag";
import type {CompanionInspection} from "@/lib/companion-config";
import {widgetConfig,type WidgetConfigureTarget,type WidgetDatabase,type WidgetProperty,type WidgetView,type WidgetDefinition} from "@/lib/widget-system";
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
  X,
  BookOpen,
  Layers3,
  LayoutGrid,
  Zap,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  PenLine,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
type Section =
  | "Calendar"
  | "Goals"
  | "Library"
  | "Developing IT"
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
  // On phones show the current page's subpages first; tap the page heading
  // to browse all pages, or pull the divider to expose both lists.
  const [mobileSidebarMode,setMobileSidebarMode]=useState<MobileSidebarMode>("subpages");
  const [mobileNavPercent,setMobileNavPercent]=useState(40);
  const mobileSidebarDrag=useRef<{y:number;navPx:number;panelPx:number;moved:boolean}|null>(null);
  const mobileSidebarDidDrag=useRef(false);
  const [settingsSection,setSettingsSection]=useState<SettingsSection>("General");
  const [companionRecord,setCompanionRecord]=useState<CompanionTarget|null>(null);
  const [widgetConfiguration,setWidgetConfiguration]=useState<WidgetConfigureTarget|null>(null);
  const [widgetInspection,setWidgetInspection]=useState<CompanionInspection|null>(null);
  const [widgetPreviewMount,setWidgetPreviewMount]=useState<HTMLDivElement|null>(null);
  const onWidgetPreviewMount=useCallback((node:HTMLDivElement|null)=>setWidgetPreviewMount(old=>old===node?old:node),[]);
  const [libraryEditIntent,setLibraryEditIntent]=useState(0);
  useEffect(()=>setWidgetInspection(null),[section,contextId]);
  const [widgetPages,setWidgetPages]=useState<{library:ContextItem[];goals:ContextItem[]}>({library:[],goals:[]});
  const [newWidgetPageIntent,setNewWidgetPageIntent]=useState(0);
  const updateWidgetPages=useCallback((area:"library"|"goals",items:ContextItem[])=>setWidgetPages(prev=>JSON.stringify(prev[area])===JSON.stringify(items)?prev:{...prev,[area]:items}),[]);
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
  const widgetEngineEnabled=engineEnabled||(environment.ok&&environment.data==="demo");
  const stagingDatabaseName=stagingDatabases.find(d=>d.id===stagingDatabaseId)?.name||"Characters";
  const refreshStagingDatabases=useCallback(async()=>{
    const {data,error}=await supabase.from("db_databases").select("id,name")
      .is("archived_at",null).order("name").limit(150);
    if(error)throw new Error(error.message);
    const rows=isDemo?(data??[]):(data??[]).filter(d=>d.name.toLowerCase()!=="perspectives");
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
    if(!(engineEnabled||isDemo)||(section!=="Databases"&&!(section==="Developing IT"&&contextId==="databases")))return;
    void refreshStagingDatabases().catch(e=>setNotice(e instanceof Error?e.message:"Could not load database navigation."));
  },[engineEnabled,section,contextId,refreshStagingDatabases]);
  const { agendaPreference, lastPinned, startDay, clock, eventDateFormat, hiddenCalendars: hidden, appearance, sidebarCollapsed: collapsed } = preferences;
  const effectiveAgendaPreference=isDemo?"column":agendaPreference;
  const setPreferences = useCallback((patch: (p: ProfilePreferences) => Partial<ProfilePreferences>) => update((s) => updateActivePreferences(s, patch)), [update]);
  const setAgendaPreference = (agendaPreference: AgendaPreference) => setPreferences(() => ({ agendaPreference }));
  const setCompanion = (patch:Partial<CompanionPreferences>)=>setPreferences(p=>({companion:{...p.companion,...patch}}));
  const setLastPinned = useCallback((lastPinned: boolean) => setPreferences(() => ({ lastPinned })), [setPreferences]);
  const setStartDay = (startDay: string) => setPreferences(() => ({ startDay: startDay as ProfilePreferences["startDay"] }));
  const setClock = (clock: string) => setPreferences(() => ({ clock: clock as ProfilePreferences["clock"] }));
  const setEventDateFormat = (eventDateFormat: ProfilePreferences["eventDateFormat"]) => setPreferences(() => ({ eventDateFormat }));
  const setMobileTooltipMode = (mobileTooltipMode: ProfilePreferences["mobileTooltipMode"]) =>
    setPreferences(() => ({ mobileTooltipMode }));
  const setHidden = (change: (old: string[]) => string[]) => setPreferences((p) => ({ hiddenCalendars: change(p.hiddenCalendars) }));
  const setAppearance = (appearance: Appearance) => setPreferences(() => ({ appearance }));
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
    setAgendaMode(next);
    if(next!=="closed"&&effectiveAgendaPreference==="toggle")setLastPinned(next==="pinned");
  },[effectiveAgendaPreference,setLastPinned]);
  const toggleAgenda=()=>changeAgenda(agendaMode==="closed"?openAgenda(effectiveAgendaPreference,lastPinned):"closed");
  const buildWidgetFromDatabase=async(databaseId:string)=>{
    if(!databaseId)return;
    try{
      const [source,views,properties]=await Promise.all([
        supabase.from("db_databases").select("id,name,icon").is("archived_at",null),
        supabase.from("db_views").select("id,database_id,name,layout,config"),
        supabase.from("db_properties").select("id,database_id,name,type,config,position").is("archived_at",null)
      ]);
      const initialError=source.error||views.error||properties.error;if(initialError)throw new Error(initialError.message);
      const allDatabases=(source.data??[]) as WidgetDatabase[];
      const db=allDatabases.find(d=>d.id===databaseId);if(!db)throw new Error("Select a database to build a widget from.");
      const {data:created,error}=await supabase.from("aaa_widget_definitions")
        .insert({name:db.name+" widget",database_id:db.id,config:{renderer:"table",editable:true}})
        .select("id,name,database_id,view_id,config").single();
      if(error)throw new Error(error.message);
      let master=created as WidgetDefinition;
      const id=master.id;
      const save=async(patch:Partial<WidgetDefinition>)=>{
        master={...master,...patch};
        const {error:saveError}=await supabase.from("aaa_widget_definitions").update(patch).eq("id",id);
        if(saveError)setNotice(saveError.message);
      };
      const refresh=async()=>{
        const [dbs,props,vws]=await Promise.all([
          supabase.from("db_databases").select("id,name,icon").is("archived_at",null),
          supabase.from("db_properties").select("id,database_id,name,type,config,position").is("archived_at",null),
          supabase.from("db_views").select("id,database_id,name,layout,config")
        ]);
        const fault=dbs.error||props.error||vws.error;if(fault)throw new Error(fault.message);
        setWidgetConfiguration(previous=>previous?.id===id?{...previous,databases:(dbs.data??[]) as WidgetDatabase[],properties:(props.data??[]) as WidgetProperty[],views:(vws.data??[]) as WidgetView[]}:previous);
      };
      const changeSource=(databaseId:string|null,viewId:string|null)=>{
        void save({database_id:databaseId,view_id:viewId,config:{...master.config,filters:[],sorts:[]}});
        setWidgetConfiguration(previous=>previous?.id===id?{...previous,databaseId,viewId,config:widgetConfig({...master.config,filters:[],sorts:[]})}:previous);
      };
      setWidgetConfiguration({id,kind:"definition",title:master.name,databaseId:db.id,viewId:null,autoEditDatabase:true,config:widgetConfig(master.config),
        databases:allDatabases,views:(views.data??[]) as WidgetView[],properties:(properties.data??[]) as WidgetProperty[],
        onConfig:patch=>{
          const config=widgetConfig({...master.config,...patch});void save({config});
          setWidgetConfiguration(previous=>previous?.id===id?{...previous,config}:previous);
        },onSource:changeSource,
        onRename:name=>{void save({name});setWidgetConfiguration(previous=>previous?.id===id?{...previous,title:name}:previous)},
        onCreateDatabase:async name=>{
          const newId=crypto.randomUUID();
          const {error:newError}=await supabase.rpc("db_create_database",{p_id:newId,p_name:name,p_dataset:"acceptance"});
          if(newError)throw new Error(newError.message);
          await save({database_id:newId,view_id:null});
          setWidgetConfiguration(previous=>previous?.id===id?{...previous,databaseId:newId,viewId:null}:previous);
          await refresh();void refreshStagingDatabases();return newId;
        },
        onAddProperty:async(dbId,name,type)=>{
          const {data:existing,error:readError}=await supabase.from("db_properties").select("id").eq("database_id",dbId);
          if(readError)throw new Error(readError.message);
          const {error:insertError}=await supabase.from("db_properties").insert({id:crypto.randomUUID(),database_id:dbId,name,type,position:existing?.length??0,config:{},archived_at:null});
          if(insertError)throw new Error(insertError.message);
          await refresh();
        },
        onUpdateProperty:async(propId,patch)=>{
          const {error:updateError}=await supabase.from("db_properties").update(patch).eq("id",propId);
          if(updateError)throw new Error(updateError.message);
          await refresh();
        }
      });
      changeAgenda(agendaMode==="closed"?openAgenda(effectiveAgendaPreference,lastPinned):agendaMode);
      setNotice(`${db.name} widget created in Developing IT → Widgets. Configure it here while keeping the database open.`);
    }catch(e){setNotice(e instanceof Error?e.message:String(e))}
  };
  useEffect(()=>{setAgendaMode(m=>m==="closed"?m:openAgenda(effectiveAgendaPreference,lastPinned));},[effectiveAgendaPreference,lastPinned]);
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
  const nav = (s: Section, keepMobileDrawer=false) => {
    if((s==="Fluid Calendar"&&!effective.fluidCalendar)||(s==="Think About It"&&!effective.thinkAboutIt))return;
    // Selecting the same page from the mobile page picker should reveal its
    // subpages, not reset whichever record or subpage was already open.
    if(!(keepMobileDrawer&&s===section)){
      setSection(s);
      setContextId(s==="Workspaces"&&engineEnabled?"writing":s==="Developing IT"?"widgets":undefined);
      if(s==="Workspaces"&&engineEnabled)setWritingExpanded(true);
      setContext([]);
      setDatabaseRecordId(null);
      setCompanionRecord(null);
      setWidgetConfiguration(null);
    }
    setMobileOpen(keepMobileDrawer&&typeof window!=="undefined"&&window.matchMedia("(max-width:767px)").matches);
    setMobileSidebarMode(modeAfterSidebarPageSelection());
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
    : section === "Developing IT"
      ? [{id:"widgets",title:"Widgets"},{id:"databases",title:"Databases"}]
    : section === "Library"
      ? widgetPages.library
    : section === "Goals"
      ? widgetPages.goals
    : section === "Databases"
      ? engineEnabled||isDemo?stagingDatabases.map(d=>({id:d.id,title:d.name})):DATABASE_CATEGORIES.map((c) => ({ id: c.id, title: c.label }))
    : section==="Workspaces"&&engineEnabled
      ? [{id:"writing",title:"Writing"},...(writingExpanded?[{id:"writing-events",title:"Events"}]:[]),...context.filter(c=>c.id!=="writing"&&c.id!=="writing-events")]
    : section === "Resources" || section === "Think About It"
      ? resources
      : context;
  const contextualTitle = calendarSection
    ? "Calendars"
    : section === "Developing IT" ? "Developing IT"
    : section === "Library" ? "Library"
    : section === "Goals" ? "Goals"
    : section === "Databases" ? "Databases"
    : section === "Resources" || section === "Think About It" ? "Collections"
    : section === "Settings" ? "Settings"
    : section;
  // The nav is location-based. Personalization belongs in the branded subtitle
  // and in the always-visible mobile page header instead.
  const navigationLabel=(name:Section)=>name;
  const contextClick = (id: string) => {
    if (calendarSection)
      setHidden((old) =>
        old.includes(id) ? old.filter((c) => c !== id) : [...old, id],
      );
    else if (section === "Databases") {
      if(engineEnabled||isDemo)setStagingDatabaseId(id);
      else setDatabaseCategory(id as DatabaseCategory);
      setDatabaseRecordId(null);
    } else if (section === "Resources" || section === "Think About It")
      setActiveThought(id);
    else if(section==="Library"||section==="Goals"||section==="Developing IT")setContextId(id);
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
    id: section==="Databases"?(engineEnabled||isDemo?stagingDatabaseId:databaseCategory):(contextId||section),
    title: section==="Databases"?(engineEnabled||isDemo?stagingDatabaseName:databaseCategory):section==="Workspaces"&&contextId==="writing-events"?"Events":section==="Workspaces"&&contextId==="writing"?"Writing":section==="Settings"?settingsSection:section,
    databaseId: section==="Databases"?(engineEnabled||isDemo?stagingDatabaseId:databaseCategory):section,
    databaseName: section==="Databases"?(engineEnabled||isDemo?stagingDatabaseName:databaseCategory):section,
    workspaceId: section==="Workspaces"||section==="Databases"?"nobody-special":"general",
    workspaceName: section==="Workspaces"||section==="Databases"?"Nobody Special":"All About Action",
    kind:"page",
    fields:[
      {id:"location",label:"Current location",value:section},
      ...(contextId?[{id:"selection",label:"Selected area",value:contextId}]:[]),
      ...(section==="Databases"?[{id:"database",label:"Database",value:engineEnabled||isDemo?stagingDatabaseName:databaseCategory}]:[])
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
        <button className="aaa-mobile-brand-launcher"
          aria-label="Open navigation menu"
          title="Open navigation"
          data-aaa-tooltip="Open navigation"
          onClick={() => {
            setMobileSidebarMode("subpages");
            setMobileOpen(true);
            setMobileCalendars(false);
          }}
        >
          <BrandMark size={30} />
        </button>
        <strong className="aaa-mobile-current-page" title={ownedPageTitle(displayName,section)}>
          {ownedPageTitle(displayName,section)}
        </strong>
        <button className="aaa-mobile-companion-launcher"
          aria-label={agendaMode==="closed"?"Open The Companion":"Close The Companion"}
          title="The Companion"
          data-aaa-tooltip="The Companion"
          aria-expanded={agendaMode!=="closed"}
          onClick={toggleAgenda}
        >
          <PanelRightOpen size={21} />
        </button>
      </header>
      <aside
        className={`aaa-sidebar ${mobileOpen ? "aaa-sidebar-open" : ""} aaa-sidebar-nav-mode-${mobileSidebarMode}`}
        aria-label="Workspace navigation"
        style={{"--aaa-mobile-nav-percent":mobileNavPercent+"%"} as CSSProperties}
      >
        <div className="aaa-brand">
          <button
            className="aaa-icon-slot aaa-brand-toggle"
            aria-label={collapsed ? "Expand sidebar" : "All About Action navigation"}
            title={undefined}
            onClick={() => {
              if (matchMedia("(max-width:767px)").matches) setMobileOpen(false);
              else toggleSidebar();
            }}
          >
            <span className="aaa-logo aaa-sidebar-brand-icon">
              <BrandMark size={34} label="All About Action" />
              <PanelLeftOpen className="aaa-brand-expand-indicator" size={21} aria-hidden="true"/>
            </span>
          </button>
          <div className="aaa-sidebar-label aaa-wordmark">
            <strong>All About Action</strong>
            <small>{ownedPageTitle(displayName, section)}</small>
          </div>
          <button
            className="aaa-collapse-control aaa-desktop-collapse-control"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeftClose size={20}/>
          </button>
          <button
            className="aaa-mobile-close-control"
            aria-label="Close navigation"
            title="Close navigation"
            onClick={()=>setMobileOpen(false)}
          >
            <X size={20}/>
          </button>
        </div>
        <nav aria-label="Main navigation">
          <button type="button" className="aaa-mobile-current-section-control"
            aria-expanded={mobileSidebarMode!=="subpages"}
            aria-label={mobileSidebarMode==="pages"?"Show "+navigationLabel(section)+" subpages":"Browse all pages"}
            onClick={()=>setMobileSidebarMode(mode=>toggleMobileSidebarMode(mode))}>
            <span className="aaa-mobile-section-icon">
              {section==="Calendar"?<CalendarDays size={20}/>
              :section==="Goals"?<Target size={20}/>
              :section==="Library"?<LibraryBig size={20}/>
              :section==="Databases"?<Database size={20}/>
              :section==="Workspaces"?<Layers3 size={20}/>
              :section==="Settings"?<Settings2 size={20}/>
              :<BookOpen size={20}/>}
            </span>
            <span className="aaa-mobile-section-text">
              <strong>{navigationLabel(section)}</strong>
              <small>{mobileSidebarMode==="pages"?"Select a page to view its subpages":mobileSidebarMode==="split"?"Page navigation and subpages":"Tap to browse all pages"}</small>
            </span>
            <ChevronDown className={mobileSidebarMode==="pages"?"aaa-mobile-section-arrow is-open":"aaa-mobile-section-arrow"} size={18}/>
          </button>
          {(
            [
              { name: "Calendar", icon: CalendarDays, badge: "GO" },
              { name: "Goals", icon: Target, badge: "BETA" },
              { name: "Library", icon: LibraryBig, badge: "BETA" },
              { name: "Developing IT", icon: Settings2, badge: "BETA" },
              { name: "Databases", icon: Database, badge: "BETA" },
              { name: "Workspaces", icon: Layers3, badge: "NA" },
              { name: "Resources", icon: BookOpen, badge: "NA" },
              { name: "Settings", icon: Settings2, badge: "GO" },
              { name: "Fluid Calendar", icon: Zap, badge: "BETA" },
              { name: "Think About It", icon: LibraryBig, badge: "BETA" },
            ] as const
          ).filter(x=>x.name==="Fluid Calendar"?effective.fluidCalendar:x.name==="Think About It"?effective.thinkAboutIt:true).map(({ name, icon: Icon, badge }) => (
            <button
              key={name}
              title={collapsed?navigationLabel(name):undefined}
              aria-label={navigationLabel(name)}
              aria-current={section === name ? "page" : undefined}
              className={`aaa-nav-row ${section === name ? "active" : ""}`}
              onClick={() => nav(name,true)}
            >
              <span className="aaa-icon-slot">
                <Icon size={21} />
              </span>
              <span className="aaa-sidebar-label">{navigationLabel(name)}</span>
              <small
                className={`aaa-badge aaa-sidebar-label aaa-badge-${badge.toLowerCase()}`}
              >
                {badge}
              </small>
            </button>
          ))}
        </nav>
        <button type="button" className="aaa-sidebar-nav-divider aaa-companion-pull" role="separator"
          aria-label="Resize navigation and subpages" aria-orientation="horizontal"
          aria-valuemin={12} aria-valuemax={86}
          aria-valuenow={mobileSidebarMode==="subpages"?12:mobileSidebarMode==="pages"?86:mobileNavPercent}
          title="Drag to reveal pages and subpages, or tap to switch layout"
          onPointerDown={e=>{
            if(e.button!==0 && e.pointerType!=="touch")return;
            const aside=e.currentTarget.closest<HTMLElement>(".aaa-sidebar");
            const navigation=aside?.querySelector<HTMLElement>('nav[aria-label="Main navigation"]');
            const panelPx=aside?.getBoundingClientRect().height||window.innerHeight;
            mobileSidebarDrag.current={y:e.clientY,navPx:navigation?.getBoundingClientRect().height||56,panelPx,moved:false};
            mobileSidebarDidDrag.current=false;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e=>{
            const start=mobileSidebarDrag.current;
            if(!start)return;
            if(Math.abs(e.clientY-start.y)>6)start.moved=true;
            if(!start.moved)return;
            const percent=Math.max(12,Math.min(86,Math.round((start.navPx+e.clientY-start.y)/start.panelPx*100)));
            setMobileNavPercent(percent);
            setMobileSidebarMode(modeForMobileSidebarDivider(percent));
          }}
          onPointerUp={()=>{
            if(mobileSidebarDrag.current?.moved)mobileSidebarDidDrag.current=true;
            mobileSidebarDrag.current=null;
          }}
          onPointerCancel={()=>{mobileSidebarDrag.current=null;}}
          onKeyDown={e=>{
            if(e.key==="Home"){e.preventDefault();setMobileSidebarMode("subpages");}
            else if(e.key==="End"){e.preventDefault();setMobileSidebarMode("pages");}
            else if(e.key==="ArrowDown"||e.key==="ArrowUp"){
              e.preventDefault();
              const next=Math.max(12,Math.min(86,mobileNavPercent+(e.key==="ArrowDown"?8:-8)));
              setMobileNavPercent(next);setMobileSidebarMode(modeForMobileSidebarDivider(next));
            }
          }}
          onClick={()=>{
            if(mobileSidebarDidDrag.current){mobileSidebarDidDrag.current=false;return;}
            setMobileSidebarMode(mode=>mode==="subpages"?"split":"subpages");
          }}>
          <span className="aaa-companion-pull-track"/>
          <span className="aaa-companion-pull-pill">{mobileSidebarMode==="subpages"?<ChevronDown size={14}/>:<ChevronDown size={14} style={{transform:"rotate(180deg)"}}/>}</span>
          <span className="aaa-companion-pull-track"/>
        </button>
        <div className="aaa-context">
          <div className="aaa-context-heading">
            <button
              className="aaa-icon-slot"
              title={collapsed?(calendarSection ? "Manage calendars" : contextualTitle):undefined}
              aria-label={
                calendarSection ? "Manage calendars" : contextualTitle
              }
              onClick={() => {
                if (calendarSection) manage();
                else if((engineEnabled||isDemo)&&section==="Databases")setNewDatabaseOpen(open=>!open);
                else if(section==="Library"||section==="Goals")setNewWidgetPageIntent(x=>x+1);
              }}
            >
              {calendarSection||(engineEnabled||isDemo)&&section==="Databases"||section==="Library"||section==="Goals" ? <Plus size={19} /> : <Layers3 size={18} />}
            </button>
            <strong className="aaa-sidebar-label">{contextualTitle}</strong>
          </div>
          {(engineEnabled||isDemo)&&section==="Databases"&&newDatabaseOpen&&
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
              settingsSections.map(({name,icon:Icon})=><button key={name} className={`aaa-context-row ${settingsSection===name?'active':''}`} title={collapsed?name:undefined} aria-pressed={settingsSection===name} onClick={()=>{setSettingsSection(name);setMobileOpen(false)}}><span className="aaa-icon-slot"><Icon size={18}/></span><span className="aaa-sidebar-label">{name}</span></button>)
            ) : (
              contextual.map((c) => (
                <button
                  key={c.id}
                  className={"aaa-context-row " + (
                    (section==="Databases"&&(engineEnabled||isDemo?stagingDatabaseId===c.id:databaseCategory===c.id))||
                    ((section==="Workspaces"||section==="Library"||section==="Goals"||section==="Developing IT")&&contextId===c.id)?"active":""
                  ) + (c.id==="writing-events"?" aaa-context-nested":"")}
                  title={collapsed?c.title:undefined}
                  aria-pressed={section === "Databases"?(engineEnabled||isDemo?stagingDatabaseId===c.id:databaseCategory===c.id):contextId===c.id||activeThought===c.id}
                  onClick={() => {
                    contextClick(c.id);
                    // Let expandable workspace group headings reveal their children.
                    // Calendar toggles stay open so several calendars can be changed.
                    if(!(section==="Workspaces"&&c.id==="writing"))setMobileOpen(false);
                  }}
                >
                  <span className="aaa-icon-slot">
                    {c.id==="writing"?(writingExpanded?<ChevronDown size={18}/>:<ChevronRight size={18}/>)
                     :c.id==="writing-events"?<CalendarDays size={17}/>
                     :section==="Databases"||c.id==="databases"?<Database size={17}/>:c.id==="widgets"?<LayoutGrid size={17}/>:<BookOpen size={18}/>}
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
      <ThemedTooltips mobileMode={preferences.mobileTooltipMode}/>
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
          agendaPreference={effectiveAgendaPreference}
          onToggleAgenda={toggleAgenda}
          onOpenThought={openThought}
          companion={isDemo?{...preferences.companion,tabDisplay:"icons"}:preferences.companion}
          onCompanion={setCompanion}
          companionTarget={companionTarget}
          companionProfileKey={userId+":"+settings.account.activeProfileId}
          widgetConfiguration={widgetConfiguration}
          onCloseWidgetConfiguration={()=>setWidgetConfiguration(null)}
          widgetInspection={widgetInspection}
          onWidgetPreviewMount={onWidgetPreviewMount}
          onActivateDeveloper={()=>{
            if(section==="Library"||section==="Goals")setLibraryEditIntent(value=>value+1);
          }}
        >
          {!calendarSection && (
            <>
              <div className="aaa-page-toolbar">
                <span>{ownedPageTitle(displayName, section)}</span>
                {preferences.companion.launcher==="top"&&<button type="button" className="calendar-panel pr11-toolbar-icon aaa-companion-toolbar-button aaa-companion-return-target" aria-label={agendaMode==="closed"?"Open The Companion":"Close The Companion"} title="The Companion · drop a widget here to return it to Developer" aria-expanded={agendaMode!=="closed"} onClick={toggleAgenda}
                  onDragOver={e=>{if(isPageWidgetDrag(e.dataTransfer)){e.preventDefault();e.dataTransfer.dropEffect="move"}}}
                  onDrop={e=>{if(!isPageWidgetDrag(e.dataTransfer))return;e.preventDefault();returnPageWidgetToDeveloper(e.dataTransfer)}}><PanelRightOpen size={20}/></button>}

              </div>
              {section === "Developing IT" && contextId === "databases" && isDemo ? (
                <DemoDatabaseWorkshop selectedDatabaseId={stagingDatabaseId} onSelectDatabase={setStagingDatabaseId} onDatabasesChange={()=>void refreshStagingDatabases()} onBuildWidget={id=>void buildWidgetFromDatabase(id)}/>
              ) : section === "Developing IT" && contextId === "databases" && engineEnabled ? (
                <section className="aaa-widget-database-development">
                  <div className="aaa-widget-database-heading"><div><span className="aaa-widget-eyebrow">DEVELOPING IT / DATABASES</span><h1>Database workshop</h1><p>Develop database properties, relationships, and source views here. Your widgets reference these same records.</p></div>
                  <div className="aaa-widget-hero-actions"><select aria-label="Database to develop" value={stagingDatabaseId} onChange={e=>setStagingDatabaseId(e.target.value)}>{stagingDatabases.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select>
                    <button className="aaa-widget-secondary" disabled={!stagingDatabaseId} onClick={()=>void buildWidgetFromDatabase(stagingDatabaseId)}><LayoutGrid size={16}/> Build widget</button>
                    <button className="aaa-widget-secondary" onClick={()=>setNewDatabaseOpen(open=>!open)}><Plus size={16}/> New database</button></div></div>
                  {newDatabaseOpen&&<form className="aaa-widget-create-row aaa-widget-database-create" onSubmit={e=>{e.preventDefault();void createStagingDatabase()}}>
                    <input autoFocus aria-label="New database name" placeholder="Database name…" maxLength={80} value={newDatabaseName} onChange={e=>setNewDatabaseName(e.target.value)}/>
                    <button type="submit" disabled={!newDatabaseName.trim()||creatingDatabase}>{creatingDatabase?"Creating…":"Create database"}</button>
                    <button type="button" onClick={()=>setNewDatabaseOpen(false)} aria-label="Cancel"><X size={15}/></button>
                  </form>}
                  <DatabaseLabErrorBoundary><StagingDatabaseLab key={"development-"+stagingDatabaseName} surface="database" databaseName={stagingDatabaseName}
                    onDatabasesChange={()=>void refreshStagingDatabases().catch(e=>setNotice(String(e)))} onContextRecord={onCompanionRecord}/></DatabaseLabErrorBoundary>
                </section>
              ) : (section==="Library"||section==="Developing IT"||section==="Goals") && !widgetEngineEnabled ? (
                <div className="aaa-settings-panel aaa-demo-notice" role="note"><h2>Widget system is waiting for the database connection</h2><p>The database engine must be enabled for this environment. Existing planning and database records remain untouched.</p></div>
              ) : (section==="Library"||section==="Goals"||section==="Developing IT") ? (
                <WidgetStudio key={section} mode={section==="Library"?"library":section==="Goals"?"goals":"widgets"} visualStyle={preferences.widgetStyle} headerPosition={preferences.widgetHeaderPosition}
                  cornerDoubleClick={preferences.widgetCornerDoubleClick} bottomDoubleClick={preferences.widgetBottomDoubleClick}
                  activePageId={contextId} newPageIntent={newWidgetPageIntent}
                  developerActive={preferences.companion.primary==="developer"}
                  previewMount={widgetPreviewMount}
                  editIntent={libraryEditIntent} onEditModeChange={editing=>{
                    if(!editing&&preferences.companion.primary==="developer")setCompanion({primary:"view"});
                  }} onInspect={setWidgetInspection}
                  onPages={items=>updateWidgetPages(section==="Goals"?"goals":"library",items)} onPage={id=>setContextId(id)}
                  onConfigure={setWidgetConfiguration}
                  onOpenConfigure={()=>changeAgenda(agendaMode==="closed"?openAgenda(effectiveAgendaPreference,lastPinned):agendaMode)}
                  onOpenDeveloper={()=>{
                    setCompanion({primary:"developer"});
                    changeAgenda(agendaMode==="closed"?openAgenda(effectiveAgendaPreference,lastPinned):agendaMode);
                    setLibraryEditIntent(value=>value+1);
                  }}
                  onOpenRecord={openThought} onPlanningContext={setPlanningContext}
                  onSchedule={task=>setCommand({id:Date.now(),type:"new",task})}/>
              ) : section === "Settings" ? (
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
                  widgetStyle={preferences.widgetStyle} onWidgetStyle={widgetStyle=>setPreferences(()=>({widgetStyle}))}
                  widgetHeaderPosition={preferences.widgetHeaderPosition} onWidgetHeaderPosition={widgetHeaderPosition=>setPreferences(()=>({widgetHeaderPosition}))}
                  widgetCornerDoubleClick={preferences.widgetCornerDoubleClick} onWidgetCornerDoubleClick={widgetCornerDoubleClick=>setPreferences(()=>({widgetCornerDoubleClick}))}
                  widgetBottomDoubleClick={preferences.widgetBottomDoubleClick} onWidgetBottomDoubleClick={widgetBottomDoubleClick=>setPreferences(()=>({widgetBottomDoubleClick}))}
                  mobileTooltipMode={preferences.mobileTooltipMode} onMobileTooltipMode={setMobileTooltipMode}
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
              ) : section === "Databases" && isDemo ? (
                <DemoDatabaseWorkshop selectedDatabaseId={stagingDatabaseId} onSelectDatabase={setStagingDatabaseId} onDatabasesChange={()=>void refreshStagingDatabases()} onBuildWidget={id=>void buildWidgetFromDatabase(id)}/>
              ) : section === "Databases" && engineEnabled ? (
                <DatabaseLabErrorBoundary>
                  <div className="aaa-widget-db-build-toolbar"><span>Build a reusable view from this database without leaving its source.</span><button className="aaa-widget-secondary" disabled={!stagingDatabaseId} onClick={()=>void buildWidgetFromDatabase(stagingDatabaseId)}><LayoutGrid size={16}/> Build widget</button></div>
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
                <div className="aaa-settings-panel aaa-demo-notice" role="note">
                  <h2>{section} isn’t available in Demo Mode</h2>
                  <p className="calendar-muted">
                    The existing writing Workspaces (Events, Characters, Perspectives, Scenes and the Matrix) rely on your real account’s database. They are unchanged and keep working in the live app.
                  </p>
                </div>
              ) : section === "Workspaces" ? (
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
