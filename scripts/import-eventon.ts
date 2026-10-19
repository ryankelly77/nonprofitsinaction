/*
 * Import the WordPress calendar (EventON + Gravity Forms) into Supabase.
 *
 *   npm run import:eventon -- npia-export.json            # dry run: report only
 *   npm run import:eventon -- npia-export.json --apply    # write
 *   npm run import:eventon -- npia-export.json --apply --images   # and copy flyers
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from
 * .env.local. Safe to run again: anything already imported (matched by its
 * WordPress id) is left alone, so a last run just before cutover only adds
 * what was listed since the previous one. --update re-imports events nobody
 * has touched since the last run (for fixing the import itself before
 * launch); an event an admin or organizer has changed is never overwritten.
 *
 * Always writes import-report.json (git-ignored: it names submitters).
 * Read it before --apply. It says how the export stores times and how sure
 * that is, which events had their time corrected from the submitter's own
 * entry, and which venue names look like duplicates.
 */
import fs from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  CAUSE_MAP,
  HOLIDAY_TYPE,
  TYPE_MAP,
  convertTimes,
  decodeEntities,
  eventSlugs,
  metaOne,
  nearDuplicates,
  parseAddress,
  plainText,
  readEntry,
  readEventonTime,
  sectorFrom,
  venueKind,
  whichReadingMatches,
  type EventonExport,
  type ExportEvent,
  type TimeReading,
  type TypedEntry,
  type TypedEvent
} from '../lib/eventon.ts';
import { nameKey } from '../lib/names.ts';
import { slugify, uniqueSlug } from '../lib/slug.ts';
import { localParts, zonedToUtc } from '../lib/time.ts';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const APPLY = args.includes('--apply');
const UPDATE = args.includes('--update');
const IMAGES = args.includes('--images');
const forced = args.find((a) => a.startsWith('--reading='))?.split('=')[1] as TimeReading | undefined;

if (!file) {
  console.error('Usage: npm run import:eventon -- <npia-export.json> [--apply] [--update] [--images] [--reading=instant|wallclock]');
  process.exit(1);
}
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');

const data = JSON.parse(fs.readFileSync(file, 'utf8')) as EventonExport;

/*
 * Times the old site showed on its own event pages in October 2026. Extra
 * evidence alongside the Gravity Forms entries (see lib/eventon.ts).
 */
const KNOWN: Record<number, { date: string; start: string }> = {
  118439: { date: '2026-10-17', start: '10:00' },
  118450: { date: '2026-10-31', start: '10:00' },
  118433: { date: '2026-11-07', start: '18:00' },
  118458: { date: '2026-12-04', start: '10:00' },
  118434: { date: '2027-05-01', start: '18:00' },
  118447: { date: '2027-05-07', start: '11:00' }
};

// ---- 1. What each submitter typed -------------------------------------------

const forms = new Map(data.forms.filter((f) => f.is_listing).map((f) => [f.id, f]));
const entries: TypedEntry[] = data.entries
  .map((e) => {
    const form = forms.get(Number(e.form_id));
    return form ? readEntry(e, form) : null;
  })
  .filter((e): e is TypedEntry => e !== null);

const typedByTitle = new Map<string, Array<{ entry: TypedEntry; event: TypedEvent }>>();
for (const entry of entries)
  for (const event of entry.events) {
    const k = nameKey(event.title);
    if (!k) continue;
    typedByTitle.set(k, [...(typedByTitle.get(k) ?? []), { entry, event }]);
  }

/**
 * The entry an event came from. Same title is not enough (a gala listed every
 * year has the same title every year): the typed date must be within a few
 * months of the stored one under either reading, and the organization must
 * agree when both sides name one. Closest date wins. No match is better than
 * a wrong one, since a match moves the event to the typed time and gives the
 * entry's submitter an edit link to it.
 */
