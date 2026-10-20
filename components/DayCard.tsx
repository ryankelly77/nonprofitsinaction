import Link from 'next/link';
import { dateTile, timeRange } from '@/lib/time';
import type { PublicEvent } from '@/lib/types';
import { typeTagClass } from './eventTypeTag';
import styles from './site.module.css';

/*
 * A day with more than one event, as one card rather than one card each.
 *
 * Most days on this calendar are crowded: three events in five share their
 * date with another. Giving each its own box repeated the date as often as
 * six times on a single day and buried the one thing a planner came to find
 * out, which is that the day is busy. Here the date is said once, the count
 * is marked in amber, and the events stack inside in the order they start.
 *
 * A day with a single event is still an EventCard, unchanged.
 */
export default function DayCard({ events }: { events: PublicEvent[] }) {
  const t = dateTile(events[0].starts_at);
  return (
    <article className={`${styles.card} ${styles.dayCard}`}>
      <div className={styles.dayCardHead}>
        <h3 className={styles.dayCardDate}>
          {t.weekday} {t.day} {t.month}
        </h3>
        <span className={styles.dayCardCount}>{events.length} events</span>
      </div>
      <ul className={styles.dayCardList}>
        {events.map((e) => (
          <li key={e.id} className={`${styles.dayCardItem} ${typeTagClass(e.event_type?.slug ?? null)}`}>
            <span className={styles.dayCardDot} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <h4 className={styles.dayCardTitle}>
                <Link href={`/events/${e.slug}/`}>{e.title}</Link>
              </h4>
              <p className={styles.dayCardMeta}>
                {[e.organization.name, timeRange(e.starts_at, e.ends_at, e.all_day), e.venue?.name].filter(Boolean).join(' · ')}
                {e.status !== 'scheduled' ? ` · ${e.status === 'cancelled' ? 'Canceled' : 'Postponed'}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
