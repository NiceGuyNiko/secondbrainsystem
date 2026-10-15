"use client";
import { Bell, CalendarClock, ChevronRight, Palette, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";

export type SettingsTab =
  | "General"
  | "Appearance"
  | "Calendar & time"
  | "Notifications"
  | "Account"
  | "Privacy & data";

export const SETTINGS_TABS = [
  { name: "General", icon: SlidersHorizontal },
  { name: "Appearance", icon: Palette },
  { name: "Calendar & time", icon: CalendarClock },
  { name: "Notifications", icon: Bell },
  { name: "Account", icon: UserRound },
  { name: "Privacy & data", icon: ShieldCheck },
] as const;

type Props = {
  tab: Exclude<SettingsTab, "Appearance">;
  onTab: (tab: SettingsTab) => void;
  startDay: string;
  onStartDay: (v: string) => void;
  clock: string;
  onClock: (v: string) => void;
  displayName: string;
  email: string;
  openProfile: () => void;
};

const summaries: Record<SettingsTab, string> = {
  General: "A quick overview of your workspace settings.",
  Appearance: "Themes, colours and how your workspace feels.",
  "Calendar & time": "How dates and times appear across your schedule.",
  Notifications: "A home for future reminders and updates.",
  Account: "Your identity and account profile.",
  "Privacy & data": "Future controls for your account data.",
};

export default function BasicSettings({
  tab, onTab, startDay, onStartDay, clock, onClock, displayName, email, openProfile,
}: Props) {
  return (
    <div className="aaa-settings aaa-settings-basic">
      <p className="aaa-eyebrow">Settings / {tab}</p>
      <h1>{tab === "General" ? "Your workspace, your way." : tab}</h1>
      <p className="calendar-subtle">{summaries[tab]}</p>

      {tab === "General" && (
        <div className="aaa-settings-section-grid">
          {SETTINGS_TABS.filter(item => item.name !== "General").map(({ name, icon: Icon }) => (
            <button key={name} className="aaa-settings-section-card" onClick={() => onTab(name)}>
              <span className="aaa-settings-section-icon"><Icon size={20}/></span>
              <span><strong>{name}</strong><small>{summaries[name]}</small></span>
              <ChevronRight size={17}/>
            </button>
          ))}
        </div>
      )}

      {tab === "Calendar & time" && (
        <section className="aaa-settings-panel">
          <h2>Calendar preferences</h2>
          <p className="calendar-subtle">These preferences apply to the calendar immediately and are saved in this browser.</p>
          <div className="aaa-settings-fields">
            <label>
              <span>Week starts on</span>
              <select value={startDay} onChange={(e) => onStartDay(e.target.value)}>
                {["Monday", "Sunday", "Saturday"].map(day => <option key={day}>{day}</option>)}
              </select>
            </label>
            <label>
              <span>Time format</span>
              <select value={clock} onChange={(e) => onClock(e.target.value)}>
                <option>12-hour</option>
                <option>24-hour</option>
              </select>
            </label>
          </div>
        </section>
      )}

      {tab === "Account" && (
        <section className="aaa-settings-panel">
          <h2>Profile</h2>
          <div className="aaa-settings-detail-row"><span>Display name</span><strong>{displayName}</strong></div>
          <div className="aaa-settings-detail-row"><span>Email address</span><strong>{email || "Not available"}</strong></div>
          <button className="aaa-settings-action" onClick={openProfile}>Edit profile <ChevronRight size={16}/></button>
        </section>
      )}

      {tab === "Notifications" && (
        <section className="aaa-settings-panel">
          <h2>Notification preferences</h2>
          <p className="calendar-subtle">A preview of where reminders and alerts will be managed. No notifications are sent from these controls yet.</p>
          <div className="aaa-settings-detail-row"><span>Task reminders</span><small>Planned</small></div>
          <div className="aaa-settings-detail-row"><span>Daily agenda</span><small>Planned</small></div>
          <div className="aaa-settings-detail-row"><span>Progress updates</span><small>Planned</small></div>
        </section>
      )}

      {tab === "Privacy & data" && (
        <section className="aaa-settings-panel">
          <h2>Data controls</h2>
          <p className="calendar-subtle">This is a layout placeholder. Account export and deletion tools are not implemented in this mockup.</p>
          <div className="aaa-settings-detail-row"><span>Export your data</span><small>Planned</small></div>
          <div className="aaa-settings-detail-row"><span>Manage account data</span><small>Planned</small></div>
        </section>
      )}
    </div>
  );
}
