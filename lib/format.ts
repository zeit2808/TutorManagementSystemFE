const locale = "vi-VN";

/** D12: every center runs on Vietnam time (UTC+7, no daylight saving), whatever the browser's zone. */
export const DEFAULT_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_OFFSET_MINUTES = 7 * 60;

const formatters = {
  date: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: DEFAULT_TIME_ZONE }),
  weekday: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: DEFAULT_TIME_ZONE }),
  weekdayShort: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: DEFAULT_TIME_ZONE }),
  time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: DEFAULT_TIME_ZONE }),
};

/** Calendar fields of an instant on the Vietnam clock. */
function vietnamParts(date: Date) {
  const shifted = new Date(date.getTime() + VIETNAM_OFFSET_MINUTES * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return formatters.date.format(typeof value === "string" ? new Date(value) : value);
}

/** Formats a server DateOnly ("2026-10-22") without shifting it through a time zone. */
export function formatDateOnly(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return `${formatters.date.format(date)} ${formatters.time.format(date)}`;
}

export function formatTime(value: string | Date) {
  return formatters.time.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDayMonth(value: string | Date) {
  const parts = vietnamParts(typeof value === "string" ? new Date(value) : value);
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`;
}

export function formatWeekday(value: string | Date, short = false) {
  const date = typeof value === "string" ? new Date(value) : value;
  const text = (short ? formatters.weekdayShort : formatters.weekday).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function minutesBetween(startUtc: string, endUtc: string) {
  return Math.round((new Date(endUtc).getTime() - new Date(startUtc).getTime()) / 60000);
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

export function formatTimeRange(startUtc: string, endUtc: string) {
  return `${formatTime(startUtc)}–${formatTime(endUtc)}`;
}

/** yyyy-MM-dd for <input type="date"> on the Vietnam calendar. */
export function toDateInput(date: Date) {
  const parts = vietnamParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** HH:mm for <input type="time"> on the Vietnam clock. */
export function toTimeInput(date: Date) {
  const parts = vietnamParts(date);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/** Combines Vietnam-time date + time inputs into a UTC ISO instant ("…Z" = +00:00). */
export function localInputsToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - VIETNAM_OFFSET_MINUTES * 60000).toISOString();
}

export function addMinutesUtc(isoUtc: string, minutes: number) {
  return new Date(new Date(isoUtc).getTime() + minutes * 60000).toISOString();
}

/** Midnight (Vietnam time) of the day containing the instant, as a Date. */
export function startOfDay(date: Date) {
  const parts = vietnamParts(date);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - VIETNAM_OFFSET_MINUTES * 60000);
}

/** Monday 00:00 Vietnam time of the week containing the instant (D12: not the browser's zone). */
export function startOfWeek(date: Date) {
  const day = startOfDay(date);
  const weekday = (new Date(day.getTime() + VIETNAM_OFFSET_MINUTES * 60000).getUTCDay() + 6) % 7;
  return addDays(day, -weekday);
}

/** Vietnam has no daylight saving, so a day is always 24 hours. */
export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 3600 * 1000);
}

/** Same day on the Vietnam calendar. */
export function isSameLocalDay(a: Date, b: Date) {
  return toDateInput(a) === toDateInput(b);
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16),
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";
  return parts.slice(-2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

/** +84912345678 → 0912 345 678 for display; anything else is returned unchanged. */
export function formatPhone(value: string | null | undefined) {
  if (!value) return "";
  const match = /^\+84(\d{3})(\d{3})(\d{3})$/.exec(value);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : value;
}

/** "T3 28/10 18:00–19:30" on the Vietnam clock. */
export function formatSlot(startUtc: string, endUtc: string) {
  return `${formatWeekday(startUtc, true)} ${formatDayMonth(startUtc)} ${formatTimeRange(startUtc, endUtc)}`;
}

/** "T3 28/10 18:00" on the Vietnam clock. */
export function formatStartLabel(startUtc: string) {
  return `${formatWeekday(startUtc, true)} ${formatDayMonth(startUtc)} ${formatTime(startUtc)}`;
}

/** 800000 → "800.000đ" (H16: VND, no decimals). */
export function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

/** "2026-03-15" → "15/03/2026" without any time-zone shift (tuition dates are calendar days). */
export function formatIsoDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/** "15/03 – 14/04/2026" for a tuition cycle. */
export function formatPeriod(start: string, end: string) {
  const [, sm, sd] = start.split("-");
  return `${sd}/${sm} – ${formatIsoDate(end)}`;
}

/** Today's calendar date in Vietnam, as yyyy-mm-dd. */
export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** "2026-03" → "Tháng 3/2026". */
export function formatMonth(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m] = value.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** 270 → "4 giờ 30 phút", for teaching time totals. */
export function formatHours(minutes: number) {
  if (minutes <= 0) return "0 giờ";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} giờ` : h === 0 ? `${m} phút` : `${h} giờ ${m} phút`;
}
