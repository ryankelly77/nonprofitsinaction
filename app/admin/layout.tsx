import type { Metadata } from 'next';
import styles from '@/components/site.module.css';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s | Admin' }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}
