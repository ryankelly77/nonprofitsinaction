import { requireAdmin } from '@/lib/admin-auth';
import Link from 'next/link';
import { adminEvents, eventNameQuestions, sameDayEvents, type AdminEvent } from '@/lib/admin-data';
import { typeTagClass } from '@/components/eventTypeTag';
import NameQuestion from './NameQuestion';
import { FORMAT_LABEL, imageUrl, safeUrl } from '@/lib/format';
import { longDate, timeRange } from '@/lib/time';
import { approve, clearFlags, reject } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Review' };

const VIEWS = [
  { key: 'pending', label: 'Waiting for review' },
  { key: 'flagged', label: 'Needs a check' },
  { key: 'upcoming', label: 'Live, upcoming' },
  { key: 'past', label: 'Live, past' },
  { key: 'rejected', label: 'Not approved' }
] as const;
type View = (typeof VIEWS)[number]['key'];

const FLAG_TEXT: Record<string, string> = {
  'venue-new': 'Venue typed in by hand. Check the name and address before approving.',
  'time-unverified': 'Imported time could not be checked against the original form entry. Confirm the time.',
  'time-corrected': 'Imported time was corrected from the original form entry. Confirm it now reads right.',
  'no-venue': 'Imported without a venue.',
  'type-guessed': 'Imported without an event type; one was guessed.'
};

