import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import EventCard from '@/components/EventCard';
import { getCauses, getEventsForOrganization, getOrganizationById, getOrganizationBySlug } from '@/lib/data';
import { safeUrl } from '@/lib/format';
import { hasEnded } from '@/lib/time';
import styles from '@/components/site.module.css';

export const revalidate = 600;

// Pages are rendered on first visit and cached, not all at build time.
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) return { title: 'Organization not found' };
  return {
    title: `${org.name} events`,
    description: `Upcoming and past events from ${org.name} on the San Antonio nonprofit community calendar.`,
    alternates: { canonical: `/organizations/${org.slug}/` }
  };
}

export default async function OrganizationPage({ params }: { params: Params }) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();
  if (org.merged_into) {
    const target = await getOrganizationById(org.merged_into);
    if (target) permanentRedirect(`/organizations/${target.slug}/`);
  }
  const [events, causes] = await Promise.all([getEventsForOrganization(org.id), getCauses()]);
  const upcoming = events.filter((e) => !hasEnded(e.ends_at)).reverse();
  const past = events.filter((e) => hasEnded(e.ends_at)).slice(0, 12);
  const cause = causes.find((c) => c.slug === org.cause_slug);
  const website = safeUrl(org.website);

  return (
    <section className={styles.sectionTight}>
      <div className={styles.container}>
        <nav aria-label="Breadcrumb" className={styles.crumbs}>
          <Link href="/">Home</Link>
          <span aria-hidden="true" className={styles.crumbSep}>/</span>
          <Link href="/events/">Events</Link>
          <span aria-hidden="true" className={styles.crumbSep}>/</span>
          <span>{org.name}</span>
        </nav>
        {cause && (
          <p className={styles.eyebrow} style={{ marginTop: 24 }}>
            <Link href={`/events/?cause=${cause.slug}`}>{cause.label}</Link>
          </p>
        )}
        <h1 className={styles.h1} style={{ marginTop: cause ? 0 : 24 }}>
          {org.name}
        </h1>
        {org.description && <p className={styles.lead}>{org.description}</p>}
        <p style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontWeight: 600 }}>
          {website && (
            <a href={website} rel="noopener">
              Website
            </a>
          )}
          <a href={`/organizations/${org.slug}/calendar.ics`}>Subscribe to their events</a>
        </p>

        <h2 className={styles.h2Small} style={{ marginTop: 40 }}>
          Upcoming
        </h2>
        {upcoming.length ? (
          <div className={styles.cardGrid} style={{ marginTop: 16 }}>
            {upcoming.map((e) => (
              <EventCard key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>Nothing upcoming is listed for {org.name}.</p>
        )}

        {past.length > 0 && (
          <>
            <h2 className={styles.h2Small} style={{ marginTop: 48 }}>
              Past events
            </h2>
            <div className={styles.cardGrid} style={{ marginTop: 16 }}>
              {past.map((e) => (
                <EventCard key={e.id} e={e} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
