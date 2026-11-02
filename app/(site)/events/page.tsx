import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import DayBand from '@/components/DayBand';
import DayCard from '@/components/DayCard';
import DayStack from '@/components/DayStack';
import EventCard from '@/components/EventCard';
import Icon from '@/components/Icon';
import { getCauses, getEventTypes, getUpcomingEvents } from '@/lib/data';
import { localParts, monthLabel } from '@/lib/time';
import type { PublicEvent } from '@/lib/types';
import { typeTagClass } from '@/components/eventTypeTag';
import styles from '@/components/site.module.css';

const PAGE_SIZE = 24;

/*
 * Three ways of showing a day that holds more than one event, up for the
 * group to look at side by side. Leaving the switch off is the live page.
 * Temporary: once one is chosen, this and the components it names come out.
 */
const CONCEPTS = [
  { key: '', label: 'Plain grid' },
  { key: '1', label: 'Concept 1' },
  { key: '2', label: 'Concept 2' },
  { key: '3', label: 'Concept 3' }
] as const;

const CONCEPT_NOTE: Record<string, string> = {
  '1': 'Concept 1: a day with more than one event becomes a single card. The date is said once, the count is marked in amber, and the events stack inside it.',
  '2': 'Concept 2: the ordinary grid, but a day with more than one event sits on a stack. The others show as edges behind the card; the chevron opens them out.',
  '3': 'Concept 3: the ordinary grid, with a band across it naming each day and how much is on it.'
};

type Search = Promise<{ type?: string; cause?: string; q?: string; page?: string; concept?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { q, concept } = await searchParams;
  return {
    title: 'Upcoming nonprofit events in San Antonio',
    description: 'Galas, luncheons, walks, golf tournaments and festivals from San Antonio nonprofits, soonest first.',
    alternates: { canonical: '/events/' },
    // A search result page, or a layout up for review, is not a page anyone
    // should land on from Google.
    robots: q || concept ? { index: false, follow: true } : undefined
  };
}

/*
 * Events arrive soonest first, so everything on one day is already together
 * and grouping needs no sorting.
 */
function groupByDay(events: PublicEvent[]): Array<{ date: string; events: PublicEvent[] }> {
  const days: Array<{ date: string; events: PublicEvent[] }> = [];
  for (const e of events) {
    const d = localParts(e.starts_at).date;
    const last = days[days.length - 1];
    if (last && last.date === d) last.events.push(e);
    else days.push({ date: d, events: [e] });
  }
  return days;
}

function groupByMonth(events: PublicEvent[]): Array<{ month: string; events: PublicEvent[] }> {
  const groups: Array<{ month: string; events: PublicEvent[] }> = [];
  for (const e of events) {
    const m = localParts(e.starts_at).date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.month === m) last.events.push(e);
    else groups.push({ month: m, events: [e] });
  }
  return groups;
}