async function Item({ e, view }: { e: AdminEvent; view: View }) {
  const clashes = view === 'pending' || view === 'flagged' ? await sameDayEvents(e) : [];
  // Only worth asking while the event can still be approved.
  const questions = e.moderation !== 'approved' ? await eventNameQuestions(e) : { venue: [], organization: [] };
  const unanswered = questions.venue.length > 0 || questions.organization.length > 0;
  const ticket = safeUrl(e.ticket_url);
  const image = imageUrl(e.image_path);
  const back = `/admin/?view=${view}`;
  return (
    <article className={a.item}>
      <div className={a.itemMain}>
        <span className={styles.tagRow}>
          {e.event_type_slug && <span className={`${styles.tag} ${typeTagClass(e.event_type_slug)}`}>{e.event_type_slug.replace('-', ' ')}</span>}
          {e.status !== 'scheduled' && <span className={`${styles.tag} ${styles.tagCancelled}`}>{e.status === 'cancelled' ? 'canceled' : e.status}</span>}
          {e.submission?.source === 'eventon-import' && <span className={`${styles.tag} ${styles.tagNeutral}`}>Imported</span>}
        </span>
        <h2 className={styles.h3} style={{ marginTop: 10, fontSize: 22 }}>
          <Link href={`/admin/events/${e.id}/`} style={{ color: 'var(--ink)' }}>
            {e.title}
          </Link>
        </h2>
        <dl className={a.meta}>
          <dt>When</dt>
          <dd>
            {longDate(e.starts_at)}, {timeRange(e.starts_at, e.ends_at, e.all_day)}
          </dd>
          <dt>Host</dt>
          <dd>{e.organization.name}</dd>
          <dt>Where</dt>
          <dd>
            {e.venue ? (
              <>
                {e.venue.name}
                {[e.venue.address_line1, e.venue.city].filter(Boolean).length > 0 && <span className={styles.muted}> · {[e.venue.address_line1, e.venue.city].filter(Boolean).join(', ')}</span>}
                {!e.venue.verified && <strong style={{ color: 'var(--amber-ink)' }}> · new venue</strong>}
              </>
            ) : (
              FORMAT_LABEL[e.format]
            )}
            {e.format === 'hybrid' && ' · also online'}
          </dd>
          {ticket && (
            <>
              <dt>Link</dt>
              <dd>
                <a href={ticket} rel="noopener" target="_blank">
                  {ticket}
                </a>
              </dd>
            </>
          )}
          {e.submission && (
            <>
              <dt>From</dt>
              <dd>
                {e.submission.submitter_name} · <a href={`mailto:${e.submission.submitter_email}`}>{e.submission.submitter_email}</a>
              </dd>
            </>
          )}
          {e.rejection_reason && (
            <>
              <dt>Reason</dt>
              <dd>{e.rejection_reason}</dd>
            </>
          )}
        </dl>
        {e.description && (
          <p className={styles.body} style={{ fontSize: 15, marginTop: 14, whiteSpace: 'pre-line' }}>
            {e.description.length > 500 ? `${e.description.slice(0, 500)}…` : e.description}
          </p>
        )}
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" style={{ marginTop: 14, maxWidth: 220, borderRadius: 10, display: 'block' }} />
        )}
      </div>

      <div className={a.itemSide}>
        {clashes.length > 0 && (
          <div className={a.clash}>
            <strong>Same day:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {clashes.map((c) => (
                <li key={c.id}>
                  {c.title} ({c.organization}), {timeRange(c.starts_at, c.ends_at, c.all_day)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {e.review_flags.map((f) => (
          <div key={f} className={a.clash}>
            {FLAG_TEXT[f] ?? f}
          </div>
        ))}

        {unanswered && (
          <div className={a.clash}>
            {questions.venue.length > 0 && e.venue && <NameQuestion kind="venue" record={e.venue} matches={questions.venue} />}
            {questions.organization.length > 0 && <NameQuestion kind="organization" record={e.organization} matches={questions.organization} />}
          </div>
        )}
        {e.moderation !== 'approved' && (
          <form action={approve}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="back" value={back} />
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: '100%' }} disabled={unanswered}>
              Approve and publish
            </button>
            {unanswered && <span className={styles.small}>Answer the question above first.</span>}
          </form>
        )}
        <Link href={`/admin/events/${e.id}/`} className={`${styles.btn} ${styles.btnOutline}`}>
          Edit
        </Link>
        {e.moderation === 'approved' && e.review_flags.length > 0 && (
          <form action={clearFlags}>
            <input type="hidden" name="id" value={e.id} />
            <button type="submit" className={`${styles.btn} ${styles.btnOutline}`} style={{ width: '100%' }}>
              Looks right, clear the flag
            </button>
          </form>
        )}
        {e.moderation === 'pending' && (
          <details className={a.reject}>
            <summary>Don&apos;t approve</summary>
            <form action={reject} className={a.reject}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="back" value={back} />
              <label htmlFor={`r-${e.id}`} className={styles.small}>
                Reason (sent to the submitter if ticked below)
              </label>
              <textarea id={`r-${e.id}`} name="reason" className={styles.textarea} rows={3} style={{ minHeight: 80 }} />
              <label className={styles.checkbox}>
                <input type="checkbox" name="tell" defaultChecked={e.submission?.source !== 'eventon-import'} />
                Email the submitter
              </label>
              <button type="submit" className={`${styles.btn} ${styles.btnOutline}`}>
                Don&apos;t approve
              </button>
            </form>
          </details>
        )}
      </div>
    </article>
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : 'pending';
  const q = sp.q?.trim() || undefined;
  const events = await adminEvents(view, q);

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>{VIEWS.find((v) => v.key === view)?.label}</h1>
        <form className={a.inline} action="/admin/">
          <input type="hidden" name="view" value={view} />
          <label htmlFor="aq" className={styles.visuallyHidden}>
            Search
          </label>
          <input id="aq" name="q" type="search" defaultValue={q} placeholder="Search title, host or venue" />
          <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
            Search
          </button>
        </form>
      </div>
      <nav className={a.tabs} aria-label="Views">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/admin/?view=${v.key}`} className={styles.chip} aria-current={v.key === view ? 'true' : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>
      {events.length === 0 ? (
        <p className={styles.empty}>{view === 'pending' ? 'Nothing is waiting for review.' : 'Nothing here.'}</p>
      ) : (
        <div className={a.queue}>
          {events.map((e) => (
            <Item key={e.id} e={e} view={view} />
          ))}
        </div>
      )}
    </>
  );
}
