import 'server-only';
import { resolveVenue, logChange } from './listing.ts';
import { refreshPublicPages } from './revalidate.ts';
import { eventInput, normalizeEvent, type Errors } from './submission.ts';
import { serviceClient } from './supabase/service.ts';
import { todayLocal } from './time.ts';

/*
 * Changing one event's details, from the private edit link or the admin.
 * The same checks as a new submission (lib/submission.ts), except a date
 * already in the past is allowed, so an old listing's typo can be fixed.
 */

const TRACKED = ['title', 'event_type_slug', 'format', 'starts_at', 'ends_at', 'all_day', 'venue_id', 'online_url', 'ticket_url', 'description', 'image_path'] as const;

export async function applyEventEdit(
  id: string,
  raw: unknown,
  actor: string
): Promise<{ ok: true; changed: string[]; wasLive: boolean } | { ok: false; errors: Errors }> {
  const db = serviceClient();
  const parsed = eventInput.safeParse(raw);
  if (!parsed.success) {
    const errors: Errors = {};
    for (const i of parsed.error.issues) errors[`events.0.${i.path.join('.')}`] ??= i.message;
    return { ok: false, errors };
  }
  const { data: types } = await db.from('event_types').select('slug');
  const norm = normalizeEvent(parsed.data, 'events.0', {
    today: todayLocal(),
    typeSlugs: new Set((types ?? []).map((t: { slug: string }) => t.slug)),
    allowPast: true
  });
  if (!norm.value) return { ok: false, errors: norm.errors };
  const v = norm.value;

  const { data: before, error } = await db.from('events').select('*').eq('id', id).single();
  if (error || !before) return { ok: false, errors: { form: 'That event no longer exists.' } };

  const venue = await resolveVenue(db, v.venue);
  const next: Record<string, unknown> = {
    title: v.title,
    event_type_slug: v.event_type_slug,
    format: v.format,
    starts_at: v.starts_at,
    ends_at: v.ends_at,
    all_day: v.all_day,
    venue_id: venue.id,
    online_url: v.online_url,
    ticket_url: v.ticket_url,
    description: v.description,
    image_path: v.image_path
  };
  const changed = TRACKED.filter((k) => {
    const a = before[k];
    const b = next[k];
    if (k === 'starts_at' || k === 'ends_at') return new Date(a as string).getTime() !== new Date(b as string).getTime();
    return (a ?? null) !== (b ?? null);
  });
  if (changed.length === 0) return { ok: true, changed: [], wasLive: before.moderation === 'approved' };

  const flags: string[] = before.review_flags ?? [];
  const update: Record<string, unknown> = { ...next };
  if (venue.isNew && !flags.includes('venue-new')) update.review_flags = [...flags, 'venue-new'];
  // An admin saving an imported event's time is the check the import asked for.
  if (actor.startsWith('admin:') && (changed.includes('starts_at') || changed.includes('ends_at'))) {
    update.review_flags = ((update.review_flags as string[] | undefined) ?? flags).filter((f) => !f.startsWith('time-'));
  }
  const { error: upErr } = await db.from('events').update(update).eq('id', id);
  if (upErr) return { ok: false, errors: { form: upErr.message } };

  const diff = Object.fromEntries(changed.map((k) => [k, { from: before[k] ?? null, to: next[k] ?? null }]));
  await logChange(db, id, actor, 'edited', diff);
  if (before.moderation === 'approved') refreshPublicPages();
  return { ok: true, changed: [...changed], wasLive: before.moderation === 'approved' };
}
