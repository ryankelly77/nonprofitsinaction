'use client';

import Link from 'next/link';
import { useState } from 'react';
import { saveManagedEvent, setManagedStatus } from '@/app/(site)/manage/actions';
import EventFields, { draftToInput, type EventDraft } from './EventFields';
import Icon from './Icon';
import styles from './site.module.css';

export interface ManagedEvent {
  id: string;
  slug: string;
  moderation: 'pending' | 'approved' | 'rejected';
  status: 'scheduled' | 'cancelled' | 'postponed';
  rejection_reason: string | null;
  when: string;
  draft: EventDraft;
}

function Badge({ e }: { e: ManagedEvent }) {
  const label = e.moderation === 'pending' ? 'Waiting for review' : e.moderation === 'approved' ? 'Live on the calendar' : 'Not approved';
  return (
    <span className={styles.tagRow}>
      <span className={`${styles.tag} ${e.moderation === 'approved' ? styles.tagNeutral : e.moderation === 'rejected' ? styles.tagCancelled : ''}`}>{label}</span>
      {e.status !== 'scheduled' && <span className={`${styles.tag} ${styles.tagCancelled}`}>{e.status === 'cancelled' ? 'Canceled' : 'Postponed'}</span>}
    </span>
  );
}

function ManagedEventCard({ token, initial, types }: { token: string; initial: ManagedEvent; types: Array<{ slug: string; label: string }> }) {
  const [e, setE] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial.draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setNote(null);
    const r = await saveManagedEvent(token, e.id, draftToInput(draft)).catch(() => ({ ok: false as const, errors: {}, message: 'We could not reach the server. Try again.' }));
    setBusy(false);
    if (r.ok) {
      setErrors({});
      setEditing(false);
      setE({ ...e, draft });
      setNote({ ok: true, text: r.message });
    } else {
      setErrors(r.errors);
      setNote({ ok: false, text: r.message });
    }
  }

  async function status(next: ManagedEvent['status']) {
    if (next === 'cancelled' && !window.confirm('Mark this event as canceled? It stays on the calendar with a canceled label.')) return;
    setBusy(true);
    const r = await setManagedStatus(token, e.id, next).catch(() => ({ ok: false, message: 'We could not reach the server. Try again.' }));
    setBusy(false);
    if (r.ok) setE({ ...e, status: next });
    setNote({ ok: r.ok, text: r.message });
  }

  return (
    <section className={styles.formCard} aria-labelledby={`m-${e.id}`}>
      <Badge e={e} />
      <h2 id={`m-${e.id}`} className={styles.h2Small} style={{ fontSize: 28, marginTop: 12 }}>
        {e.draft.title}
      </h2>
      <p className={styles.small} style={{ margin: '6px 0 0' }}>
        {e.when}
      </p>
      {e.moderation === 'rejected' && e.rejection_reason && (
        <p className={styles.body} style={{ marginTop: 12 }}>
          Note from the reviewers: {e.rejection_reason}
        </p>
      )}
      {note && (
        <div className={`${styles.notice} ${note.ok ? styles.noticeOk : styles.noticeError}`} style={{ marginTop: 16 }} role="status">
          <Icon name={note.ok ? 'check' : 'alert'} size={20} />
          <p style={{ margin: 0, fontWeight: 600 }}>{note.text}</p>
        </div>
      )}

      {editing ? (
        <>
          <EventFields draft={draft} index={0} types={types} errors={errors} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} ignoreSlug={e.slug} />
          <div className={styles.formFoot}>
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => { setEditing(false); setDraft(e.draft); setErrors({}); }} disabled={busy}>
              Discard changes
            </button>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </>
      ) : (
        <div className={styles.actions} style={{ marginTop: 20 }}>
          {e.moderation !== 'rejected' && (
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setEditing(true)} disabled={busy}>
              Edit details
            </button>
          )}
          {e.moderation === 'approved' && (
            <Link href={`/events/${e.slug}/`} className={`${styles.btn} ${styles.btnOutline}`}>
              View on the calendar
            </Link>
          )}
          {e.moderation !== 'rejected' && e.status === 'scheduled' && (
            <>
              <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => status('postponed')} disabled={busy}>
                Mark postponed
              </button>
              <button type="button" className={styles.textButton} onClick={() => status('cancelled')} disabled={busy}>
                Cancel this event
              </button>
            </>
          )}
          {e.status !== 'scheduled' && (
            <button type="button" className={`${styles.btn} ${styles.btnOutline}`} onClick={() => status('scheduled')} disabled={busy}>
              Mark as scheduled again
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function ManageEvents({ token, events, types }: { token: string; events: ManagedEvent[]; types: Array<{ slug: string; label: string }> }) {
  return (
    <>
      {events.map((e) => (
        <ManagedEventCard key={e.id} token={token} initial={e} types={types} />
      ))}
    </>
  );
}
