import { requireAdmin } from '@/lib/admin-auth';
import { adminOrganizations, organizationDuplicates } from '@/lib/admin-data';
import { getCauses } from '@/lib/data';
import DuplicateList from '../DuplicateList';
import Retired from '../Retired';
import RowActions from '../RowActions';
import Tabs from '../Tabs';
import { addRecord, saveOrganization } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Organizations' };

/*
 * Two jobs, so two tabs. Settling lookalikes and reading names nobody has
 * read yet is work with an end to it, and it is what the count in the bar is
 * counting; the whole list is a reference you go to on purpose. Mixing them
 * meant the work was always buried under a hundred rows of things already
 * done.
 */
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const [all, retired, causes, duplicates] = await Promise.all([
    adminOrganizations(),
    adminOrganizations({ retired: true }),
    getCauses(),
    organizationDuplicates()
  ]);
  if (show === 'retired') return <Retired kind="organization" rows={retired} back="/admin/organizations/" />;

  const unchecked = all.filter((o) => !o.verified);
  const needsReview = unchecked.length + duplicates.length;
  const tab = show === 'all' ? 'all' : 'review';
  const rows = tab === 'all' ? all : unchecked;
  const targets = all.map((o) => ({ id: o.id, name: o.name }));

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Organizations</h1>
        {retired.length > 0 && (
          <p className={styles.small} style={{ margin: 0 }}>
            <a href="/admin/organizations/?show=retired">Retired ({retired.length})</a>
          </p>
        )}
      </div>

      <Tabs
        current={tab}
        tabs={[
          { key: 'review', label: 'Review', href: '/admin/organizations/', count: needsReview },
          { key: 'all', label: 'All organizations', href: '/admin/organizations/?show=all', count: all.length, quiet: true }
        ]}
      />

      {tab === 'review' ? (
        <>
          <h2 className={styles.h3} style={{ marginTop: 32 }}>Possible duplicates</h2>
          <p className={styles.small} style={{ marginTop: 4 }}>
            Names close enough that they may be one organization. Nothing is merged until you say so, and &ldquo;not the same&rdquo; keeps a pair off this
            list for good.
          </p>
          <DuplicateList kind="organization" pairs={duplicates} />

          <h2 className={styles.h3} style={{ marginTop: 40 }}>Not checked yet</h2>
          {unchecked.length === 0 ? (
            <p className={styles.empty} style={{ marginTop: 8 }}>
              Every organization has been checked. An organization is checked once somebody has read its name and agreed it reads the way they write it,
              which is what lets the submit form suggest it to the next person.
            </p>
          ) : (
            <>
              <p className={styles.small} style={{ marginTop: 4 }}>
                An organization nobody has read is never suggested on the submit form, so a misspelling cannot spread. Fix the name, cause and website, then
                mark it checked.
              </p>
              <OrgTable rows={unchecked} causes={causes} targets={targets} />
            </>
          )}
        </>
      ) : (
        <>
          <p className={styles.body} style={{ marginTop: 24 }}>
            Every organization on the calendar. Merging moves its events and submissions to the one you pick, and the old address redirects.
          </p>
          <OrgTable rows={rows} causes={causes} targets={targets} />

          <h2 className={styles.h3} style={{ marginTop: 40 }}>Add one</h2>
          <form action={addRecord} className={a.inline} style={{ marginTop: 8 }}>
            <input type="hidden" name="kind" value="organization" />
            <input name="name" placeholder="Organization name" aria-label="Organization name" className={a.cellInput} style={{ minWidth: 260 }} required />
            <select name="cause" aria-label="Cause" defaultValue="" className={a.cellInput} style={{ minWidth: 180 }}>
              <option value="">No cause</option>
              {causes.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
            <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
              Add
            </button>
          </form>
          <p className={styles.small} style={{ marginTop: 6 }}>
            Added here counts as checked, since you are the one adding it. Retiring takes an organization off the form and the lists while leaving its events
            alone; one that nothing at all points at is removed outright.
          </p>
        </>
      )}
    </>
  );
}

function OrgTable({
  rows,
  causes,
  targets
}: {
  rows: Array<{ id: string; name: string; cause_slug: string | null; website: string | null; verified: boolean; auto_approve: boolean; events: number }>;
  causes: Array<{ slug: string; label: string }>;
  targets: Array<{ id: string; name: string }>;
}) {
  return (
    <div className={a.tableWrap}>
      <table className={a.table}>
        <thead>
          <tr>
            <th>Organization</th>
            <th>Cause</th>
            <th>Website</th>
            <th>Events</th>
            <th>What to do</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                <form id={`org-${o.id}`} action={saveOrganization} />
                <input type="hidden" name="id" value={o.id} form={`org-${o.id}`} />
                <input name="name" defaultValue={o.name} aria-label="Name" className={a.cellInput} form={`org-${o.id}`} />
                <div className={styles.small} style={{ marginTop: 4 }}>
                  {o.verified ? 'Checked' : 'Not read yet'}
                  {o.auto_approve ? ' · publishes as it arrives' : ''}
                </div>
              </td>
              <td>
                <select name="cause" defaultValue={o.cause_slug ?? ''} aria-label="Cause" className={a.cellInput} form={`org-${o.id}`}>
                  <option value="">No cause</option>
                  {causes.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input name="website" defaultValue={o.website ?? ''} placeholder="https://" aria-label="Website" className={a.cellInput} form={`org-${o.id}`} />
              </td>
              <td className={styles.small} style={{ whiteSpace: 'nowrap', paddingTop: 20 }}>
                {o.events}
              </td>
              <td>
                <div className={a.inline}>
                  {/*
                    * Saving what has been typed and deciding what happens to
                    * the record are different acts, so they stay two controls.
                    * Everything that was a button of its own is in the menu.
                    */}
                  <input type="hidden" name="verified" value={o.verified ? 'on' : ''} form={`org-${o.id}`} />
                  <button type="submit" form={`org-${o.id}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                    Save
                  </button>
                  <RowActions
                    kind="organization"
                    id={o.id}
                    name={o.name}
                    verified={o.verified}
                    trusted={o.auto_approve}
                    mergeInto={targets.filter((t) => t.id !== o.id)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
