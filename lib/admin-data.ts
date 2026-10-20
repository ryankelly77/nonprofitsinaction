import 'server-only';
import { requireAdmin } from './admin-auth.ts';
import { serviceClient } from './supabase/service.ts';
import { duplicatePairs, nameQuestions, type DuplicatePair, type NameQuestions } from './duplicates.ts';
import { dayRange, localParts } from './time.ts';
import type { EventFormat, EventStatus, ModerationStatus } from './types.ts';

/*
 * Reads for the admin. Service role, so they see every event in every state.
 * Each one checks the admin itself. The admin layout checks too, but Next
 * can render a page without re-running its layout, so a layout check alone
 * does not protect what a page reads.
 */

export interface AdminEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  format: EventFormat;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  online_url: string | null;
  ticket_url: string | null;
  image_path: string | null;
  status: EventStatus;
  moderation: ModerationStatus;
  rejection_reason: string | null;
  featured: boolean;
  review_flags: string[];
  legacy_post_id: number | null;
  event_type_slug: string | null;
  created_at: string;
  published_at: string | null;
  organization: { id: string; name: string; slug: string; verified: boolean };
  venue: { id: string; name: string; verified: boolean; address_line1: string | null; city: string | null } | null;
  submission: { submitter_name: string; submitter_email: string; source: string } | null;
}

const ADMIN_EVENT_SELECT = `
  id, slug, title, description, format, starts_at, ends_at, all_day, online_url, ticket_url, image_path,
  status, moderation, rejection_reason, featured, review_flags, legacy_post_id, event_type_slug, created_at, published_at,
  organization:organizations!inner ( id, name, slug, verified ),
  venue:venues ( id, name, verified, address_line1, city ),
  submission:submissions ( submitter_name, submitter_email, source )
`;

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function shape(rows: unknown[] | null): AdminEvent[] {
  return ((rows ?? []) as Array<AdminEvent & { submission: unknown; venue: unknown; organization: unknown }>).map((r) => ({
    ...r,
    organization: one(r.organization as AdminEvent['organization']) as AdminEvent['organization'],
    venue: one(r.venue as AdminEvent['venue']),
    submission: one(r.submission as AdminEvent['submission'])
  }));
}

export async function adminCounts(): Promise<{ pending: number; flagged: number; unverifiedVenues: number }> {
  await requireAdmin();
  const db = serviceClient();
  const [p, f, v] = await Promise.all([
    db.from('events').select('id', { count: 'exact', head: true }).eq('moderation', 'pending'),
    db.from('events').select('id', { count: 'exact', head: true }).neq('review_flags', '{}').neq('moderation', 'rejected'),
    db.from('venues').select('id', { count: 'exact', head: true }).eq('verified', false).is('merged_into', null)
  ]);
  return { pending: p.count ?? 0, flagged: f.count ?? 0, unverifiedVenues: v.count ?? 0 };
}

export async function adminEvents(view: 'pending' | 'flagged' | 'upcoming' | 'past' | 'rejected', q?: string): Promise<AdminEvent[]> {
  await requireAdmin();
  const db = serviceClient();
  let query = db.from('events').select(ADMIN_EVENT_SELECT);
  const now = new Date().toISOString();
  if (view === 'pending') query = query.eq('moderation', 'pending').order('created_at', { ascending: true });
  if (view === 'flagged') query = query.neq('review_flags', '{}').neq('moderation', 'rejected').order('starts_at', { ascending: true });
  if (view === 'upcoming') query = query.eq('moderation', 'approved').gte('ends_at', now).order('starts_at', { ascending: true });
  if (view === 'past') query = query.eq('moderation', 'approved').lt('ends_at', now).order('starts_at', { ascending: false });
  if (view === 'rejected') query = query.eq('moderation', 'rejected').order('created_at', { ascending: false });
  if (q) query = query.textSearch('search', q, { type: 'websearch', config: 'english' });
  const { data, error } = await query.limit(200);
  if (error) throw new Error(error.message);
  return shape(data);
}

export async function adminEvent(id: string): Promise<AdminEvent | null> {
  await requireAdmin();
  const { data, error } = await serviceClient().from('events').select(ADMIN_EVENT_SELECT).eq('id', id).limit(1);
  if (error) throw new Error(error.message);
  return shape(data)[0] ?? null;
}

