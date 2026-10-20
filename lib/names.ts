/*
 * Matching names to the record they already belong to, and flagging the ones
 * close enough that a person should look.
 *
 * Two different reductions live here and they are not interchangeable:
 *
 *   nameKey()      decides. Two names with one key are one record, so it only
 *                  folds differences that cannot change meaning. The database
 *                  makes the same reduction in public.name_key(); the two must
 *                  stay identical or the server and the generated column will
 *                  disagree about what a name belongs to. tests/names.test.ts
 *                  checks them against each other.
 *
 *   similarNames() only flags. It is far looser, never merges anything, and
 *   				its answer is a suggestion for an admin. Ported from the
 *                  cleanup report the WordPress site ran.
 */

/* Words that trail a legal name without changing which organization it is. */
const TRAILING = new Set(['inc', 'incorporated', 'llc']);

/*
 * Letters and digits only, lower case, with four differences folded away:
 * accents ("González" and "Gonzalez"), "&" against the word "and", a leading
 * "the", and a trailing "Inc"/"Incorporated"/"LLC".
 *
 * The accents go by splitting each letter from its mark (NFD) and dropping
 * the marks, which is what the database does too, so neither side needs the
 * unaccent extension. The leading and trailing words are taken off the list
 * of words, not off the joined string: "Theater Row" starts with "the" as
 * letters but not as a word, and must keep them.
 *
 * A name that is only "The" or only "Inc" keeps it, since a key of nothing
 * would match every other name of nothing.
 */
export function nameKey(value: string): string {
  const words = (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length > 1 && words[0] === 'the') words.shift();
  if (words.length > 1 && TRAILING.has(words[words.length - 1])) words.pop();
  return words.join('');
}

// ---------------------------------------------------------------------------
// Flagging names a person should look at
// ---------------------------------------------------------------------------

/* The words the old report dropped before comparing. */
const SKIP = new Set(['the', 'at', 'in', 'on', 'of']);

/*
 * The old report's own normalization, kept as it was: lower case, trim, drop
 * those words, drop punctuation, collapse spaces. Unlike nameKey this keeps
 * the spaces, because the rules below measure length and containment and both
 * read differently once the words run together.
 */
function loose(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((w) => w && !SKIP.has(w.replace(/[^\p{L}\p{N}]+/gu, '')))
    .join(' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The part before the first hyphen, dash or comma: "Witte Museum - Mays Family Center". */
function head(value: string): string {
  return loose((value ?? '').split(/[-–—,]/)[0] ?? '');
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Why two names were flagged. */
export type SimilarRule = 'same' | 'contains' | 'distance' | 'head';

/*
 * Whether two names are close enough that someone should decide if they are
 * one place, and which rule said so. Never a decision in itself: the old
 * report flagged and a person merged, and that is still the arrangement.
 *
 * The rules are the old report's, in its order:
 *   same      the normalized names are equal
 *   contains  one holds the other and the shorter is at least 10 characters
 *   distance  both are longer than 5 and differ by at most 3 edits, or by
 *             fewer than a fifth of the longer one
 *   head      cut either name at its first hyphen, dash or comma and the
 *             front matches the other's front, or the other name entire
 */
export function similarNames(a: string, b: string): SimilarRule | null {
  const x = loose(a);
  const y = loose(b);
  if (!x || !y) return null;
  if (x === y) return 'same';

  const shorter = Math.min(x.length, y.length);
  const longer = Math.max(x.length, y.length);
  if ((x.includes(y) || y.includes(x)) && shorter >= 10) return 'contains';

  if (x.length > 5 && y.length > 5) {
    const d = editDistance(x, y);
    if (d <= 3 || d < longer * 0.2) return 'distance';
  }

  const hx = head(a);
  const hy = head(b);
  if (hx && hy && hx === hy) return 'head';
  if (hx && (hx === y || hx === hy)) return 'head';
  if (hy && (hy === x || hy === hx)) return 'head';

  return null;
}

/** Every pair out of a list that similarNames flags, with the rule that flagged it. */
export function similarPairs<T>(items: T[], nameOf: (item: T) => string): Array<{ a: T; b: T; rule: SimilarRule }> {
  const out: Array<{ a: T; b: T; rule: SimilarRule }> = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const rule = similarNames(nameOf(items[i]), nameOf(items[j]));
      if (rule) out.push({ a: items[i], b: items[j], rule });
    }
  }
  return out;
}
