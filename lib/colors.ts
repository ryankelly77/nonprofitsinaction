/*
 * The colours a kind of event may wear.
 *
 * Fixed on purpose. The twelve were chosen by measuring rather than by eye:
 * no two are closer than a deltaE2000 of 7, none is within 7 of the Canceled
 * red, none is dark enough to read as the brand teal, and every pale/dark
 * pair holds 7:1 so the small capitals on a pill stay legible. A free colour
 * picker would undo all of that within a month, so the admin offers this list
 * and nothing else.
 *
 * The names are the colours, not the kinds of event, because which type wears
 * which is now a choice rather than something written into the stylesheet.
 * Adding one means adding it in three places: here, the class in
 * components/site.module.css, and the check constraint on event_types.color.
 *
 * Grouped the way the palette was designed: meals warm, the active types
 * green, daytime and learning blue, evening and the arts violet through pink.
 */

export const EVENT_COLORS = [
  { name: 'sand', label: 'Sand' },
  { name: 'citron', label: 'Citron' },
  { name: 'moss', label: 'Moss' },
  { name: 'green', label: 'Green' },
  { name: 'mint', label: 'Mint' },
  { name: 'sky', label: 'Sky' },
  { name: 'blue', label: 'Blue' },
  { name: 'violet', label: 'Violet' },
  { name: 'orchid', label: 'Orchid' },
  { name: 'blossom', label: 'Blossom' },
  { name: 'rose', label: 'Rose' },
  { name: 'grey', label: 'Grey' }
] as const;

export type EventColor = (typeof EVENT_COLORS)[number]['name'];

/** What a type gets when nobody has chosen, and what the column defaults to. */
export const DEFAULT_EVENT_COLOR: EventColor = 'grey';

const NAMES: readonly string[] = EVENT_COLORS.map((c) => c.name);

/*
 * The server takes nothing on trust from the form: a colour that is not on
 * the list becomes the default rather than reaching the check constraint and
 * failing the save with a database error nobody can read.
 */
export function tidyColor(raw: unknown): EventColor {
  const value = String(raw ?? '').trim().toLowerCase();
  return (NAMES.includes(value) ? value : DEFAULT_EVENT_COLOR) as EventColor;
}
