import { requireAdmin } from '@/lib/admin-auth';
import { adminOrganizations, organizationDuplicates } from '@/lib/admin-data';
import { getCauses } from '@/lib/data';
import DuplicateList from '../DuplicateList';
import { mergeOrganizationAction, saveOrganization } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Organizations' };

export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const [all, causes, duplicates] = await Promise.all([adminOrganizations(), getCauses(), organizationDuplicates()]);
  // Same as venues: the ones nobody has read yet are the job, so they are
  // what the page opens on.
  const orgs = show === 'all' ? all : all.filter((o) => !o.verified);
  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Organizations</h1>
        <p className={styles.small} style={{ margin: 0 }}>
          {show === 'all' ? (
            <a href="/admin/organizations/">Show only unverified</a>
          ) : (
            <a href="/admin/organizations/?show=all">Show all {all.length}</a>
          )}
        </p>
      </div>
      <p className={styles.body} style={{ marginTop: 8 }}>
        Only verified organizations are suggested on the submit form, so a name nobody has read is never handed to the next person. Fix the name, cause and
        website, then tick Verified. Merging moves every event and submission to the organization you pick; the old address redirects.
      </p>

      <h2 className={styles.h3} style={{ marginTop: 32 }}>Possible duplicates</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        Names close enough that they may be one organization. Nothing is merged until you say so, and &ldquo;Not the same&rdquo; keeps a pair off this list for good.
      </p>
      <DuplicateList kind="organization" pairs={duplicates} />

      <h2 className={styles.h3} style={{ marginTop: 32 }}>{show === 'all' ? 'All organizations' : 'Needs a check'}</h2>
      {orgs.length === 0 ? (
        <p className={styles.empty}>Every organization has been checked.</p>
      ) : (
      <div className={a.tableWrap}>
        <table className={a.table}>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Events</th>
              <th>Merge into</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td>
                  <form action={saveOrganization} className={a.inline}>
                    <input type="hidden" name="id" value={o.id} />
                    <input name="name" defaultValue={o.name} aria-label="Name" style={{ minWidth: 240 }} />
                    <select name="cause" defaultValue={o.cause_slug ?? ''} aria-label="Cause">
                      <option value="">No cause</option>
                      {causes.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <input name="website" defaultValue={o.website ?? ''} placeholder="https://" aria-label="Website" />
                    <label className={styles.checkbox} style={{ minHeight: 40 }}>
                      <input type="checkbox" name="verified" defaultChecked={o.verified} />
                      Verified
                    </label>
                    <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Save
                    </button>
                  </form>
                </td>
                <td>{o.events}</td>
                <td>
                  <form action={mergeOrganizationAction} className={a.inline}>
                    <input type="hidden" name="id" value={o.id} />
                    <select name="into" aria-label={`Merge ${o.name} into`} defaultValue="">
                      <option value="">Choose…</option>
                      {all
                        .filter((x) => x.id !== o.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                    <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Merge
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </>
  );
}
