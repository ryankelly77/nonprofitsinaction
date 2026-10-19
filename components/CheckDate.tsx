'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { addDays, localParts, longDateFromString, monthGrid, monthLabel, shiftMonth, timeRange } from '@/lib/time';
import type { CalendarEvent } from '@/lib/types';
import Icon from './Icon';
import styles from './site.module.css';

/*
 * The date checker: a month of days, the busy ones marked, and what is on
 * the day you pick. The first month arrives with the page; other months are
 * fetched from /api/calendar/ as you page to them.
 */

/** The San Antonio dates an event touches (at most a week, for long runs). */
function datesOf(e: CalendarEvent): string[] {
  const first = localParts(e.starts_at).date;
  const last = localParts(new Date(new Date(e.ends_at).getTime() - 1)).date;
  const out = [first];
  let d = first;
  while (d < last && out.length < 7) {
    d = addDays(d, 1);
    out.push(d);
  }
  return out;
}

export default function CheckDate({
  initialMonth,
  initialEvents,
  today,
  initialDate
}: {
  initialMonth: string;
  initialEvents: CalendarEvent[];
  today: string;
  initialDate?: string;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [cache, setCache] = useState<Record<string, CalendarEvent[]>>({ [initialMonth]: initialEvents });
  const [selected, setSelected] = useState(initialDate ?? (today.startsWith(initialMonth) ? today : `${initialMonth}-01`));
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const events = useMemo(() => cache[month] ?? [], [cache, month]);
  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      for (const d of datesOf(e)) {
        const list = map.get(d) ?? [];
        list.push(e);
        map.set(d, list);
      }
    }
    return map;
  }, [events]);

  async function go(by: number) {
    const next = shiftMonth(month, by);
    setMonth(next);
    setSelected(today.startsWith(next) ? today : `${next}-01`);
    setFailed(false);
    if (cache[next]) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar/?month=${next}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { events: CalendarEvent[] };
      setCache((c) => ({ ...c, [next]: data.events }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  const dayEvents = byDate.get(selected) ?? [];
  const n = dayEvents.length;

  return (
    <div className={styles.calendarCard}>
      <div className={styles.calendarHead}>
        <button type="button" className={styles.iconButton} onClick={() => go(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" />
        </button>
        <h3 className={styles.calendarTitle} aria-live="polite">
          {monthLabel(month)}
        </h3>
        <button type="button" className={styles.iconButton} onClick={() => go(1)} aria-label="Next month">
          <Icon name="chevronRight" />
        </button>
      </div>

      <div className={styles.weekdays} aria-hidden="true">
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className={styles.days} aria-busy={loading}>
        {monthGrid(month).map((cell, i) => {
          if (!cell) return <span key={`blank-${i}`} aria-hidden="true" />;
          const count = byDate.get(cell.date)?.length ?? 0;
          const cls = [
            styles.day,
            count ? styles.dayBusy : '',
            cell.date === today ? styles.dayToday : '',
            cell.date < today ? styles.dayPast : '',
            cell.date === selected ? styles.daySelected : ''
          ].join(' ');
          const label = `${longDateFromString(cell.date)}${count ? `, ${count} event${count > 1 ? 's' : ''} listed` : ''}${cell.date === today ? ', today' : ''}`;
          return (
            <button key={cell.date} type="button" className={cls} aria-label={label} aria-pressed={cell.date === selected} onClick={() => setSelected(cell.date)}>
              <span>{cell.day}</span>
              <span className={styles.dot} />
            </button>
          );
        })}
      </div>
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendBusy} />
          Events listed
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendToday} />
          Today
        </span>
      </div>

      <div className={styles.dayPanel} aria-live="polite">
        <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
          {longDateFromString(selected)}
        </p>
        {failed ? (
          <p className={styles.dayHeadline}>That month did not load. Try again in a moment.</p>
        ) : loading ? (
          <p className={styles.dayHeadline}>Loading…</p>
        ) : (
          <>
            <p className={styles.dayHeadline}>{n ? `${n} event${n > 1 ? 's' : ''} already listed` : 'Nothing listed yet'}</p>
            {n > 0 ? (
              <ul className={styles.dayList}>
                {dayEvents.map((e) => (
                  <li key={e.slug} className={styles.dayItem}>
                    <Link href={`/events/${e.slug}/`}>{e.title}</Link>
                    <span className={styles.small}>
                      {[e.organization, timeRange(e.starts_at, e.ends_at, e.all_day), e.venue].filter(Boolean).join(' · ')}
                      {e.status !== 'scheduled' ? ` · ${e.status === 'cancelled' ? 'Canceled' : 'Postponed'}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              selected >= today && (
                <p className={styles.body} style={{ margin: '8px 0 0', fontSize: 15 }}>
                  This date looks open. If you are planning an event, list it so other organizations can plan around it.
                </p>
              )
            )}
            {selected >= today && (
              <Link href={`/submit/?date=${selected}`} className={styles.arrowLink} style={{ marginTop: 6, fontSize: 15 }}>
                List an event on this date
                <Icon name="arrow" size={18} />
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
