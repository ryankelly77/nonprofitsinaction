'use client';

import { useState } from 'react';
import { dateTile } from '@/lib/time';
import type { PublicEvent } from '@/lib/types';
import EventCard from './EventCard';
import Icon from './Icon';
import styles from './site.module.css';

/*
 * A day with more than one event, as the ordinary grid with the first card
 * sitting on a stack: the others show as edges behind it, a bubble counts
 * them, and the chevron opens them out into cards of their own.
 *
 * The hidden ones stay in the page rather than being fetched on opening, so
 * a reader without JavaScript and a search engine both still see every
 * event. Opening only reveals what was already there.
 */
export default function DayStack({ events, id }: { events: PublicEvent[]; id: string }) {
  const [open, setOpen] = useState(false);
  const rest = events.slice(1);
  const t = dateTile(events[0].starts_at);

  return (
    <>
      <div className={`${styles.stackWrap} ${open ? '' : styles.stackCollapsed}`}>
        <EventCard e={events[0]} />
        {!open && (
          <span className={styles.stackBubble} aria-hidden="true">
            +{rest.length}
          </span>
        )}
        <button type="button" className={styles.stackToggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          {open ? `Hide the other ${rest.length}` : `${rest.length} more on ${t.month} ${t.day}`}
          <span className={`${styles.stackChevron} ${open ? styles.stackChevronOpen : ''}`}>
            <Icon name="chevronRight" size={16} />
          </span>
        </button>
      </div>
      <div id={id} className={open ? styles.stackExtras : styles.stackExtrasClosed}>
        {rest.map((e) => (
          <EventCard key={e.id} e={e} />
        ))}
      </div>
    </>
  );
}
