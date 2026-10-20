import styles from './site.module.css';

/*
 * The colour for each event type, shared by the public cards and the admin
 * queue so the two cannot drift apart. The colours themselves, and why red
 * and teal are left out of the set, are in site.module.css.
 */
const TYPE_TAG: Record<string, string> = {
  breakfast: styles.typeBreakfast,
  luncheon: styles.typeLuncheon,
  dinner: styles.typeDinner,
  'run-walk': styles.typeRunWalk,
  golf: styles.typeGolf,
  'sporting-event': styles.typeSportingEvent,
  conference: styles.typeConference,
  community: styles.typeCommunity,
  gala: styles.typeGala,
  concert: styles.typeConcert,
  festival: styles.typeFestival,
  other: styles.typeOther
};

/*
 * The colour class for an event type. A type with no colour listed gets
 * nothing back and keeps the plain tag, so adding one to the database is
 * never a broken-looking pill.
 */
export function typeTagClass(slug: string | null | undefined): string {
  return (slug && TYPE_TAG[slug]) || '';
}
