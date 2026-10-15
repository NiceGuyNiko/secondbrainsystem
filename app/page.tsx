"use client";
import { useEffect, useState, useCallback } from "react";
import AuthGate from "@/components/auth-gate";
import ThoughtWorkspace from "@/components/thought-workspace";
import PlanningWorkspace from "@/components/planning-workspace";
import CalendarWorkspace from "@/components/calendar-workspace";
import AppearanceSettings from "@/components/appearance-settings";
import { type AgendaMode } from "@/components/agenda";
import { useProfile } from "@/components/profile-context";
import { thoughtStore } from "@/lib/thoughts";
import {
  appearanceDefaults,
  appearanceKey,
  parseAppearance,
  applyAppearance,
  ownedPageTitle,
  type Appearance,
} from "@/lib/appearance";
import { categoryColours } from "@/lib/calendar-layout";
import {
  CalendarDays,
  Target,
  LibraryBig,
  Plus,
  Settings2,
  Check,
  Menu,
  X,
  UserRound,
  LogOut,
  ChevronDown,
  BookOpen,
  Layers3,
  Zap,
  PanelRightOpen,
  ArrowLeft,
} from "lucide-react";
type Section =
  | "Calendar"
  | "Goals"
  | "Workspaces"
  | "Resources"
  | "Fluid Calendar"
  | "Think About It"
  | "Settings";
