import Link from 'next/link';
import { SITE } from '@/content/site';
import { localParts } from '@/lib/time';
import styles from './site.module.css';

export default function Footer() {
  const year = localParts(new Date()).year;
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <div className={styles.footerTop}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <p className={styles.footerName}>{SITE.name}</p>
            <p style={{ margin: '10px 0 0', maxWidth: 360, fontSize: 15, lineHeight: 1.55 }}>
              A shared community calendar for San Antonio&apos;s nonprofits, funders and supporters.
            </p>
          </div>
          <nav aria-label="Footer" className={styles.footerNav}>
            <Link href="/events/">Events</Link>
            <Link href="/calendar/">Check a date</Link>
            <Link href="/submit/">Submit an event</Link>
            <Link href="/about/">About</Link>
            <a href="/calendar.ics">Subscribe to the calendar</a>
            <a href={`mailto:${SITE.contactEmail}`}>Contact</a>
          </nav>
        </div>
        <div className={styles.footerBottom}>
          <span>© {year} {SITE.name}. All rights reserved.</span>
          {SITE.social.length > 0 && (
            <span style={{ display: 'flex', gap: 20 }}>
              {SITE.social.map((s) => (
                <a key={s.url} href={s.url}>
                  {s.label}
                </a>
              ))}
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
