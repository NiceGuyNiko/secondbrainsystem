export type CalendarTask = {
  id: number;
  title: string;
  done: boolean;
  project: string;
  taskId?: string;
  workingId?: string;
};
export type CalendarEvent = {
  thoughtId?: string;
  dbId?: string;
  id: number;
  title: string;
  date: string;
  endDate: string;
  start: string;
  end: string;
  category: string;
  kind: "block" | "event" | "due" | "shift";
  locked?: boolean;
  repeat?: "none" | "daily" | "weekly" | "monthly" | "yearly";
  repeatEvery?: number;
  repeatUntil?: string;
  repeatCount?: number;
  allDay?: boolean;
  travelMinutes?: number;
  timeZone?: string;
  exceptions?: string[];
  tasks: CalendarTask[];
};
export type Occurrence = {
  event: CalendarEvent;
  date: string;
  endDate: string;
  start?: string;
  end?: string;
  sourceDate?: string;
};
export const occurrenceKey = (o: Occurrence) =>
  (o.event.dbId || String(o.event.id)) + ":" + (o.sourceDate || o.date);
export const categoryColours: Record<string, string> = {
  blue: "#63A9FF",
  green: "#6BCB93",
  orange: "#FFB365",
  purple: "#BA9BFF",
  pink: "#F58AB7",
  teal: "#65CFC4",
};
export function packWeek(
  days: string[],
  occurrences: Occurrence[],
  capacity: number,
) {
  const ribbons = occurrences
    .filter((o) => o.event.allDay || o.endDate > o.date)
    .map((o) => ({
      o,
      start: Math.max(
        0,
        days.findIndex((d) => d >= o.date),
      ),
      end: days.findIndex((d) => d > o.endDate),
    }))
    .map((e) => ({ ...e, end: e.end < 0 ? 7 : e.end }))
    .sort(
      (a, b) =>
        b.end - b.start - (a.end - a.start) ||
        a.o.date.localeCompare(b.o.date) ||
        occurrenceKey(a.o).localeCompare(occurrenceKey(b.o)),
    );
  const occupied: boolean[][] = [];
  const bars = ribbons.map((r) => {
    let lane = 0;
    while (
      occupied[lane]?.some(
        (taken, col) => taken && col >= r.start && col < r.end,
      )
    )
      lane++;
    occupied[lane] ??= Array(7).fill(false);
    for (let col = r.start; col < r.end; col++) occupied[lane][col] = true;
    return { ...r, lane };
  });
  const columns = days.map((date, col) => {
    const bullets = occurrences
      .filter((o) => !o.event.allDay && o.date === o.endDate && o.date === date)
      .sort(
        (a, b) =>
          (a.start || a.event.start).localeCompare(b.start || b.event.start) ||
          occurrenceKey(a).localeCompare(occurrenceKey(b)),
      );
    const free = Array.from({ length: capacity }, (_, i) => i).filter(
      (i) => !occupied[i]?.[col],
    );
    const shown = bullets
      .slice(0, free.length)
      .map((o, i) => ({ o, lane: free[i] }));
    const hidden = [
      ...bars
        .filter((b) => b.start <= col && col < b.end && b.lane >= capacity)
        .map((b) => b.o),
      ...bullets.slice(free.length),
    ];
    return { date, shown, hidden };
  });
  return { bars: bars.filter((b) => b.lane < capacity), columns };
}
export function timedLanes(occurrences: Occurrence[], day: string) {
  const minutes = (s: string) =>
    Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const entries = occurrences
    .filter((o) => !o.event.allDay && o.date <= day && o.endDate >= day)
    .map((o) => ({
      o,
      start: o.date < day ? 0 : minutes(o.start || o.event.start),
      end: o.endDate > day ? 1440 : minutes(o.end || o.event.end),
    }))
    .filter((e) => e.end > e.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: {
    o: Occurrence;
    start: number;
    end: number;
    lane: number;
    lanes: number;
  }[] = [];
  let group: typeof out = [];
  let end = 0;
  const flush = () => {
    const lanes = Math.max(0, ...group.map((e) => e.lane)) + 1;
    out.push(...group.map((e) => ({ ...e, lanes })));
    group = [];
    end = 0;
  };
  for (const e of entries) {
    if (group.length && e.start >= end) flush();
    const occupied = new Set(
      group.filter((g) => g.end > e.start).map((g) => g.lane),
    );
    let lane = 0;
    while (occupied.has(lane)) lane++;
    group.push({ ...e, lane, lanes: 1 });
    end = Math.max(end, e.end);
  }
  flush();
  return out;
}
