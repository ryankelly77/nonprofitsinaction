import Link from 'next/link';
import { SITE } from '@/content/site';
import Logo from './Logo';
import NavLinks from './NavLinks';
import styles from './site.module.css';

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Link href="/" className={styles.brand}>
          <Logo />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{SITE.name}</span>
            <span className={styles.brandSub}>{SITE.tagline}</span>
          </span>
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