function typedFor(ev: ExportEvent): { entry: TypedEntry; event: TypedEvent } | null {
  const srow = Number(metaOne(ev.meta, 'evcal_srow'));
  if (!srow) return null;
  const stored = [readEventonTime(srow, 'instant').getTime(), readEventonTime(srow, 'wallclock').getTime()];
  const org = ev.terms.find((t) => t.taxonomy === 'event_organizer');
  const orgKey = org ? nameKey(decodeEntities(org.name)) : null;
  const WINDOW = 120 * 86_400_000;
  const scored = (typedByTitle.get(nameKey(decodeEntities(ev.title))) ?? [])
    .filter((c) => c.event.date)
    .filter((c) => !orgKey || !c.entry.organization || nameKey(c.entry.organization) === orgKey)
    .map((c) => ({ c, gap: Math.min(...stored.map((t) => Math.abs(Date.parse(`${c.event.date}T12:00:00Z`) - t))) }))
    .filter((x) => x.gap <= WINDOW)
    .sort((a, b) => a.gap - b.gap);
  return scored[0]?.c ?? null;
}

// ---- 2. How this export stores times -----------------------------------------

const events = data.events.filter((e) => e.status !== 'trash' && e.status !== 'auto-draft');
const tally = { instant: 0, wallclock: 0, neither: 0 };
const disagreements: Array<{ postId: number; title: string; typed: string }> = [];
/** Per checked event: when it was created, and which reading its typed time confirms. */
const evidence: Array<{ postId: number; created: number; how: TimeReading }> = [];
const ownReading = new Map<number, TimeReading>();
for (const ev of events) {
  const srow = Number(metaOne(ev.meta, 'evcal_srow'));
  if (!srow) continue;
  const t = typedFor(ev);
  const truth = t?.event.date ? { date: t.event.date, start: t.event.start } : KNOWN[ev.id] ?? null;
  if (!truth) continue;
  let how: TimeReading | null;
  if (metaOne(ev.meta, 'evcal_allday') === 'yes' || !truth.start) {
    // A date alone only tells the readings apart near midnight UTC.
    const fits = (['instant', 'wallclock'] as const).filter((h) => localParts(readEventonTime(srow, h)).date === truth.date);
    if (fits.length !== 1) continue;
    how = fits[0];
  } else {
    how = whichReadingMatches(srow, truth.date, truth.start);
  }
  if (how) {
    tally[how]++;
    evidence.push({ postId: ev.id, created: Date.parse(`${ev.date_gmt.replace(' ', 'T')}Z`), how });
    ownReading.set(ev.id, how);
  } else {
    tally.neither++;
    disagreements.push({ postId: ev.id, title: ev.title, typed: `${truth.date} ${truth.start ?? ''}`.trim() });
  }
}
evidence.sort((a, b) => a.created - b.created);
const checked = tally.instant + tally.wallclock + tally.neither;
const majority: TimeReading | null = tally.instant === 0 && tally.wallclock === 0 ? null : tally.wallclock > tally.instant ? 'wallclock' : 'instant';
const agreement = checked ? Math.max(tally.instant, tally.wallclock) / checked : 0;

console.log(`\nEvents in export: ${data.events.length} (${events.length} not trashed)`);
console.log(`Gravity Forms entries read: ${entries.length}, typed events: ${entries.reduce((n, e) => n + e.events.length, 0)}`);
console.log(`Times checked against what was typed: ${checked}. Stored as instants: ${tally.instant}. Stored as wall clock: ${tally.wallclock}. Matching neither: ${tally.neither}.`);
if (!forced && !majority) {
  console.error('\nNo event could be checked, so there is no way to tell how this export stores times. Look at a few events by hand and rerun with --reading=instant or --reading=wallclock.');
  process.exit(2);
}
console.log(
  forced
    ? `Reading every time as: ${forced} (forced).`
    : `Mostly stored as: ${majority}, ${Math.round(agreement * 100)}% of checked events agree.${tally.instant && tally.wallclock ? ' The export is MIXED: each unchecked event takes the reading of the checked events created around the same time, and is flagged when those disagree.' : ''}`
);

/*
 * How to read one event's numbers. Its own typed time decides when it has
 * one. Otherwise the storage habit at the time it was created decides: the
 * two checked events created just before it and the two just after. When
 * they disagree (or there are none) the majority is used and the event is
 * flagged for a person to confirm.
 */
function readingFor(ev: ExportEvent): { how: TimeReading; sure: boolean } {
  if (forced) return { how: forced, sure: true };
  const own = ownReading.get(ev.id);
  if (own) return { how: own, sure: true };
  const created = Date.parse(`${ev.date_gmt.replace(' ', 'T')}Z`);
  const i = evidence.findIndex((e) => e.created > created);
  const at = i === -1 ? evidence.length : i;
  const near = evidence.slice(Math.max(0, at - 2), at + 2);
  const kinds = new Set(near.map((e) => e.how));
  if (kinds.size === 1) return { how: near[0].how, sure: true };
  return { how: majority!, sure: false };
}

