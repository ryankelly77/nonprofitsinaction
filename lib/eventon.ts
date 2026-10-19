import { nameKey } from './names.ts';
import { slugify } from './slug.ts';
import { addDays, localParts, zonedToUtc } from './time.ts';

/*
 * Reading the WordPress export (scripts/npia-export.php output) into the new
 * model. Pure functions, no database: scripts/import-eventon.ts does the
 * writing, tests/eventon.test.ts holds these to known events.
 *
 * THE TIME PROBLEM. EventON stores start and end as unix numbers in
 * evcal_srow / evcal_erow, but depending on version and on how an event was
 * saved, the number is either the real instant or the San Antonio wall-clock
 * time written as if it were UTC (6:00 PM stored as 18:00Z). The Gravity
 * Forms bridge on this site also had a time zone bug for a while. So nothing
 * here assumes which one an event used. Every event the export can check
 * (the submitter's own typed date and time in its Gravity Forms entry, or a
 * known fixture) is checked, and the export as a whole is judged by those.
 * An event whose stored time disagrees with what was typed takes the typed
 * time and is flagged for a person to confirm.
 */

export type TimeReading = 'instant' | 'wallclock';

/** The two ways to read an EventON number, as an instant. */
export function readEventonTime(unix: number, how: TimeReading): Date {
  if (how === 'instant') return new Date(unix * 1000);
  // The number is the wall clock written as UTC: take its UTC parts as San Antonio's.
  const asUtc = new Date(unix * 1000);
  const date = asUtc.toISOString().slice(0, 10);
  const time = asUtc.toISOString().slice(11, 16);
  return zonedToUtc(date, time);
}

// ---------------------------------------------------------------------------
// Export shape (what npia-export.php prints)
// ---------------------------------------------------------------------------

export interface ExportTerm {
  taxonomy: string;
  term_id: number;
  slug: string;
  name: string;
  description?: string;
  term_meta?: Record<string, unknown[]>;
  evo_meta?: Record<string, unknown> | null;
}

export interface ExportEvent {
  id: number;
  status: string;
  title: string;
  slug: string;
  permalink?: string;
  content: string;
  excerpt?: string;
  date_gmt: string;
  modified_gmt?: string;
  featured_image: string | null;
  terms: Array<{ taxonomy: string; term_id: number; slug: string; name: string }>;
  meta: Record<string, unknown[]>;
}

export interface ExportForm {
  id: number;
  title: string;
  is_listing: boolean;
  fields: Array<{ id: string; type: string; label: string; inputs: Array<{ id: string; label: string }> }>;
}

export interface EventonExport {
  site: { timezone_string?: string; home_url?: string };
  events: ExportEvent[];
  terms: ExportTerm[];
  forms: ExportForm[];
  entries: Array<Record<string, unknown>>;
}

