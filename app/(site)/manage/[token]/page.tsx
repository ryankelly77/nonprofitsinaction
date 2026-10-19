import type { Metadata } from 'next';
import Link from 'next/link';
import ManageEvents, { type ManagedEvent } from '@/components/ManageEvents';
import { getEventTypes } from '@/lib/data';
import { eventToDraft } from '@/lib/draft';
import { imageUrl } from '@/lib/format';
import { serviceClient } from '@/lib/supabase/service';
import { longDate, timeRange } from '@/lib/time';
import { hashToken } from '@/lib/tokens';
import styles from '@/components/site.module.css';

export const metadata: Metadata = { title: 'Manage your listing', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = serviceClient();
  const { data: sub } = await db
    .from('submissions')
    .select('id, submitter_name, organization:organizations(name)')
    .eq('manage_token_hash', hashToken(token))
    .maybeSingle();

  if (!sub) {
    return (
      <section className={styles.section}>
        <div className={styles.container} style={{ maxWidth: 760 }}>
          <h1 className={styles.h1}>This link does not work anymore.</h1>
          <p className={styles.lead}>Edit links stop working when a newer one is sent. Get a fresh link sent to the email address you listed with.</p>
          <Link href="/manage/" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 24 }}>
            Get a new link
          </Link>
        </div>
      </section>
    );
  }

  const [{ data: rows }, types] = await Promise.all([
    db
      .from('events')
      .select('id, slug, title, event_type_slug, format, starts_at, ends_at, all_day, online_url, ticket_url, description, image_path, moderation, status, rejection_reason, venue:venues(id, name)')
      .eq('submission_id', sub.id)
      .order('starts_at'),
    getEventTypes()
  ]);
  const org = Array.isArray(sub.organization) ? sub.organization[0] : sub.organization;
  const events: ManagedEvent[] = (rows ?? []).map((r) => {
    const venue = Array.isArray(r.venue) ? r.venue[0] : r.venue;
    return {
      id: r.id,
      slug: r.slug,
      moderation: r.moderation,
      status: r.status,
      rejection_reason: r.rejection_reason,
      when: `${longDate(r.starts_at)}, ${timeRange(r.starts_at, r.ends_at, r.all_day)}${venue ? ` · ${venue.name}` : ''}`,
      draft: eventToDraft({ ...r, venue: venue ?? null }, imageUrl(r.image_path))
    };
  });

  return (
    <>
      <section className={styles.sectionMist} style={{ borderBottom: '1px solid var(--line)' }}>
        <div className={styles.container} style={{ paddingTop: 'clamp(36px, 5vw, 64px)', paddingBottom: 'clamp(28px, 4vw, 48px)' }}>
          <p className={styles.eyebrow}>Private link</p>
          <h1 className={styles.h1}>Manage your listing</h1>
          <p className={styles.lead}>
            {org?.name ? `${org.name}. ` : ''}Change details, or mark an event postponed or canceled. Anyone with this link can do the same, so keep it to yourself.
          </p>
        </div>
      </section>
      <div className={styles.container} style={{ maxWidth: 900, paddingTop: 32, paddingBottom: 'clamp(56px, 7vw, 96px)' }}>
        {events.length ? (
          <ManageEvents token={token} events={events} types={types.map((t) => ({ slug: t.slug, label: t.label }))} />
        ) : (
          <p className={styles.empty}>There are no events under this link.</p>
        )}
        <p className={styles.small} style={{ marginTop: 32 }}>
          Have another event? <Link href="/submit/">List it here</Link>.
        </p>
      </div>
    </>
  );
}