function href(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/events/?${s}` : '/events/';
}

export default async function EventsPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const [types, causes] = await Promise.all([getEventTypes(), getCauses()]);
  const type = types.find((t) => t.slug === sp.type)?.slug;
  const cause = causes.find((c) => c.slug === sp.cause)?.slug;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const page = Math.max(1, Math.min(50, Number(sp.page) || 1));
  const concept = CONCEPTS.some((c) => c.key && c.key === sp.concept) ? sp.concept : undefined;

  // One more than a page tells us whether there is a next page.
  const events = await getUpcomingEvents({ type, cause, q, limit: PAGE_SIZE * page + 1 });
  const shown = events.slice(0, PAGE_SIZE * page);
  const more = events.length > shown.length;
  const groups = groupByMonth(shown);
  const causeLabel = causes.find((c) => c.slug === cause)?.label;
  const typeLabel = types.find((t) => t.slug === type)?.plural;

  return (
    <section className={styles.sectionTight}>
      <div className={styles.container}>
        {/* Temporary, for the group to compare the three. Remove with CONCEPTS. */}
        <nav aria-label="Layout concept" className={styles.conceptSwitch}>
          {CONCEPTS.map((c) => (
            <Link
              key={c.key || 'plain'}
              href={href({ type, cause, q, concept: c.key || undefined })}
              className={styles.conceptLink}
              aria-current={(concept ?? '') === c.key ? 'true' : undefined}
            >
              {c.label}
            </Link>
          ))}
        </nav>
        <h1 className={styles.h1}>{typeLabel ? `Upcoming ${typeLabel.toLowerCase()}` : 'Upcoming events'}</h1>
        {concept && <p className={styles.conceptNote}>{CONCEPT_NOTE[concept]}</p>}
        <p className={styles.lead}>
          {causeLabel ? `Events from ${causeLabel.toLowerCase()} organizations. ` : ''}
          {q ? `Matching “${q}”. ` : ''}
          Soonest first. <Link href="/calendar/">See them by month</Link> or <a href="/calendar.ics">subscribe in your calendar app</a>.
        </p>

        <form action="/events/" className={styles.filterBar} role="search">
          {type && <input type="hidden" name="type" value={type} />}
          {concept && <input type="hidden" name="concept" value={concept} />}
          <div className={styles.field} style={{ flex: '2 1 280px' }}>
            <label htmlFor="q" className={styles.label}>
              Search
            </label>
            <input id="q" name="q" type="search" defaultValue={q} className={styles.input} placeholder="Event or organization name" />
          </div>
          <div className={styles.field} style={{ flex: '1 1 220px' }}>
            <label htmlFor="cause" className={styles.label}>
              Cause
            </label>
            <select id="cause" name="cause" defaultValue={cause ?? ''} className={styles.select}>
              <option value="">All causes</option>
              {causes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            Show events
          </button>
        </form>

        <nav aria-label="Event types" className={styles.chips}>
          <Link href={href({ cause, q, concept })} className={styles.chip} aria-current={!type ? 'true' : undefined}>
            All events
          </Link>
          {types.map((t) => (
            <Link
              key={t.slug}
              href={href({ type: t.slug, cause, q, concept })}
              className={`${styles.chip} ${typeTagClass(t.slug)}`}
              aria-current={type === t.slug ? 'true' : undefined}
            >
              {t.plural}
            </Link>
          ))}
        </nav>

        {groups.length === 0 ? (
          <div className={styles.empty}>
            <p style={{ margin: 0 }}>Nothing upcoming matches that.</p>
            <p style={{ margin: '8px 0 0' }}>
              <Link href="/events/">See every upcoming event</Link> or <Link href="/submit/">list one of your own</Link>.
            </p>
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.month}>
              <h2 className={styles.monthGroupTitle}>{monthLabel(g.month)}</h2>
              <div className={styles.cardGrid} style={{ marginTop: 16, alignItems: concept === '1' ? 'start' : undefined }}>
                {!concept
                  ? g.events.map((e) => <EventCard key={e.id} e={e} />)
                  : groupByDay(g.events).map((d) => {
                      if (concept === '3') {
                        return (
                          <Fragment key={d.date}>
                            <DayBand date={d.date} count={d.events.length} />
                            {d.events.map((e) => (
                              <EventCard key={e.id} e={e} />
                            ))}
                          </Fragment>
                        );
                      }
                      if (d.events.length === 1) return <EventCard key={d.events[0].id} e={d.events[0]} />;
                      if (concept === '1') return <DayCard key={d.date} events={d.events} />;
                      return <DayStack key={d.date} id={`day-${d.date}`} events={d.events} />;
                    })}
              </div>
            </div>
          ))
        )}

        {more && (
          <div className={styles.pager}>
            <Link href={href({ type, cause, q, concept, page: String(page + 1) })} className={`${styles.btn} ${styles.btnOutline}`} scroll={false}>
              Show more events
              <Icon name="arrow" size={18} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
