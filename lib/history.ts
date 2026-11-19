import { formatPrice } from './money.ts';
import { longDate, timeOfDay } from './time.ts';

/*
 * An event's history, said in words.
 *
 * It used to be printed as the JSON it is stored as, so the commonest line
 * in the admin read:
 *
 *     created by import
 *     { "wordpress_post": 118442 }
 *
 * which tells a reviewer nothing they can use and three things they cannot
 * (that there is JSON, that there is a key, that there is an id). The record
 * underneath is right and worth keeping exactly as it is; only the reading
 * of it was missing.
 *
 * Kept apart from the page so every shape the log can hold is covered by a
 * test rather than by looking at whichever event happened to be open.
 */

const FIELDS: Record<string, string> = {
  title: 'Name',
  event_type_slug: 'Kind of event',
  format: 'Format',
  starts_at: 'Start',
  ends_at: 'End',
  all_day: 'All day',
  venue_id: 'Venue',
  organization_id: 'Host',
  online_url: 'Online link',
  ticket_url: 'Ticket link',
  description: 'Description',
  image_path: 'Image',
  price_cents: 'Cost',
  price_max_cents: 'Top price',
  featured: 'Featured',
  legacy_slugs: 'Old addresses',
  review_flags: 'Flags'
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* One stored value, as a person would say it. */
function say(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return 'nothing';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'nothing';
  if (field === 'price_cents' || field === 'price_max_cents') {
    return typeof value === 'number' ? (value === 0 ? 'free' : formatPrice(value)) : String(value);
  }
  if (field === 'starts_at' || field === 'ends_at') {
    const s = String(value);
    return Number.isNaN(Date.parse(s)) ? s : `${longDate(s)}, ${timeOfDay(s)}`;
  }
  const text = String(value);
  // An id is true but useless to read. What changed is the point, not which
  // row it points at.
  if (UUID.test(text)) return 'another record';
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function isFromTo(v: unknown): v is { from?: unknown; to?: unknown; into?: unknown } {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && ('from' in v || 'to' in v || 'into' in v);
}

/*
 * The lines to show under one entry. Empty when there is nothing worth
 * adding beyond the action itself, which is the common case.
 */
export function describeChange(changes: unknown): string[] {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(changes as Record<string, unknown>)) {
    if (key === 'wordpress_post') {
      out.push(`Brought over from WordPress, post ${String(value)}`);
      continue;
    }
    if (key === 'venue_merged' || key === 'organization_merged') {
      out.push(key === 'venue_merged' ? 'Its venue was folded into another record' : 'Its host was folded into another record');
      continue;
    }
    // Free text the admin wrote, which is already a sentence.
    if (key === 'reason' || key === 'why') {
      out.push(say(key, value));
      continue;
    }
    const label = FIELDS[key] ?? key.replace(/_/g, ' ');
    if (isFromTo(value)) {
      const from = 'from' in value ? say(key, value.from) : null;
      const to = 'to' in value ? say(key, value.to) : 'into' in value ? say(key, value.into) : null;
      out.push(from && to ? `${label}: ${from} → ${to}` : `${label}: ${to ?? from ?? 'changed'}`);
      continue;
    }
    out.push(`${label}: ${say(key, value)}`);
  }
  return out;
}

/* The verb at the head of an entry, and who did it. */
export function describeActor(actor: string): string {
  if (actor === 'import') return 'the WordPress import';
  if (actor === 'auto-approve') return 'auto-approve';
  if (actor === 'submitter') return 'the organizer';
  return actor.replace(/^admin:/, '');
}