export async function eventHistory(id: string): Promise<Array<{ actor: string; action: string; changes: unknown; created_at: string }>> {
  await requireAdmin();
  const { data } = await serviceClient()
    .from('event_changes')
    .select('actor, action, changes, created_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Approved events on the same San Antonio day as `e`, other than `e`. */
export async function sameDayEvents(e: { id: string; starts_at: string }): Promise<Array<{ id: string; slug: string; title: string; starts_at: string; ends_at: string; all_day: boolean; organization: string }>> {
  await requireAdmin();
  const day = dayRange(localParts(e.starts_at).date);
  const { data } = await serviceClient()
    .from('events')
    .select('id, slug, title, starts_at, ends_at, all_day, organization:organizations(name)')
    .eq('moderation', 'approved')
    .neq('id', e.id)
    .lt('starts_at', day.end.toISOString())
    .gt('ends_at', day.start.toISOString())
    .order('starts_at');
  return (data ?? []).map((r: { id: string; slug: string; title: string; starts_at: string; ends_at: string; all_day: boolean; organization: unknown }) => ({
    ...r,
    organization: (one(r.organization as { name: string } | null) ?? { name: '' }).name
  }));
}

export async function adminVenues(): Promise<Array<{ id: string; name: string; slug: string; verified: boolean; address_line1: string | null; city: string | null; postal_code: string | null; merged_into: string | null; events: number }>> {
  await requireAdmin();
  const db = serviceClient();
  const { data, error } = await db.from('venues').select('id, name, slug, verified, address_line1, city, postal_code, merged_into, events(count)').is('merged_into', null).order('name');
  if (error) throw new Error(error.message);
  type Row = { id: string; name: string; slug: string; verified: boolean; address_line1: string | null; city: string | null; postal_code: string | null; merged_into: string | null; events: Array<{ count: number }> };
  return ((data ?? []) as Row[]).map((v) => ({ ...v, events: v.events?.[0]?.count ?? 0 }));
}

export async function adminOrganizations(): Promise<
  Array<{ id: string; name: string; slug: string; cause_slug: string | null; website: string | null; verified: boolean; events: number }>
> {
  await requireAdmin();
  const db = serviceClient();
  const { data, error } = await db
    .from('organizations')
    .select('id, name, slug, cause_slug, website, verified, events(count)')
    .is('merged_into', null)
    .order('name');
  if (error) throw new Error(error.message);
  type Row = { id: string; name: string; slug: string; cause_slug: string | null; website: string | null; verified: boolean; events: Array<{ count: number }> };
  return ((data ?? []) as Row[]).map((o) => ({ ...o, events: o.events?.[0]?.count ?? 0 }));
}

/*
 * The venue and organization pairs an admin should look at: everything
 * similarNames() matches, less the pairs already kept apart. Nothing here
 * merges anything, exactly as the WordPress cleanup report worked.
 */
export async function venueDuplicates(): Promise<DuplicatePair[]> {
  await requireAdmin();
  return duplicatePairs(serviceClient(), 'venue');
}

export async function organizationDuplicates(): Promise<DuplicatePair[]> {
  await requireAdmin();
  return duplicatePairs(serviceClient(), 'organization');
}

/** Venues with no street address, which the old report listed too. */
export async function venuesWithoutAddress(): Promise<Array<{ id: string; name: string; events: number }>> {
  await requireAdmin();
  const db = serviceClient();
  const { data, error } = await db
    .from('venues')
    .select('id, name, address_line1, events(count)')
    .is('merged_into', null)
    .or('address_line1.is.null,address_line1.eq.')
    .order('name');
  if (error) throw new Error(error.message);
  type Row = { id: string; name: string; address_line1: string | null; events: Array<{ count: number }> };
  return ((data ?? []) as Row[]).map((v) => ({ id: v.id, name: v.name, events: v.events?.[0]?.count ?? 0 }));
}

/** What an event still has to answer about its venue and organization names. */
export async function eventNameQuestions(e: AdminEvent): Promise<NameQuestions> {
  await requireAdmin();
  return nameQuestions(serviceClient(), { id: e.id, venue: e.venue, organization: e.organization });
}
