import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { adminOrganization, adminOrganizations } from '@/lib/admin-data';
import { getCauses } from '@/lib/data';
import { safeUrl } from '@/lib/format';
import { longDate } from '@/lib/time';
import OrgForm from './OrgForm';
import WebsitePreview from './WebsitePreview';
import a from '../../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Organization' };

/*
 * The three answers the old form's "which of these best describes you" could
 * give, spelled out. Almost everything on this calendar is the first one,
 * which is why the bare word was telling nobody anything.
 */
const SECTOR: Record<string, string> = {
  nonprofit: 'Nonprofit',
  for_profit: 'For-profit business',
  public: 'Public or government',
  unknown: 'not given'
};

/*
 * One organization, everything about it in one place.
 *
 * The list it came from is names only, so this is where the details are: the
 * name, cause and website in a form, and then the two things an admin
 * actually came to find out, which the old table could not show at all. What
 * it has on the calendar, coming up and gone by. And who has been listing it,
 * so there is somebody to write to when a listing needs a question asked.
 */
export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [org, causes, all] = await Promise.all([adminOrganization(id), getCauses(), adminOrganizations()]);
  if (!org) notFound();
  const site = safeUrl(org.website);

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/organizations/?show=all">Organizations</Link>
        <span className={styles.crumbSep}>/</span>
        {org.name}
      </p>

      <div className={styles.sectionHead} style={{ marginTop: 16 }}>
        <h1 className={styles.h2Small}>{org.name}</h1>
        <p className={styles.small} style={{ margin: 0 }}>
          {/* The public page, so a name can be checked against what a visitor sees. */}
          <a href={`/organizations/${org.slug}/`} target="_blank" rel="noopener">
            View on the site
          </a>
        </p>
      </div>

      {/*
        * Each fact labelled. These were four words run together by middots,
        * which read as one: "Checked · nonprofit" looks like a definition of
        * Checked rather than two unrelated things, one of which is whether
        * anybody has read the name and the other the answer to "which of
        * these best describes you" on the old form.
        */}
      <p className={styles.small} style={{ marginTop: 4 }}>
        {[
          `Org type: ${SECTOR[org.sector ?? 'unknown'] ?? org.sector}`,
          org.verified ? 'Name checked' : 'Name not read yet',
          org.auto_approve ? 'Publishes as it arrives' : null,
          org.retired ? 'Retired' : null
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {/* ---- the details, and their website beside them ---- */}

      {/*
        * Side by side on a wide screen, and the preview drops under the form
        * on a narrow one, which is the right way round: the form is the work
        * and the website is what you glance at while doing it.
        */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 32 }}>
        <OrgForm org={org} causes={causes} mergeInto={all.filter((t) => t.id !== org.id).map((t) => ({ id: t.id, name: t.name }))} />
        {site && <WebsitePreview url={site} />}
      </div>

      {/* ---- contacts ---- */}

      <h2 className={styles.h3} style={{ marginTop: 40 }}>Contacts</h2>
      {org.contacts.length === 0 ? (
        <p className={styles.empty} style={{ marginTop: 8 }}>
          No address on file. An organization only has one once somebody has listed an event for it, either through the form or on the old site.
        </p>
      ) : (
        <>
          <p className={styles.small} style={{ marginTop: 4 }}>
            The people who have listed events for this organization, from their own submissions. These addresses are private and are not on the public page.
          </p>
          <ul className={a.lines} style={{ marginTop: 8 }}>
            {org.contacts.map((c) => (
              <li key={c.email} style={{ marginTop: 6 }}>
                <a href={`mailto:${c.email}`}>{c.email}</a>
                {c.name && c.name.toLowerCase() !== c.email && <span className={styles.small}> · {c.name}</span>}
                <span className={styles.small}>
                  {' '}
                  · {c.listings} listing{c.listings === 1 ? '' : 's'}
                  {c.last ? `, last ${longDate(c.last)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* ---- what it has on the calendar ---- */}

      <h2 className={styles.h3} style={{ marginTop: 40 }}>Coming up</h2>
      <EventLines rows={org.upcoming} empty="Nothing on the calendar after today." />

      <h2 className={styles.h3} style={{ marginTop: 40 }}>Past</h2>
      <EventLines rows={org.past} empty="Nothing has happened yet." />
    </>
  );
}

function EventLines({
  rows,
  empty
}: {
  rows: Array<{ id: string; slug: string; title: string; starts_at: string; moderation: string; status: string }>;
  empty: string;
}) {
  if (rows.length === 0)
    return (
      <p className={styles.empty} style={{ marginTop: 8 }}>
        {empty}
      </p>
    );
  return (
    <ul className={a.lines} style={{ marginTop: 8 }}>
      {rows.map((e) => (
        <li key={e.id} style={{ marginTop: 6 }}>
          <Link href={`/admin/events/${e.id}/`}>{e.title}</Link>
          <span className={styles.small}>
            {' '}
            · {longDate(e.starts_at)}
            {e.moderation !== 'approved' ? ` · ${e.moderation}` : ''}
            {e.status !== 'scheduled' ? ` · ${e.status}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
