'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './site.module.css';

const LINKS = [
  { href: '/events/', label: 'Events' },
  { href: '/calendar/', label: 'Check a date' },
  { href: '/about/', label: 'About' }
];

export default function NavLinks() {
  const path = usePathname() ?? '/';
  return (
    <nav aria-label="Main" className={styles.nav}>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={styles.navLink} aria-current={path.startsWith(l.href) ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
      <Link href="/submit/" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary} ${styles.navCta}`}>
        Submit an event
      </Link>
    </nav>
  );
}