export function metaOne(meta: Record<string, unknown[]> | undefined, key: string): string | null {
  const v = meta?.[key]?.[0];
  if (v === undefined || v === null || v === '') return null;
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Post content (HTML, WPBakery shortcodes) as plain paragraphs. */
export function plainText(html: string): string | null {
  const text = decodeEntities(
    html
      .replace(/\[\/?[a-z_]+[^\]]*\]/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length ? text.slice(0, 2000) : null;
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

/** Location terms that are not places. */
const ONLINE = new Set(['online', 'virtual', 'facebooklive', 'instagramlive', 'crowdcast', 'wwwthebiggiveorg', 'zoom', 'youtube']);
const UNDECIDED = new Set(['tbd', 'tobeannounced', 'tba']);

export type VenueKind = 'place' | 'online' | 'undecided';

export function venueKind(name: string): VenueKind {
  const k = nameKey(name);
  if (ONLINE.has(k)) return 'online';
  if (UNDECIDED.has(k)) return 'undecided';
  return 'place';
}

/** "451 North Main St., Boerne, TX 78006" into its parts. Anything it cannot split stays in line 1. */
export function parseAddress(raw: string | null): { line1: string | null; city: string | null; state: string | null; postal: string | null } {
  if (!raw) return { line1: null, city: null, state: null, postal: null };
  const s = raw.replace(/\s+/g, ' ').replace(/,?\s*(USA|United States)$/i, '').trim();
  const m = s.match(/^(.*?),\s*([^,]+?),?\s+(TX|Texas)\.?\s*(\d{5})?(?:-\d{4})?$/i);
  if (m) return { line1: m[1] || null, city: m[2] || null, state: 'TX', postal: m[4] ?? null };
  const cityOnly = s.match(/^([^,]+),\s*(TX|Texas)\.?\s*(\d{5})?$/i);
  if (cityOnly) return { line1: null, city: cityOnly[1], state: 'TX', postal: cityOnly[3] ?? null };
  return { line1: s, city: null, state: null, postal: null };
}

/** Levenshtein distance, for spotting venue names that are probably the same place. */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Pairs of names close enough that a person should decide whether they are one place. */
export function nearDuplicates(names: string[]): Array<[string, string]> {
  const keys = names.map((n) => ({ n, k: nameKey(n).replace(/^the/, '') }));
  const out: Array<[string, string]> = [];
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i].k;
      const b = keys[j].k;
      if (!a || !b) continue;
      const close = a === b || (Math.min(a.length, b.length) >= 6 && editDistance(a, b) <= Math.max(1, Math.floor(Math.min(a.length, b.length) / 10)));
      if (close) out.push([keys[i].n, keys[j].n]);
    }
  return out;
}

// ---------------------------------------------------------------------------
// Types and causes
// ---------------------------------------------------------------------------

export const TYPE_MAP: Record<string, string> = {
  gala: 'gala',
  luncheon: 'luncheon',
  breakfast: 'breakfast',
  dinner: 'dinner',
  concerts: 'concert',
  concert: 'concert',
  festivals: 'festival',
  festival: 'festival',
  'golf-tournament': 'golf',
  'runs-walks': 'run-walk',
  'sporting-event': 'sporting-event',
  conference: 'conference',
  // One event used this; there is no closer type.
  cocktail: 'other'
};

/** The EventON type the old site used for holiday markers (imported as holidays, not events). */
export const HOLIDAY_TYPE = 'us-holidays';

export const CAUSE_MAP: Record<string, string> = {
  animals: 'animals',
  artsculture: 'arts-culture',
  chamberofcommerce: 'chamber-of-commerce',
  disabilitiesspecialneeds: 'disabilities',
  economiccommunitydevelopment: 'community-development',
  education: 'education',
  environmental: 'environmental',
  foundation: 'foundation',
  healthcare: 'health-care',
  housingassistance: 'housing',
  mediaoutlets: 'media',
  mentalhealth: 'mental-health',
  professionalassociation: 'professional-association',
  religious: 'religious',
  socialservices: 'social-services',
  sports: 'sports',
  veterans: 'veterans',
  youthactivities: 'youth'
};

export function sectorFrom(answer: string | null): 'nonprofit' | 'for_profit' | 'public' | null {
  const k = nameKey(answer ?? '');
  if (k === 'nonprofit') return 'nonprofit';
  if (k === 'forprofit') return 'for_profit';
  if (k.startsWith('public')) return 'public';
  return null;
}

// ---------------------------------------------------------------------------
// Gravity Forms entries
// ---------------------------------------------------------------------------

/** "06:30 pm", "6:30PM", "18:30" into "18:30". */
export function parseTypedTime(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "2026-09-23", "09/23/2026", "9/23/2026" into "2026-09-23". */
export function parseTypedDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

export interface TypedEvent {
  entryId: number;
  title: string;
  date: string | null;
  start: string | null;
  endDate: string | null;
  end: string | null;
  venueName: string | null;
  newVenueName: string | null;
  newVenueAddress: string | null;
  type: string | null;
  website: string | null;
}

export interface TypedEntry {
  entryId: number;
  createdAt: string | null;
  organization: string | null;
  orgType: string | null;
  sector: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  events: TypedEvent[];
}

/**
 * One Gravity Forms entry, read by field LABEL (ids differ between forms).
 * The form repeats the same labels for event 1, 2 and 3, so the fields are
 * split into blocks at each "Name of Event".
 */
export function readEntry(entry: Record<string, unknown>, form: ExportForm): TypedEntry {
  const val = (id: string) => {
    const v = entry[id];
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
  };
  const fieldValue = (f: ExportForm['fields'][number], part?: RegExp): string | null => {
    if (part && f.inputs.length) {
      const input = f.inputs.find((i) => part.test(i.label));
      return input ? val(input.id) : null;
    }
    if (f.inputs.length && f.type !== 'time' && f.type !== 'date') {
      const joined = f.inputs.map((i) => val(i.id)).filter(Boolean).join(' ');
      return joined || null;
    }
    return val(f.id);
  };
  const label = (f: ExportForm['fields'][number]) => f.label.toLowerCase().replace(/[*:]/g, '').trim();

  const out: TypedEntry = {
    entryId: Number(entry.id),
    createdAt: typeof entry.date_created === 'string' ? entry.date_created : null,
    organization: null,
    orgType: null,
    sector: null,
    submitterName: null,
    submitterEmail: null,
    events: []
  };
  let current: TypedEvent | null = null;
  for (const f of form.fields) {
    const l = label(f);
    if (l.startsWith('name of event')) {
      const title = fieldValue(f);
      current = { entryId: out.entryId, title: title ?? '', date: null, start: null, endDate: null, end: null, venueName: null, newVenueName: null, newVenueAddress: null, type: null, website: null };
      if (title) out.events.push(current);
      continue;
    }
    if (!current) {
      if (l.startsWith('name of nonprofit') || l.startsWith('name of organization') || l === 'organization') out.organization = fieldValue(f);
      else if (l.startsWith('organization type')) out.orgType = fieldValue(f);
      else if (l.startsWith('which of these best describes')) out.sector = fieldValue(f);
      else if (l === 'your name') out.submitterName = fieldValue(f);
      else if (l === 'your email') out.submitterEmail = fieldValue(f)?.toLowerCase() ?? null;
      continue;
    }
    if (l === 'event start date') current.date = parseTypedDate(fieldValue(f));
    else if (l === 'event start time') current.start = parseTypedTime(fieldValue(f));
    else if (l === 'event end date') current.endDate = parseTypedDate(fieldValue(f));
    else if (l === 'event end time') current.end = parseTypedTime(fieldValue(f));
    else if (l === 'event location name') current.venueName = fieldValue(f);
    else if (l === 'new location name') current.newVenueName = fieldValue(f);
    else if (l === 'new location address') current.newVenueAddress = fieldValue(f);
    else if (l === 'event type') current.type = fieldValue(f);
    else if (l.startsWith('website for this event')) current.website = fieldValue(f);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Judging the stored times
// ---------------------------------------------------------------------------

export interface TimeEvidence {
  postId: number;
  typedDate: string;
  typedStart: string;
}

/** Which reading of evcal_srow puts this event at the time that was typed, if either. */
export function whichReadingMatches(srow: number, typedDate: string, typedStart: string): TimeReading | null {
  for (const how of ['instant', 'wallclock'] as const) {
    const p = localParts(readEventonTime(srow, how));
    if (p.date === typedDate && p.time === typedStart) return how;
  }
  return null;
}

export interface ConvertedTimes {
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  flags: string[];
}

/**
 * An event's start and end. `reading` is how the export as a whole stores
 * times; `typed` is this event's own ground truth when there is one.
 */
export function convertTimes(ev: ExportEvent, reading: TimeReading, typed?: { date: string; start: string | null; endDate: string | null; end: string | null }): ConvertedTimes | null {
  const srow = Number(metaOne(ev.meta, 'evcal_srow'));
  const erowRaw = Number(metaOne(ev.meta, 'evcal_erow'));
  if (!Number.isFinite(srow) || srow <= 0) return null;
  const erow = Number.isFinite(erowRaw) && erowRaw >= srow ? erowRaw : srow;
  const allDay = metaOne(ev.meta, 'evcal_allday') === 'yes';
  const hideEnd = metaOne(ev.meta, 'evo_hide_endtime') === 'yes';
  const flags: string[] = [];

  if (allDay) {
    // The date is what matters; both readings agree on it except near midnight UTC.
    const start = readEventonTime(srow, reading);
    const end = readEventonTime(erow, reading);
    const first = typed?.date ?? localParts(start).date;
    const last = typed?.endDate ?? localParts(end).date;
    return {
      starts_at: zonedToUtc(first, '00:00').toISOString(),
      ends_at: zonedToUtc(addDays(last < first ? first : last, 1), '00:00').toISOString(),
      all_day: true,
      flags
    };
  }

  let start = readEventonTime(srow, reading);
  let end = readEventonTime(erow, reading);

  // Midnight to 11:59 PM (one day or a run of days, like a show's season)
  // is how the old form saved an all-day listing. Store it as one.
  const ls = localParts(start);
  const le = localParts(end);
  if (ls.time === '00:00' && (le.time === '23:59' || (le.time === '00:00' && le.date > ls.date))) {
    const last = le.time === '23:59' ? le.date : addDays(le.date, -1);
    return {
      starts_at: zonedToUtc(ls.date, '00:00').toISOString(),
      ends_at: zonedToUtc(addDays(last, 1), '00:00').toISOString(),
      all_day: true,
      flags
    };
  }

  if (typed?.date && typed.start) {
    const p = localParts(start);
    if (p.date !== typed.date || p.time !== typed.start) {
      // The stored number disagrees with what the submitter typed. Trust the typing.
      start = zonedToUtc(typed.date, typed.start);
      const endDate = typed.endDate ?? typed.date;
      end = typed.end ? zonedToUtc(endDate, typed.end) : start;
      if (end < start) end = start;
      flags.push('time-corrected');
    }
  } else {
    const h = localParts(start).hour;
    // 12 to 6 AM starts are almost always a time zone error, not a real event.
    if (h < 6) flags.push('time-unverified');
  }
  if (hideEnd) end = start;
  return { starts_at: start.toISOString(), ends_at: end.toISOString(), all_day: false, flags };
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/** The address to give an imported event, and the old ones that should still find it. */
export function eventSlugs(ev: ExportEvent): { slug: string; legacy: string[] } {
  const raw = ev.slug ?? '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // leave as is
  }
  const old = (ev.meta?._wp_old_slug ?? []).filter((s): s is string => typeof s === 'string');
  const clean = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw);
  const slug = clean ? raw : slugify(decodeEntities(ev.title));
  const legacy = [...new Set([...(clean ? [] : [raw, decoded]), ...old].filter((s) => s && s !== slug))];
  return { slug, legacy };
}
