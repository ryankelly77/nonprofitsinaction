import type { SupabaseClient } from '@supabase/supabase-js';
import { publicClient } from '@/lib/supabase/public';
import { dayRange, monthRange } from '@/lib/time';
import {
  PUBLIC_EVENT_SELECT,
  type CalendarEvent,
  type Cause,
  type EventType,
  type Organization,
  type PublicEvent
} from '@/lib/types';

/*
 * Every public read. Row level security already limits the anon key to
 * approved events; the filters here decide which of those a page shows.
 *
 * With no Supabase settings (a local build before .env.local exists) each
 * read returns its empty value, so the site still builds. In production that
 * case is an error raised in publicClient().
 */

async function read<T>(
  mode: 'cached' | 'fresh',
  empty: T,
  run: (db: SupabaseClient) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T> {
  const db = publicClient(mode);
  if (!db) return empty;
  const { data, error } = await run(db);
  if (error) throw new Error(error.message);
  return (data ?? empty) as T;
}

export async function getEventTypes(): Promise<EventType[]> {
  return read('cached', [], (db) => db.from('event_types').select('*').eq('active', true).order('sort'));
}

export async function getCauses(): Promise<Cause[]> {
  return read('cached', [], (db) => db.from('causes').select('*').order('sort'));
}

export interface EventQuery {
  type?: string;
  cause?: string;
  q?: string;
  /** Only events that have not ended by this instant. Defaults to now. */
  after?: Date;
  limit?: number;
  offset?: number;
}

/** Upcoming approved events, soonest first. */
export async function getUpcomingEvents(query: EventQuery = {}): Promise<PublicEvent[]> {
  const after = (query.after ?? new Date()).toISOString();
  const limit = query.limit ?? 24;
  const offset = query.offset ?? 0;
  return read('cached', [], (db) => {
    let q = db
      .from('events')
      .select(PUBLIC_EVENT_SELECT)
      .gte('ends_at', after)
      .order('starts_at', { ascending: true })
      .range(offset, offset + limit - 1);
    if (query.type) q = q.eq('event_type_slug', query.type);
    if (query.cause) q = q.eq('organization.cause_slug', query.cause);
    if (query.q) q = q.textSearch('search', query.q, { type: 'websearch', config: 'english' });
    return q;
  });
}

/** The most recently published events, newest first. */
export async function getRecentlyAdded(limit = 6): Promise<PublicEvent[]> {
  return read('cached', [], (db) =>
    db
      .from('events')
      .select(PUBLIC_EVENT_SELECT)
      .gte('ends_at', new Date().toISOString())
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit)
  );
}

/**
 * The spellings an address can arrive in. Next hands a page its segment
 * either still percent-encoded (in upper case) or decoded, and WordPress
 * stored encoded slugs in lower case, so all three are tried.
 */
function slugVariants(slug: string): string[] {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    // not encoded
  }
  // Characters that mean something in a PostgREST filter (or are never in a
  // slug) disqualify a spelling, so a crafted address cannot widen the match.
  return [...new Set([slug, decoded, encodeURIComponent(decoded).toLowerCase()])].filter(
    (v) => v.length > 0 && v.length <= 200 && !/[\s,(){}"'\\*]/.test(v)
  );
}

/** One event by its address. Also finds it by an address WordPress used to give it. */
export async function getEventBySlug(slug: string): Promise<{ event: PublicEvent | null; movedTo: string | null }> {
  const variants = slugVariants(slug);
  if (variants.length === 0) return { event: null, movedTo: null };
  const found = await read<PublicEvent[]>('cached', [], (db) =>
    db.from('events').select(PUBLIC_EVENT_SELECT).in('slug', variants).limit(1)
  );
  if (found[0]) return { event: found[0], movedTo: null };
  const legacy = await read<Array<{ slug: string }>>('cached', [], (db) =>
    db.from('events').select('slug').overlaps('legacy_slugs', variants).limit(1)
  );
  return { event: null, movedTo: legacy[0]?.slug ?? null };
}

/** Every approved event's address, for the sitemap. */
export async function getAllEventSlugs(): Promise<Array<{ slug: string; updated_at: string }>> {
  return read('cached', [], (db) => db.from('events').select('slug, updated_at').order('starts_at', { ascending: false }));
}

export async function getOrganizationBySlug(slug: string): Promise<Organization | null> {
  const rows = await read<Organization[]>('cached', [], (db) =>
    db.from('organizations').select('*').eq('slug', slug).limit(1)
  );
  return rows[0] ?? null;
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  const rows = await read<Organization[]>('cached', [], (db) => db.from('organizations').select('*').eq('id', id).limit(1));
  return rows[0] ?? null;
}

export async function getEventsForOrganization(organizationId: string): Promise<PublicEvent[]> {
  return read('cached', [], (db) =>
    db
      .from('events')
      .select(PUBLIC_EVENT_SELECT)
      .eq('organization_id', organizationId)
      .order('starts_at', { ascending: false })
      .limit(200)
  );
}

/** Organizations that have at least one approved event, for the sitemap. */
export async function getOrganizationSlugsWithEvents(): Promise<string[]> {
  const rows = await read<Array<{ organization: { slug: string } }>>('cached', [], (db) =>
    db.from('events').select('organization:organizations!inner(slug)')
  );
  return [...new Set(rows.map((r) => r.organization.slug))];
}

function toCalendarEvent(e: PublicEvent): CalendarEvent {
  return {
    slug: e.slug,
    title: e.title,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    all_day: e.all_day,
    status: e.status,
    organization: e.organization.name,
    venue: e.venue?.name ?? (e.format === 'virtual' ? 'Online' : null)
  };
}

/** Approved events that touch [start, end), as compact calendar entries. */
export async function getCalendarEvents(start: Date, end: Date, mode: 'cached' | 'fresh' = 'cached'): Promise<CalendarEvent[]> {
  const rows = await read<PublicEvent[]>(mode, [], (db) =>
    db
      .from('events')
      .select(PUBLIC_EVENT_SELECT)
      .lt('starts_at', end.toISOString())
      .gt('ends_at', start.toISOString())
      .order('starts_at', { ascending: true })
      .limit(500)
  );
  return rows.map(toCalendarEvent);
}

export async function getMonthEvents(month: string, mode: 'cached' | 'fresh' = 'cached'): Promise<CalendarEvent[]> {
  const r = monthRange(month);
  return getCalendarEvents(r.start, r.end, mode);
}

/** What is already on the calendar on a San Antonio date. */
export async function getDayEvents(date: string): Promise<CalendarEvent[]> {
  const r = dayRange(date);
  return getCalendarEvents(r.start, r.end, 'fresh');
}

/** Verified venues whose name contains the typed text, for the submit form. */
export async function searchVenues(text: string): Promise<Array<{ id: string; name: string; address: string }>> {
  const term = text.replace(/[%_,()]/g, ' ').trim().slice(0, 60);
  if (term.length < 2) return [];
  const rows = await read<Array<{ id: string; name: string; address_line1: string | null; city: string | null; state: string | null }>>(
    'fresh',
    [],
    (db) =>
      db
        .from('venues')
        .select('id, name, address_line1, city, state')
        .eq('verified', true)
        .is('merged_into', null)
        .ilike('name', `%${term}%`)
        .order('name')
        .limit(8)
  );
  return rows.map((v) => ({ id: v.id, name: v.name, address: [v.address_line1, v.city, v.state].filter(Boolean).join(', ') }));
}
