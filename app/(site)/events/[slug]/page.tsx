import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { EventRow } from '@/components/EventCard';
import { StatusTags } from '@/components/EventCard';
import Icon from '@/components/Icon';
import JsonLd from '@/components/JsonLd';
import ShareButton from '@/components/ShareButton';
import { getEventBySlug, getUpcomingEvents } from '@/lib/data';
import { SITE_URL } from '@/lib/env';
import { FORMAT_LABEL, directionsUrl, imageUrl, safeUrl, venueAddress } from '@/lib/format';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/ics';
import { eventJsonLd } from '@/lib/schema';
import { dateTile, hasEnded, localParts, longDate, monthName, timeOfDay, timeRange } from '@/lib/time';
import type { PublicEvent } from '@/lib/types';
import styles from '@/components/site.module.css';

export const revalidate = 600;

// Pages are rendered on first visit and cached, not all at build time.
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { event: e } = await getEventBySlug(slug);
  if (!e) return { title: 'Event not found' };
  const when = `${longDate(e.starts_at)}, ${timeRange(e.starts_at, e.ends_at, e.all_day)}`;
  const description = `${when}${e.venue ? ` at ${e.venue.name}` : ''}. Hosted by ${e.organization.name}.`;
  const image = imageUrl(e.image_path);
  return {
    title: e.title,
    description,
    alternates: { canonical: `/events/${e.slug}/` },
    openGraph: { title: e.title, description, url: `/events/${e.slug}/`, type: 'website', images: image ? [image] : undefined }
  };
}

function relative(from: PublicEvent, other: PublicEvent): string {
  const a = localParts(from.starts_at).date;
  const b = localParts(other.starts_at).date;
  const days = Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
  if (days === 0) return 'Same day';
  const n = Math.abs(days);
  const amount = n % 7 === 0 ? `${n / 7} week${n / 7 > 1 ? 's' : ''}` : `${n} day${n > 1 ? 's' : ''}`;
  return `${amount} ${days < 0 ? 'before' : 'after'}`;
}

