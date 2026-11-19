import Link from 'next/link';
import Icon from '@/components/Icon';
import { requireAdmin } from '@/lib/admin-auth';
import { adminCounts, organizationDuplicates, recentActivity, venueDuplicates, venuesWithoutAddress } from '@/lib/admin-data';
import { describeActor, describeChange } from '@/lib/history';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Dashboard' };

/*
 * What is waiting on a person, and what has happened lately.
 *
 * The admin used to open straight onto the review queue, which answered one
 * question well and hid five others: nothing said that two venues looked
 * alike, or that a dozen had no address, until you went to their own pages
 * and found out. Somebody coming back after a week had no way to see what
 * had piled up, or what had gone on without them.
 *
 * Only outstanding work is shown. A tile with nothing behind it is left out,
 * so an empty dashboard means there is genuinely nothing to do, which is
 * worth being able to see at a glance rather than having to read.
 */
export default async function Dashboard() {
  const admin = await requireAdmin();
  const [counts, vDupes, oDupes, noAddress, lately] = await Promise.all([
    adminCounts(),
    venueDuplicates(),
    organizationDuplicates(),
    venuesWithoutAddress(),
    recentActivity()
  ]);

  const work = [
    {
      key: 'pending',
      count: counts.pending,
      title: 'Waiting for review',
      line: 'Nobody has decided about these yet. Approving one puts it on the calendar.',
      href: '/admin/review/'
    },
    {
      key: 'flagged',
      count: counts.flagged,
      title: 'Needs a check',
      line: 'On the calendar, or ready to be, with something unfinished about them.',
      href: '/admin/review/?view=flagged'
    },
    {
      key: 'address',
      count: noAddress.filter((v) => v.upcoming).length,
      title: 'Venues with no address',
      line: 'With a date still to come, so somebody has to be able to find them.',
      href: '/admin/venues/'
    },
    { key: 'vdupes', count: vDupes.length, title: 'Venues that may be one place', line: 'Two names, one building, for you to settle.', href: '/admin/venues/' },
    {
      key: 'odupes',
      count: oDupes.length,
      title: 'Organizations that may be one',
      line: 'Two names, one charity.',
      href: '/admin/organizations/'
    },
    {
      key: 'venues',
      count: counts.unverifiedVenues,
      title: 'Venues not checked',
      line: 'Never suggested on the submit form until somebody has read the name.',
      href: '/admin/venues/'
    },
    {
      key: 'orgs',
      count: counts.unverifiedOrganizations,
      title: 'Organizations not checked',
      line: 'Never suggested on the submit form until somebody has read the name.',
      href: '/admin/organizations/'
    }
  ].filter((w) => w.count > 0);

  const total = work.reduce((n, w) => n + w.count, 0);

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>{greeting(admin.name)}</h1>
      </div>

      {work.length === 0 ? (
        <div className={`${styles.notice} ${styles.noticeOk}`} style={{ marginTop: 20 }}>
          <Icon name="check" size={22} />
          <div>
            <p className={styles.noticeTitle}>Nothing is waiting.</p>
            <p style={{ margin: '4px 0 0' }}>
              Every listing has been decided on, and every venue and organization has been read.{' '}
              <Link href="/admin/events/">See what is on the calendar</Link>.
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className={styles.body} style={{ marginTop: 6 }}>
            {total} thing{total === 1 ? '' : 's'} waiting on you.
          </p>
          <div className={a.dash}>
            {work.map((w) => (
              <Link key={w.key} href={w.href} className={a.dashCard}>
                <span className={a.dashCount}>{w.count}</span>
                <span className={a.dashTitle}>{w.title}</span>
                <span className={a.dashLine}>{w.line}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className={styles.h3} style={{ marginTop: 44 }}>Lately</h2>
      {lately.length === 0 ? (
        <p className={styles.empty} style={{ marginTop: 8 }}>
          Nothing has happened since the import. New listings, and changes organizers make to their own, will show up here.
        </p>
      ) : (
        <>
          <p className={styles.small} style={{ marginTop: 4 }}>
            New listings, changes organizers make to theirs, and anything published without review. Replies to the emails the calendar sends go to your own
            inbox; this cannot see those.
          </p>
          <ul className={a.lately}>
            {lately.map((h, i) => (
              <li key={`${h.eventId}-${i}`}>
                <span className={a.latelyWhen}>{when(h.created_at)}</span>
                <span>
                  <Link href={`/admin/events/${h.eventId}/`}>{h.title}</Link> {said(h.action)} {describeActor(h.actor)}
                  {describeChange(h.changes).map((line) => (
                    <span key={line} className={a.latelyDetail}>
                      {line}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/* The verb, said about the listing rather than by it. */
function said(action: string): string {
  if (action === 'created') return 'was listed by';
  if (action === 'approved') return 'was published by';
  if (action === 'rejected') return 'was turned down by';
  if (action === 'edited') return 'was changed by';
  if (action === 'cancelled') return 'was called off by';
  if (action === 'postponed') return 'was postponed by';
  if (action === 'restored') return 'was put back on by';
  return `${action} by`;
}

/* How long ago, in the words somebody would use for it. */
function when(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Chicago' });
}

/*
 * The reviewer's own name: this is the one screen that is theirs rather than
 * the calendar's. Falls back to the plain word for an admin invited without
 * one.
 */
function greeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hello, ${first}` : 'Dashboard';
}
