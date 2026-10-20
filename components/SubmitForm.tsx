'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { submitListing } from '@/app/(site)/submit/actions';
import EventFields, { draftToInput, emptyDraft, type EventDraft } from './EventFields';
import Icon from './Icon';
import styles from './site.module.css';

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

const MAX_EVENTS = 3;

export default function SubmitForm({
  types,
  causes,
  initialDate,
  turnstileSiteKey
}: {
  types: Array<{ slug: string; label: string }>;
  causes: Array<{ slug: string; label: string }>;
  initialDate?: string;
  turnstileSiteKey: string;
}) {
  const [org, setOrg] = useState({ id: undefined as string | undefined, name: '', cause: '', sector: 'nonprofit' as 'nonprofit' | 'for_profit' | 'public' });

  /*
   * Suggestions under the organization name, the way the venue box has them.
   * Typing again clears the picked id: the name is the submitter's own, and
   * an id left over from a half-chosen suggestion would file their event
   * under the wrong organization.
   */
  const [orgHits, setOrgHits] = useState<Array<{ id: string; name: string }>>([]);
  const [orgListOpen, setOrgListOpen] = useState(false);
  const orgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function orgTyped(text: string) {
    setOrg((o) => ({ ...o, id: undefined, name: text }));
    if (orgTimer.current) clearTimeout(orgTimer.current);
    if (text.trim().length < 2) {
      setOrgHits([]);
      return;
    }
    orgTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/organizations/?q=${encodeURIComponent(text.trim())}`);
        const data = (await r.json()) as { organizations: Array<{ id: string; name: string }> };
        setOrgHits(data.organizations);
        setOrgListOpen(true);
      } catch {
        setOrgHits([]);
      }
    }, 200);
  }
  const [person, setPerson] = useState({ name: '', email: '' });
  const [events, setEvents] = useState<EventDraft[]>(() => [emptyDraft(initialDate ?? '', true)]);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [done, setDone] = useState<{ count: number; email: string } | null>(null);
  const startedAt = useRef<number>(0);
  const turnstileEl = useRef<HTMLDivElement>(null);
  const turnstileId = useRef<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  function renderTurnstile() {
    if (!turnstileSiteKey || !window.turnstile || !turnstileEl.current || turnstileId.current) return;
    turnstileId.current = window.turnstile.render(turnstileEl.current, {
      sitekey: turnstileSiteKey,
      callback: (t: string) => setTurnstileToken(t),
      'expired-callback': () => setTurnstileToken('')
    });
  }

  function patchEvent(i: number, patch: Partial<EventDraft>) {
    setEvents((list) => list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setStatus('sending');
    setMessage('');
    const result = await submitListing({
      organization: org,
      submitter: person,
      events: events.map(draftToInput),
      website: honeypot,
      startedAt: startedAt.current,
      turnstileToken: turnstileToken || undefined
    }).catch(() => ({ ok: false as const, errors: {}, message: 'We could not reach the server. Check your connection and try again.' }));

    if (result.ok) {
      setDone({ count: result.count, email: result.email });
      setStatus('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors(result.errors);
    setMessage(result.message);
    setStatus('idle');
    if (turnstileId.current && window.turnstile) window.turnstile.reset(turnstileId.current);
    setTurnstileToken('');
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  if (status === 'done' && done) {
    return (
      <div className={styles.formCard} role="status">
        <div className={styles.featureIcon} style={{ background: 'var(--teal)', color: '#fff' }}>
          <Icon name="check" size={26} strokeWidth={2.6} />
        </div>
        <h2 className={styles.h2Small} style={{ marginTop: 20 }}>
          Thanks. {done.count === 1 ? 'Your event is' : `Your ${done.count} events are`} in for review.
        </h2>
        <p className={styles.body} style={{ marginTop: 12 }}>
          We sent a confirmation to <strong>{done.email}</strong>. It has a private link you can use to change or cancel the listing at any time, so keep it.
        </p>
        <p className={styles.body}>We review every listing before it goes on the calendar and will email you when it is live.</p>
        <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/events/" className={`${styles.btn} ${styles.btnPrimary}`}>
            See upcoming events
          </Link>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => {
              setEvents([emptyDraft()]);
              setDone(null);
              setStatus('idle');
              setErrors({});
              turnstileId.current = null;
              startedAt.current = Date.now();
            }}
          >
            List another event
          </button>
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;
  const err = (k: string) => errors[k];

  return (
    <form onSubmit={submit} noValidate>
      {turnstileSiteKey && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={renderTurnstile} />}

      <div ref={summaryRef} tabIndex={-1} aria-live="assertive" style={{ outline: 'none' }}>
        {message && (
          <div className={`${styles.notice} ${styles.noticeError}`} style={{ marginBottom: 24 }}>
            <Icon name="alert" size={22} />
            <div>
              <p className={styles.noticeTitle}>{message}</p>
              {errorCount > 0 && <p style={{ margin: '4px 0 0', fontSize: 15 }}>{errorCount === 1 ? 'One field needs' : `${errorCount} fields need`} attention.</p>}
            </div>
          </div>
        )}
      </div>

      <section className={styles.formCard} aria-labelledby="s-org">
        <h2 id="s-org" className={styles.h2Small} style={{ fontSize: 26 }}>
          1. Your organization
        </h2>
        <div className={styles.field} style={{ marginTop: 20, position: 'relative' }}>
          <label htmlFor="org-name" className={styles.label}>
            Organization name
          </label>
          <input
            id="org-name"
            className={styles.input}
            value={org.name}
            onChange={(e) => orgTyped(e.target.value)}
            onFocus={() => orgHits.length && setOrgListOpen(true)}
            onBlur={() => setTimeout(() => setOrgListOpen(false), 150)}
            autoComplete="organization"
            required
            role="combobox"
            aria-expanded={orgListOpen && orgHits.length > 0}
            aria-controls="org-list"
            aria-autocomplete="list"
            aria-invalid={err('organization.name') ? true : undefined}
            aria-describedby={err('organization.name') ? 'org-name-err' : undefined}
          />
          {orgListOpen && orgHits.length > 0 && (
            <ul id="org-list" role="listbox" className={styles.suggestions}>
              {orgHits.map((o) => (
                <li key={o.id} role="option" aria-selected={org.id === o.id}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={styles.suggestion}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOrg((prev) => ({ ...prev, id: o.id, name: o.name }));
                      setOrgListOpen(false);
                      setOrgHits([]);
                    }}
                  >
                    <span>{o.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {org.id && (
            <span className={styles.hint}>
              Listed organization selected. Your events will join the ones already under this name.
            </span>
          )}
          {err('organization.name') && (
            <span id="org-name-err" className={styles.error}>
              {err('organization.name')}
            </span>
          )}
        </div>
        <div className={styles.formRow}>
          <div className={styles.field} style={{ flexBasis: 280 }}>
            <label htmlFor="org-cause" className={styles.label}>
              Cause
            </label>
            <select
              id="org-cause"
              className={styles.select}
              value={org.cause}
              onChange={(e) => setOrg({ ...org, cause: e.target.value })}
              required
              aria-invalid={err('organization.cause') ? true : undefined}
              aria-describedby={err('organization.cause') ? 'org-cause-err' : undefined}
            >
              <option value="">Choose the closest fit</option>
              {causes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            {err('organization.cause') && (
              <span id="org-cause-err" className={styles.error}>
                {err('organization.cause')}
              </span>
            )}
          </div>
          <fieldset className={styles.fieldset} style={{ margin: 0, flex: '1 1 300px' }}>
            <legend>Your organization is</legend>
            <div className={styles.segmented}>
              {(
                [
                  ['nonprofit', 'Nonprofit'],
                  ['for_profit', 'For profit'],
                  ['public', 'Public / government']
                ] as const
              ).map(([value, label]) => (
                <label key={value} className={styles.segment}>
                  <input type="radio" name="sector" value={value} checked={org.sector === value} onChange={() => setOrg({ ...org, sector: value })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <h3 className={styles.h3} style={{ marginTop: 32 }}>
          Your contact details
        </h3>
        <p className={styles.hint} style={{ margin: '6px 0 0' }}>
          Not shown on the calendar. We use them to confirm the listing and send your private edit link.
        </p>
        <div className={styles.formRow} style={{ marginTop: 12 }}>
          <div className={styles.field} style={{ flexBasis: 240 }}>
            <label htmlFor="p-name" className={styles.label}>
              Your name
            </label>
            <input
              id="p-name"
              className={styles.input}
              value={person.name}
              onChange={(e) => setPerson({ ...person, name: e.target.value })}
              autoComplete="name"
              required
              aria-invalid={err('submitter.name') ? true : undefined}
              aria-describedby={err('submitter.name') ? 'p-name-err' : undefined}
            />
            {err('submitter.name') && (
              <span id="p-name-err" className={styles.error}>
                {err('submitter.name')}
              </span>
            )}
          </div>
          <div className={styles.field} style={{ flexBasis: 280 }}>
            <label htmlFor="p-email" className={styles.label}>
              Your email
            </label>
            <input
              id="p-email"
              type="email"
              className={styles.input}
              value={person.email}
              onChange={(e) => setPerson({ ...person, email: e.target.value })}
              autoComplete="email"
              required
              aria-invalid={err('submitter.email') ? true : undefined}
              aria-describedby={err('submitter.email') ? 'p-email-err' : undefined}
            />
            {err('submitter.email') && (
              <span id="p-email-err" className={styles.error}>
                {err('submitter.email')}
              </span>
            )}
          </div>
        </div>
        {/* People never see this field. Bots fill it in. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="website">Website</label>
          <input id="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        </div>
      </section>

      {events.map((draft, i) => (
        <section key={draft.key} className={styles.formCard} aria-labelledby={`s-ev-${draft.key}`}>
          <div className={styles.eventHeader}>
            <h2 id={`s-ev-${draft.key}`} className={styles.h2Small} style={{ fontSize: 26 }}>
              {i + 2}. {events.length > 1 ? `Event ${i + 1}` : 'Your event'}
            </h2>
            {events.length > 1 && (
              <button type="button" className={styles.textButton} onClick={() => setEvents((list) => list.filter((_, j) => j !== i))}>
                Remove this event
              </button>
            )}
          </div>
          <EventFields draft={draft} index={i} types={types} errors={errors} onChange={(p) => patchEvent(i, p)} />
        </section>
      ))}

      {events.length < MAX_EVENTS && (
        <button
          type="button"
          className={`${styles.btn} ${styles.btnOutline}`}
          style={{ marginTop: 24 }}
          onClick={() => setEvents((list) => [...list, { ...emptyDraft(), type: list[list.length - 1]?.type ?? '' }])}
        >
          + Add another event ({events.length} of {MAX_EVENTS})
        </button>
      )}

      <div className={styles.formFoot}>
        <p className={styles.small} style={{ margin: 0, maxWidth: 420 }}>
          Listings are reviewed before they appear. We will email you when yours is live.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
          {turnstileSiteKey && <div ref={turnstileEl} />}
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={status === 'sending' || (Boolean(turnstileSiteKey) && !turnstileToken)}>
            {status === 'sending' ? 'Sending…' : events.length > 1 ? `Submit ${events.length} events` : 'Submit event'}
          </button>
        </div>
      </div>
    </form>
  );
}
