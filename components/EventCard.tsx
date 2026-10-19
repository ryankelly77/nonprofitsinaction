import Link from 'next/link';
import { longDate, timeRange } from '@/lib/time';
import type { PublicEvent } from '@/lib/types';
import DateTile from './DateTile';
import styles from './site.module.css';

function where(e: PublicEvent): string {
  if (e.venue) return e.venue.name;
  if (e.format === 'virtual') return 'Online';
  return 'Venue to be announced';
}

export function StatusTags({ e }: { e: PublicEvent }) {
  return (
    <span className={styles.tagRow}>
      {e.status === 'cancelled' && <span className={`${styles.tag} ${styles.tagCancelled}`}>Canceled</span>}
      {e.status === 'postponed' && <span className={`${styles.tag} ${styles.tagCancelled}`}>Postponed</span>}
      {e.event_type && <span className={styles.tag}>{e.event_type.label}</span>}
      {e.format !== 'in_person' && <span className={`${styles.tag} ${styles.tagNeutral}`}>{e.format === 'virtual' ? 'Online' : 'Hybrid'}</span>}
    </span>
  );
}

export default function EventCard({ e }: { e: PublicEvent }) {
  return (
    <article className={styles.card}>
      <DateTile at={e.starts_at} />
      <div className={styles.cardBody}>
        <StatusTags e={e} />
        <h3 className={styles.cardTitle}>
          <Link href={`/events/${e.slug}/`}>{e.title}</Link>
        </h3>
        <p className={styles.cardOrg}>{e.organization.name}</p>
        <p className={styles.cardMeta}>
          <span className={styles.visuallyHidden}>{longDate(e.starts_at)}, </span>
          {timeRange(e.starts_at, e.ends_at, e.all_day)} · {where(e)}
        </p>
      </div>
    </article>
  );
}

export function EventRow({ e, last = false, note }: { e: PublicEvent; last?: boolean; note?: string }) {
  return (
    <li className={`${styles.row} ${last ? styles.rowLast : ''}`}>
      <DateTile at={e.starts_at} small />
      <div className={styles.rowBody}>
        <Link href={`/events/${e.slug}/`} className={styles.rowTitle}>
          {e.title}
        </Link>
        <span className={styles.rowMeta}>{e.organization.name}</span>
        <span className={styles.rowMeta}>
          <span className={styles.visuallyHidden}>{longDate(e.starts_at)}, </span>
          {note ?? `${timeRange(e.starts_at, e.ends_at, e.all_day)}${e.venue ? ` · ${e.venue.name}` : ''}`}
        </span>
      </div>
    </li>
  );
}
