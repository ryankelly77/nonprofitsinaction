/*
 * Turning a Google place into the four fields the venues table keeps.
 *
 * Apart from lib/places.ts, which reaches the network and is server-only, so
 * that the mapping can be read and tested on its own.
 */

export type Component = { longText: string; shortText: string; types: string[] };

/*
 * Google returns an address in pieces; the database wants a street line, a
 * city, a state and a ZIP. Kept pure and exported so the mapping can be
 * tested without a network call.
 */
export interface StreetAddress {
  line1: string | null;
  city: string | null;
  state: string | null;
  postal: string | null;
}

export function addressFromComponents(components: Component[] | undefined): StreetAddress {
  const find = (type: string, short = false) => {
    const c = (components ?? []).find((x) => x.types.includes(type));
    return c ? (short ? c.shortText : c.longText) : null;
  };
  const number = find('street_number');
  const street = find('route');
  return {
    // A route with no street number is still worth having: "Hemisfair Plaza
    // Way" beats nothing. A number with no route is not an address at all.
    line1: street ? [number, street].filter(Boolean).join(' ') : null,
    city: find('locality') ?? find('postal_town'),
    state: find('administrative_area_level_1', true),
    postal: find('postal_code')
  };
}

