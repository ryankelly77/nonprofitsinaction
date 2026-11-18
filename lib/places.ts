import 'server-only';
import { addressFromComponents, type Component, type StreetAddress } from './address.ts';

/*
 * Asking Google where a venue is.
 *
 * Forty-eight venues came out of the WordPress import with a name and no
 * address, because the old form never made anyone type one. Most of them are
 * real, findable places: the Witte Museum, the Grand Hyatt, La Cantera. The
 * admin should not have to go and look each one up in another tab and copy
 * it back.
 *
 * This only ever *suggests*. Nothing it returns is written anywhere until an
 * admin picks one and saves, because an address is a fact about the world
 * and a guessed one sends people to the wrong building. Google is a better
 * guesser than we are; it is still a guesser.
 *
 * Without GOOGLE_PLACES_API_KEY the lookup returns nothing and the admin
 * types the address by hand, the same way the rest of the optional services
 * here behave.
 */

export type { Component };

export interface AddressSuggestion extends StreetAddress {
  name: string;
  /** The whole thing as Google writes it, for the admin to read before picking. */
  formatted: string;
}

/* Everything on this calendar is in or around San Antonio. */
const SAN_ANTONIO = { latitude: 29.4252, longitude: -98.4946 };
const WITHIN_METRES = 60_000;

export function hasPlaces(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

/** Up to a handful of places Google thinks this name might be. */
export async function suggestAddresses(name: string): Promise<AddressSuggestion[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const query = name.trim();
  if (!key || query.length < 3) return [];

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // Asking for the fewest fields that answer the question: the field
        // mask is what Google bills on.
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.addressComponents'
      },
      body: JSON.stringify({
        textQuery: `${query}, San Antonio, TX`,
        maxResultCount: 5,
        languageCode: 'en',
        locationBias: { circle: { center: SAN_ANTONIO, radius: WITHIN_METRES } }
      }),
      cache: 'no-store'
    });
    if (!res.ok) {
      console.error(`[places] Google refused (${res.status}): ${await res.text()}`);
      return [];
    }
    const data = (await res.json()) as {
      places?: Array<{ displayName?: { text?: string }; formattedAddress?: string; addressComponents?: Component[] }>;
    };
    return (data.places ?? [])
      .map((p) => ({
        name: p.displayName?.text ?? query,
        formatted: p.formattedAddress ?? '',
        ...addressFromComponents(p.addressComponents)
      }))
      // A result with no street line cannot fill the field it is here to
      // fill, so it is not offered.
      .filter((s) => s.line1);
  } catch (err) {
    console.error('[places] Google unreachable:', err);
    return [];
  }
}
