import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import styles from '@/components/site.module.css';

export default function NotFound() {
  return (
    <div className={styles.root}>
      <Header />
      <main id="content" className={`${styles.main} ${styles.section}`}>
        <div className={styles.container} style={{ maxWidth: 760 }}>
          <p className={styles.eyebrow}>Page not found</p>
          <h1 className={styles.h1}>That page is not on the calendar.</h1>
          <p className={styles.lead}>It may have moved when the calendar was rebuilt, or the event may have been removed.</p>
          <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link href="/events/" className={`${styles.btn} ${styles.btnPrimary}`}>
              See upcoming events
            </Link>
            <Link href="/" className={`${styles.btn} ${styles.btnOutline}`}>
              Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
