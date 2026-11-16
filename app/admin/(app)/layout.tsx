import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { adminCounts } from '@/lib/admin-data';
import { EMAIL_SUBMITTERS } from '@/lib/env';
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
              Organizations{counts.unverifiedOrganizations > 0 && <span className={a.count}>{counts.unverifiedOrganizations}</span>}
            </Link>
            <Link href="/admin/settings/" className={a.barLink}>
              Lists
            </Link>
            {admin.super_admin && (
              <Link href="/admin/admins/" className={a.barLink}>
                Admins
              </Link>
            )}
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
          {/*
            * Said on every page rather than once on the dashboard, because the
            * moment it matters is the moment somebody is about to approve
            * something, and that happens on three different pages.
            */}
          {!EMAIL_SUBMITTERS && (
            <div className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginBottom: 28 }}>
              <div>
                <p className={styles.noticeTitle}>Submitters are not being emailed yet</p>
                <p style={{ margin: '4px 0 0' }}>
                  Approving or turning down a listing changes the calendar but sends nothing to the person who submitted it, which is what we want while the
                  imported listings are worked through. Admin emails and sign-in codes are unaffected. Turn this on at launch by setting EMAIL_SUBMITTERS to
                  &ldquo;on&rdquo; in Vercel.
                </p>
              </div>
            </div>
          )}
          {children}
        </div>
      </main>
    </>
  );
}
