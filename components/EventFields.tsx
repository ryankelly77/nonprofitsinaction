'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';
import { longDateFromString, timeRange } from '@/lib/time';
import type { CalendarEvent } from '@/lib/types';
import Icon from './Icon';
import styles from './site.module.css';

/*
 * One event's fields, shared by the listing form and the private edit page.
 * The parent owns the values; this component reports every change.
 */

export interface EventDraft {
  key: string;
  title: string;
  type: string;
  format: 'in_person' | 'virtual' | 'hybrid';
  date: string;
  endDate: string;
  multiDay: boolean;
  allDay: boolean;
  start: string;
  end: string;
  venueId: string;
  venueName: string;
  venueIsNew: boolean;
  venueAddress: string;
  venueCity: string;
  venuePostal: string;
  onlineUrl: string;
  ticketUrl: string;
  description: string;
  imagePath: string;
  imagePreview: string;
}

let drafts = 0;

/** A blank event. The first one's key is fixed so the server and browser render it identically. */
export function emptyDraft(date = '', first = false): EventDraft {
  return {
    key: first ? 'event-1' : `event-${++drafts + 1}-${Date.now().toString(36)}`,
    title: '',
    type: '',
    format: 'in_person',
    date,
    endDate: '',
    multiDay: false,
    allDay: false,
    start: '',
    end: '',
    venueId: '',
    venueName: '',
    venueIsNew: false,
    venueAddress: '',
    venueCity: 'San Antonio',
    venuePostal: '',
    onlineUrl: '',
    ticketUrl: '',
    description: '',
    imagePath: '',
    imagePreview: ''
  };
}

/** The shape lib/submission.ts expects for one event. */
export function draftToInput(d: EventDraft) {
  return {
    title: d.title,
    type: d.type,
    format: d.format,
    date: d.date,
    endDate: d.multiDay ? d.endDate : '',
    allDay: d.allDay,
    start: d.allDay ? undefined : d.start,
    end: d.allDay ? undefined : d.end,
    venue:
      d.format === 'virtual'
        ? null
        : d.venueId
          ? { id: d.venueId }
          : d.venueName
            ? { name: d.venueName, address: d.venueAddress, city: d.venueCity, postalCode: d.venuePostal }
            : null,
    onlineUrl: d.format === 'in_person' ? '' : d.onlineUrl,
    ticketUrl: d.ticketUrl,
    description: d.description,
    imagePath: d.imagePath
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className={styles.error}>
      {message}
    </span>
  );
}

const FORMATS: Array<[EventDraft['format'], string]> = [
  ['in_person', 'In person'],
  ['virtual', 'Online'],
  ['hybrid', 'Hybrid']
];

