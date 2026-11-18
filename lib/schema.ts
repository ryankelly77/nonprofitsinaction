import { imageUrl } from '@/lib/format';
import { hasEnded, isoWithOffset } from '@/lib/time';
import type { PublicEvent } from '@/lib/types';

/*
 * schema.org data. Event pages carry an Event, which is what gets them into
 * Google's event listings; the old site sent none.
 */

const STATUS = {
  scheduled: 'https://schema.org/EventScheduled',
  cancelled: 'https://schema.org/EventCancelled',
  postponed: 'https://schema.org/EventPostponed'
} as const;

const MODE = {
  in_person: 'https://schema.org/OfflineEventAttendanceMode',
  virtual: 'https://schema.org/OnlineEventAttendanceMode',
  hybrid: 'https://schema.org/MixedEventAttendanceMode'
} as const;

export function eventJsonLd(e: PublicEvent, siteUrl: string) {
  const place = e.venue
    ? {
        '@type': 'Place',
        name: e.venue.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: [e.venue.address_line1, e.venue.address_line2].filter(Boolean).join(', ') || undefined,
          addressLocality: e.venue.city ?? 'San Antonio',
          addressRegion: e.venue.state ?? 'TX',
          postalCode: e.venue.postal_code ?? undefined,
          addressCountry: 'US'
        },
        geo:
          e.venue.latitude && e.venue.longitude
            ? { '@type': 'GeoCoordinates', latitude: e.venue.latitude, longitude: e.venue.longitude }
            : undefined
      }
    : null;
  const online = e.online_url ? { '@type': 'VirtualLocation', url: e.online_url } : null;
  const location = [place, online].filter(Boolean);
  const image = imageUrl(e.image_path);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    url: `${siteUrl}/events/${e.slug}/`,
    startDate: isoWithOffset(e.starts_at),
    endDate: isoWithOffset(e.ends_at),
    eventStatus: STATUS[e.status],
    eventAttendanceMode: MODE[e.format],
    location: location.length === 1 ? location[0] : location.length ? location : undefined,
    description: e.description ?? `${e.title}, hosted by ${e.organization.name}${e.venue ? ` at ${e.venue.name}` : ''}.`,
    image: image ? [image] : undefined,
    organizer: { '@type': 'Organization', name: e.organization.name, url: `${siteUrl}/organizations/${e.organization.slug}/` },
    offers: offer(e)
  };
}

/*
 * What it costs, said the way schema.org asks for it.
 *
 * A price is the thing Google's event results most want after the date and
 * the place, and "Free" is the single most useful word a listing can carry.
 * Nothing is invented: an event nobody has priced keeps the bare Offer it
 * had before, with a link and no number, rather than being guessed at as
 * free.
 *
 * Tiered tickets become an AggregateOffer, which is what a range is for; one
 * price stays a plain Offer.
 */
function offer(e: PublicEvent) {
  const min = e.price_cents;
  const max = e.price_max_cents;
  if (min === null) return e.ticket_url ? { '@type': 'Offer', url: e.ticket_url } : undefined;

  const common = {
    priceCurrency: 'USD',
    url: e.ticket_url ?? undefined,
    // Only while it can still be attended; "in stock" for last year's gala
    // would be a small lie told to a machine that believes it.
    availability: hasEnded(e.ends_at) ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock'
  };
  const dollars = (cents: number) => (cents / 100).toFixed(2);
  return max === null || max === min
    ? { '@type': 'Offer', price: dollars(min), ...common }
    : { '@type': 'AggregateOffer', lowPrice: dollars(min), highPrice: dollars(max), ...common };
}

function withoutContext<T extends { '@context': string }>(node: T): Omit<T, '@context'> {
  const copy = { ...node } as Partial<T>;
  delete copy['@context'];
  return copy as Omit<T, '@context'>;
}

/*
 * An organization's page, as the thing it actually is: a nonprofit and the
 * events it runs.
 *
 * The events are carried inside the organization rather than listed loose,
 * which is what lets something reading the page answer "what does this
 * charity put on" without crawling every event page. Only the ones still to
 * come: an assistant repeating a date that has been and gone is the failure
 * worth designing against.
 *
 * NGO rather than Organization. It is the narrower type and every
 * organization on this calendar is one, which is the whole admission
 * criterion.
 */
export function organizationJsonLd(
  org: { name: string; slug: string; description: string | null; website: string | null },
  upcoming: PublicEvent[],
  siteUrl: string
) {
  const url = `${siteUrl}/organizations/${org.slug}/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    name: org.name,
    url,
    description: org.description ?? `${org.name} lists its events on the San Antonio nonprofit community calendar.`,
    // The charity's own site is the authority on it; this page is a mention.
    sameAs: org.website ? [org.website] : undefined,
    areaServed: { '@type': 'City', name: 'San Antonio', addressRegion: 'TX', addressCountry: 'US' },
    // Nested events drop their own @context: the document already has one,
    // and repeating it inside is not what the nesting means.
    event: upcoming.length ? upcoming.map((e) => withoutContext(eventJsonLd(e, siteUrl))) : undefined
  };
}

/* The trail the page already shows, said again where a crawler reads it. */
export function breadcrumbJsonLd(trail: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: t.url }))
  };
}

export function siteJsonLd(siteUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Nonprofits in Action',
    url: `${siteUrl}/`,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/events/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

