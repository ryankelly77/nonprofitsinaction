import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { adminCauses, adminOrganizations, organizationDuplicates } from '@/lib/admin-data';
import { getCauses } from '@/lib/data';
import CauseList from '../CauseList';
import DuplicateList from '../DuplicateList';
import Retired from '../Retired';
import RowActions from '../RowActions';
import Tabs from '../Tabs';
import { addRecord, saveOrganization } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Organizations' };

/*
 * Three jobs, so three tabs.
 *
 * Review is work with an end to it, and it is what the count in the bar is
 * counting: settling lookalikes and reading names nobody has read yet. The
 * whole list is a reference you go to on purpose. Causes is here as well as
 * under Lists because the moment you find out a cause is missing is the
 * moment you are trying to give one to an organization.
 *
 * The whole list is names and nothing else, in columns, because that is how
 * it is read: you arrive knowing which organization you want. Everything
 * about one of them is on its own page, where there is room to show what it
 * has on the calendar and who has been listing it.
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
  const tab = show === 'all' ? 'all' : show === 'causes' ? 'causes' : 'review';
  const targets = all.map((o) => ({ id: o.id, name: o.name }));

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Organizations</h1>
        {retired.length > 0 && (
          <p className={styles.small} style={{ margin: 0 }}>
            <Link href="/admin/organizations/?show=retired">Retired ({retired.length})</Link>
          </p>
        )}
      </div>

      <Tabs
        current={tab}
        tabs={[
          { key: 'review', label: 'Review', href: '/admin/organizations/', count: needsReview },
          { key: 'all', label: 'All organizations', href: '/admin/organizations/?show=all', count: all.length, quiet: true },
          { key: 'causes', label: 'Causes', href: '/admin/organizations/?show=causes' }
        ]}
      />

      {tab === 'review' && (
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
                mark it checked. Everything else about one of them is on its own page.
              </p>
              <OrgTable rows={unchecked} causes={causes} targets={targets} />
            </>
          )}
        </>
      )}

      {tab === 'all' && (
        <>
          <p className={styles.body} style={{ marginTop: 24 }}>
            Every organization on the calendar, by name. Open one to see or change its cause, website and contacts, and what it has coming up.
          </p>
          <NameColumns rows={all} />

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

      {tab === 'causes' && <Causes />}
    </>
  );
}

/* The list as a list: names, alphabetical, flowing down one column and on to
 * the next. The count beside a name is how many events it has, which is the
 * one thing worth knowing before you decide whether to open it. */
function NameColumns({ rows }: { rows: Array<{ id: string; name: string; events: number; verified: boolean }> }) {
  return (
    <ul className={a.nameColumns}>
      {rows.map((o) => {
        /* Nothing to say about a checked organization with no events, and an
           empty line under the name still takes up room. */
        const meta = [o.events > 0 ? `${o.events} event${o.events === 1 ? '' : 's'}` : null, o.verified ? null : 'not read yet'].filter(Boolean).join(' · ');
        return (
          <li key={o.id}>
            <Link href={`/admin/organizations/${o.id}/`} className={a.nameColumnLink}>
              {o.name}
            </Link>
            {meta && <span className={a.nameColumnMeta}>{meta}</span>}
          </li>
        );
      })}
    </ul>
  );
}

async function Causes() {
  const causes = await adminCauses();
  return (
    <>
      <p className={styles.body} style={{ marginTop: 24 }}>
        What an organization does. Drives &ldquo;Browse by cause&rdquo; on the public site and the cause picker on the submit form. The same list is under{' '}
        <Link href="/admin/settings/">Lists</Link> with the other lookup lists.
      </p>
      <CauseList causes={causes} />
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
                  <Link href={`/admin/organizations/${o.id}/`}>Open</Link>
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
