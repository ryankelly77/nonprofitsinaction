/*
 * Addresses for events, organizations and venues. Lower case, ASCII, words
 * joined by hyphens, at most 80 characters, cut at a word boundary.
 */
export function slugify(value: string): string {
  const base = value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base.length <= 80) return base || 'event';
  const cut = base.slice(0, 80);
  return cut.slice(0, cut.lastIndexOf('-') > 40 ? cut.lastIndexOf('-') : 80);
}

/** The first of slug, slug-2, slug-3 ... that `taken` does not hold. */
export function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
