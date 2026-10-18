"use client";
import { useState } from "react";
import {
  ArrowUpRight, BookOpen, ChevronLeft, CircleHelp, Link2, LockKeyhole, Maximize2,
  MessageSquare, PanelRightClose, Pin, PinOff, StickyNote, X,
} from "lucide-react";
import { recordCode, recordTitle, type PlanningRecord } from "@/lib/planning";
import { type Thought } from "@/lib/thoughts";
import { recordProperties, editable, type DatabaseProperty, type PropertyValues } from "@/lib/database-property-model";
import { categoryForKind, type DatabaseCategory } from "@/lib/database-categories";
import DatabasePropertyEditor from "./database-property-editor";
import InlineDatabaseCell from "./database-inline-cell";
import HelpTip from "./database-help-tip";

type Tab = "Properties" | "Connections" | "Thoughts" | "Feedback" | "Questions";
const tabs: { name: Tab; help: string }[] = [
  { name: "Properties", help: "Edit properties belonging to the selected canonical database page." },
  { name: "Connections", help: "View existing links to other pages. Custom Relation links will become editable in Phase 3." },
  { name: "Thoughts", help: "Review notes stored on this page; richer Thought links will be connected in a later phase." },
  { name: "Feedback", help: "Future review and beta-reader comments on the selected page." },
  { name: "Questions", help: "Future contextual questions and author-reviewed continuity suggestions." },
];

