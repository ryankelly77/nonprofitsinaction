import { TZDate } from '@date-fns/tz';

/*
 * Every date and time on this site is San Antonio's.
 *
 * The database holds instants (timestamptz, so UTC). People type and read wall
 * clock times in Central time. This file is the only place the two meet, and
 * tests/time.test.ts holds it to real events from the old calendar and to
 * both daylight-saving changes.
 *
 * The rule that keeps it right: a wall-clock time is always converted with an
 * explicit zone, never with the server's own (Vercel runs in UTC) and never
 * by adding a fixed offset (Central is -6 in winter and -5 in summer).
 */

export const CALENDAR_TZ = 'America/Chicago';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function isTimeString(value: string): boolean {
  return TIME_RE.test(value);
}

/** "2026-11-07" and "18:00" in San Antonio, as the instant they name. */
export function zonedToUtc(date: string, time: string, tz: string = CALENDAR_TZ): Date {
  if (!isDateString(date)) throw new Error(`Not a date: ${date}`);
  if (!isTimeString(time)) throw new Error(`Not a time: ${time}`);
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).getTime());
}

export interface LocalParts {
  /** 2026-11-07 */
  date: string;
  /** 18:00 */
  time: string;
  year: number;
  /** 1 to 12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 is Sunday */
  weekday: number;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short'
    });
    partsFormatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The wall clock in San Antonio at a given instant. */
export function localParts(instant: Date | string, tz: string = CALENDAR_TZ): LocalParts {
  const at = typeof instant === 'string' ? new Date(instant) : instant;
  const bits: Record<string, string> = {};
  for (const p of partsFormatter(tz).formatToParts(at)) bits[p.type] = p.value;
  const year = Number(bits.year);
  const month = Number(bits.month);
  const day = Number(bits.day);
  const hour = Number(bits.hour);
  const minute = Number(bits.minute);
  return {
    date: `${bits.year}-${bits.month}-${bits.day}`,
    time: `${bits.hour}:${bits.minute}`,
    year,
    month,
    day,
    hour,
    minute,
    weekday: WEEKDAYS.indexOf(bits.weekday)
  };
}

/** Today's date in San Antonio. */
export function todayLocal(now: Date = new Date()): string {
  return localParts(now).date;
}

/** Date arithmetic on "YYYY-MM-DD" strings, with no time zone involved. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** The instants a San Antonio day starts and ends: [start, end). */
export function dayRange(date: string): { start: Date; end: Date } {
  return { start: zonedToUtc(date, '00:00'), end: zonedToUtc(addDays(date, 1), '00:00') };
}

/** "2026-11" for the month a date falls in. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function isMonthString(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + by, 1));
  return t.toISOString().slice(0, 7);
}

/** The instants a San Antonio month starts and ends: [start, end). */
export function monthRange(month: string): { start: Date; end: Date } {
  return { start: zonedToUtc(`${month}-01`, '00:00'), end: zonedToUtc(`${shiftMonth(month, 1)}-01`, '00:00') };
}

export interface MonthCell {
  date: string;
  day: number;
}

/** A month laid out Sunday first: leading nulls, then one cell per day. */
export function monthGrid(month: string): Array<MonthCell | null> {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<MonthCell | null> = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d++) cells.push({ date: `${month}-${String(d).padStart(2, '0')}`, day: d });
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function monthName(month: number): string {
  return MONTHS[month - 1];
}

/** "November 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "Saturday, November 7, 2026" for a "YYYY-MM-DD" string. */
export function longDateFromString(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[weekday]}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "Saturday, November 7, 2026" for an instant. */
export function longDate(instant: Date | string): string {
  return longDateFromString(localParts(instant).date);
}

/** "Nov 7" */
export function shortDate(instant: Date | string): string {
  const p = localParts(instant);
  return `${MONTHS[p.month - 1].slice(0, 3)} ${p.day}`;
}

function clock(p: LocalParts): { text: string; meridiem: 'AM' | 'PM' } {
  const meridiem = p.hour < 12 ? 'AM' : 'PM';
  const h = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return { text: `${h}:${String(p.minute).padStart(2, '0')}`, meridiem };
}

/** "6:00 PM" */
export function timeOfDay(instant: Date | string): string {
  const c = clock(localParts(instant));
  return `${c.text} ${c.meridiem}`;
}

/**
 * "6:00 – 10:00 PM", "10:00 AM – 2:00 PM", "All day", or, across days,
 * "6:00 PM – Nov 8, 2:00 AM".
 */
export function timeRange(start: Date | string, end: Date | string, allDay = false): string {
  const s = localParts(start);
  const e = localParts(end);
  if (allDay) {
    const oneDay = s.date === e.date || (e.date === addDays(s.date, 1) && e.time === '00:00');
    return oneDay ? 'All day' : `All day, through ${shortDate(end)}`;
  }
  const a = clock(s);
  const b = clock(e);
  if (s.date !== e.date) return `${a.text} ${a.meridiem} – ${shortDate(end)}, ${b.text} ${b.meridiem}`;
  if (s.time === e.time) return `${a.text} ${a.meridiem}`;
  if (a.meridiem === b.meridiem) return `${a.text} – ${b.text} ${b.meridiem}`;
  return `${a.text} ${a.meridiem} – ${b.text} ${b.meridiem}`;
}

/** The pieces of the date tile: SAT / 7 / NOV. */
export function dateTile(instant: Date | string): { weekday: string; day: number; month: string; year: number } {
  const p = localParts(instant);
  return {
    weekday: WEEKDAYS[p.weekday].toUpperCase(),
    day: p.day,
    month: MONTHS[p.month - 1].slice(0, 3).toUpperCase(),
    year: p.year
  };
}

/** "2026-11-07T18:00:00-06:00": the instant written in San Antonio's time, for schema.org. */
export function isoWithOffset(instant: Date | string, tz: string = CALENDAR_TZ): string {
  const at = typeof instant === 'string' ? new Date(instant) : instant;
  const p = localParts(at, tz);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  const offsetMin = Math.round((asIfUtc - Math.floor(at.getTime() / 60000) * 60000) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  return `${p.date}T${p.time}:00${off}`;
}

/** Whether an event has finished, as of now unless told otherwise. */
export function hasEnded(endsAt: string, at: number = Date.now()): boolean {
  return Date.parse(endsAt) < at;
}