// ---- 3. Build the rows ----------------------------------------------------------

const termsBy = (tax: string) => data.terms.filter((t) => t.taxonomy === tax);

interface VenueRow { legacy_term_id: number; name: string; slug: string; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null; latitude: number | null; longitude: number | null; website: string | null }
const venues = new Map<number, VenueRow | 'online' | 'undecided'>();
for (const t of termsBy('event_location')) {
  const name = decodeEntities(t.name).trim();
  const kind = venueKind(name);
  if (kind !== 'place') {
    venues.set(t.term_id, kind);
    continue;
  }
  const evo = (t.evo_meta ?? {}) as Record<string, unknown>;
  const addr = parseAddress(typeof evo.location_address === 'string' ? decodeEntities(evo.location_address) : null);
  const lat = Number(evo.location_lat);
  const lon = Number(evo.location_lon);
  venues.set(t.term_id, {
    legacy_term_id: t.term_id,
    name,
    slug: t.slug,
    address_line1: addr.line1,
    city: addr.city ?? (typeof evo.location_city === 'string' ? evo.location_city : null),
    state: addr.state ?? 'TX',
    postal_code: addr.postal,
    latitude: Number.isFinite(lat) && lat !== 0 ? lat : null,
    longitude: Number.isFinite(lon) && lon !== 0 ? lon : null,
    website: typeof evo.location_link === 'string' && /^https?:/.test(evo.location_link) ? evo.location_link : null
  });
}

interface OrgRow { legacy_term_id: number | null; name: string; slug: string; website: string | null; cause_slug: string | null; sector: 'nonprofit' | 'for_profit' | 'public' | null }
const orgs = new Map<string, OrgRow>(); // by name key
for (const t of termsBy('event_organizer')) {
  const name = decodeEntities(t.name).trim();
  const evo = (t.evo_meta ?? {}) as Record<string, unknown>;
  const site = typeof evo.evcal_org_exlink === 'string' && /^https?:/.test(evo.evcal_org_exlink) ? evo.evcal_org_exlink : null;
  if (!orgs.has(nameKey(name))) orgs.set(nameKey(name), { legacy_term_id: t.term_id, name, slug: t.slug, website: site, cause_slug: null, sector: null });
}
for (const entry of entries) {
  if (!entry.organization) continue;
  const k = nameKey(entry.organization);
  const row = orgs.get(k) ?? { legacy_term_id: null, name: entry.organization, slug: slugify(entry.organization), website: null, cause_slug: null, sector: null };
  row.cause_slug ??= CAUSE_MAP[nameKey(entry.orgType ?? '')] ?? null;
  row.sector ??= sectorFrom(entry.sector);
  orgs.set(k, row);
}

interface EventRow {
  postId: number;
  slug: string;
  legacy_slugs: string[];
  title: string;
  description: string | null;
  orgKey: string;
  venueTerm: number | null;
  event_type_slug: string;
  format: 'in_person' | 'virtual' | 'hybrid';
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  online_url: string | null;
  ticket_url: string | null;
  image: string | null;
  moderation: 'approved' | 'pending';
  status: 'scheduled' | 'cancelled' | 'postponed';
  published_at: string | null;
  review_flags: string[];
  entryId: number | null;
  /** Who submitted it, from the Pear integration's own post meta, when no form entry matched. */
  submitter: { name: string; email: string; date: string } | null;
}

