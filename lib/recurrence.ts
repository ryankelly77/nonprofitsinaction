/*
 * Which listing is the next time round of one that has been and gone.
 *
 * Most of this calendar is annual. The same gala, the same 5K and the same
 * luncheon come back every year under a title that moves with it: "2026
 * Curtain Up Gala" becomes the 2027 one, "44th Annual Zoobilation Ball"
 * becomes the 45th. A page for last year's is where people who search the
 * event by name arrive, and sending them on to this year's is the whole
 * point of keeping it.
 *
 * Kept apart from the database so the matching can be read and tested on its
 * own, the way lib/names.ts is.
 */

/* An ordinal, however it is written: 1st, 2nd, 3rd, 44th, 101st. */
const ORDINAL = /\b\d{1,3}(?:st|nd|rd|th)\b/gu;
/* A year, near enough: 1900 to 2099. */
const YEAR = /\b(?:19|20)\d{2}\b/gu;
/* Words that say an event repeats, which is exactly what we are folding. */
const REPEATING = /\b(?:annual|anniversary|edition)\b/gu;

/*
 * The part of a title that stays the same year on year.
 *
 * Deliberately not nameKey(): that one decides which record a name belongs
 * to and must never fold a difference that changes meaning, and the year is
 * precisely such a difference. This one is the opposite, and only safe
 * because it is never used to merge anything, only to offer a link.
 */
export function recurrenceKey(title: string): string {
  return (title ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/gu, ' and ')
    .replace(ORDINAL, ' ')
    .replace(YEAR, ' ')
    .replace(REPEATING, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^the /u, '')
    .replace(/\s+/gu, ' ');
}

/*
 * Whether a key says enough to act on.
 *
 * Length alone is the wrong test. "Gala" is four letters and could be any of
 * an organization's evenings; "Siclovia" is eight and is the name of one
 * particular thing. What separates them is distinctiveness, so a key of a
 * single common word has to be a long one, while two words together are
 * specific enough on their own: an organization with two different events
 * both called "Curtain Up Gala" does not really have two events.
 */
function worthActingOn(key: string): boolean {
  const words = key.split(' ').filter(Boolean);
  if (words.length === 0) return false;
  return words.length > 1 || words[0].length >= 6;
}

export interface Recurring {
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
}

/*
 * The next time this event happens, out of the candidates given. Callers pass
 * only events from the same organization: a title alone is nowhere near
 * enough across the whole calendar, where half a dozen charities run a
 * "Spring Gala".
 *
 * The soonest one wins, so an event listed three years running points at the
 * next one rather than the last.
 */
export function nextOccurrence<T extends Recurring>(past: Recurring, candidates: readonly T[], now: number = Date.now()): T | null {
  const key = recurrenceKey(past.title);
  if (!worthActingOn(key)) return null;
  return (
    candidates
      .filter((c) => c.slug !== past.slug)
      // Still to come, and later than the one being looked at, so a listing
      // cannot point backwards at something that has also finished.
      .filter((c) => Date.parse(c.ends_at) >= now && Date.parse(c.starts_at) > Date.parse(past.starts_at))
      .filter((c) => recurrenceKey(c.title) === key)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))[0] ?? null
  );
}
