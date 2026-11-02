import Footer from '@/components/Footer';
import Header from '@/components/Header';
import JsonLd from '@/components/JsonLd';
import { SITE_URL } from '@/lib/env';
import { siteJsonLd } from '@/lib/schema';
import styles from '@/components/site.module.css';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.root}>
      <a className={styles.skip} href="#content">
        Skip to main content
      </a>
      <Header />
      <main id="content" className={styles.main}>
        {children}
      </main>
      <Footer />
      <JsonLd data={siteJsonLd(SITE_URL)} />
    </div>
  );
}