const rows: EventRow[] = [];
const skipped: Array<{ postId: number; title: string; why: string }> = [];
const holidays: Array<{ date: string; name: string }> = [];
const usedOrgs = new Set<string>();
const usedVenues = new Set<number>();
const taken = new Set<string>();
for (const ev of events) {
  const title = decodeEntities(ev.title).trim();

  // The old site's holiday markers become holidays, not events.
  if (ev.terms.some((t) => t.taxonomy === 'event_type' && t.slug === HOLIDAY_TYPE)) {
    const srow = Number(metaOne(ev.meta, 'evcal_srow'));
    if (srow) holidays.push({ date: localParts(readEventonTime(srow, readingFor(ev).how)).date, name: title });
    continue;
  }

  const typed = typedFor(ev);
  const read = readingFor(ev);
  const times = convertTimes(
    ev,
    read.how,
    typed?.event.date ? { date: typed.event.date, start: typed.event.start, endDate: typed.event.endDate, end: typed.event.end } : undefined
  );
  if (!times) {
    skipped.push({ postId: ev.id, title, why: 'no start time' });
    continue;
  }

  const orgTerm = ev.terms.find((t) => t.taxonomy === 'event_organizer');
  const orgName = orgTerm ? decodeEntities(orgTerm.name) : typed?.entry.organization;
  if (!orgName) {
    skipped.push({ postId: ev.id, title, why: 'no organizer' });
    continue;
  }
  if (!orgs.has(nameKey(orgName))) orgs.set(nameKey(orgName), { legacy_term_id: null, name: orgName, slug: slugify(orgName), website: null, cause_slug: null, sector: null });
  usedOrgs.add(nameKey(orgName));
  {
    // Cause and sector: the form entry, else what the Pear integration stored on the post, else the type terms.
    const org = orgs.get(nameKey(orgName))!;
    const termName = (tax: string) => ev.terms.find((t) => t.taxonomy === tax)?.name ?? null;
    org.cause_slug ??= CAUSE_MAP[nameKey(metaOne(ev.meta, '_pear_organization_type') ?? termName('event_type_2') ?? '')] ?? null;
    org.sector ??= sectorFrom(metaOne(ev.meta, '_pear_business_type') ?? termName('event_type_3'));
  }

  const locTerm = ev.terms.find((t) => t.taxonomy === 'event_location');
  const place = locTerm ? venues.get(locTerm.term_id) : undefined;
  if (locTerm && place && typeof place === 'object') usedVenues.add(locTerm.term_id);
  const flags = [...times.flags];
  if (!read.sure && !flags.includes('time-corrected') && !flags.includes('time-unverified')) flags.push('time-unverified');
  const statusMeta = metaOne(ev.meta, '_status');
  const virtual = metaOne(ev.meta, '_virtual') === 'yes' || place === 'online' || statusMeta === 'movedonline';
  const format: EventRow['format'] = virtual ? (place && typeof place === 'object' ? 'hybrid' : 'virtual') : 'in_person';
  if (!locTerm && !virtual) flags.push('no-venue');

  const typeTerm = ev.terms.find((t) => t.taxonomy === 'event_type');
  let type = typeTerm ? TYPE_MAP[typeTerm.slug] : undefined;
  if (!type) {
    type = 'other';
    flags.push('type-guessed');
  }

  const status: EventRow['status'] =
    statusMeta === 'cancelled' || metaOne(ev.meta, '_cancel') === 'yes' ? 'cancelled' : statusMeta === 'postponed' ? 'postponed' : 'scheduled';

  const { slug: wanted, legacy } = eventSlugs(ev);
  const slug = uniqueSlug(wanted, taken);
  taken.add(slug);
  const link = metaOne(ev.meta, 'evcal_lmlink');
  const vurl = metaOne(ev.meta, '_vir_url');

  rows.push({
    postId: ev.id,
    slug,
    legacy_slugs: slug === wanted ? legacy : [...legacy, wanted],
    title,
    description: plainText(ev.content ?? ''),
    orgKey: nameKey(orgName),
    venueTerm: place && typeof place === 'object' ? locTerm!.term_id : null,
    event_type_slug: type,
    format,
    starts_at: times.starts_at,
    ends_at: times.ends_at,
    all_day: times.all_day,
    online_url: vurl && /^https?:/.test(vurl) ? vurl : null,
    ticket_url: link && /^https?:/.test(link) ? link : (typed?.event.website && /^https?:/.test(typed.event.website) ? typed.event.website : null),
    image: ev.featured_image,
    moderation: ev.status === 'publish' ? 'approved' : 'pending',
    status,
    published_at: ev.status === 'publish' ? `${ev.date_gmt.replace(' ', 'T')}Z` : null,
    review_flags: [...new Set(flags)],
    entryId: typed?.entry.entryId ?? null,
    submitter: (() => {
      const email = metaOne(ev.meta, '_pear_submitter_email')?.trim().toLowerCase();
      const date = metaOne(ev.meta, '_pear_submission_date');
      if (typed || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
      return { name: metaOne(ev.meta, '_pear_submitter_name') ?? email, email, date: date ?? ev.date_gmt };
    })()
  });
}

// ---- 4. Report --------------------------------------------------------------------

for (const k of [...orgs.keys()]) if (!usedOrgs.has(k)) orgs.delete(k);
for (const t of [...venues.keys()]) if (!usedVenues.has(t)) venues.delete(t);
const placeNames = [...venues.values()].filter((v): v is VenueRow => typeof v === 'object').map((v) => v.name);
const report = {
  generated_at: new Date().toISOString(),
  export_file: file,
  times: { majority, forced: forced ?? null, checked, ...tally, agreement, disagreements },
  counts: {
    events: rows.length,
    approved: rows.filter((r) => r.moderation === 'approved').length,
    pending: rows.filter((r) => r.moderation === 'pending').length,
    upcoming: rows.filter((r) => Date.parse(r.ends_at) >= Date.now()).length,
    cancelled: rows.filter((r) => r.status === 'cancelled').length,
    organizations: orgs.size,
    venues: placeNames.length,
    entries_matched: new Set(rows.map((r) => r.entryId).filter(Boolean)).size,
    submitters_from_post_meta: rows.filter((r) => r.submitter).length,
    without_submitter: rows.filter((r) => !r.entryId && !r.submitter).length,
    with_images: rows.filter((r) => r.image).length,
    holidays: holidays.length
  },
  flagged: rows.filter((r) => r.review_flags.length).map((r) => ({ postId: r.postId, title: r.title, starts_at: r.starts_at, flags: r.review_flags })),
  renamed_slugs: rows.filter((r) => r.legacy_slugs.length).map((r) => ({ postId: r.postId, slug: r.slug, old: r.legacy_slugs })),
  venue_near_duplicates: nearDuplicates(placeNames),
  // Same title on the same day: usually one listing submitted twice. Imported
  // as is; reject the extra one in /admin/.
  possible_duplicate_events: Object.values(
    rows.reduce<Record<string, Array<{ postId: number; title: string }>>>((acc, r) => {
      const k = `${nameKey(r.title)}|${localParts(r.starts_at).date}`;
      (acc[k] ??= []).push({ postId: r.postId, title: r.title });
      return acc;
    }, {})
  ).filter((g) => g.length > 1),
  organizations_without_cause: [...orgs.values()].filter((o) => !o.cause_slug).map((o) => o.name),
  skipped
};
fs.writeFileSync('import-report.json', JSON.stringify(report, null, 2));
console.log(`\n${report.counts.events} events (${report.counts.upcoming} upcoming), ${report.counts.organizations} organizations, ${report.counts.venues} venues, ${holidays.length} holidays.`);
console.log(
  `${report.flagged.length} flagged for a person to check, ${skipped.length} skipped, ${report.venue_near_duplicates.length} possible duplicate venues, ${report.possible_duplicate_events.length} possible duplicate events.`
);
console.log('Details: import-report.json');

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Add --apply to import.');
  process.exit(0);
}

