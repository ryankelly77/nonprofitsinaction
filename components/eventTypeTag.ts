import styles from './site.module.css';

/*
 * The colour for an event type, shared by the public cards, the month grid
 * and the admin queue so the three cannot drift apart.
 *
 * Keyed by the colour now, not by the slug: which colour a type wears is
 * chosen in the admin and stored on the row, so a kind of event added after
 * launch gets a real colour instead of falling back to amber, which means
 * "something is on this date" everywhere else on the calendar. The colours
 * themselves, and why red and teal are left out of the set, are in
 * site.module.css.
 */
const COLOR_CLASS: Record<string, string> = {
  sand: styles.tagSand,
  citron: styles.tagCitron,
  moss: styles.tagMoss,
  green: styles.tagGreen,
  mint: styles.tagMint,
  sky: styles.tagSky,
  blue: styles.tagBlue,
  violet: styles.tagViolet,
  orchid: styles.tagOrchid,
  blossom: styles.tagBlossom,
  rose: styles.tagRose,
  grey: styles.tagGrey
};

/*
 * The class for a colour. A colour with nothing listed gets nothing back and
 * keeps the plain tag, so a value the stylesheet has never heard of is never
 * a broken-looking pill.
 */
export function typeTagClass(color: string | null | undefined): string {
  return (color && COLOR_CLASS[color]) || '';
}
