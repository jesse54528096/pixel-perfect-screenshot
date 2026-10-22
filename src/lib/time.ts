// Slots are timestamptz. Shops publish in Taiwan time, so the buyer side renders
// every slot in that zone too (and says so), whatever the browser's own zone is.
export const DISPLAY_TZ = "Asia/Taipei";
export const DISPLAY_TZ_LABEL = "台灣時間";

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dayLabelFormat = new Intl.DateTimeFormat("zh-TW", {
  timeZone: DISPLAY_TZ,
  month: "numeric",
  day: "numeric",
  weekday: "short",
});
const timeFormat = new Intl.DateTimeFormat("zh-TW", {
  timeZone: DISPLAY_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// YYYY-MM-DD of the instant in the display zone, used to group slots by day.
export function dayKey(iso: string) {
  return dayKeyFormat.format(new Date(iso));
}

export function dayLabel(iso: string) {
  return dayLabelFormat.format(new Date(iso));
}

export function timeLabel(iso: string) {
  return timeFormat.format(new Date(iso));
}

export function rangeLabel(startIso: string, endIso: string) {
  return `${dayLabel(startIso)} ${timeLabel(startIso)}–${timeLabel(endIso)}`;
}

const dateFormat = new Intl.DateTimeFormat("zh-TW", {
  timeZone: DISPLAY_TZ,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function dateLabel(iso: string) {
  return dateFormat.format(new Date(iso));
}