// ---- 5. Write -----------------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in .env.local).');
  process.exit(1);
}
const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string): Promise<T> {
  const { data: d, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return d;
}

async function slugsIn(table: string): Promise<Set<string>> {
  const all = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const page = await must(db.from(table).select('slug').range(from, from + 999), `read ${table}`);
    for (const r of page as Array<{ slug: string }>) all.add(r.slug);
    if ((page as unknown[]).length < 1000) return all;
  }
}

const orgIds = new Map<string, string>();
{
  const taken = await slugsIn('organizations');
  for (const [k, o] of orgs) {
    type Org = { id: string; merged_into: string | null; website: string | null; cause_slug: string | null; sector: string | null };
    const cols = 'id, merged_into, website, cause_slug, sector';
    const hit =
      (o.legacy_term_id ? ((await must(db.from('organizations').select(cols).eq('legacy_term_id', o.legacy_term_id).limit(1), 'org by term')) as Org[])[0] : undefined) ??
      ((await must(db.from('organizations').select(cols).eq('name_key', k).is('merged_into', null).limit(1), 'org by name')) as Org[])[0];
    if (hit) {
      // An organization an admin has merged since: use the one it was merged into.
      const id = hit.merged_into ?? hit.id;
      orgIds.set(k, id);
      // --update only fills in what is still blank. Never overwrites an admin's edit.
      if (UPDATE && !hit.merged_into) {
        const blanks = {
          ...(hit.website ? {} : o.website ? { website: o.website } : {}),
          ...(hit.cause_slug ? {} : o.cause_slug ? { cause_slug: o.cause_slug } : {}),
          ...(hit.sector ? {} : o.sector ? { sector: o.sector } : {})
        };
        if (Object.keys(blanks).length) await must(db.from('organizations').update(blanks).eq('id', id), 'fill org');
      }
      continue;
    }
    const slug = uniqueSlug(slugify(o.slug || o.name), taken);
    taken.add(slug);
    const ins = (await must(db.from('organizations').insert({ name: o.name, slug, website: o.website, cause_slug: o.cause_slug, sector: o.sector, legacy_term_id: o.legacy_term_id }).select('id').single(), `insert org ${o.name}`)) as { id: string };
    orgIds.set(k, ins.id);
  }
}

