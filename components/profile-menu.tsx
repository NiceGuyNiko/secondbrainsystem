"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Copy, CornerUpLeft, Layers, LogOut, Pencil, Plus, RotateCcw, Settings2, Trash2, UserRound, X } from "lucide-react";
import {
  activeProfile, createProfile, defaultPreferences, deleteProfile, duplicateProfile, MAX_PROFILE_NAME, primaryOf, ProfileError,
  renameProfile, suggestProfileName, switchProfile, type EffectiveFeatures, type Settings,
} from "@/lib/settings/model";

type Props = {
  displayName: string;
  email: string;
  settings: Settings;
  effective: EffectiveFeatures;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: (change: (s: Settings) => Settings) => void;
  onNotice: (message: string) => void;
  onAccount: () => void;
  onSettings: () => void;
  demo: boolean;
  onResetDemo: () => void;
  onSignOut: () => void;
};

const SHARED_NOTE = "Profiles change how the app looks and works. Your calendars, events, thoughts, goals and tasks are shared by every profile.";

export default function ProfileMenu(p: Props) {
  const [managing, setManaging] = useState<null | "list" | "create">(null);
  const active = activeProfile(p.settings);
  const profilesOn = p.effective.testProfiles;
  const onTestProfile = profilesOn && !active.isPrimary;
  const close = () => p.onOpenChange(false);
  const use = (id: string) => {
    if (id === active.id) return close();
    p.update((s) => switchProfile(s, id));
    p.onNotice(`Switched to “${p.settings.profiles.find((x) => x.id === id)?.name}”.`);
    close();
  };

  return (
    <div className="aaa-profile">
      <button
        className="aaa-profile-button"
        aria-haspopup="menu"
        aria-expanded={p.open}
        onClick={() => p.onOpenChange(!p.open)}
        title={onTestProfile ? `${p.displayName} — test profile “${active.name}”` : p.displayName}
      >
        <span className="aaa-icon-slot">
          <span className="pr11-avatar">
            <UserRound size={18} />
            {onTestProfile && <span className="aaa-profile-dot" aria-hidden="true" />}
          </span>
        </span>
        <span className="aaa-sidebar-label aaa-profile-text">
          <strong>{p.displayName}</strong>
          {profilesOn ? <small className="aaa-profile-active">Profile: {active.name}</small> : <small>{p.email}</small>}
        </span>
        <ChevronDown className="aaa-sidebar-label" size={15} />
      </button>
      {p.open && (
        <div className="aaa-profile-menu" role="menu" aria-label="Account and profiles">
          {profilesOn && (
            <>
              <div className="aaa-menu-heading" role="presentation">
                <span>Test profiles</span>
                <small className="aaa-badge aaa-badge-beta">BETA</small>
              </div>
              <div className="aaa-profile-list" role="group" aria-label="Switch profile">
                {p.settings.profiles.map((profile) => (
                  <button key={profile.id} role="menuitemradio" aria-checked={profile.id === active.id} onClick={() => use(profile.id)}>
                    <span className="aaa-menu-check">{profile.id === active.id && <Check size={15} />}</span>
                    <span className="aaa-menu-name">{profile.name}</span>
                  </button>
                ))}
              </div>
              {onTestProfile && (
                <button role="menuitem" onClick={() => use(primaryOf(p.settings).id)}>
                  <CornerUpLeft size={16} />
                  Return to Primary
                </button>
              )}
              <button role="menuitem" onClick={() => { setManaging("create"); close(); }}>
                <Plus size={16} />
                New profile…
              </button>
              <button role="menuitem" onClick={() => { setManaging("list"); close(); }}>
                <Layers size={16} />
                Manage profiles…
              </button>
              <div className="aaa-menu-separator" role="separator" />
            </>
          )}
          <button role="menuitem" onClick={() => { p.onAccount(); close(); }}>
            <UserRound size={16} />
            Account
          </button>
          <button role="menuitem" onClick={() => { p.onSettings(); close(); }}>
            <Settings2 size={16} />
            Settings
          </button>
          {p.demo ? (
            <button role="menuitem" onClick={p.onResetDemo}>
              <RotateCcw size={16} />
              Reset demo data
            </button>
          ) : (
            <button role="menuitem" onClick={p.onSignOut}>
              <LogOut size={16} />
              Log out
            </button>
          )}
        </div>
      )}
      {managing && profilesOn && (
        <ManageProfiles settings={p.settings} start={managing} update={p.update} onNotice={p.onNotice} onClose={() => setManaging(null)} />
      )}
    </div>
  );
}

