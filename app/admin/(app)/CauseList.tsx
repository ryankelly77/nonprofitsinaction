import { saveCause } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * The causes list, editable, with a row at the bottom for a new one.
 *
 * It is on two pages: under Lists with the other lookup lists, and as a tab
 * on the organizations page, because deciding an organization's cause is when
 * you find out the cause you want is missing. One component rather than two,
 * so the two can never drift into disagreeing about what the list is.
 *
 * A cause is retired, never deleted, once an organization is filed under it:
 * the organization keeps the cause it was given and the cause simply stops
 * being offered. Unticking "On the form" is how that is done.
 */
export default function CauseList({ causes }: { causes: Array<{ slug: string; label: string; sort: number; active: boolean; organizations: number }> }) {
  return (
    <div className={a.tableWrap}>
      <table className={a.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Order</th>
            <th>Used by</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {/*
            * One form per row, with the fields in their own cells so they line
            * up down the column. A form cannot wrap a <tr>, so the form element
            * is empty and each field names it: that is what the form attribute
            * is for.
            */}
          {causes.map((c) => (
            <tr key={c.slug}>
              <td>
                <form id={`cause-${c.slug}`} action={saveCause} />
                <input type="hidden" name="slug" value={c.slug} form={`cause-${c.slug}`} />
                <input name="label" defaultValue={c.label} aria-label="Name" className={a.cellInput} form={`cause-${c.slug}`} />
              </td>
              <td>
                <input name="sort" type="number" defaultValue={c.sort} aria-label="Order" className={a.cellInput} style={{ width: 80 }} form={`cause-${c.slug}`} />
              </td>
              <td className={styles.small} style={{ whiteSpace: 'nowrap', paddingTop: 20 }}>
                {c.organizations} organization{c.organizations === 1 ? '' : 's'}
              </td>
              <td>
                <div className={a.inline}>
                  <label className={styles.checkbox} style={{ minHeight: 40 }}>
                    <input type="checkbox" name="active" defaultChecked={c.active} form={`cause-${c.slug}`} />
                    On the form
                  </label>
                  <button type="submit" form={`cause-${c.slug}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                    Save
                  </button>
                </div>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <form id="cause-new" action={saveCause} />
              <input name="label" placeholder="New cause" aria-label="New cause" className={a.cellInput} form="cause-new" required />
            </td>
            <td>
              <input name="sort" type="number" placeholder="Order" aria-label="Order" className={a.cellInput} style={{ width: 80 }} form="cause-new" />
            </td>
            <td />
            <td>
              <button type="submit" form="cause-new" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