const venueIds = new Map<number, string>();
{
  const taken = await slugsIn('venues');
  for (const [termId, v] of venues) {
    if (typeof v !== 'object') continue;
    const found =
      ((await must(db.from('venues').select('id, merged_into').eq('legacy_term_id', termId).limit(1), 'venue by term')) as Array<{ id: string; merged_into: string | null }>)[0] ??
      ((await must(db.from('venues').select('id, merged_into').eq('name_key', nameKey(v.name)).is('merged_into', null).limit(1), 'venue by name')) as Array<{ id: string; merged_into: string | null }>)[0];
    if (found) {
      venueIds.set(termId, found.merged_into ?? found.id);
      continue;
    }
    const slug = uniqueSlug(slugify(v.slug || v.name), taken);
    taken.add(slug);
    const { legacy_term_id, name, address_line1, city, state, postal_code, latitude, longitude, website } = v;
    const ins = (await must(
      db.from('venues').insert({ legacy_term_id, name, slug, address_line1, city, state, postal_code, latitude, longitude, website, verified: true }).select('id').single(),
      `insert venue ${v.name}`
    )) as { id: string };
    venueIds.set(termId, ins.id);
  }
}

const submissionIds = new Map<number, string>();
for (const entry of entries) {
  if (!entry.submitterEmail || !rows.some((r) => r.entryId === entry.entryId)) continue;
  const found = ((await must(db.from('submissions').select('id').eq('legacy_entry_id', entry.entryId).limit(1), 'submission')) as Array<{ id: string }>)[0];
  if (found) {
    submissionIds.set(entry.entryId, found.id);
    continue;
  }
  const ins = (await must(
    db
      .from('submissions')
      .insert({
        submitter_name: entry.submitterName ?? entry.organization ?? 'Unknown',
        submitter_email: entry.submitterEmail,
        organization_id: entry.organization ? orgIds.get(nameKey(entry.organization)) ?? null : null,
        source: 'eventon-import',
        legacy_entry_id: entry.entryId,
        created_at: entry.createdAt ? `${entry.createdAt.replace(' ', 'T')}Z` : undefined
      })
      .select('id')
      .single(),
    'insert submission'
  )) as { id: string };
  submissionIds.set(entry.entryId, ins.id);
}

/*
 * Events with no matching form entry but with the submitter the Pear
 * integration stored on the post: one submission per address and submission
 * time, so "email me a new link" at /manage/ finds these too.
 */
const metaSubmissionIds = new Map<string, string>();
for (const r of rows) {
  if (!r.submitter) continue;
  const k = `${r.submitter.email}|${r.submitter.date}`;
  if (metaSubmissionIds.has(k)) continue;
  const [d, t] = r.submitter.date.split(' ');
  const created = /^\d{4}-\d{2}-\d{2}$/.test(d) && /^\d{2}:\d{2}/.test(t ?? '') ? zonedToUtc(d, t.slice(0, 5)).toISOString() : null;
  const found = created
    ? ((await must(
        db.from('submissions').select('id').eq('submitter_email', r.submitter.email).eq('source', 'eventon-import').eq('created_at', created).is('legacy_entry_id', null).limit(1),
        'submission by meta'
      )) as Array<{ id: string }>)[0]
    : undefined;
  if (found) {
    metaSubmissionIds.set(k, found.id);
    continue;
  }
  const ins = (await must(
    db
      .from('submissions')
      .insert({
        submitter_name: r.submitter.name,
        submitter_email: r.submitter.email,
        organization_id: orgIds.get(r.orgKey) ?? null,
        source: 'eventon-import',
        ...(created ? { created_at: created } : {})
      })
      .select('id')
      .single(),
    'insert submission from post'
  )) as { id: string };
  metaSubmissionIds.set(k, ins.id);
}