function ManageProfiles({ settings, start, update, onNotice, onClose }: { settings: Settings; start: "list" | "create"; update: Props["update"]; onNotice: Props["onNotice"]; onClose: () => void }) {
  const active = activeProfile(settings);
  const [name, setName] = useState(() => suggestProfileName(settings, "Test profile"));
  const [source, setSource] = useState<"current" | "default">("current");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const createInput = useRef<HTMLInputElement>(null), dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (start === "create" ? createInput.current : dialog.current?.querySelector<HTMLElement>("button"))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [start, onClose]);

  const attempt = (action: () => void) => {
    try {
      action();
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof ProfileError ? e.message : "Something went wrong. Nothing was changed.");
      return false;
    }
  };
  const run = (change: (s: Settings) => Settings) => attempt(() => update((s) => change(s)));
  // Validate against the current settings first, so a bad name shows an error instead of being saved.
  const create = (e: FormEvent) => {
    e.preventDefault();
    let created = "";
    const ok = attempt(() => {
      const { id } = createProfile(settings, name, source === "default" ? defaultPreferences : active.preferences);
      created = id;
      update((s) => {
        const result = createProfile(s, name, source === "default" ? defaultPreferences : activeProfile(s).preferences);
        return switchProfile(result.settings, result.id);
      });
    });
    if (ok && created) {
      onNotice(`Created and switched to “${name.trim()}”.`);
      onClose();
    }
  };

  return (
    <div className="aaa-dialog-backdrop" onClick={onClose}>
      <section ref={dialog} className="aaa-dialog" role="dialog" aria-modal="true" aria-labelledby="profiles-title" onClick={(e) => e.stopPropagation()}>
        <header className="aaa-dialog-header">
          <div>
            <h2 id="profiles-title">Test profiles <small className="aaa-badge aaa-badge-beta">BETA</small></h2>
            <p>{SHARED_NOTE}</p>
          </div>
          <button aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        {error && <p className="aaa-dialog-error" role="alert">{error}</p>}
        <ul className="aaa-profile-rows">
          {settings.profiles.map((profile) => (
            <li key={profile.id} className={profile.id === active.id ? "is-active" : ""}>
              {renaming?.id === profile.id ? (
                <form
                  className="aaa-inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (run((s) => renameProfile(s, profile.id, renaming.name))) setRenaming(null);
                  }}
                >
                  <input aria-label={`New name for ${profile.name}`} autoFocus maxLength={MAX_PROFILE_NAME} value={renaming.name} onChange={(e) => setRenaming({ id: profile.id, name: e.target.value })} />
                  <button type="submit" className="calendar-primary">Save</button>
                  <button type="button" onClick={() => setRenaming(null)}>Cancel</button>
                </form>
              ) : confirmDelete === profile.id ? (
                <div className="aaa-confirm" role="alertdialog" aria-label={`Delete ${profile.name}?`}>
                  <span>Delete “{profile.name}”? Only its settings are removed — your calendars, events, thoughts and tasks are not affected.{profile.id === active.id ? " You’ll return to Primary." : ""}</span>
                  <div>
                    <button
                      className="aaa-danger"
                      autoFocus
                      onClick={() => {
                        if (run((s) => deleteProfile(s, profile.id))) {
                          setConfirmDelete(null);
                          onNotice(`Deleted “${profile.name}”.${profile.id === active.id ? " You’re back on Primary." : ""}`);
                        }
                      }}
                    >
                      Delete profile
                    </button>
                    <button onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="aaa-profile-row-name">
                    <strong>{profile.name}</strong>
                    {profile.isPrimary && <small className="aaa-profile-tag">Can’t be deleted</small>}
                    {profile.id === active.id && <small className="aaa-profile-tag is-active">In use</small>}
                  </span>
                  <span className="aaa-profile-row-actions">
                    {profile.id !== active.id && (
                      <button onClick={() => { if (run((s) => switchProfile(s, profile.id))) onNotice(`Switched to “${profile.name}”.`); }}>Use</button>
                    )}
                    <button aria-label={`Duplicate ${profile.name}`} title="Duplicate settings" onClick={() => {
                      const copyName = suggestProfileName(settings, `${profile.name} copy`);
                      if (attempt(() => duplicateProfile(settings, profile.id, copyName)) && run((s) => duplicateProfile(s, profile.id, copyName).settings)) onNotice(`Duplicated settings as “${copyName}”.`);
                    }}><Copy size={15} /></button>
                    {!profile.isPrimary && (
                      <>
                        <button aria-label={`Rename ${profile.name}`} title="Rename" onClick={() => { setConfirmDelete(null); setRenaming({ id: profile.id, name: profile.name }); }}><Pencil size={15} /></button>
                        <button aria-label={`Delete ${profile.name}`} title="Delete" className="aaa-danger-icon" onClick={() => { setRenaming(null); setConfirmDelete(profile.id); }}><Trash2 size={15} /></button>
                      </>
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <form className="aaa-create-profile" onSubmit={create}>
          <h3>New profile</h3>
          <label>
            Name
            <input ref={createInput} maxLength={MAX_PROFILE_NAME} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Start from
            <select value={source} onChange={(e) => setSource(e.target.value as "current" | "default")}>
              <option value="current">A copy of “{active.name}” settings</option>
              <option value="default">Default settings</option>
            </select>
          </label>
          <button type="submit" className="calendar-primary"><Plus size={15} /> Create and switch</button>
        </form>
      </section>
    </div>
  );
}
