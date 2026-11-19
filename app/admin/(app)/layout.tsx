import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { adminCounts } from '@/lib/admin-data';
import { emailingSubmitters } from '@/lib/settings-store';
import BarNav from './BarNav';
import { signOut } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const [counts, emailing] = await Promise.all([adminCounts(), emailingSubmitters()]);
  return (
    <>
      <header className={a.bar}>
        <div className={`${styles.container} ${a.barInner}`}>
          {/*
            * Two tiers, because the items are not the same kind of thing.
            *
            * The first is the work and the things it is done to: where the
            * calendar is run from, in the order somebody runs it. Review
            * carries everything waiting on a person, since that is the one
            * number worth seeing from every page; the two kinds of waiting
            * are different jobs and stay told apart on the screen itself.
            *
            * The second is everything you go to once and come back from.
            * Keeping them in one row made "View site" look like a step in
            * reviewing listings.
            */}
          <BarNav
            counts={{
              review: counts.pending + counts.flagged,
              venues: counts.unverifiedVenues,
              organizations: counts.unverifiedOrganizations
            }}
          />
          <div className={a.barSide}>
            <nav aria-label="Elsewhere" className={a.barMinor}>
              {admin.super_admin && (
                <Link href="/admin/admins/" className={a.barMinorLink}>
                  Admins
                </Link>
              )}
              {/* A new tab, so whatever was half reviewed is still open behind it. */}
              <Link href="/" className={a.barMinorLink} target="_blank" rel="noopener">
                View site
              </Link>
            </nav>
            <form action={signOut} className={a.who}>
              <span>{admin.email}</span>
              <button type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main id="content" className={styles.main}>
        <div className={styles.container} style={{ paddingTop: 32, paddingBottom: 64 }}>
          {/*
            * Said on every page rather than once on the dashboard, because the
            * moment it matters is the moment somebody is about to approve
            * something, and that happens on three different pages.
            */}
          {!emailing && (
            <div className={`${styles.notice} ${styles.noticeWarn}`} style={{ marginBottom: 28 }}>
              <div>
                <p className={styles.noticeTitle}>Submitters are not being emailed yet</p>
                <p style={{ margin: '4px 0 0' }}>
                  Approving or turning down a listing changes the calendar but sends nothing to the person who submitted it, which is what we want while the
                  imported listings are worked through. Admin emails and sign-in codes are unaffected.{' '}
                  <Link href="/admin/settings/">Turn it on under Settings</Link> when the calendar is ready to be heard from.
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
