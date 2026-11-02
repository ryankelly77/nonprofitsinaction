import type { Metadata } from 'next';
import Link from 'next/link';
import SubmitForm from '@/components/SubmitForm';
import { getCauses, getEventTypes } from '@/lib/data';
import { TURNSTILE_SITE_KEY } from '@/lib/env';
import { isDateString, todayLocal } from '@/lib/time';
import styles from '@/components/site.module.css';

export const metadata: Metadata = {
  title: 'List your event',
  description: 'Add your nonprofit event to the San Antonio community calendar. Free, reviewed before it goes live, and you can edit it any time.',
  alternates: { canonical: '/submit/' }
};

type Search = Promise<{ date?: string }>;

export default async function SubmitPage({ searchParams }: { searchParams: Search }) {
  const { date } = await searchParams;
  const [types, causes] = await Promise.all([getEventTypes(), getCauses()]);
  const initialDate = date && isDateString(date) && date >= todayLocal() ? date : undefined;

  return (
    <>
      <section className={`${styles.sectionMist}`} style={{ borderBottom: '1px solid var(--line)' }}>
        <div className={styles.container} style={{ paddingTop: 'clamp(36px, 5vw, 64px)', paddingBottom: 'clamp(36px, 5vw, 64px)' }}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <Link href="/">Home</Link>
            <span aria-hidden="true" className={styles.crumbSep}>
              /
            </span>
            <span>List your event</span>
          </nav>
          <h1 className={styles.h1} style={{ marginTop: 16 }}>
            List your event
          </h1>
          <p className={styles.lead} style={{ maxWidth: 680 }}>
            Put your event in front of supporters and help other nonprofits plan around your date. Listing is free. You can add up to three events at once.
          </p>
        </div>
      </section>
      <div className={styles.container} style={{ paddingTop: 'clamp(32px, 5vw, 56px)', paddingBottom: 'clamp(56px, 7vw, 96px)' }}>
        <div className={styles.formLayout}>
          <aside className={styles.formAside}>
            <ol className={styles.progress}>
              {['Your organization', 'Event details', 'Review and go live'].map((s, i) => (
                <li key={s} className={styles.progressItem}>
                  <span className={styles.progressNum}>{i + 1}</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{s}</span>
                </li>
              ))}
            </ol>
            <div className={styles.tips}>
              <p className={styles.h3} style={{ margin: 0, fontSize: 17 }}>
                What makes a strong listing
              </p>
              <ul>
                <li>A direct ticket or registration link</li>
                <li>The venue name guests will recognize</li>
                <li>An end time, so planners can see overlap</li>
                <li>A flyer or photo for your event page</li>
              </ul>
            </div>
            <p className={styles.small} style={{ marginTop: 20 }}>
              Already listed and need to change something? Use the private link in your confirmation email, or{' '}
              <Link href="/manage/">get a new link</Link>.
            </p>
          </aside>
          <div className={styles.formMain}>
            <SubmitForm types={types.map((t) => ({ slug: t.slug, label: t.label }))} causes={causes} initialDate={initialDate} turnstileSiteKey={TURNSTILE_SITE_KEY} />
          </div>
        </div>
      </div>
    </>
  );
}
