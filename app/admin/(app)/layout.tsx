import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { adminCounts } from '@/lib/admin-data';
import { signOut } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const counts = await adminCounts();
  return (
    <>
      <header className={a.bar}>
        <div className={`${styles.container} ${a.barInner}`}>
          <nav aria-label="Admin" className={a.barNav}>
            <Link href="/admin/" className={a.barLink}>
              Review{counts.pending > 0 && <span className={a.count}>{counts.pending}</span>}
            </Link>
            <Link href="/admin/?view=flagged" className={a.barLink}>
              Needs a check{counts.flagged > 0 && <span className={a.count}>{counts.flagged}</span>}
            </Link>
            <Link href="/admin/?view=upcoming" className={a.barLink}>
              Live events
            </Link>
            <Link href="/admin/venues/" className={a.barLink}>
              Venues{counts.unverifiedVenues > 0 && <span className={a.count}>{counts.unverifiedVenues}</span>}
            </Link>
            <Link href="/admin/organizations/" className={a.barLink}>
              Organizations
            </Link>
            <Link href="/" className={a.barLink}>
              View site
            </Link>
          </nav>
          <form action={signOut} className={a.who}>
            <span>{admin.email}</span>
            <button type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main id="content" className={styles.main}>
        <div className={styles.container} style={{ paddingTop: 32, paddingBottom: 64 }}>
          {children}
        </div>
      </main>
    </>
  );
}
