import { requireAdmin } from '@/lib/admin-auth';
import { activeRejectionReasons, adminCounts, adminEvents } from '@/lib/admin-data';
import EventList, { type ListView } from '../EventList';
import Tabs from '../Tabs';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Review' };

/*
 * Listings waiting on a person.
 *
 * Apart from the events screen on purpose. Both show listings, but the
 * question is different: here it is whether something goes up, there it is
 * what is already up. One page doing both meant the navigation could only
 * offer "listings", and the work hid among the thousand things already done.
 */
const VIEWS = [
  { key: 'pending', label: 'Waiting for review' },
  { key: 'flagged', label: 'Needs a check' },
  /*
   * Both already over. Nothing useful is decided about either any more, so
   * they are out of the counts and kept where they can be seen and tidied.
   */
  { key: 'pending-past', label: 'Waiting, already over' },
  { key: 'flagged-past', label: 'Flagged, already over' },
  { key: 'rejected', label: 'Not approved' }
] as const;

export default async function ReviewPage({
  searchParams
}: {
  searchParams: Promise<{ view?: string; q?: string; approved?: string; held?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'pending') as ListView;
  const q = sp.q?.trim() || undefined;
  const [events, reasons, counts] = await Promise.all([adminEvents(view, q), activeRejectionReasons(), adminCounts()]);
  const approved = Number(sp.approved) || 0;
  const held = Number(sp.held) || 0;
  const back = `/admin/review/?view=${view}`;

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Review</h1>
        <form className={a.inline} action="/admin/review/">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="aq" className={styles.visuallyHidden}>
            Search
          </label>
          <input id="aq" name="q" type="search" defaultValue={q} placeholder="Search title, host or venue" className={a.cellInput} style={{ width: 'auto', minWidth: 230 }} />
          <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
            Search
          </button>
        </form>
      </div>

      {/*
        * The two kinds of waiting carry their own counts, because they are
        * different work: one is "decide whether this goes up", the other is
        * "it is up, or could be, and something about it is unfinished".
        */}
      <Tabs
        current={view}
        tabs={VIEWS.map((v) => ({
          key: v.key,
          label: v.label,
          href: `/admin/review/?view=${v.key}`,
          count: v.key === 'pending' ? counts.pending : v.key === 'flagged' ? counts.flagged : undefined
        }))}
      />

      {(approved > 0 || held > 0) && (
        <p className={a.done}>
          {approved > 0 && `${approved} published.`}
          {held > 0 && ` ${held} left waiting: answer the question about the venue or organization first.`}
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <EventList
          events={events}
          view={view}
          reasons={reasons}
          back={back}
          empty={view === 'pending' ? 'Nothing is waiting for review.' : 'Nothing here.'}
        />
      </div>
    </>
  );
}
