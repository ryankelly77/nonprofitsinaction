import { imageUrl } from '@/lib/format';
import { isoWithOffset } from '@/lib/time';
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
    offers: e.ticket_url ? { '@type': 'Offer', url: e.ticket_url } : undefined
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

