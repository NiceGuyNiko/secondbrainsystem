"use client";
import { useEffect, useRef, useState } from "react";
import {
  packWeek,
  occurrenceKey,
  categoryColours,
  type Occurrence,
  type CalendarEvent,
} from "@/lib/calendar-layout";
export default function MonthCalendar({
  days,
  cursor,
  today,
  occurrences,
  colour,
  format,
  hideTimes,
  onOpen,
  onDay,
  onContext,
  onMove,
  editMode,
}: {
  days: string[];
  cursor: string;
  today: string;
  occurrences: Occurrence[];
  colour: (e: CalendarEvent) => string;
  format: (s: string) => string;
  hideTimes: boolean;
  onOpen: (d: string, e?: CalendarEvent) => void;
  onDay: (d: string) => void;
  onContext: (e: React.MouseEvent, event: CalendarEvent, date: string) => void;
  onMove: (id: string, date: string) => void;
  editMode: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState(3);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () =>
      setCapacity(
        Math.max(
          0,
          Math.floor(((el.clientHeight - 30) / (days.length / 7) - 56) / 20),
        ),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [days.length]);
  const date = (s: string) => new Date(s + "T12:00:00");
  return (
    <div
      ref={root}
      className="aaa-month"
      role="region"
      aria-label="Month calendar"
    >
      <div className="aaa-weekdays">
        {days.slice(0, 7).map((d) => (
          <span key={d}>
            {date(d).toLocaleDateString("en", { weekday: "short" })}
          </span>
        ))}
      </div>
      <div
        className="aaa-month-weeks"
        style={{ gridTemplateRows: `repeat(${days.length / 7},minmax(0,1fr))` }}
      >
        {Array.from({ length: days.length / 7 }, (_, week) => {
          const row = days.slice(week * 7, week * 7 + 7);
          const { bars, columns } = packWeek(
            row,
            occurrences.filter((o) => o.date <= row[6] && o.endDate >= row[0]),
            capacity,
          );
          return (
            <div key={row[0]} className="aaa-month-week">
              <div className="aaa-day-cells">
                {columns.map(({ date: d, shown, hidden }) => (
                  <div
                    key={d}
                    className={`aaa-month-day ${d.slice(0, 7) !== cursor.slice(0, 7) ? "aaa-outside" : ""}`}
                    onDragOver={(e) => {
                      if (editMode) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (editMode)
                        onMove(e.dataTransfer.getData("text/plain"), d);
                    }}
                  >
                    <button
                      className="aaa-date"
                      aria-label={`Open ${d}`}
                      onClick={() => onDay(d)}
                    >
                      <span className={d === today ? "today-number" : ""}>
                        {date(d).getDate()}
                      </span>
                      {(d === days[0] || d.endsWith("-01")) && (
                        <small>
                          {date(d).toLocaleDateString("en", { month: "long" })}
                        </small>
                      )}
                    </button>
                    <div className="aaa-cell-events">
                      {shown.map(({ o, lane }) => (
                        <button
                          key={occurrenceKey(o)}
                          className="aaa-bullet"
                          style={{ top: lane * 20 }}
                          title={o.event.title}
                          draggable={editMode && !o.event.locked}
                          onDragStart={(e) =>
                            e.dataTransfer.setData(
                              "text/plain",
                              o.event.dbId || "",
                            )
                          }
                          onClick={() =>
                            onOpen(o.sourceDate || o.date, o.event)
                          }
                          onContextMenu={(e) =>
                            onContext(e, o.event, o.sourceDate || o.date)
                          }
                        >
                          <i
                            style={{
                              background: categoryColours[colour(o.event)],
                            }}
                          />
                          <span>{o.event.title}</span>
                          {!hideTimes && (
                            <time>{format(o.start || o.event.start)}</time>
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="aaa-day-footer">
                      <button
                        aria-label={`New event for ${d}`}
                        onClick={() => onOpen(d)}
                      >
                        +
                      </button>
                      {hidden.length > 0 && (
                        <button
                          onClick={() => onDay(d)}
                          aria-label={`See all events for ${d}; ${hidden.length} hidden`}
                        >
                          See more ({hidden.length}){" "}
                          <span className="aaa-hidden-dots">
                            {[...new Set(hidden.map((o) => colour(o.event)))]
                              .slice(0, 3)
                              .map((c) => (
                                <i
                                  key={c}
                                  style={{ background: categoryColours[c] }}
                                />
                              ))}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="aaa-ribbon-layer">
                {bars.map(({ o, start, end, lane }) => (
                  <button
                    key={occurrenceKey(o)}
                    className={`event-chip event-${colour(o.event)} aaa-month-ribbon`}
                    style={{
                      gridColumn: `${start + 1}/${end + 1}`,
                      top: lane * 20,
                    }}
                    title={o.event.title}
                    draggable={editMode && !o.event.locked}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/plain", o.event.dbId || "")
                    }
                    onClick={() => onOpen(o.sourceDate || o.date, o.event)}
                    onContextMenu={(e) =>
                      onContext(e, o.event, o.sourceDate || o.date)
                    }
                  >
                    <span>{o.event.title}</span>
                    {!hideTimes && !o.event.allDay && (
                      <time>{format(o.start || o.event.start)}</time>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
