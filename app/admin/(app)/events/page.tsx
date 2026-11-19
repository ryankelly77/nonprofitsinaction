import { requireAdmin } from '@/lib/admin-auth';
import { activeRejectionReasons, adminEvents } from '@/lib/admin-data';
import { emailingSubmitters } from '@/lib/settings-store';
import EventList, { type ListView } from '../EventList';
import Tabs from '../Tabs';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Events' };

/*
 * What is on the calendar. Not work, which is what the review screen holds:
 * this is the reference you come to on purpose, to find a listing and change
 * something about it.
 *
 * Current and past, because that is the only division anybody wants here.
 * No counts: a thousand past events is not a thousand things to do, and a
 * number next to them would read as though it were.
 */
const VIEWS = [
  { key: 'upcoming', label: 'Current' },
  { key: 'past', label: 'Past' }
] as const;

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view = (VIEWS.some((v) => v.key === sp.view) ? sp.view : 'upcoming') as ListView;
  const q = sp.q?.trim() || undefined;
  const [events, reasons, canEmail] = await Promise.all([adminEvents(view, q), activeRejectionReasons(), emailingSubmitters()]);
  const back = `/admin/events/?view=${view}`;

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Events</h1>
        <form className={a.inline} action="/admin/events/">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="eq" className={styles.visuallyHidden}>
            Search
          </label>
          <input id="eq" name="q" type="search" defaultValue={q} placeholder="Search title, host or venue" className={a.cellInput} style={{ width: 'auto', minWidth: 230 }} />
          <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
            Search
          </button>
        </form>
      </div>

      <Tabs current={view} tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, href: `/admin/events/?view=${v.key}` }))} />

      <div style={{ marginTop: 24 }}>
        <EventList
          events={events}
          view={view}
          reasons={reasons}
          back={back}
          canEmail={canEmail}
          empty={view === 'upcoming' ? 'Nothing is coming up.' : 'Nothing has happened yet.'}
        />
      </div>
    </>
  );
}
