import Link from 'next/link';
import type { EventPeek as Peek } from '@/lib/admin-data';
import { shortDate } from '@/lib/time';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * How many events a venue or an organization has, and which ones.
 *
 * The number on its own was the end of the line: deciding whether two names
 * are one place, or whether a name nobody has read is worth keeping, is
 * mostly a question about what is filed under it, and the only way to see
 * that was to open the record in another tab and come back.
 *
 * Folded away, because the number answers it often enough. Open is a list of
 * titles with dates, each going to the listing, since the next thing after
 * recognising the wrong one is editing it.
 *
 * A nought is plain text. There is nothing to expand, and a disclosure
 * triangle that opens onto nothing is worse than no triangle.
 */
export default function EventPeek({ events, count }: { events: Peek[]; count?: number }) {
  const n = count ?? events.length;
  if (n === 0) return <span className={styles.small}>no events</span>;
  /*
   * A count with nothing behind it means the caller did not load the list for
   * this record. Say the number and stop, rather than offer a triangle that
   * opens onto nothing.
   */
  if (events.length === 0) {
    return (
      <span className={styles.small}>
        {n} event{n === 1 ? '' : 's'}
      </span>
    );
  }

  return (
    <details className={a.peek}>
      <summary>
        {n} event{n === 1 ? '' : 's'}
      </summary>
      <ul className={a.peekList}>
        {events.map((e) => (
          <li key={e.id}>
            <Link href={`/admin/events/${e.id}/`}>{e.title}</Link>
            <span className={styles.small}>
              {' '}
              · {shortDate(e.starts_at)}
              {e.moderation !== 'approved' ? ` · ${e.moderation}` : ''}
              {e.status !== 'scheduled' ? ` · ${e.status}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
