import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { nameKey } from './names.ts';
import { slugify, uniqueSlug } from './slug.ts';
import type { NormalizedEvent } from './submission.ts';

/*
 * Writing a listing: finding or creating its organization and venues, and
 * giving each event an address of its own. Used by the public form, the
 * private edit link and the admin. Always called with the service role.
 */

async function takenSlugs(db: SupabaseClient, table: 'events' | 'organizations' | 'venues', base: string): Promise<Set<string>> {
  const { data, error } = await db.from(table).select('slug').like('slug', `${base}%`);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: { slug: string }) => r.slug));
}

export async function freeSlug(db: SupabaseClient, table: 'events' | 'organizations' | 'venues', title: string, reserved = new Set<string>()): Promise<string> {
  const base = slugify(title);
  const taken = await takenSlugs(db, table, base);
  for (const r of reserved) taken.add(r);
  return uniqueSlug(base, taken);
}

/** The organization a typed name belongs to, created if it is new. Follows merges. */
export async function findOrCreateOrganization(
  db: SupabaseClient,
  org: { name: string; cause: string; sector: 'nonprofit' | 'for_profit' | 'public' }
): Promise<string> {
  const { data, error } = await db.from('organizations').select('id, merged_into').eq('name_key', nameKey(org.name)).limit(1);
  if (error) throw new Error(error.message);
  if (data?.[0]) return data[0].merged_into ?? data[0].id;
  const slug = await freeSlug(db, 'organizations', org.name);
  const created = await db
    .from('organizations')
    .insert({ name: org.name, slug, cause_slug: org.cause, sector: org.sector })
    .select('id')
    .single();
  if (created.error) throw new Error(created.error.message);
  return created.data.id;
}

/** The venue an event names: an existing one, one with the same name, or a new unverified one. */
export async function resolveVenue(db: SupabaseClient, venue: NormalizedEvent['venue']): Promise<{ id: string | null; isNew: boolean }> {
  if (!venue) return { id: null, isNew: false };
  if ('id' in venue) {
    const { data } = await db.from('venues').select('id, merged_into').eq('id', venue.id).limit(1);
    if (!data?.[0]) throw new Error('That venue is no longer listed. Pick it again or add it.');
    return { id: data[0].merged_into ?? data[0].id, isNew: false };
  }
  const { data: same } = await db.from('venues').select('id, merged_into').eq('name_key', nameKey(venue.new.name)).limit(1);
  if (same?.[0]) return { id: same[0].merged_into ?? same[0].id, isNew: false };
  const slug = await freeSlug(db, 'venues', venue.new.name);
  const created = await db
    .from('venues')
    .insert({
      name: venue.new.name,
      slug,
      address_line1: venue.new.address,
      city: venue.new.city ?? 'San Antonio',
      state: 'TX',
      postal_code: venue.new.postalCode,
      verified: false
    })
    .select('id')
    .single();
  if (created.error) throw new Error(created.error.message);
  return { id: created.data.id, isNew: true };
}

export async function logChange(db: SupabaseClient, eventId: string, actor: string, action: string, changes?: unknown): Promise<void> {
  await db.from('event_changes').insert({ event_id: eventId, actor, action, changes: changes ?? null });
}
