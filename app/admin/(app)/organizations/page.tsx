import { requireAdmin } from '@/lib/admin-auth';
import { adminOrganizations } from '@/lib/admin-data';
import { getCauses } from '@/lib/data';
import { mergeOrganizationAction, saveOrganization } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Organizations' };

export default async function OrganizationsPage() {
  await requireAdmin();
  const [orgs, causes] = await Promise.all([adminOrganizations(), getCauses()]);
  return (
    <>
      <h1 className={styles.h2Small}>Organizations</h1>
      <p className={styles.body} style={{ marginTop: 8 }}>
        Fix names, causes and websites. Merging moves every event and submission to the organization you pick; the old address redirects.
      </p>
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
                      {orgs
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
    </>
  );
}
