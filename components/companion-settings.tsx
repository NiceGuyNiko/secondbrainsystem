"use client";
import type {CompanionPreferences,CompanionTool} from "@/lib/companion-config";
import type {AgendaPreference} from "@/lib/agenda-state";
export default function CompanionSettings({options,onChange,preference,onPreference}:{
 options:CompanionPreferences;onChange:(patch:Partial<CompanionPreferences>)=>void;
 preference:AgendaPreference;onPreference:(value:AgendaPreference)=>void;
}){
 const c=options;
 const toolOptions:CompanionTool[]=["agenda","context","thoughts"];
 return <div className="aaa-settings-panel aaa-companion-settings">
  <h2>The Companion · Play-test controls</h2>
  <p className="calendar-muted">Choices apply immediately and are saved in the active test profile. Individual Context section layouts are stored locally on this device for preview testing.</p>
  <label>Opening behavior<select value={preference} onChange={e=>onPreference(e.target.value as AgendaPreference)}>
    <option value="toggle">Toggle — remember last pinned state</option><option value="pin">Pin — floating first</option><option value="column">Column — always docked</option>
  </select></label>
  <label>Launcher<select value={c.launcher} onChange={e=>onChange({launcher:e.target.value as CompanionPreferences["launcher"]})}>
    <option value="top">Top-right square</option><option value="edge">Right-edge handle</option>
  </select></label>
  <label>Second tool drawer (also controlled by the pull handle)<select value={c.layout} onChange={e=>onChange({layout:e.target.value as CompanionPreferences["layout"]})}>
    <option value="split">Expanded — show both tools</option><option value="single">Collapsed — show only the selected tab</option>
  </select></label>
  <label>When both panes select the same tool
    <select value={c.matchingTool} onChange={e=>onChange({
      matchingTool:e.target.value as CompanionPreferences["matchingTool"],
      ...(e.target.value==="swap"&&c.primary===c.secondary?{secondary:c.primary==="agenda"?"context":"agenda"}:{})
    })}>
      <option value="duplicate">Allow duplicates — two of the same tool</option>
      <option value="swap">Swap the panes (original preview behavior)</option>
    </select>
  </label>
  <label className="aaa-companion-check"><input type="checkbox" checked={c.resizableColumn}
    onChange={e=>onChange({resizableColumn:e.target.checked})}/> Drag to resize docked Companion column</label>
  <label>Docked Companion width: {c.widthPx}px
    <input aria-label="Companion column width" type="range" min="300" max="720" step="10"
      value={c.widthPx} onChange={e=>onChange({widthPx:Number(e.target.value)})}/>
  </label>
  <label>Starting header tab<select value={c.primary} onChange={e=>onChange({primary:e.target.value as CompanionTool})}>{toolOptions.map(t=><option value={t} key={t}>{t}</option>)}</select></label>
  <label>Drawer tool<select value={c.secondary} onChange={e=>onChange({secondary:e.target.value as CompanionTool})}>{toolOptions.filter(t=>c.matchingTool==="duplicate"||t!==c.primary).map(t=><option key={t} value={t}>{t}</option>)}</select></label>
  <label>Top section height: {c.splitPercent}%<input aria-label="Top section percentage" type="range" min="25" max="75" value={c.splitPercent} onChange={e=>onChange({splitPercent:Number(e.target.value)})}/></label>
  <label>Day navigation<select value={c.jump} onChange={e=>onChange({jump:e.target.value as CompanionPreferences["jump"]})}>
    <option value="first">Jump to first timed block</option><option value="midnight">Start at midnight</option>
  </select></label>
  <label>Context reference<select value={c.follow} onChange={e=>onChange({follow:e.target.value as CompanionPreferences["follow"]})}>
    <option value="page">Follow active page unless locked</option><option value="workspace">Workspace overview</option>
  </select></label>
  <label>Section visibility<select value={c.visibility} onChange={e=>onChange({visibility:e.target.value as CompanionPreferences["visibility"]})}>
    <option value="rules">Configurable rules</option><option value="empty">Hide empty sections</option><option value="manual">Manual visibility only</option>
  </select></label>
  <label className="aaa-companion-check"><input type="checkbox" checked={c.quickLink} onChange={e=>onChange({quickLink:e.target.checked})}/> Suggest linking captured Thoughts to the current reference</label>
  <button className="calendar-panel rounded-lg px-3 py-2" onClick={()=>onChange({layout:"single",primary:"agenda",secondary:"context",matchingTool:"duplicate",widthPx:380,resizableColumn:true,splitPercent:52,jump:"first",visibility:"rules",follow:"page",quickLink:true,launcher:"top"})}>Restore recommended defaults</button>
 </div>;
}