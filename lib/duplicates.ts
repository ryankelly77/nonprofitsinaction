import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { similarNames, type SimilarRule } from './names.ts';
import type { NameKind } from './types.ts';

/*
 * Finding the records a name might already be, and remembering the pairs an
 * admin has kept apart.
 *
 * Nothing here merges anything. similarNames() is deliberately loose, so its
 * answer is always a question put to a person: the old WordPress report
 * worked the same way and never merged on its own.
 *
 * Both lists are small (a hundred or so venues, about as many organizations),
 * so every candidate is compared in memory rather than approximated in SQL.
 * That keeps the admin lists, the review page and the submit form using one
 * rule, which is the point.
 */

export interface NameMatch {
  id: string;
  name: string;
  rule: SimilarRule;
  events: number;
  address: string | null;
}

interface Row {
  id: string;
  name: string;
  address_line1?: string | null;
  city?: string | null;
  events?: Array<{ count: number }>;
}

/** A pair, smaller id first, so one decision answers it whichever way it is asked. */
export function pairIds(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export function pairKey(a: string, b: string): string {
  return pairIds(a, b).join('|');
}

/** The pairs an admin has already said are not the same place. */
export async function dismissedPairs(db: SupabaseClient, kind: NameKind): Promise<Set<string>> {
  const { data, error } = await db.from('name_decisions').select('a_id, b_id').eq('kind', kind);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r: { a_id: string; b_id: string }) => `${r.a_id}|${r.b_id}`));
}

/** Record that two records are not the same. Saying it twice is not an error. */
export async function keepApart(db: SupabaseClient, kind: NameKind, a: string, b: string, actor: string): Promise<void> {
  const [x, y] = pairIds(a, b);
  if (x === y) return;
  const { error } = await db.from('name_decisions').upsert({ kind, a_id: x, b_id: y, decided_by: actor }, { onConflict: 'kind,a_id,b_id' });
  if (error) throw new Error(error.message);
}

function addressOf(r: Row): string | null {
  return [r.address_line1, r.city].filter(Boolean).join(', ') || null;
}

function toMatch(r: Row, rule: SimilarRule): NameMatch {
  return { id: r.id, name: r.name, rule, events: r.events?.[0]?.count ?? 0, address: addressOf(r) };
}

async function allOf(db: SupabaseClient, kind: NameKind): Promise<Row[]> {
  const table = kind === 'venue' ? 'venues' : 'organizations';
  const select = kind === 'venue' ? 'id, name, address_line1, city, events(count)' : 'id, name, events(count)';
  const { data, error } = await db.from(table).select(select).is('merged_into', null);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Row[];
}

/*
 * The records a given one might duplicate: everything similarNames() pairs it
 * with, less the pairs already kept apart. Used on the review page, where the
 * record in question is usually one a submitter has just typed in.
 */
export async function matchesFor(db: SupabaseClient, kind: NameKind, id: string, name: string): Promise<NameMatch[]> {
  const [rows, skip] = await Promise.all([allOf(db, kind), dismissedPairs(db, kind)]);
  const out: NameMatch[] = [];
  for (const r of rows) {
    if (r.id === id) continue;
    if (skip.has(pairKey(id, r.id))) continue;
    const rule = similarNames(name, r.name);
    if (rule) out.push(toMatch(r, rule));
  }
  // The ones with a history first: an established record is the likelier home.
  return out.sort((a, b) => b.events - a.events || a.name.localeCompare(b.name));
}

export interface DuplicatePair {
  rule: SimilarRule;
  a: NameMatch;
  b: NameMatch;
}

/** Every pair in one list that a person should decide about, less the dismissed ones. */
export async function duplicatePairs(db: SupabaseClient, kind: NameKind): Promise<DuplicatePair[]> {
  const [rows, skip] = await Promise.all([allOf(db, kind), dismissedPairs(db, kind)]);
  const out: DuplicatePair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (skip.has(pairKey(rows[i].id, rows[j].id))) continue;
      const rule = similarNames(rows[i].name, rows[j].name);
      if (rule) out.push({ rule, a: toMatch(rows[i], rule), b: toMatch(rows[j], rule) });
    }
  }
  return out.sort((x, y) => x.a.name.localeCompare(y.a.name));
}

export interface NameQuestions {
  venue: NameMatch[];
  organization: NameMatch[];
}

/*
 * The questions an event raises before it can be published.
 *
 * Approving used to vouch for a typed-in venue, which turned a misspelling
 * into a suggestion for the next person: the way "Wittie Museum" would have
 * become a choice on the form. So a venue nobody has checked, and an
 * organization with no approved event yet, are both looked up against what is
 * already listed, and an admin answers before either becomes permanent.
 *
 * An empty answer here is the normal case: a venue picked from the list is
 * already verified, and a returning organization already has events.
 */
export async function nameQuestions(
  db: SupabaseClient,
  event: { id: string; venue: { id: string; name: string; verified: boolean } | null; organization: { id: string; name: string } }
): Promise<NameQuestions> {
  const venue = event.venue && !event.venue.verified ? await matchesFor(db, 'venue', event.venue.id, event.venue.name) : [];

  const { count, error } = await db
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', event.organization.id)
    .eq('moderation', 'approved')
    .neq('id', event.id);
  if (error) throw new Error(error.message);
  const organization = (count ?? 0) === 0 ? await matchesFor(db, 'organization', event.organization.id, event.organization.name) : [];

  return { venue, organization };
}

export function hasOpenQuestions(q: NameQuestions): boolean {
  return q.venue.length > 0 || q.organization.length > 0;
}
