/*
 * The shapes the pages work with. They mirror supabase/migrations; when the
 * schema changes, change these with it (or generate them with
 * `supabase gen types typescript` once the project is linked).
 */

export type EventFormat = 'in_person' | 'virtual' | 'hybrid';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type EventStatus = 'scheduled' | 'cancelled' | 'postponed';
export type OrgSector = 'nonprofit' | 'for_profit' | 'public';

export interface EventType {
  slug: string;
  label: string;
  plural: string;
  sort: number;
  active: boolean;
}

export interface Cause {
  slug: string;
  label: string;
  sort: number;
}

export interface OrganizationRef {
  id: string;
  name: string;
  slug: string;
  cause_slug: string | null;
}

export interface Organization extends OrganizationRef {
  sector: OrgSector | null;
  website: string | null;
  description: string | null;
  merged_into: string | null;
}

export interface VenueRef {
  id: string;
  name: string;
  slug: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Venue extends VenueRef {
  website: string | null;
  verified: boolean;
  merged_into: string | null;
}

/** An event as the public pages show it. */
export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  format: EventFormat;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  time_zone: string;
  online_url: string | null;
  ticket_url: string | null;
  image_path: string | null;
  status: EventStatus;
  featured: boolean;
  published_at: string | null;
  organization: OrganizationRef;
  venue: VenueRef | null;
  event_type: { slug: string; label: string } | null;
}

/** The select string that produces a PublicEvent. */
export const PUBLIC_EVENT_SELECT = `
  id, slug, title, description, format, starts_at, ends_at, all_day, time_zone,
  online_url, ticket_url, image_path, status, featured, published_at,
  organization:organizations!inner ( id, name, slug, cause_slug ),
  venue:venues ( id, name, slug, address_line1, address_line2, city, state, postal_code, latitude, longitude ),
  event_type:event_types ( slug, label )
`;

/** A compact event for calendars and the date check. */
export interface CalendarEvent {
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: EventStatus;
  organization: string;
  venue: string | null;
}

/** A day planners should know about (Thanksgiving, Election Day). Not an event. */
export interface Holiday {
  date: string;
  name: string;
}

/** Which list a "not the same" decision is about. */
export type NameKind = 'venue' | 'organization';

/*
 * A pair of records similarNames() matched that an admin has looked at and
 * kept apart. Being here keeps the pair off the duplicate lists and out of
 * the question on the review page; neither record changes. The two ids are
 * always stored with the smaller first, so one decision answers the pair
 * whichever way round it is asked about.
 */
export interface NameDecision {
  kind: NameKind;
  a_id: string;
  b_id: string;
  decided_by: string;
  decided_at: string;
}
