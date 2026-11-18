/*
 * What it costs to attend, held in cents.
 *
 * Cents, not dollars, because a price is money and money in a float is how
 * $74.99 becomes $74.98999999999999. Everything stored and compared is a
 * whole number; dollars exist only where a person reads or types one.
 */

/** Nobody is listing a San Antonio charity luncheon at a million dollars. */
const CEILING = 1_000_000_00;

/*
 * A price as somebody types it. "$75", "75", "75.00", "1,250" and " 75 " are
 * all the same number; anything else is not a price.
 *
 * Returns the amount in cents, or null if it cannot be read as one. Null is
 * not zero: zero is free, null is "we do not know", and the difference is
 * the whole reason the field has three states rather than a number alone.
 */
export function parsePrice(raw: unknown): number | null {
  const text = String(raw ?? '')
    .trim()
    .replace(/^\$/, '')
    .replace(/,/g, '');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (!Number.isFinite(cents) || cents < 0 || cents > CEILING) return null;
  return cents;
}

/*
 * Cents as a person reads them: whole dollars lose the ".00", because
 * "$75" is what a ticket costs and "$75.00" is what a receipt says.
 */
export function formatPrice(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** What the event page and the card say about cost. Null when nobody said. */
export function priceLabel(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  if (min === 0 && (max === null || max === 0)) return 'Free';
  if (max === null || max === min) return formatPrice(min);
  // A range reads as a range even when it starts at nothing: a gala with
  // free admission and paid tables is still "Free to $250".
  return `${min === 0 ? 'Free' : formatPrice(min)} to ${formatPrice(max)}`;
}
