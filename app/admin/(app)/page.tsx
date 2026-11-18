import { requireAdmin } from '@/lib/admin-auth';
import Link from 'next/link';
import { activeRejectionReasons, adminEvents, eventNameQuestions, sameDayEvents, type AdminEvent } from '@/lib/admin-data';
import { typeTagClass } from '@/components/eventTypeTag';
import type { RejectionReason } from '@/lib/types';
import NameQuestion from './NameQuestion';
import RejectForm from './RejectForm';
import { FORMAT_LABEL, imageUrl, safeUrl } from '@/lib/format';
import { longDate, timeRange } from '@/lib/time';
import { approve, approveSelected, clearFlags } from '../actions';
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

/*
 * Why a listing is waiting, in two halves: what happened, then what to do
 * about it. Said on the card, because "Needs a check" is only useful if the
 * next thing it tells you is which part to look at.
 */
const FLAG_TEXT: Record<string, { why: string; what: string }> = {
  'venue-new': {
    why: 'The venue was typed in by hand rather than picked from the list.',
    what: 'Read the name and address the way they wrote them and fix anything off, because approving is what offers this venue to the next person.'
  },
  'organization-new': {
    why: 'This organization has not been listed before.',
    what: 'Check the name reads the way they write it before approving.'
  },
  'time-unverified': {
    why: 'The imported time could not be checked against what was typed on the old form.',
    what: 'Compare it with the Link above, or the organizer, before approving.'
  },
  'time-corrected': {
    why: 'The imported time disagreed with what was typed on the old form and was corrected.',
    what: 'Confirm the When line now reads right.'
  },
  'no-venue': {
    why: 'The old site had no venue for this one, so the Where line below has none.',
    what: 'Add one with Edit, or leave it if the event genuinely has no address, then clear the flag.'
  },
  'type-guessed': {
    why: 'The old site had no event type for this one, so the type above was guessed from the title.',
    what: 'Change it with Edit if the guess is wrong, then clear the flag.'
  }
};

async function Item({ e, view, reasons }: { e: AdminEvent; view: View; reasons: RejectionReason[] }) {
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
        {e.moderation !== 'approved' && (
          <label className={a.pick}>
            {/* Tied to the batch form above by name, since a form inside a
                form is not allowed and each item already has its own. */}
            <input type="checkbox" form="batch" name="id" value={e.id} disabled={unanswered} />
            {unanswered ? 'Needs an answer first' : 'Approve with the batch'}
          </label>
        )}
        <span className={styles.tagRow}>
          {e.event_type_slug && (
            <span className={`${styles.tag} ${typeTagClass(e.event_type?.color)}`}>{e.event_type?.label ?? e.event_type_slug.replace('-', ' ')}</span>
          )}
          {e.status !== 'scheduled' && <span className={`${styles.tag} ${styles.tagCancelled}`}>{e.status === 'cancelled' ? 'canceled' : e.status}</span>}
          {e.submission?.source === 'eventon-import' && <span className={`${styles.tag} ${styles.tagNeutral}`}>Imported</span>}
        </span>
        <h2 className={styles.h3} style={{ marginTop: 10, fontSize: 22 }}>
          <Link href={`/admin/events/${e.id}/`} style={{ color: 'var(--ink)' }}>
            {e.title}
          </Link>
        </h2>
        {/* Directly under the title, so the reason is read before the details
            it is about rather than beside them. */}
        {e.review_flags.length > 0 && (
          <div className={a.flag}>
            <p className={a.flagLabel}>Why this needs a check</p>
            {e.review_flags.map((f) => {
              const t = FLAG_TEXT[f];
              return (
                <p key={f} className={a.flagLine}>
                  <strong>{t ? t.why : f}</strong>
                  {t ? ` ${t.what}` : ''}
                </p>
              );
            })}
          </div>
        )}
        <dl className={a.meta}>
          <dt>When</dt>
          <dd>
            {longDate(e.starts_at)}, {timeRange(e.starts_at, e.ends_at, e.all_day)}
          </dd>
          <dt>Host</dt>
          <dd>
            {e.organization.name}
            {!e.organization.verified && <strong style={{ color: 'var(--amber-ink)' }}> · unverified</strong>}
          </dd>
          <dt>Where</dt>
          <dd>
            {e.venue ? (
              <>
                {e.venue.name}
                {[e.venue.address_line1, e.venue.city].filter(Boolean).length > 0 && <span className={styles.muted}> · {[e.venue.address_line1, e.venue.city].filter(Boolean).join(', ')}</span>}
                {!e.venue.verified && <strong style={{ color: 'var(--amber-ink)' }}> · unverified</strong>}
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
        {e.moderation !== 'approved' && (!e.organization.verified || (e.venue && !e.venue.verified)) && (
          <div className={a.clash}>
            <strong>Not checked yet.</strong> The{' '}
            {[!e.organization.verified ? 'organization' : null, e.venue && !e.venue.verified ? 'venue' : null].filter(Boolean).join(' and the ')} above{' '}
            {!e.organization.verified && e.venue && !e.venue.verified ? 'have' : 'has'} not been listed before. Read the name the way they write it, fix it
            here or on its own page, then approve: approving is what puts this on the calendar and lets the name be suggested to the next person.
          </div>
        )}
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
            <RejectForm eventId={e.id} back={back} tellByDefault={e.submission?.source !== 'eventon-import'} reasons={reasons} />
          </details>
        )}
      </div>
    </article>
  );
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; approved?: string; held?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : 'pending';
  const q = sp.q?.trim() || undefined;
  const [events, reasons] = await Promise.all([adminEvents(view, q), activeRejectionReasons()]);
  const batchable = events.filter((e) => e.moderation !== 'approved').length;
  const approved = Number(sp.approved) || 0;
  const held = Number(sp.held) || 0;

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
      {(approved > 0 || held > 0) && (
        <p className={a.done}>
          {approved > 0 && `${approved} published.`}
          {held > 0 && ` ${held} left waiting: answer the question about the venue or organization first.`}
        </p>
      )}
      {events.length === 0 ? (
        <p className={styles.empty}>{view === 'pending' ? 'Nothing is waiting for review.' : 'Nothing here.'}</p>
      ) : (
        <>
          {batchable > 1 && (
            <form id="batch" action={approveSelected} className={a.batch}>
              <input type="hidden" name="back" value={`/admin/?view=${view}`} />
              <span>Tick the ones that are fine and publish them together.</span>
              <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                Approve ticked
              </button>
            </form>
          )}
          <div className={a.queue}>
            {events.map((e) => (
              <Item key={e.id} e={e} view={view} reasons={reasons} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
