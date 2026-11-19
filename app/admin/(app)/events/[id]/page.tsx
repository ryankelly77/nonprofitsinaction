import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminEventForm from '@/components/AdminEventForm';
import { requireAdmin } from '@/lib/admin-auth';
import { activeRejectionReasons, adminEvent, eventHistory, sameDayEvents } from '@/lib/admin-data';
import { eventToDraft } from '@/lib/draft';
import { describeActor, describeChange } from '@/lib/history';
import { imageUrl } from '@/lib/format';
import { serviceClient } from '@/lib/supabase/service';
import { timeRange } from '@/lib/time';
import RejectForm from '../../RejectForm';
import { approve, setStatus } from '../../../actions';
import a from '../../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Edit event' };

export default async function AdminEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const e = await adminEvent(id);
  if (!e) notFound();
  const db = serviceClient();
  const [history, clashes, orgs, types, reasons] = await Promise.all([
    eventHistory(id),
    sameDayEvents(e),
    db.from('organizations').select('id, name').is('merged_into', null).order('name'),
    db.from('event_types').select('slug, label').order('sort'),
    activeRejectionReasons()
  ]);
  const back = `/admin/events/${id}/`;

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/">Review</Link>
        <span className={styles.crumbSep}>/</span>
        {e.title}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, marginTop: 16 }}>
        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          <h1 className={styles.h2Small}>{e.title}</h1>
          <p className={styles.small} style={{ margin: '8px 0 20px' }}>
            {e.moderation === 'approved' ? (
              <>
                Live at <Link href={`/events/${e.slug}/`}>/events/{e.slug}/</Link>
              </>
            ) : e.moderation === 'pending' ? (
              'Waiting for review. Not public.'
            ) : (
              'Not approved. Not public.'
            )}
            {e.legacy_post_id ? ` · WordPress post ${e.legacy_post_id}` : ''}
          </p>
          <AdminEventForm
            id={e.id}
            slug={e.slug}
            initial={eventToDraft({ ...e, venue: e.venue }, imageUrl(e.image_path))}
            organizationId={e.organization.id}
            featured={e.featured}
            organizations={orgs.data ?? []}
            types={types.data ?? []}
          />
        </div>

        <aside style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {e.moderation !== 'approved' && (
            <form action={approve}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="back" value={back} />
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: '100%' }}>
                Approve and publish
              </button>
            </form>
          )}
          {e.moderation === 'pending' && (
            <details className={a.reject}>
              <summary>Don&apos;t approve</summary>
              {/* The same form, and the same standard answers, as the queue. */}
              <RejectForm eventId={e.id} back="/admin/" tellByDefault={e.submission?.source !== 'eventon-import'} reasons={reasons} />
            </details>
          )}
          <div className={styles.infoCard}>
            <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
              Status
            </p>
            <p style={{ margin: '6px 0 12px', fontWeight: 700 }}>{e.status === 'scheduled' ? 'Scheduled' : e.status === 'cancelled' ? 'Canceled' : 'Postponed'}</p>
            <div className={a.inline}>
              {(['scheduled', 'postponed', 'cancelled'] as const)
                .filter((s) => s !== e.status)
                .map((s) => (
                  <form key={s} action={setStatus}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="status" value={s} />
                    <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Mark {s === 'cancelled' ? 'canceled' : s}
                    </button>
                  </form>
                ))}
            </div>
          </div>
          {e.submission && (
            <div className={styles.infoCard}>
              <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
                Submitted by
              </p>
              <p style={{ margin: '6px 0 0' }}>
                {e.submission.submitter_name}
                <br />
                <a href={`mailto:${e.submission.submitter_email}`}>{e.submission.submitter_email}</a>
              </p>
            </div>
          )}
          {clashes.length > 0 && (
            <div className={a.clash}>
              <strong>Same day:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {clashes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/events/${c.slug}/`}>{c.title}</Link> ({c.organization}), {timeRange(c.starts_at, c.ends_at, c.all_day)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className={styles.infoCard}>
            <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
              History
            </p>
            <ul className={a.history}>
              {history.map((h, i) => (
                <li key={i}>
                  <strong>{h.action}</strong> by {describeActor(h.actor)}
                  <br />
                  <span className={styles.muted}>{new Date(h.created_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}</span>
                  {/* The record underneath is unchanged; only the reading of
                      it. See lib/history.ts for every shape it can hold. */}
                  {describeChange(h.changes).map((line) => (
                    <span key={line} className={a.historyLine}>
                      {line}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
