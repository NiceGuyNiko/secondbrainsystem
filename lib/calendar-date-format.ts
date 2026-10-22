export type CalendarDateFormat = "long" | "friendly" | "compact";

export const defaultCalendarDateFormat: CalendarDateFormat = "long";

export function parseCalendarDateFormat(value: unknown): CalendarDateFormat {
  return value === "long" || value === "friendly" || value === "compact"
    ? value : defaultCalendarDateFormat;
}

/** Format a date-only ISO value in local calendar time, never via a UTC conversion. */
export function formatCalendarDate(iso: string, format: CalendarDateFormat = defaultCalendarDateFormat): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "Choose date";
  if (format === "compact") return iso;
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA",
    format === "friendly"
      ? {month:"long",day:"numeric",year:"numeric"}
      : {weekday:"long",month:"long",day:"numeric",year:"numeric"});
}
