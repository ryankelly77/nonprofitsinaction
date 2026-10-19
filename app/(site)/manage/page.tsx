import type { Metadata } from 'next';
import NewLinkForm from '@/components/NewLinkForm';
import styles from '@/components/site.module.css';

export const metadata: Metadata = { title: 'Get a new edit link', robots: { index: false, follow: true } };

export default function ManageIndex() {
  return (
    <section className={styles.section}>
      <div className={styles.container} style={{ maxWidth: 760 }}>
        <p className={styles.eyebrow}>Already listed?</p>
        <h1 className={styles.h1}>Get a new edit link</h1>
        <p className={styles.lead}>
          Every listing has a private link for changing or cancelling it. If you cannot find yours, we will email a new one to the address you listed with.
        </p>
        <NewLinkForm />
      </div>
    </section>
  );
}
