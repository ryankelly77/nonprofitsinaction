import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { adminCauses, adminOrganizations, eventsByRecord, organizationDuplicates, type EventPeek as Peek } from '@/lib/admin-data';
import { getCauses } from '@/lib/data';
import CauseList from '../CauseList';
import DuplicateList from '../DuplicateList';
import EventPeek from '../EventPeek';
import RecordAnswer from '../RecordAnswer';
import Retired from '../Retired';
import Tabs from '../Tabs';
import { addRecord, saveOrganizationDetails } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Organizations' };

/*
 * Three jobs, so three tabs.
 *
 * Review is work with an end to it, and it is what the count in the bar is
 * counting: settling lookalikes and reading names nobody has read yet. The
 * whole list is a reference you go to on purpose. Causes is here as well as
 * under Settings because the moment you find out a cause is missing is the
 * moment you are trying to give one to an organization.
 *
 * The whole list is names and nothing else, in columns, because that is how
 * it is read: you arrive knowing which organization you want. Everything
 * about one of them is on its own page, where there is room to show what it
 * has on the calendar and who has been listing it.
 */
export default async function OrganizationsPage({ searchParams }: { searchParams: Promise<{ show?: string; cause?: string }> }) {
  await requireAdmin();
  const { show, cause } = await searchParams;
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
  /*
   * The whole list means the retired ones too, marked. They were only behind
   * the "Retired" link before, so the one page that claims to be every
   * organization was the one place you could not see that an organization had
   * been taken off the form. That link stays: putting one back is its own job
   * and has its own view.
   */
  const everything = [...all, ...retired].sort((x, y) => x.name.localeCompare(y.name, 'en', { sensitivity: 'base' }));
  /*
   * Narrowed to one cause, which is what the counts under Causes link to:
   * "16 organizations" is only worth printing if you can then go and read the
   * sixteen. "none" is a cause of its own, since an organization with no
   * cause is missing from "Browse by cause" and is the thing you most often
   * went looking for.
   */
  const filtered = cause ? everything.filter((o) => (cause === 'none' ? !o.cause_slug : o.cause_slug === cause)) : everything;
  const causeLabel = cause === 'none' ? 'no cause' : causes.find((c) => c.slug === cause)?.label ?? cause;
  /*
   * What is filed under the records on the review tab, in one query: both the
   * lookalike pairs and the names nobody has read are decided mostly by
   * reading the events underneath them.
   */
  const peek =
    tab === 'review'
      ? await eventsByRecord('organization', [...unchecked.map((o) => o.id), ...duplicates.flatMap((p) => [p.a.id, p.b.id])])
      : new Map<string, Peek[]>();

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
          { key: 'all', label: 'All organizations', href: '/admin/organizations/?show=all', count: everything.length, quiet: true },
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
          <DuplicateList kind="organization" pairs={duplicates} events={peek} />

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
              <OrgTable rows={unchecked} causes={causes} targets={targets} events={peek} />
            </>
          )}
        </>
      )}

      {tab === 'all' && (
        <>
          {cause ? (
            <p className={styles.body} style={{ marginTop: 24 }}>
              {filtered.length} organization{filtered.length === 1 ? '' : 's'} with {causeLabel}.{' '}
              <Link href="/admin/organizations/?show=all">Show all of them</Link>.
            </p>
          ) : (
            <p className={styles.body} style={{ marginTop: 24 }}>
              Every organization on the calendar, by name, retired ones included. Open one to see or change its cause, website and contacts, and what it
              has coming up.
            </p>
          )}
          {filtered.length === 0 ? (
            <p className={styles.empty} style={{ marginTop: 20 }}>Nothing filed under that.</p>
          ) : (
            <NameColumns rows={filtered} />
          )}

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

/*
 * The list as a list: names, alphabetical, flowing down one column and on to
 * the next.
 *
 * Under each name goes only what you cannot work out from the name itself and
 * would want before deciding whether to open it: how many events it has, and
 * the two states that change what the calendar does with it. Retired is a tag
 * rather than another phrase in that line, because it means the organization
 * is not on the form at all, which outranks everything else on the line.
 */
function NameColumns({
  rows
}: {
  rows: Array<{ id: string; name: string; events: number; verified: boolean; auto_approve: boolean; retired: boolean }>;
}) {
  return (
    <ul className={a.nameColumns}>
      {rows.map((o) => {
        /* Nothing to say about a plain checked organization with no events,
           and an empty line under the name still takes up room. */
        const meta = [
          o.events > 0 ? `${o.events} event${o.events === 1 ? '' : 's'}` : null,
          o.auto_approve ? 'publishes as it arrives' : null,
          o.verified ? null : 'not read yet'
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <li key={o.id}>
            <Link href={`/admin/organizations/${o.id}/`} className={a.nameColumnLink}>
              {o.name}
            </Link>
            {o.retired && <span className={a.retiredTag}>Retired</span>}
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
        <Link href="/admin/settings/?show=causes">Settings</Link>, with the other lists the form offers.
      </p>
      <CauseList causes={causes} />
    </>
  );
}

function OrgTable({
  rows,
  causes,
  targets,
  events
}: {
  rows: Array<{
    id: string;
    name: string;
    cause_slug: string | null;
    website: string | null;
    verified: boolean;
    auto_approve: boolean;
    retired: boolean;
    events: number;
  }>;
  causes: Array<{ slug: string; label: string }>;
  targets: Array<{ id: string; name: string }>;
  events: Map<string, Peek[]>;
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
            <th>Action</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>
                {/*
                  * One form per row. It has to be an empty element with the
                  * fields naming it, because a form cannot wrap a <tr>; that
                  * is what the form attribute is for. Everything in the row
                  * belongs to this one form, so the row has one button.
                  */}
                <form id={`org-${o.id}`} action={saveOrganizationDetails} />
                <input type="hidden" name="id" value={o.id} form={`org-${o.id}`} />
                <input type="hidden" name="kind" value="organization" form={`org-${o.id}`} />
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
              <td style={{ whiteSpace: 'nowrap' }}>
                <EventPeek events={events.get(o.id) ?? []} count={o.events} />
              </td>
              <td>
                <RecordAnswer
                  kind="organization"
                  id={o.id}
                  form={`org-${o.id}`}
                  verified={o.verified}
                  autoApprove={o.auto_approve}
                  retired={o.retired}
                  mergeInto={targets.filter((t) => t.id !== o.id)}
                  className={a.cellInput}
                />
              </td>
              <td>
                <button type="submit" form={`org-${o.id}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
