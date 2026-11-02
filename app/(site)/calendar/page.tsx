import type { Metadata } from 'next';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { getMonthEvents, getMonthHolidays } from '@/lib/data';
import {
  addDays,
  isDateString,
  isMonthString,
  localParts,
  longDateFromString,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
  timeOfDay,
  timeRange,
  todayLocal
} from '@/lib/time';
import type { CalendarEvent } from '@/lib/types';
import styles from '@/components/site.module.css';

export const metadata: Metadata = {
  title: 'Check a date: nonprofit events by month',
  description: 'Every listed San Antonio nonprofit event, laid out by month. See what is already booked before you pick a date for your own.',
  alternates: { canonical: '/calendar/' }
};

type Search = Promise<{ month?: string; date?: string }>;

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

export default async function CalendarPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const today = todayLocal();
  const date = sp.date && isDateString(sp.date) ? sp.date : undefined;
  const month = date ? monthOf(date) : sp.month && isMonthString(sp.month) ? sp.month : monthOf(today);
  const [events, holidayRows] = await Promise.all([getMonthEvents(month), getMonthHolidays(month)]);
  const holidays = new Map<string, string[]>();
  for (const h of holidayRows) holidays.set(h.date, [...(holidays.get(h.date) ?? []), h.name]);

  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) for (const d of datesOf(e)) byDate.set(d, [...(byDate.get(d) ?? []), e]);
  const picked = date ? byDate.get(date) ?? [] : null;
  const busyDays = [...new Set([...byDate.keys(), ...holidays.keys()])].filter((d) => d.startsWith(month)).sort();
  const pickedHolidays = date ? holidays.get(date) ?? [] : [];
  const cells = monthGrid(month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  return (
    <section className={styles.sectionTight}>
      <div className={styles.container}>
        <div className={`${styles.split} ${styles.splitStart}`} style={{ gap: 40 }}>
          <div className={styles.splitMain}>
            <p className={styles.eyebrow}>For event planners</p>
            <h1 className={styles.h1}>Check a date</h1>
            <p className={styles.lead}>
              Donors, sponsors and local media can only be in so many places at once. See what is already booked before you commit to a date.
            </p>
          </div>
          <form action="/calendar/" className={`${styles.splitSide} ${styles.calendarCard}`} style={{ flexBasis: 380 }}>
            <div className={styles.field}>
              <label htmlFor="date" className={styles.label}>
                Date you are considering
              </label>
              <input id="date" name="date" type="date" defaultValue={date ?? ''} className={styles.input} required />
            </div>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 16, width: '100%' }}>
              Check this date
            </button>
            {picked && date && (
              <div className={styles.dayPanel} aria-live="polite">
                <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
                  {longDateFromString(date)}
                </p>
                <p className={styles.dayHeadline}>
                  {picked.length ? `${picked.length} event${picked.length > 1 ? 's' : ''} already listed` : 'Nothing listed yet'}
                </p>
                {pickedHolidays.length > 0 && <p className={styles.holidayNote}>Also {pickedHolidays.join(' and ')}.</p>}
                {picked.length > 0 && (
                  <ul className={styles.dayList}>
                    {picked.map((e) => (
                      <li key={e.slug} className={styles.dayItem}>
                        <Link href={`/events/${e.slug}/`}>{e.title}</Link>
                        <span className={styles.small}>{[e.organization, timeRange(e.starts_at, e.ends_at, e.all_day), e.venue].filter(Boolean).join(' · ')}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {date >= today && (
                  <Link href={`/submit/?date=${date}`} className={styles.arrowLink} style={{ marginTop: 6, fontSize: 15 }}>
                    List an event on this date
                    <Icon name="arrow" size={18} />
                  </Link>
                )}
              </div>
            )}
          </form>
        </div>

        <div className={styles.calendarHead} style={{ marginTop: 48 }}>
          <Link href={`/calendar/?month=${shiftMonth(month, -1)}`} className={styles.iconButton} aria-label={`Previous month, ${monthLabel(shiftMonth(month, -1))}`} scroll={false}>
            <Icon name="chevronLeft" />
          </Link>
          <h2 className={styles.h2Small}>{monthLabel(month)}</h2>
          <Link href={`/calendar/?month=${shiftMonth(month, 1)}`} className={styles.iconButton} aria-label={`Next month, ${monthLabel(shiftMonth(month, 1))}`} scroll={false}>
            <Icon name="chevronRight" />
          </Link>
        </div>
        {month !== monthOf(today) && (
          <p style={{ textAlign: 'center', margin: '8px 0 0' }}>
            <Link href="/calendar/" scroll={false}>
              Back to this month
            </Link>
          </p>
        )}

        <table className={styles.monthTable}>
          <caption className={styles.visuallyHidden}>Events in {monthLabel(month)}</caption>
          <thead>
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <th key={d} scope="col" className={styles.monthHeadCell}>
                  {d.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, w) => (
              <tr key={w}>
                {week.map((cell, i) =>
                  cell ? (
                    <td key={cell.date} className={`${styles.monthCell} ${cell.date === today ? styles.monthCellToday : ''}`}>
                      <span className={styles.monthDate}>
                        <span className={styles.visuallyHidden}>{longDateFromString(cell.date)}</span>
                        <span aria-hidden="true">{cell.day}</span>
                      </span>
                      {(holidays.get(cell.date) ?? []).map((h) => (
                        <span key={h} className={styles.monthHoliday}>
                          {h}
                        </span>
                      ))}
                      {(byDate.get(cell.date) ?? []).map((e) => (
                        <Link key={e.slug} href={`/events/${e.slug}/`} className={styles.monthEvent}>
                          <span className={styles.monthEventTime}>{e.all_day ? 'All day' : timeOfDay(e.starts_at)}</span>
                          {e.title}
                        </Link>
                      ))}
                    </td>
                  ) : (
                    <td key={`blank-${w}-${i}`} className={`${styles.monthCell} ${styles.monthCellEmpty}`} />
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.monthAgenda}>
          {busyDays.length === 0 ? (
            <p className={styles.empty}>Nothing is listed in {monthLabel(month)} yet.</p>
          ) : (
            busyDays.map((d) => (
              <div key={d}>
                <h3 className={styles.monthGroupTitle} style={{ marginTop: 28 }}>
                  {longDateFromString(d)}
                </h3>
                {(holidays.get(d) ?? []).length > 0 && <p className={styles.holidayNote}>{(holidays.get(d) ?? []).join(' and ')}</p>}
                <ul className={styles.dayList}>
                  {(byDate.get(d) ?? []).map((e) => (
                    <li key={e.slug} className={styles.dayItem}>
                      <Link href={`/events/${e.slug}/`}>{e.title}</Link>
                      <span className={styles.small}>{[e.organization, timeRange(e.starts_at, e.ends_at, e.all_day), e.venue].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
