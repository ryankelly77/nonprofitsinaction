import Link from 'next/link';
import { eventNameQuestions, sameDayEvents, type AdminEvent } from '@/lib/admin-data';
import { typeTagClass } from '@/components/eventTypeTag';
import type { RejectionReason } from '@/lib/types';
import AskForm from './AskForm';
import NameQuestion from './NameQuestion';
import RejectForm from './RejectForm';
import { FORMAT_LABEL, imageUrl, safeUrl } from '@/lib/format';
import { longDate, timeRange } from '@/lib/time';
import { approve, approveSelected, clearFlags } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * One listing as the admin shows it, and the queue they sit in.
 *
 * Shared by the two pages that show listings: the review screen, where the
 * question is whether something goes up, and the events screen, where it is
 * already up. They were one page with a view parameter, which meant the
 * navigation could not tell the difference between work and reference.
 */

export type ListView = 'pending' | 'pending-past' | 'flagged' | 'flagged-past' | 'upcoming' | 'past' | 'rejected';

/*
 * Why a listing is waiting, in two halves: what happened, then what to do
 * about it. Said on the card, because "Needs a check" is only useful if the
 * next thing it tells you is which part to look at.
 */
const FLAG_TEXT: Record<string, { why: string; what: string; ask?: string }> = {
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
    what: 'Compare it with the Link above, or the organizer, before approving.',
    ask: 'Could you confirm the start and end time? The time we have came across from the old site and we were not able to check it.'
  },
  'time-corrected': {
    why: 'The imported time disagreed with what was typed on the old form and was corrected.',
    what: 'Confirm the When line now reads right.',
    ask: 'Could you confirm the date and time are right? The old site had two different answers for this one.'
  },
  'no-venue': {
    why: 'The old site had no venue for this one, so the Where line below has none.',
    what: 'Add one with Edit, or leave it if the event genuinely has no address, then clear the flag.',
    ask: 'Where is this being held? We do not have a venue or address for it, and people cannot find an event with no location. If it is online, or the venue is not settled yet, let us know that instead.'
  },
  'type-guessed': {
    why: 'The old site had no event type for this one, so the type above was guessed from the title.',
    what: 'Change it with Edit if the guess is wrong, then clear the flag.',
    ask: 'What kind of event is this? We have guessed from the title, and we would rather label it the way you would.'
  }
};

/*
 * The question to send about this listing, from its flags. Several flags make
 * several paragraphs, in the order the flags are stored, so one email covers
 * everything rather than the organizer hearing from us three times.
 */
function suggestedQuestion(flags: string[]): string {
  const asks = flags.map((f) => FLAG_TEXT[f]?.ask).filter((x): x is string => Boolean(x));
  return asks.length > 0
    ? asks.join('\n\n')
    : 'Could you check this listing over and let us know if anything is missing or wrong?';
}

async function Item({ e, view, reasons, back, canEmail }: { e: AdminEvent; view: ListView; reasons: RejectionReason[]; back: string; canEmail: boolean }) {
  const clashes = view === 'pending' || view === 'flagged' ? await sameDayEvents(e) : [];
  // Only worth asking while the event can still be approved.
  const questions = e.moderation !== 'approved' ? await eventNameQuestions(e) : { venue: [], organization: [] };
  const unanswered = questions.venue.length > 0 || questions.organization.length > 0;
  const ticket = safeUrl(e.ticket_url);
  const image = imageUrl(e.image_path);
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
        {/*
          * The third thing to do with a listing that needs a check, beside
          * fixing it yourself and saying it is fine: ask the person who
          * listed it. Folded away, because most checks are settled without
          * writing to anybody, and open is the wrong default for an email.
          */}
        {e.review_flags.length > 0 && (
          <details className={a.reject}>
            <summary>Ask the organizer</summary>
            <AskForm
              eventId={e.id}
              back={back}
              suggested={suggestedQuestion(e.review_flags)}
              canEmail={canEmail}
              submitter={e.submission?.submitter_email ?? null}
            />
          </details>
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

export default function EventList({
  events,
  view,
  reasons,
  back,
  empty,
  canEmail
}: {
  events: AdminEvent[];
  view: ListView;
  reasons: RejectionReason[];
  back: string;
  empty: string;
  /* Whether anything addressed to a submitter leaves the site yet, read once
     by the page rather than by every listing on it. */
  canEmail: boolean;
}) {
  const batchable = events.filter((e) => e.moderation !== 'approved').length;
  if (events.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <>
      {batchable > 1 && (
        <form id="batch" action={approveSelected} className={a.batch}>
          <input type="hidden" name="back" value={back} />
          <span>Tick the ones that are fine and publish them together.</span>
          <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
            Approve ticked
          </button>
        </form>
      )}
      <div className={a.queue}>
        {events.map((e) => (
          <Item key={e.id} e={e} view={view} reasons={reasons} back={back} canEmail={canEmail} />
        ))}
      </div>
    </>
  );
}
