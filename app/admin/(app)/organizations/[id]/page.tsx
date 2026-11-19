import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { adminOrganization, adminOrganizations } from '@/lib/admin-data';
import { getCauses } from '@/lib/data';
import { safeUrl } from '@/lib/format';
import { longDate } from '@/lib/time';
import RowActions from '../../RowActions';
import { saveOrganization } from '../../../actions';
import a from '../../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Organization' };

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

      <p className={styles.small} style={{ marginTop: 4 }}>
        {org.verified ? 'Checked' : 'Not read yet'}
        {org.auto_approve ? ' · publishes as it arrives' : ''}
        {org.retired ? ' · retired' : ''}
        {org.sector ? ` · ${org.sector.replace('_', ' ')}` : ''}
      </p>

      {/* ---- the details ---- */}

      <form action={saveOrganization} className={a.card} style={{ marginTop: 24, display: 'grid', gap: 16, maxWidth: 560 }}>
        <input type="hidden" name="id" value={org.id} />
        {/* Carried through untouched: this form is the name, cause and website,
            and saving them must not quietly un-check the name. */}
        <input type="hidden" name="verified" value={org.verified ? 'on' : ''} />
        <label className={styles.field}>
          <span className={styles.label}>Name</span>
          <input name="name" defaultValue={org.name} required />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Cause</span>
          <select name="cause" defaultValue={org.cause_slug ?? ''}>
            <option value="">No cause</option>
            {causes.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.small} style={{ margin: 0 }}>
          A cause that is not on this list yet is added under <Link href="/admin/organizations/?show=causes">Causes</Link>.
        </p>
        <label className={styles.field}>
          <span className={styles.label}>Website</span>
          <input name="website" defaultValue={org.website ?? ''} placeholder="https://" />
        </label>
        {site && (
          <p className={styles.small} style={{ margin: 0 }}>
            <a href={site} target="_blank" rel="noopener">
              {site}
            </a>
          </p>
        )}
        <div className={a.inline}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
            Save
          </button>
          <RowActions
            kind="organization"
            id={org.id}
            name={org.name}
            verified={org.verified}
            trusted={org.auto_approve}
            retired={org.retired}
            mergeInto={all.filter((t) => t.id !== org.id).map((t) => ({ id: t.id, name: t.name }))}
          />
        </div>
      </form>

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
