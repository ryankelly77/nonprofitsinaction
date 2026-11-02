import { SUPABASE_URL } from './env.ts';
import type { EventFormat, VenueRef } from './types.ts';

/** "451 North Main St., Boerne, TX 78006", from whatever parts a venue has. */
export function venueAddress(v: Pick<VenueRef, 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'>): string {
  const street = [v.address_line1, v.address_line2].filter(Boolean).join(', ');
  const cityState = [v.city, [v.state, v.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [street, cityState].filter(Boolean).join(', ');
}

/** A Google Maps directions link to the venue. */
export function directionsUrl(v: VenueRef): string {
  const destination = v.latitude && v.longitude ? `${v.latitude},${v.longitude}` : [v.name, venueAddress(v)].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export const FORMAT_LABEL: Record<EventFormat, string> = {
  in_person: 'In person',
  virtual: 'Online',
  hybrid: 'In person and online'
};

/** Where an image in the event-images bucket is served from. */
export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/event-images/${path.split('/').map(encodeURIComponent).join('/')}`;
}

/** Only http(s) links are ever rendered as links. */
export function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
