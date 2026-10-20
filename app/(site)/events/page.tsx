import type { Metadata } from 'next';
import Link from 'next/link';
import EventCard from '@/components/EventCard';
import Icon from '@/components/Icon';
import { getCauses, getEventTypes, getUpcomingEvents } from '@/lib/data';
import { localParts, monthLabel } from '@/lib/time';
import type { PublicEvent } from '@/lib/types';
import { typeTagClass } from '@/components/eventTypeTag';
import styles from '@/components/site.module.css';

const PAGE_SIZE = 24;

type Search = Promise<{ type?: string; cause?: string; q?: string; page?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: Search }): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: 'Upcoming nonprofit events in San Antonio',
    description: 'Galas, luncheons, walks, golf tournaments and festivals from San Antonio nonprofits, soonest first.',
    alternates: { canonical: '/events/' },
    // A search result page is not a page anyone should land on from Google.
    robots: q ? { index: false, follow: true } : undefined
  };
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
        <h1 className={styles.h1}>{typeLabel ? `Upcoming ${typeLabel.toLowerCase()}` : 'Upcoming events'}</h1>
        <p className={styles.lead}>
          {causeLabel ? `Events from ${causeLabel.toLowerCase()} organizations. ` : ''}
          {q ? `Matching “${q}”. ` : ''}
          Soonest first. <Link href="/calendar/">See them by month</Link> or <a href="/calendar.ics">subscribe in your calendar app</a>.
        </p>

        <form action="/events/" className={styles.filterBar} role="search">
          {type && <input type="hidden" name="type" value={type} />}
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
          <Link href={href({ cause, q })} className={styles.chip} aria-current={!type ? 'true' : undefined}>
            All events
          </Link>
          {types.map((t) => (
            <Link
              key={t.slug}
              href={href({ type: t.slug, cause, q })}
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
              <div className={styles.cardGrid} style={{ marginTop: 16 }}>
                {g.events.map((e) => (
                  <EventCard key={e.id} e={e} />
                ))}
              </div>
            </div>
          ))
        )}

        {more && (
          <div className={styles.pager}>
            <Link href={href({ type, cause, q, page: String(page + 1) })} className={`${styles.btn} ${styles.btnOutline}`} scroll={false}>
              Show more events
              <Icon name="arrow" size={18} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