type ContextItem = { id: string; title: string };
export default function Home() {
  return (
    <AuthGate>
      <Workspace />
    </AuthGate>
  );
}
function Workspace() {
  const { displayName, email, openProfile, signOut } = useProfile();
  const [section, setSection] = useState<Section>("Calendar"),
    [mobileOpen, setMobileOpen] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [profileMenu, setProfileMenu] = useState(false),
    [mobileCalendars, setMobileCalendars] = useState(false),
    [activeThought, setActiveThought] = useState<string | undefined>(),
    [contextId, setContextId] = useState<string | undefined>(),
    [returnSection, setReturnSection] = useState<Section>("Calendar");
  const [agendaMode, setAgendaMode] = useState<AgendaMode>("closed"),
    [hidden, setHidden] = useState<string[]>([]),
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
  const [appearance, setAppearance] = useState<Appearance>(appearanceDefaults),
    [mode, setMode] = useState<"dark" | "light" | "system">("dark"),
    [startDay, setStartDay] = useState("Monday"),
    [clock, setClock] = useState("12-hour"),
    [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("think-sidebar-collapsed") === "true");
      const savedMode = localStorage.getItem("think-theme");
      if (
        savedMode === "light" ||
        savedMode === "system" ||
        savedMode === "dark"
      )
        setMode(savedMode);
      const raw = localStorage.getItem(appearanceKey);
      if (raw) setAppearance(parseAppearance(JSON.parse(raw)));
      setStartDay(localStorage.getItem("aaa-week-start") || "Monday");
      setClock(localStorage.getItem("aaa-clock") || "12-hour");
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const apply = () => applyAppearance(appearance, mode);
    apply();
    localStorage.setItem(appearanceKey, JSON.stringify(appearance));
    localStorage.setItem("think-theme", mode);
    localStorage.setItem("aaa-week-start", startDay);
    localStorage.setItem("aaa-clock", clock);
    const mq = matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [appearance, mode, ready, startDay, clock]);
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
    setSection(s);
    setContextId(undefined);
    setContext([]);
    setMobileOpen(false);
    setMobileCalendars(false);
    setProfileMenu(false);
  };
  const toggleSidebar = () =>
    setCollapsed((v) => {
      localStorage.setItem("think-sidebar-collapsed", String(!v));
      return !v;
    });
  const openThought = (id: string) => {
    setReturnSection(section);
    setActiveThought(id);
    setSection("Think About It");
  };
  const calendarSection =
    section === "Calendar" || section === "Fluid Calendar";
  const contextual = calendarSection
    ? categories.map((c) => ({ id: c.name, title: c.name }))
    : section === "Resources" || section === "Think About It"
      ? resources
      : context;
  const contextualTitle = calendarSection
    ? "Calendars"
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
    else if (section === "Resources" || section === "Think About It")
      setActiveThought(id);
    else setContextId(id);
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
  return (
    <div className={`app-shell aaa-shell ${collapsed ? "aaa-collapsed" : ""}`}>
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
          <Zap size={18} />
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
              <Zap size={22} />
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
              { name: "Workspaces", icon: Layers3, badge: "NA" },
              { name: "Resources", icon: BookOpen, badge: "NA" },
              { name: "Fluid Calendar", icon: Zap, badge: "BETA" },
              { name: "Think About It", icon: LibraryBig, badge: "BETA" },
            ] as const
          ).map(({ name, icon: Icon, badge }) => (
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
              }}
            >
              {calendarSection ? <Plus size={19} /> : <Layers3 size={18} />}
            </button>
            <strong className="aaa-sidebar-label">{contextualTitle}</strong>
          </div>
          <div className="aaa-context-scroll">
            {calendarSection ? (
              calendarControls
            ) : section === "Settings" ? (
              <button
                className="aaa-context-row"
                title="Appearance"
                onClick={() => nav("Settings")}
              >
                <span className="aaa-icon-slot">
                  <Settings2 size={18} />
                </span>
                <span className="aaa-sidebar-label">Appearance</span>
              </button>
            ) : (
              contextual.map((c) => (
                <button
                  key={c.id}
                  className="aaa-context-row"
                  title={c.title}
                  aria-pressed={contextId === c.id || activeThought === c.id}
                  onClick={() => contextClick(c.id)}
                >
                  <span className="aaa-icon-slot">
                    <BookOpen size={18} />
                  </span>
                  <span className="aaa-sidebar-label">{c.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
        <button
          className={`aaa-nav-row aaa-settings-link ${section === "Settings" ? "active" : ""}`}
          title="Settings"
          onClick={() => nav("Settings")}
        >
          <span className="aaa-icon-slot">
            <Settings2 size={20} />
          </span>
          <span className="aaa-sidebar-label">Settings</span>
        </button>
        <div className="aaa-profile">
          <button
            className="aaa-profile-button"
            aria-haspopup="menu"
            aria-expanded={profileMenu}
            onClick={() => setProfileMenu(!profileMenu)}
            title={displayName}
          >
            <span className="aaa-icon-slot">
              <span className="pr11-avatar">
                <UserRound size={18} />
              </span>
            </span>
            <span className="aaa-sidebar-label aaa-profile-text">
              <strong>{displayName}</strong>
              <small>{email}</small>
            </span>
            <ChevronDown className="aaa-sidebar-label" size={15} />
          </button>
          {profileMenu && (
            <div className="aaa-profile-menu" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  openProfile();
                  setProfileMenu(false);
                  setMobileOpen(false);
                }}
              >
                <UserRound size={16} />
                Profile
              </button>
              <button role="menuitem" onClick={() => nav("Settings")}>
                <Settings2 size={16} />
                Settings
              </button>
              <button role="menuitem" onClick={() => void signOut()}>
                <LogOut size={16} />
                Log out
              </button>
            </div>
          )}
        </div>
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
          fluidOnly={section === "Fluid Calendar"}
          hiddenCategories={hidden}
          onCategoriesChange={setCategories}
          command={command}
          agendaMode={agendaMode}
          onAgendaMode={setAgendaMode}
          onOpenThought={openThought}
        >
          {!calendarSection && (
            <>
              <div className="aaa-page-toolbar">
                <span>{ownedPageTitle(displayName, section)}</span>
                <button
                  onClick={() =>
                    setAgendaMode(
                      agendaMode === "closed" ? "overlay" : "closed",
                    )
                  }
                >
                  <PanelRightOpen size={17} />
                  The Agenda
                </button>
              </div>
              {section === "Settings" ? (
                <AppearanceSettings
                  value={appearance}
                  onChange={setAppearance}
                  mode={mode}
                  onMode={setMode}
                  startDay={startDay}
                  onStartDay={setStartDay}
                  clock={clock}
                  onClock={setClock}
                  onBack={() => nav("Calendar")}
                />
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
                    collectionsOnly={section === "Resources"}
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