let holidaysAdded = 0;
for (const h of holidays) {
  const { data: hit } = await db.from('holidays').select('id').eq('date', h.date).eq('name', h.name).limit(1);
  if (hit?.length) continue;
  await must(db.from('holidays').insert(h), `holiday ${h.name}`);
  holidaysAdded++;
}

async function copyImage(src: string, postId: number): Promise<string | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : type.includes('jpeg') || type.includes('jpg') ? 'jpg' : null;
    if (!ext) return null;
    const path = `imported/${postId}.${ext}`;
    const { error } = await db.storage.from('event-images').upload(path, Buffer.from(await res.arrayBuffer()), { contentType: type, upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

let inserted = 0;
let updated = 0;
let unchanged = 0;
let keptEdited = 0;
let imagesCopied = 0;
const takenEvents = await slugsIn('events');
for (const r of rows) {
  const existing = ((await must(db.from('events').select('id, slug').eq('legacy_post_id', r.postId).limit(1), 'event by post')) as Array<{ id: string; slug: string }>)[0];
  if (existing && !UPDATE) {
    unchanged++;
    continue;
  }
  if (existing) {
    // --update refreshes an imported event only while nobody has touched it.
    // Anything an admin or the organizer changed (approval, rejection, a time
    // fix, a merge) is kept.
    const touched = (await must(db.from('event_changes').select('id').eq('event_id', existing.id).neq('actor', 'import').limit(1), 'history')) as unknown[];
    if (touched.length) {
      keptEdited++;
      continue;
    }
  }
  const image = r.image && IMAGES ? await copyImage(r.image, r.postId) : null;
  if (image) imagesCopied++;
  const fields = {
    title: r.title,
    description: r.description,
    organization_id: orgIds.get(r.orgKey)!,
    venue_id: r.venueTerm ? venueIds.get(r.venueTerm) ?? null : null,
    event_type_slug: r.event_type_slug,
    format: r.format,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    all_day: r.all_day,
    online_url: r.online_url,
    ticket_url: r.ticket_url,
    ...(image ? { image_path: image } : {}),
    moderation: r.moderation,
    status: r.status,
    published_at: r.published_at,
    review_flags: r.review_flags,
    legacy_slugs: r.legacy_slugs,
    submission_id: r.entryId
      ? submissionIds.get(r.entryId) ?? null
      : r.submitter
        ? metaSubmissionIds.get(`${r.submitter.email}|${r.submitter.date}`) ?? null
        : null
  };
  if (existing) {
    await must(db.from('events').update(fields).eq('id', existing.id), `update ${r.title}`);
    await db.from('event_changes').insert({ event_id: existing.id, actor: 'import', action: 'edited', changes: { reimported_from_wordpress_post: r.postId } });
    updated++;
    continue;
  }
  const slug = takenEvents.has(r.slug) ? uniqueSlug(r.slug, takenEvents) : r.slug;
  takenEvents.add(slug);
  const ins = (await must(db.from('events').insert({ ...fields, slug, legacy_post_id: r.postId }).select('id').single(), `insert ${r.title}`)) as { id: string };
  await db.from('event_changes').insert({ event_id: ins.id, actor: 'import', action: 'created', changes: { wordpress_post: r.postId } });
  inserted++;
}

console.log(
  `\nWritten: ${inserted} new events, ${updated} updated, ${unchanged} already imported and left alone${UPDATE ? `, ${keptEdited} kept because someone edited them after import` : ''}. ${holidaysAdded} holidays added.${IMAGES ? ` ${imagesCopied} images copied.` : ''}`
);
console.log('Flagged events are under "Needs a check" in /admin/. Possible duplicate venues are in import-report.json; merge them in /admin/venues/.');