export default function EventFields({
  draft,
  index,
  types,
  errors,
  onChange,
  ignoreSlug
}: {
  draft: EventDraft;
  index: number;
  types: Array<{ slug: string; label: string }>;
  errors: Record<string, string>;
  onChange: (patch: Partial<EventDraft>) => void;
  /** On the edit page: leave this event itself out of the "already listed" check. */
  ignoreSlug?: string;
}) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const err = (name: string) => errors[`events.${index}.${name}`];
  const invalid = (name: string) => (err(name) ? { 'aria-invalid': true as const, 'aria-describedby': id(`${name}-err`) } : {});

  // ---- what else is on that date ----
  const [sameDay, setSameDay] = useState<{ date: string; events: CalendarEvent[]; holidays: string[] } | null>(null);
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return;
    const ctrl = new AbortController();
    fetch(`/api/day/?date=${draft.date}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { date: string; events: CalendarEvent[]; holidays?: Array<{ name: string }> } | null) => {
        if (data)
          setSameDay({ date: data.date, events: data.events.filter((e) => e.slug !== ignoreSlug), holidays: (data.holidays ?? []).map((h) => h.name) });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [draft.date, ignoreSlug]);
  const clash = sameDay && sameDay.date === draft.date ? sameDay.events : null;
  const holidayNames = sameDay && sameDay.date === draft.date ? sameDay.holidays : [];

  // ---- venue type-ahead ----
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; address: string }>>([]);
  /* Verified venues the typed letters do not reach: "Wittie" against "Witte". */
  const [didYouMean, setDidYouMean] = useState<Array<{ id: string; name: string; address: string }>>([]);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function venueTyped(text: string) {
    onChange({ venueName: text, venueId: '' });
    setActive(-1);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setDidYouMean([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/venues/?q=${encodeURIComponent(text.trim())}`);
        const data = (await r.json()) as {
          venues: Array<{ id: string; name: string; address: string }>;
          didYouMean?: Array<{ id: string; name: string; address: string }>;
        };
        setSuggestions(data.venues);
        setDidYouMean(data.didYouMean ?? []);
        setListOpen(true);
      } catch {
        setSuggestions([]);
        setDidYouMean([]);
      }
    }, 200);
  }
  function pickVenue(v: { id: string; name: string }) {
    onChange({ venueId: v.id, venueName: v.name, venueIsNew: false });
    setListOpen(false);
    setSuggestions([]);
    setDidYouMean([]);
  }
  function venueKey(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (!listOpen || suggestions.length === 0) return;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActive((a) => Math.min(suggestions.length - 1, a + 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (ev.key === 'Enter' && active >= 0) {
      ev.preventDefault();
      pickVenue(suggestions[active]);
    } else if (ev.key === 'Escape') {
      setListOpen(false);
    }
  }

  // ---- image ----
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  async function pickImage(file: File | undefined) {
    setUploadError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setUploadError('Use a JPG, PNG or WebP image.');
    if (file.size > 5 * 1024 * 1024) return setUploadError('Images can be up to 5 MB.');
    setUploading(true);
    try {
      const slot = await fetch('/api/uploads/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: file.type, size: file.size }) });
      const data = (await slot.json()) as { path?: string; token?: string; error?: string };
      if (!slot.ok || !data.path || !data.token) throw new Error(data.error ?? 'Upload failed.');
      const { error } = await browserClient().storage.from('event-images').uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      onChange({ imagePath: data.path, imagePreview: URL.createObjectURL(file) });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className={styles.field} style={{ marginTop: 24 }}>
        <label htmlFor={id('title')} className={styles.label}>
          Event name
        </label>
        <input
          id={id('title')}
          className={styles.input}
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="e.g. Spring Benefit Luncheon"
          maxLength={140}
          required
          {...invalid('title')}
        />
        <FieldError id={id('title-err')} message={err('title')} />
      </div>

      <fieldset className={styles.fieldset} {...(err('type') ? { 'aria-describedby': id('type-err') } : {})}>
        <legend>Event type</legend>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {types.map((t) => (
            <label key={t.slug} className={styles.pillChoice}>
              <input type="radio" name={id('type')} value={t.slug} checked={draft.type === t.slug} onChange={() => onChange({ type: t.slug })} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
        <FieldError id={id('type-err')} message={err('type')} />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Format</legend>
        <div className={styles.segmented}>
          {FORMATS.map(([value, label]) => (
            <label key={value} className={styles.segment}>
              <input type="radio" name={id('format')} value={value} checked={draft.format === value} onChange={() => onChange({ format: value })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.formRow}>
        <div className={styles.field}>
          <label htmlFor={id('date')} className={styles.label}>
            {draft.multiDay ? 'Starts' : 'Date'}
          </label>
          <input id={id('date')} type="date" className={styles.input} value={draft.date} onChange={(e) => onChange({ date: e.target.value })} required {...invalid('date')} />
          <FieldError id={id('date-err')} message={err('date')} />
        </div>
        {!draft.allDay && (
          <>
            <div className={styles.field} style={{ flexBasis: 150 }}>
              <label htmlFor={id('start')} className={styles.label}>
                Start time
              </label>
              <input id={id('start')} type="time" className={styles.input} value={draft.start} onChange={(e) => onChange({ start: e.target.value })} required {...invalid('start')} />
              <FieldError id={id('start-err')} message={err('start')} />
            </div>
            <div className={styles.field} style={{ flexBasis: 150 }}>
              <label htmlFor={id('end')} className={styles.label}>
                End time
              </label>
              <input id={id('end')} type="time" className={styles.input} value={draft.end} onChange={(e) => onChange({ end: e.target.value })} required {...invalid('end')} />
              <FieldError id={id('end-err')} message={err('end')} />
            </div>
          </>
        )}
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '0 24px' }}>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={draft.allDay} onChange={(e) => onChange({ allDay: e.target.checked })} />
          All day
        </label>
        <label className={styles.checkbox}>
          <input type="checkbox" checked={draft.multiDay} onChange={(e) => onChange({ multiDay: e.target.checked })} />
          Ends on a different day
        </label>
      </div>
      {draft.multiDay && (
        <div className={styles.field} style={{ marginTop: 8, maxWidth: 320 }}>
          <label htmlFor={id('endDate')} className={styles.label}>
            End date
          </label>
          <input id={id('endDate')} type="date" className={styles.input} value={draft.endDate} min={draft.date || undefined} onChange={(e) => onChange({ endDate: e.target.value })} {...invalid('endDate')} />
          <FieldError id={id('endDate-err')} message={err('endDate')} />
        </div>
      )}
      <p className={styles.hint} style={{ margin: '8px 0 0' }}>
        Times are San Antonio time (Central).
      </p>

      <div aria-live="polite">
        {holidayNames.length > 0 && (
          <p className={styles.holidayNote} style={{ marginTop: 16 }}>
            {longDateFromString(draft.date).replace(/, \d{4}$/, '')} is {holidayNames.join(' and ')}.
          </p>
        )}
        {clash && clash.length > 0 && (
          <div className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 16 }}>
            <Icon name="alert" size={24} />
            <div style={{ minWidth: 0 }}>
              <p className={styles.noticeTitle}>
                Heads up: {clash.length} event{clash.length > 1 ? 's are' : ' is'} already listed on {longDateFromString(draft.date).replace(/, \d{4}$/, '')}.
              </p>
              <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {clash.map((c) => (
                  <li key={c.slug} style={{ fontSize: 15, lineHeight: 1.5 }}>
                    <strong>
                      <Link href={`/events/${c.slug}/`} target="_blank" style={{ color: 'inherit' }}>
                        {c.title}
                      </Link>
                    </strong>{' '}
                    · {c.organization} · {timeRange(c.starts_at, c.ends_at, c.all_day)}
                    {c.venue ? ` at ${c.venue}` : ''}
                  </li>
                ))}
              </ul>
              <p style={{ margin: '10px 0 0', fontSize: 14, lineHeight: 1.5 }}>You can still list this date. Overlaps are shown so planners see them before booking.</p>
            </div>
          </div>
        )}
        {clash && clash.length === 0 && (
          <div className={`${styles.notice} ${styles.noticeOk}`} style={{ marginTop: 16, alignItems: 'center' }}>
            <Icon name="check" size={22} strokeWidth={2.6} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Nothing else is listed on {longDateFromString(draft.date).replace(/, \d{4}$/, '')} yet.</p>
          </div>
        )}
      </div>

      {draft.format !== 'virtual' && (
        <div className={styles.field} style={{ marginTop: 24, position: 'relative' }}>
          <label htmlFor={id('venue')} className={styles.label}>
            Venue
          </label>
          <input
            id={id('venue')}
            className={styles.input}
            value={draft.venueName}
            onChange={(e) => venueTyped(e.target.value)}
            onKeyDown={venueKey}
            onFocus={() => suggestions.length && setListOpen(true)}
            onBlur={() => setTimeout(() => setListOpen(false), 150)}
            placeholder="Start typing a venue name"
            autoComplete="off"
            role="combobox"
            aria-expanded={listOpen && suggestions.length > 0}
            aria-controls={id('venue-list')}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? id(`venue-opt-${active}`) : undefined}
            {...invalid('venue')}
          />
          {listOpen && suggestions.length > 0 && (
            <ul id={id('venue-list')} role="listbox" className={styles.suggestions}>
              {suggestions.map((v, i) => (
                <li key={v.id} id={id(`venue-opt-${i}`)} role="option" aria-selected={i === active}>
                  <button type="button" tabIndex={-1} className={styles.suggestion} onMouseDown={(e) => e.preventDefault()} onClick={() => pickVenue(v)}>
                    <span>{v.name}</span>
                    {v.address && <span className={styles.suggestionAddr}>{v.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <FieldError id={id('venue-err')} message={err('venue')} />
          {/*
            * About to add a venue that looks like one already listed. Said
            * here rather than refused, because neighbouring rooms really do
            * share a name: the Witte Museum and its Mays Family Center are
            * two places with one name between them.
            */}
          {!draft.venueId && didYouMean.length > 0 && (
            <p className={styles.hint} style={{ marginTop: 8 }}>
              Did you mean{' '}
              {didYouMean.map((v, i) => (
                <span key={v.id}>
                  {i > 0 ? ', ' : ''}
                  <button type="button" className={styles.linkButton} onClick={() => pickVenue(v)}>
                    {v.name}
                  </button>
                </span>
              ))}
              ?
            </p>
          )}
          {draft.venueId ? (
            <span className={styles.hint}>
              <Icon name="check" size={14} strokeWidth={2.6} /> Listed venue selected.
            </span>
          ) : draft.venueName.trim().length >= 2 ? (
            <span className={styles.hint}>Not in our list? Add the address below so guests can find it.</span>
          ) : (
            <span className={styles.hint}>Pick from venues other organizations have used, or type a new one.</span>
          )}
        </div>
      )}
      {draft.format !== 'virtual' && !draft.venueId && draft.venueName.trim().length >= 2 && draft.venueName.trim().toUpperCase() !== 'TBD' && (
        <div className={styles.formRow} style={{ marginTop: 12 }}>
          <div className={styles.field} style={{ flexBasis: 320 }}>
            <label htmlFor={id('vaddr')} className={styles.label}>
              Street address <span className={styles.labelOptional}>(optional)</span>
            </label>
            <input id={id('vaddr')} className={styles.input} value={draft.venueAddress} onChange={(e) => onChange({ venueAddress: e.target.value })} autoComplete="street-address" />
          </div>
          <div className={styles.field} style={{ flexBasis: 160 }}>
            <label htmlFor={id('vcity')} className={styles.label}>
              City
            </label>
            <input id={id('vcity')} className={styles.input} value={draft.venueCity} onChange={(e) => onChange({ venueCity: e.target.value })} autoComplete="address-level2" />
          </div>
          <div className={styles.field} style={{ flexBasis: 120 }}>
            <label htmlFor={id('vzip')} className={styles.label}>
              ZIP
            </label>
            <input id={id('vzip')} className={styles.input} value={draft.venuePostal} onChange={(e) => onChange({ venuePostal: e.target.value })} inputMode="numeric" autoComplete="postal-code" maxLength={10} />
          </div>
        </div>
      )}

      {draft.format !== 'in_person' && (
        <div className={styles.field} style={{ marginTop: 24 }}>
          <label htmlFor={id('online')} className={styles.label}>
            Where to watch or join
          </label>
          <input id={id('online')} type="url" className={styles.input} value={draft.onlineUrl} onChange={(e) => onChange({ onlineUrl: e.target.value })} placeholder="https://" {...invalid('onlineUrl')} />
          <FieldError id={id('onlineUrl-err')} message={err('onlineUrl')} />
          <span className={styles.hint}>Zoom, Facebook Live, YouTube or any public link.</span>
        </div>
      )}

      <div className={styles.field} style={{ marginTop: 24 }}>
        <label htmlFor={id('ticket')} className={styles.label}>
          Tickets or event website <span className={styles.labelOptional}>(optional)</span>
        </label>
        <input id={id('ticket')} type="url" className={styles.input} value={draft.ticketUrl} onChange={(e) => onChange({ ticketUrl: e.target.value })} placeholder="https://" {...invalid('ticketUrl')} />
        <FieldError id={id('ticketUrl-err')} message={err('ticketUrl')} />
      </div>

      <div className={styles.field} style={{ marginTop: 24 }}>
        <label htmlFor={id('desc')} className={styles.label}>
          Short description <span className={styles.labelOptional}>(optional)</span>
        </label>
        <textarea
          id={id('desc')}
          className={styles.textarea}
          rows={4}
          maxLength={2000}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Two or three sentences on what guests can expect and who the event supports."
          {...invalid('description')}
        />
        <FieldError id={id('description-err')} message={err('description')} />
      </div>

      <div className={styles.field} style={{ marginTop: 24 }}>
        <span id={id('img-label')} className={styles.label}>
          Flyer or photo <span className={styles.labelOptional}>(optional)</span>
        </span>
        {draft.imagePreview || draft.imagePath ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            {draft.imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.imagePreview} alt="" className={styles.preview} />
            )}
            <button type="button" className={styles.textButton} onClick={() => onChange({ imagePath: '', imagePreview: '' })}>
              Remove image
            </button>
          </div>
        ) : (
          <label className={styles.dropzone}>
            <Icon name="upload" size={28} />
            <span style={{ fontSize: 15 }}>
              <strong style={{ color: 'var(--teal)' }}>{uploading ? 'Uploading…' : 'Choose a file'}</strong> JPG, PNG or WebP, up to 5 MB.
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-labelledby={id('img-label')}
              className={styles.visuallyHidden}
              disabled={uploading}
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
          </label>
        )}
        {uploadError && <span className={styles.error}>{uploadError}</span>}
      </div>
    </>
  );
}