export default async function EventPage({ params }: { params: Params }) {
  const { slug } = await params;
  const { event: e, movedTo } = await getEventBySlug(slug);
  if (!e) {
    if (movedTo) permanentRedirect(`/events/${movedTo}/`);
    notFound();
  }

  const url = `${SITE_URL}/events/${e.slug}/`;
  const tile = dateTile(e.starts_at);
  const image = imageUrl(e.image_path);
  const ticket = safeUrl(e.ticket_url);
  const online = safeUrl(e.online_url);
  const isPast = hasEnded(e.ends_at);

  // Neighbors: what else is on within two weeks either side.
  const start = new Date(e.starts_at);
  const nearby = (
    await getUpcomingEvents({ after: new Date(start.getTime() - 14 * 86_400_000), limit: 40 })
  ).filter((o) => o.id !== e.id && Math.abs(Date.parse(o.starts_at) - start.getTime()) <= 14 * 86_400_000);
  const sameDay = nearby.filter((o) => localParts(o.starts_at).date === localParts(e.starts_at).date);
  const around = [...sameDay, ...nearby.filter((o) => !sameDay.includes(o))].slice(0, 4);

  return (
    <>
      <section className={styles.sectionTight}>
        <div className={styles.container}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <Link href="/">Home</Link>
            <span aria-hidden="true" className={styles.crumbSep}>
              /
            </span>
            <Link href="/events/">Events</Link>
            <span aria-hidden="true" className={styles.crumbSep}>
              /
            </span>
            <span>{e.title}</span>
          </nav>

          <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 48 }}>
            <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <StatusTags e={e} />
              <h1 className={styles.h1} style={{ marginTop: 18, fontSize: 'clamp(36px, 5.2vw, 64px)', lineHeight: 1 }}>
                {e.title}
              </h1>
              <p className={styles.lead} style={{ marginTop: 18 }}>
                Hosted by <Link href={`/organizations/${e.organization.slug}/`} style={{ fontWeight: 700 }}>{e.organization.name}</Link>
              </p>

              {e.status !== 'scheduled' && (
                <div className={`${styles.notice} ${styles.noticeError}`} style={{ marginTop: 24 }} role="status">
                  <Icon name="alert" size={22} />
                  <p className={styles.noticeTitle}>
                    {e.status === 'cancelled' ? 'This event has been canceled.' : 'This event has been postponed. A new date has not been listed yet.'}
                  </p>
                </div>
              )}
              {isPast && e.status === 'scheduled' && (
                <div className={`${styles.notice} ${styles.noticeOk}`} style={{ marginTop: 24 }} role="status">
                  <Icon name="calendar" size={22} />
                  <p className={styles.noticeTitle}>This event has already happened.</p>
                </div>
              )}

              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <Icon name="calendar" size={24} />
                  <div>
                    <dt>Date</dt>
                    <dd>{longDate(e.starts_at)}</dd>
                  </div>
                </div>
                <div className={styles.fact}>
                  <Icon name="clock" size={24} />
                  <div>
                    <dt>Time</dt>
                    <dd>
                      {timeRange(e.starts_at, e.ends_at, e.all_day)}
                      {!e.all_day && ' CT'}
                    </dd>
                  </div>
                </div>
                <div className={styles.fact}>
                  <Icon name={e.format === 'virtual' ? 'globe' : 'pin'} size={24} />
                  <div>
                    <dt>{e.format === 'virtual' ? 'Where' : 'Venue'}</dt>
                    <dd>{e.venue ? e.venue.name : e.format === 'virtual' ? 'Online' : 'To be announced'}</dd>
                  </div>
                </div>
              </dl>

              {!isPast && e.status !== 'cancelled' && (
                <>
                  <div className={styles.actions}>
                    {ticket && (
                      <a href={ticket} className={`${styles.btn} ${styles.btnPrimary}`} rel="noopener">
                        Tickets and details
                        <Icon name="external" size={18} />
                      </a>
                    )}
                    {online && e.format !== 'in_person' && (
                      <a href={online} className={`${styles.btn} ${styles.btnOutline}`} rel="noopener">
                        Join online
                        <Icon name="external" size={18} />
                      </a>
                    )}
                    <a href={`/events/${e.slug}/calendar.ics`} className={`${styles.btn} ${styles.btnOutline}`}>
                      <Icon name="calendarPlus" size={18} />
                      Add to calendar
                    </a>
                    <ShareButton title={e.title} url={url} />
                  </div>
                  <p className={styles.small} style={{ marginTop: 14 }}>
                    Or add it to <a href={googleCalendarUrl(e, SITE_URL)} rel="noopener">Google Calendar</a> or{' '}
                    <a href={outlookCalendarUrl(e, SITE_URL)} rel="noopener">Outlook.com</a>.
                  </p>
                </>
              )}
            </div>

            {image ? (
              <div className={styles.posterImage}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt={`Flyer for ${e.title}`} />
              </div>
            ) : (
              <div className={styles.poster} aria-hidden="true">
                <span className={styles.mono} style={{ fontSize: 14, letterSpacing: '0.12em', color: 'var(--amber)' }}>
                  {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][localParts(e.starts_at).weekday]}
                </span>
                <div>
                  <div className={styles.posterDay}>{String(tile.day).padStart(2, '0')}</div>
                  <div className={styles.posterMonth}>
                    {monthName(localParts(e.starts_at).month)} {tile.year}
                  </div>
                </div>
                <div className={styles.posterFoot}>
                  {e.all_day ? 'All day' : timeOfDay(e.starts_at)}
                  {e.venue ? ` · ${e.venue.name}` : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={`${styles.sectionTight} ${styles.sectionLined}`}>
        <div className={`${styles.container} ${styles.split} ${styles.splitStart}`} style={{ gap: 48 }}>
          <div style={{ flex: '999 1 560px', minWidth: 0 }}>
            {e.description && (
              <>
                <h2 className={styles.h2Small} style={{ fontSize: 30 }}>
                  About this event
                </h2>
                <div className={styles.description}>{e.description}</div>
              </>
            )}
            <div className={styles.features} style={{ marginTop: e.description ? 32 : 0, gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}>
              <div className={styles.infoCard}>
                <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
                  Hosted by
                </p>
                <p className={styles.h3} style={{ margin: '8px 0 0', fontSize: 22 }}>
                  {e.organization.name}
                </p>
                <Link href={`/organizations/${e.organization.slug}/`} className={styles.arrowLink} style={{ marginTop: 8, fontSize: 15 }}>
                  All events from this organization
                  <Icon name="arrow" size={16} />
                </Link>
              </div>
              <div className={styles.infoCard}>
                <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)' }}>
                  {e.format === 'virtual' ? 'Format' : 'Location'}
                </p>
                <p className={styles.h3} style={{ margin: '8px 0 0', fontSize: 22 }}>
                  {e.venue ? e.venue.name : FORMAT_LABEL[e.format]}
                </p>
                {e.venue && venueAddress(e.venue) && <p className={styles.small} style={{ margin: '6px 0 0' }}>{venueAddress(e.venue)}</p>}
                {e.venue && (
                  <a href={directionsUrl(e.venue)} className={styles.arrowLink} style={{ marginTop: 8, fontSize: 15 }} rel="noopener">
                    Get directions
                    <Icon name="arrow" size={16} />
                  </a>
                )}
                {e.format === 'hybrid' && <p className={styles.small} style={{ margin: '6px 0 0' }}>Also streamed online.</p>}
              </div>
            </div>
          </div>

          <aside aria-labelledby="around" style={{ flex: '1 1 320px', maxWidth: 420, minWidth: 0 }}>
            <h2 id="around" className={styles.h3} style={{ fontSize: 24, fontWeight: 800 }}>
              Around this date
            </h2>
            {sameDay.length === 0 ? (
              <p className={`${styles.notice} ${styles.noticeOk}`} style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
                <Icon name="check" size={16} strokeWidth={2.8} />
                No other events listed that day
              </p>
            ) : (
              <p className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
                <Icon name="alert" size={16} />
                {sameDay.length} other event{sameDay.length > 1 ? 's' : ''} that day
              </p>
            )}
            {around.length > 0 && (
              <ul className={styles.list} style={{ marginTop: 16 }}>
                {around.map((o, i) => (
                  <EventRow key={o.id} e={o} last={i === around.length - 1} note={relative(e, o)} />
                ))}
              </ul>
            )}
            <div className={styles.ctaPanel}>
              <p className={styles.h3} style={{ margin: 0, color: '#fff' }}>
                Planning your own event?
              </p>
              <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.55 }}>See what is already on the calendar before you pick a date.</p>
              <Link href="/calendar/" className={`${styles.btn} ${styles.btnSmall} ${styles.btnAmber}`} style={{ marginTop: 16 }}>
                Check a date
              </Link>
            </div>
          </aside>
        </div>
      </section>
      <JsonLd data={eventJsonLd(e, SITE_URL)} />
    </>
  );
}
