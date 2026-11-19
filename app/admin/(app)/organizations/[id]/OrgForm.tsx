import Link from 'next/link';
import RecordAnswer from '../../RecordAnswer';
import { saveOrganizationDetails } from '../../../actions';
import a from '../../../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * One organization's details, and the one other change to make, under one
 * Save.
 *
 * The details and the menu of things to do were two forms with a button each,
 * which is both a question the page cannot answer ("which button keeps my
 * typing?") and, on a page rather than in a table row, broken: a form inside
 * a form is dropped by the parser, so the inner button submitted the outer
 * form and the choice went nowhere.
 *
 * The menu goes last, after the fields you are more likely to have come for,
 * and defaults to doing nothing else.
 */
export default function OrgForm({
  org,
  causes,
  mergeInto
}: {
  org: { id: string; name: string; cause_slug: string | null; website: string | null; verified: boolean; auto_approve: boolean; retired: boolean };
  causes: Array<{ slug: string; label: string }>;
  mergeInto: Array<{ id: string; name: string }>;
}) {
  return (
    <form action={saveOrganizationDetails} className={a.card} style={{ marginTop: 24, display: 'grid', gap: 20, maxWidth: 640 }}>
      <input type="hidden" name="id" value={org.id} />
      <input type="hidden" name="kind" value="organization" />

      <div className={styles.field}>
        <label htmlFor="org-name" className={styles.label}>
          Name
        </label>
        <input id="org-name" name="name" className={styles.input} defaultValue={org.name} required />
      </div>

      <div className={styles.field}>
        <label htmlFor="org-cause" className={styles.label}>
          Cause
        </label>
        <select id="org-cause" name="cause" className={styles.select} defaultValue={org.cause_slug ?? ''}>
          <option value="">No cause</option>
          {causes.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <p className={styles.small} style={{ margin: 0 }}>
          A cause that is not on this list yet is added under <Link href="/admin/organizations/?show=causes">Causes</Link>.
        </p>
      </div>

      <div className={styles.field}>
        <label htmlFor="org-website" className={styles.label}>
          Website
        </label>
        <input id="org-website" name="website" className={styles.input} defaultValue={org.website ?? ''} placeholder="https://" />
      </div>

      <div className={styles.field}>
        <RecordAnswer
          kind="organization"
          id={org.id}
          verified={org.verified}
          autoApprove={org.auto_approve}
          retired={org.retired}
          mergeInto={mergeInto}
          className={styles.select}
          label="visible"
        />
      </div>

      <div>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
          Save
        </button>
      </div>
    </form>
  );
}
