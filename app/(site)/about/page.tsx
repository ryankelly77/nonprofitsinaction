import type { Metadata } from 'next';
import Link from 'next/link';
import PartnerLogos from '@/components/PartnerLogos';
import { SITE } from '@/content/site';
import styles from '@/components/site.module.css';

export const metadata: Metadata = {
  title: 'About the calendar',
  description: 'Why San Antonio has a shared nonprofit events calendar, who runs it, and how to get involved.',
  alternates: { canonical: '/about/' }
};

export default function AboutPage() {
  return (
    <>
      <section className={styles.sectionTight}>
        <div className={styles.container} style={{ maxWidth: 860 }}>
          <p className={styles.eyebrow}>About</p>
          <h1 className={styles.h1}>Why this calendar matters</h1>
          <p className={styles.lead}>
            Nonprofits pour tremendous effort into mission-driven events: galas, luncheons, walkathons, concerts, festivals and more. As the city&apos;s calendar gets
            more crowded, scheduling gets harder, and donors, funders and media can only be in so many places at once.
          </p>

          <h2 className={styles.h2Small} style={{ marginTop: 48 }}>
            What it is for
          </h2>
          <ul className={styles.checks}>
            {[
              'More visibility for nonprofit events across San Antonio',
              'Fewer scheduling conflicts, through one shared planning resource',
              'Connecting nonprofits with businesses, foundations and individuals who want to support local causes',
              'Stronger collaboration and more strategic giving across the region'
            ].map((t) => (
              <li key={t} className={styles.check}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className={styles.body} style={{ marginTop: 24 }}>
            Virtual, in person or hybrid: if your organization is putting on an event, the calendar is a free way to get it seen and to keep it clear of
            others. <Link href="/submit/">List your event.</Link>
          </p>

          <h2 className={styles.h2Small} style={{ marginTop: 48 }}>
            Where it came from
          </h2>
          <p className={styles.body}>
            In 2020, in response to growing need and the scheduling chaos of the COVID-19 crisis, the San Antonio Business Journal, The CE Group and Pear
            Analytics launched the Community Calendar, a central tool for nonprofit leaders and funders to plan, promote and align events during a time of
            disruption.
          </p>
          <p className={styles.body}>
            In 2026 it relaunched in collaboration with The Nonprofit Council, with generous support from the Kronkosky Foundation.
          </p>

          <h2 className={styles.h2Small} style={{ marginTop: 48 }}>
            How to get involved
          </h2>
          <p className={styles.body}>
            Nonprofit leaders, business partners, foundation representatives and community supporters are invited to help shape what comes next. To ask about
            sponsorships, partnerships or joining the steering committee, email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        </div>
      </section>
      <section className={`${styles.sectionTight} ${styles.sectionMist}`}>
        <div className={styles.container} style={{ maxWidth: 860 }}>
          <p className={styles.mono} style={{ margin: 0, color: 'var(--muted)', textAlign: 'center' }}>
            A shared resource from
          </p>
          <p className={styles.partnerRow} style={{ marginTop: 16 }}>
            <PartnerLogos />
          </p>
        </div>
      </section>
    </>
  );
}
