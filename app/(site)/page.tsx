import Link from 'next/link';
import CheckDate from '@/components/CheckDate';
import EventCard, { EventRow } from '@/components/EventCard';
import Icon from '@/components/Icon';
import { SITE } from '@/content/site';
import { getCauses, getEventTypes, getMonthEvents, getRecentlyAdded, getUpcomingEvents } from '@/lib/data';
import { monthOf, shortDate, todayLocal } from '@/lib/time';
import styles from '@/components/site.module.css';

// Rebuilt every ten minutes, and at once whenever an admin changes anything.
export const revalidate = 600;

export default async function Home() {
  const today = todayLocal();
  const month = monthOf(today);
  const [upcoming, recent, types, causes, monthEvents] = await Promise.all([
    getUpcomingEvents({ limit: 9 }),
    getRecentlyAdded(6),
    getEventTypes(),
    getCauses(),
    getMonthEvents(month)
  ]);
  const nextUp = upcoming.slice(0, 3);
  const grid = upcoming.length > 3 ? upcoming.slice(3, 9) : upcoming;

  return (
    <>
      <section className={`${styles.onDark} ${styles.hero}`}>
        <div className={`${styles.container} ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>San Antonio · Nonprofit events</p>
            <h1 className={styles.display}>Every good cause in San Antonio, on one calendar.</h1>
            <p className={styles.lead}>
              Galas, luncheons, walks, golf tournaments and festivals from local nonprofits. Find one worth showing up for, or check a date before you book your own.
            </p>
            <form role="search" action="/events/" className={styles.search}>
              <label htmlFor="hero-search" className={styles.visuallyHidden}>
                Search events
              </label>
              <div className={styles.searchBox}>
                <span style={{ color: 'var(--muted)', display: 'flex' }}>
                  <Icon name="search" />
                </span>
                <input id="hero-search" name="q" type="search" placeholder="Search events or organizations" />
              </div>
              <button type="submit" className={`${styles.btn} ${styles.btnAmber}`} style={{ borderRadius: 12, minHeight: 56 }}>
                Search
              </button>
            </form>
            <div className={styles.heroLinks}>
              <Link href="/calendar/">Planning an event? Check a date</Link>
              <Link href="/submit/">List your event</Link>
            </div>
          </div>

          {nextUp.length > 0 && (
            <aside aria-labelledby="next-up" className={styles.heroAside}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <h2 id="next-up" className={styles.h3} style={{ fontSize: 22 }}>
                  Coming up next
                </h2>
                <span className={styles.mono} style={{ color: 'var(--muted)' }}>
                  {shortDate(nextUp[0].starts_at)}
                  {nextUp.length > 1 ? ` – ${shortDate(nextUp[nextUp.length - 1].starts_at)}` : ''}
                </span>
              </div>
              <ul className={styles.list} style={{ marginTop: 16 }}>
                {nextUp.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ul>
              <Link href="/events/" className={styles.arrowLink} style={{ marginTop: 8, fontSize: 15 }}>
                See all upcoming events
                <Icon name="arrow" size={18} />
              </Link>
            </aside>
          )}
        </div>
      </section>

      <section aria-label="Partners" className={styles.partners}>
        <div className={`${styles.container} ${styles.partnersInner}`}>
          <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
            A shared resource from
          </p>
          {SITE.partners.map((p) => (
            <span key={p} className={styles.partnerName}>
              {p}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div style={{ maxWidth: 640 }}>
              <h2 className={styles.h2}>Upcoming events</h2>
              <p className={styles.lead} style={{ marginTop: 12 }}>
                Show up for a cause you care about.
              </p>
            </div>
            <Link href="/events/" className={styles.arrowLink}>
              See every event
              <Icon name="arrow" size={18} />
            </Link>
          </div>
          {types.length > 0 && (
            <nav aria-label="Event types" className={styles.chips}>
              {types
                .filter((t) => t.slug !== 'other')
                .map((t) => (
                  <Link key={t.slug} href={`/events/?type=${t.slug}`} className={styles.chip}>
                    {t.plural}
                  </Link>
                ))}
            </nav>
          )}
          {grid.length > 0 ? (
            <div className={styles.cardGrid}>
              {grid.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No upcoming events are listed yet. <Link href="/submit/">Submit the first one.</Link>
            </p>
          )}
        </div>
      </section>

      <section id="check" className={`${styles.section} ${styles.sectionMist}`}>
        <div className={`${styles.container} ${styles.split}`}>
          <div className={styles.splitMain} style={{ flexBasis: 420 }}>
            <p className={styles.eyebrow}>For event planners</p>
            <h2 className={styles.h2}>Planning an event? Check the date first.</h2>
            <p className={styles.lead}>
              Donors, sponsors and local media can only be in so many places at once. Before you sign a venue contract, see what is already booked that day.
            </p>
            <ul className={styles.checks}>
              {[
                'Pick any day to see what is already listed',
                "Keep your gala from landing on top of someone else's",
                'List your date so other organizations can plan around you'
              ].map((t) => (
                <li key={t} className={styles.check}>
                  <Icon name="check" size={22} strokeWidth={2.4} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link href="/submit/" className={`${styles.btn} ${styles.btnPrimary}`}>
                Submit your event
              </Link>
              <Link href="/calendar/" className={`${styles.btn} ${styles.btnOutline}`}>
                Full month view
              </Link>
            </div>
          </div>
          <div className={styles.splitSide} style={{ flexBasis: 440, maxWidth: 540 }}>
            <CheckDate initialMonth={month} initialEvents={monthEvents} today={today} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={`${styles.container} ${styles.split} ${styles.splitStart}`}>
          <div className={styles.splitMain}>
            <h2 className={styles.h2Small}>Browse by cause</h2>
            <p className={styles.body} style={{ margin: '10px 0 0', color: 'var(--muted)' }}>
              Find events from the kinds of organizations you want to support.
            </p>
            <nav aria-label="Causes" style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {causes.map((c) => (
                <Link key={c.slug} href={`/events/?cause=${c.slug}`} className={styles.causeLink}>
                  {c.label}
                </Link>
              ))}
            </nav>
          </div>
          {recent.length > 0 && (
            <div className={styles.splitSide} style={{ flexBasis: 420 }}>
              <h2 className={styles.h2Small}>Just added</h2>
              <p className={styles.body} style={{ margin: '10px 0 0', color: 'var(--muted)' }}>
                The newest listings from local organizations.
              </p>
              <ul className={styles.list} style={{ marginTop: 20 }}>
                {recent.map((e, i) => (
                  <EventRow key={e.id} e={e} last={i === recent.length - 1} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionLined}`}>
        <div className={`${styles.container} ${styles.split} ${styles.splitStart}`}>
          <div className={styles.splitMain} style={{ flexBasis: 420 }}>
            <p className={styles.eyebrow}>Why this exists</p>
            <h2 className={styles.h2}>One shared calendar means fewer collisions.</h2>
            <p className={styles.body} style={{ marginTop: 20 }}>
              In 2020, as COVID-19 scrambled every nonprofit&apos;s event plans, the San Antonio Business Journal, The CE Group and Pear Analytics launched this calendar so leaders and funders could plan around one another.
            </p>
            <p className={styles.body}>In 2026 it relaunched in partnership with The Nonprofit Council, with support from the Kronkosky Foundation.</p>
            <Link href="/about/" className={styles.arrowLink}>
              More about the calendar
              <Icon name="arrow" size={18} />
            </Link>
          </div>
          <div className={`${styles.splitSide} ${styles.features}`} style={{ flexBasis: 520 }}>
            {[
              { icon: 'eye' as const, title: 'More eyes on your event', text: 'Reach new attendees, sponsors and media across the city.' },
              { icon: 'calendarCheck' as const, title: 'Fewer date conflicts', text: 'A shared planning tool so big events stop landing on the same night.' },
              { icon: 'people' as const, title: 'Connections to supporters', text: 'Businesses, foundations and individuals looking for local causes to back.' },
              { icon: 'share' as const, title: 'Stronger collaboration', text: "A clear view of the sector's year helps everyone plan and give with intent." }
            ].map((f) => (
              <div key={f.title}>
                <div className={styles.featureIcon}>
                  <Icon name={f.icon} size={24} />
                </div>
                <h3 className={styles.h3} style={{ marginTop: 16 }}>
                  {f.title}
                </h3>
                <p className={styles.body} style={{ margin: '8px 0 0', fontSize: 16, color: 'var(--muted)' }}>
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.onDark}`}>
        <div className={`${styles.container} ${styles.panelPair}`}>
          <div className={styles.panel}>
            <p className={styles.eyebrow}>For nonprofits</p>
            <h2 className={styles.h2Small} style={{ fontSize: 'clamp(28px, 3.4vw, 40px)' }}>
              Add your event to the calendar.
            </h2>
            <ol className={styles.steps}>
              {['Tell us about your organization', 'Add up to three events at once', 'Share your listing with supporters'].map((s, i) => (
                <li key={s} className={styles.step}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
            <Link href="/submit/" className={`${styles.btn} ${styles.btnAmber}`} style={{ marginTop: 32 }}>
              Submit an event
            </Link>
          </div>
          <div className={styles.panel}>
            <p className={styles.eyebrow}>For sponsors and partners</p>
            <h2 className={styles.h2Small} style={{ fontSize: 'clamp(28px, 3.4vw, 40px)' }}>
              Sponsor the calendar or join the steering committee.
            </h2>
            <p className={styles.lead} style={{ color: 'var(--on-dark-2)' }}>
              Business partners, foundation representatives and community supporters help shape what this calendar becomes next.
            </p>
            <a href={`mailto:${SITE.contactEmail}`} className={`${styles.btn} ${styles.btnOutlineLight}`} style={{ marginTop: 32 }}>
              Email {SITE.contactEmail}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