export default function DatabaseCompanion({
  record, thoughts, definitions, open, docked, onOpen, onClose, onDocked,
  onFullPage, onSaveField, onSaveValue, onNavigate,
}: {
  record: PlanningRecord | null;
  thoughts: Thought[];
  definitions: DatabaseProperty[];
  open: boolean;
  docked: boolean;
  onOpen: () => void;
  onClose: () => void;
  onDocked: (value: boolean) => void;
  onFullPage: () => void;
  onSaveField: (field: "summary" | "status", value: string) => Promise<void>;
  onSaveValue: (prop: DatabaseProperty, value: PropertyValues[string]) => Promise<void>;
  onNavigate: (category: DatabaseCategory, id: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("Properties");
  const source = record ? thoughts.find((thought) => thought.id === record.thought_id) : null;
  const title = record ? recordTitle(record, thoughts) : "";
  const connections = record ? [
    ["Workspace",record.workspace_id],["Event",record.event_id],["Character",record.character_id],
    ["Project",record.project_id],["Goal",record.goal_id],["Working page",record.working_id],
  ].filter((link):link is [string,string]=>Boolean(link[1])) : [];

  return <>
    {!open && <button type="button" className="aaa-companion-reopen" onClick={onOpen}>
      <BookOpen size={16}/> Open The Companion
    </button>}
    {open && <aside className={"aaa-companion "+(docked?"aaa-companion-docked":"aaa-companion-overlay")} aria-label="The Companion">
      <div className="aaa-companion-header">
        <div className="aaa-companion-brand"><BookOpen size={17}/><span>THE COMPANION</span></div>
        <div className="aaa-companion-tools">
          <button type="button" title={docked?"Unpin to overlay":"Pin as column"} aria-label={docked?"Unpin Companion":"Pin Companion"} onClick={()=>onDocked(!docked)}>
            {docked?<PinOff size={17}/>:<Pin size={17}/>}
          </button>
          <button type="button" title="Close The Companion" aria-label="Close The Companion" onClick={onClose}><X size={17}/></button>
        </div>
      </div>
      {record ? <>
        <div className="aaa-companion-record">
          <span className="aaa-db-code">{recordCode(record)}</span>
          <button type="button" className="aaa-companion-record-title" onClick={onFullPage} title="Open full record page">
            {title}<ArrowUpRight size={16}/>
          </button>
          <p>Canonical {record.kind} page</p>
          <button type="button" className="aaa-companion-full" onClick={onFullPage}><Maximize2 size={14}/> Open full page</button>
        </div>
        <div className="aaa-companion-tabs" role="tablist" aria-label="Companion content">
          {tabs.map((item)=><button type="button" role="tab" key={item.name} aria-selected={tab===item.name}
            className={tab===item.name?"active":""} onClick={()=>setTab(item.name)} title={item.help}>{item.name}</button>)}
        </div>
        <div className="aaa-companion-content">
          {tab==="Properties"&&<>
            <div className="aaa-companion-section-head"><strong>Built-in properties</strong><HelpTip subject="Built-in properties">These fields belong to the original canonical record and are shared with Planning, Workspaces and other views.</HelpTip></div>
            <div className="aaa-companion-attribute">
              <label>Summary</label>
              <InlineDatabaseCell label="Summary" type="long_text" value={record.data.summary??""} onSave={(v)=>onSaveField("summary",String(v??""))}/>
            </div>
            <div className="aaa-companion-attribute">
              <label>Status</label>
              <InlineDatabaseCell label="Status" type="select" options={["idea","developing","canon","superseded"]}
                value={record.data.status??"idea"} onSave={(v)=>onSaveField("status",String(v??"idea"))}/>
            </div>
            <div className="aaa-companion-section-head"><strong>Custom properties</strong><HelpTip subject="Custom properties">Defined once per database and stored on the canonical record by a permanent property ID.</HelpTip></div>
            {definitions.filter((p)=>!p.archived_at).map((p)=>
              editable(p)
                ? <DatabasePropertyEditor key={record.thought_id+":"+p.id} property={p}
                    value={recordProperties(record)[p.id]} onSave={(value)=>onSaveValue(p,value)}/>
                : <div className="aaa-db-pending-property" key={p.id}><strong>{p.label}</strong><small>
                    {p.type==="relation"?"Page linking is enabled in Phase 3.":"Rollup calculations are enabled in Phases 3–4."}
                  </small></div>
            )}
            {!definitions.length&&<p className="aaa-db-no-content">Choose Properties in the table toolbar to create a custom field.</p>}
          </>}
          {tab==="Connections"&&<>
            {connections.map(([label,id])=>{
              const related=thoughts.find((item)=>item.id===id);
              const linkedRecordId=related ? id : null;
              return <div key={label+id} className="aaa-db-linkrow"><span>{label}</span>
                {linkedRecordId && <button type="button" onClick={()=>{
                  // Only supported canonical kinds should switch database views.
                  const category=categoryForKind((record.kind==="perspective"&&label==="Event"?"event":record.kind==="perspective"&&label==="Character"?"character":record.kind) as PlanningRecord["kind"]);
                  if(category)onNavigate(category,linkedRecordId);
                }}><Link2 size={14}/>{related?.title||id.slice(0,8)}</button>}
                {!linkedRecordId&&<small>{id.slice(0,8)}</small>}
              </div>;
            })}
            {definitions.filter((p)=>p.type==="relation").map((p)=><div className="aaa-db-linkrow" key={p.id}>
              <span>{p.label}</span><small>Allowed database types: {p.config.target_databases?.join(", ")||"none"}</small>
              <small>Clickable page links available in Phase 3</small>
            </div>)}
            {!connections.length&&!definitions.some(p=>p.type==="relation")&&<p className="aaa-db-no-content">No connections recorded yet.</p>}
          </>}
          {tab==="Thoughts"&&<>
            {source?.content.blocks?.filter(b=>b.text.trim()).map((block)=><p className="aaa-db-note" key={block.id}>{block.text}</p>)}
            {!source?.content.blocks?.some(b=>b.text.trim())&&<p className="aaa-db-no-content">No written notes on this page yet. Linked Thoughts are planned for a later phase.</p>}
          </>}
          {tab==="Feedback"&&<div className="aaa-companion-soon"><MessageSquare size={22}/>
            <strong>Feedback is coming</strong><p>Review comments and beta-reader feedback will attach to this page without changing its canonical data.</p>
          </div>}
          {tab==="Questions"&&<div className="aaa-companion-soon"><CircleHelp size={22}/>
            <strong>Contextual questions</strong><p>Future continuity suggestions can be reviewed here, with provenance and links to the affected records.</p>
          </div>}
        </div>
        <div className="aaa-companion-foot"><LockKeyhole size={13}/> {record.thought_id.slice(0,13)} · Same canonical record</div>
      </>:<div className="aaa-companion-soon aaa-companion-prompt">
        <StickyNote size={26}/><strong>Select a record</strong><p>Click a record name to open its full page, or click any editable cell for a quick change.</p>
        <button type="button" onClick={onClose}><ChevronLeft size={14}/> Close panel</button>
      </div>}
    </aside>}
  </>;
}
