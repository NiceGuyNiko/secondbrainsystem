"use client";
import { useEffect, useRef, useState } from "react";
import { Pin, Plus, X, LocateFixed, ExternalLink } from "lucide-react";
import {canPin, type AgendaPreference} from "@/lib/agenda-state";
import {
  timedLanes,
  occurrenceKey,
  type Occurrence,
  type CalendarEvent,
  type CalendarTask,
} from "@/lib/calendar-layout";
export type AgendaMode = "closed" | "overlay" | "pinned";
export default function Agenda({
  preference,
  mode,
  onMode,
  today,
  now,
  timeZone,
  occurrences,
  colour,
  format,
  onNew,
  onToggleTask,
  onOpenThought,
}: {
  preference: AgendaPreference;
  mode: AgendaMode;
  onMode: (m: AgendaMode) => void;
  today: string;
  now: Date;
  timeZone: string;
  occurrences: Occurrence[];
  colour: (e: CalendarEvent) => string;
  format: (t: string) => string;
  onNew: () => void;
  onToggleTask: (event: CalendarEvent, task: CalendarTask) => Promise<void>;
  onOpenThought?: (id: string) => void;
}) {
  const scroll = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLElement>(null);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const clockTime =
    (parts.find((p) => p.type === "hour")?.value || "00") +
    ":" +
    (parts.find((p) => p.type === "minute")?.value || "00");
  const minute =
    Number(clockTime.slice(0, 2)) * 60 + Number(clockTime.slice(3));
  const minuteRef = useRef(minute);
  minuteRef.current = minute;
  const jump = () =>
    scroll.current?.scrollTo({
      top: Math.max(0, minute - 120),
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  useEffect(() => {
    if (mode === "closed") return;
    const prior = document.activeElement as HTMLElement;
    const node = scroll.current;
    if (node) node.scrollTop = Math.max(0, minuteRef.current - 120);
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        onMode("closed");
      }
      if (
        e.key === "Tab" &&
        (mode === "overlay" || matchMedia("(max-width: 767px)").matches)
      ) {
        const buttons =
          panel.current?.querySelectorAll<HTMLElement>("button,input");
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", close);
    panel.current?.querySelector("button")?.focus();
    return () => {
      window.removeEventListener("keydown", close);
      prior?.focus();
    };
  }, [mode, today, onMode]);
  if (mode === "closed") return null;
  const active = occurrences.find((o) => occurrenceKey(o) === selected);
  const time = (o: Occurrence) =>
    o.event.allDay
      ? "All day"
      : `${format(o.start || o.event.start)} – ${format(o.end || o.event.end)}`;
  return (
    <>
      {
        <button
          className={`aaa-agenda-backdrop ${mode === "pinned" ? "aaa-pinned-backdrop" : ""}`}
          aria-label="Dismiss The Agenda"
          onClick={() => onMode("closed")}
        />
      }
      <aside
        ref={panel}
        className={`aaa-agenda aaa-agenda-${mode}`}
        aria-label="The Agenda"
        role={mode === "overlay" ? "dialog" : "complementary"}
        aria-modal={mode === "overlay" ? true : undefined}
      >
        <header onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;e.currentTarget.dataset.swipeX=String(e.clientX);e.currentTarget.setPointerCapture(e.pointerId)}} onPointerUp={e=>{const start=e.currentTarget.dataset.swipeX;delete e.currentTarget.dataset.swipeX;if(start&&e.clientX-Number(start)>65)onMode("closed")}}>
          <div className="aaa-agenda-heading">
            <span>THE AGENDA</span>
            <div>
              {canPin(preference, mode) && <button
                data-desktop-pin
                className={mode === "pinned" ? "aaa-pin-active" : ""}
                aria-label={mode === "pinned" ? "Unpin The Agenda" : "Pin The Agenda"}
                aria-pressed={mode === "pinned"}
                onClick={() => onMode(mode === "pinned" ? "overlay" : "pinned")}
              >
                <Pin size={17} />
              </button>}
              <button
                className={preference === "column" || mode === "pinned" ? "aaa-close aaa-mobile-only" : "aaa-close"}
                aria-label="Close The Agenda"
                onClick={() => onMode("closed")}
              >
                <X size={17} />
              </button>
            </div>
          </div>
          <h2>
            {new Date(today + "T12:00:00").toLocaleDateString("en-CA", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h2>
          <div className="aaa-agenda-actions">
            <small>{occurrences.length} visible blocks</small>
            <button onClick={onNew}>
              <Plus size={14} />
              New event
            </button>
            <button onClick={jump}>
              <LocateFixed size={14} />
              Now {format(clockTime)}
            </button>
          </div>
        </header>
        {occurrences.some((o) => o.event.allDay) && (
          <div className="aaa-all-day">
            <small>All day</small>
            {occurrences
              .filter((o) => o.event.allDay)
              .map((o) => (
                <button
                  key={occurrenceKey(o)}
                  className={`event-chip event-${colour(o.event)}`}
                  onClick={() => setSelected(occurrenceKey(o))}
                >
                  {o.event.title}
                </button>
              ))}
          </div>
        )}
        <div ref={scroll} className="aaa-agenda-scroll">
          <div className="aaa-agenda-timegrid">
            {Array.from({ length: 24 }, (_, h) => (
              <div className="aaa-agenda-hour" key={h}>
                <span>{format(`${String(h).padStart(2, "0")}:00`)}</span>
              </div>
            ))}
            <span className="aaa-day-end">{format("23:59")}</span>
            <div className="aaa-agenda-events">
              {timedLanes(occurrences, today).map(
                ({ o, start, end, lane, lanes }) => (
                  <button
                    key={occurrenceKey(o)}
                    className={`event-chip event-${colour(o.event)} aaa-agenda-event`}
                    style={{
                      top: start,
                      height: Math.max(20, end - start),
                      left: `${(lane / lanes) * 100}%`,
                      width: `${100 / lanes}%`,
                    }}
                    onClick={() => setSelected(occurrenceKey(o))}
                  >
                    <strong>{o.event.title}</strong>
                    <small>{time(o)}</small>
                    <small>
                      {o.event.tasks.length
                        ? `${o.event.tasks.filter((t) => t.done).length}/${o.event.tasks.length} tasks`
                        : ""}
                    </small>
                  </button>
                ),
              )}
              <div className="aaa-agenda-now" style={{ top: minute }}>
                <i />
              </div>
            </div>
          </div>
        </div>
        {active && (
          <div className="aaa-quick-details">
            <div className="aaa-options">
              <h3>{active.event.title}</h3>
              <button
                aria-label="Close block details"
                onClick={() => setSelected(null)}
              >
                <X size={17} />
              </button>
            </div>
            <p>
              {time(active)} · {active.event.category}
            </p>
            {active.event.holidayInfo && <p>{active.event.holidayInfo}</p>}
            {active.event.thoughtId && (
              <button
                className="calendar-accent"
                onClick={() => onOpenThought?.(active.event.thoughtId!)}
              >
                <ExternalLink size={14} />
                Open working page
              </button>
            )}
            {active.event.tasks.map((task) => (
              <div className="aaa-agenda-task" key={task.taskId || task.id}>
                <input
                  aria-label={`Complete ${task.title}`}
                  type="checkbox"
                  disabled={busy}
                  checked={task.done}
                  onChange={async () => {
                    setBusy(true);
                    try {
                      await onToggleTask(active.event, task);
                      setError("");
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Unable to save task",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <span className={task.done ? "line-through" : ""}>
                  {task.title}
                </span>
                {(task.workingId || task.taskId) && (
                  <button
                    aria-label={`Open ${task.title} working page`}
                    onClick={() =>
                      onOpenThought?.(task.workingId || task.taskId!)
                    }
                  >
                    <ExternalLink size={15} />
                  </button>
                )}
              </div>
            ))}
            {!active.event.tasks.length && (
              <p className="calendar-muted">No tasks linked to this block.</p>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        )}
      </aside>
    </>
  );
}
