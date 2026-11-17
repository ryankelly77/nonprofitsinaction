import { requireAdmin } from '@/lib/admin-auth';
import { adminCauses, adminEventTypes, adminRejectionReasons } from '@/lib/admin-data';
import { deleteRejectionReason, saveCause, saveEventType, saveRejectionReason } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Lists' };

/*
 * The three lists that decide what the form can say and what a refusal reads
 * like. None of them is deleted once anything is filed under it: an event
 * keeps the type it was given and an organization keeps its cause, they just
 * stop being offered. Unticking Offered is how something is retired.
 */
export default async function SettingsPage() {
  await requireAdmin();
  const [types, causes, reasons] = await Promise.all([adminEventTypes(), adminCauses(), adminRejectionReasons()]);

  return (
    <>
      <h1 className={styles.h2Small}>Lists</h1>
      <p className={styles.body} style={{ marginTop: 8 }}>
        What the submit form offers, and what a listing that is turned down says. Nothing here is ever deleted out from under an event that uses it. Untick
        &ldquo;Offered&rdquo; to retire something: it disappears from the form and the filters, and the events already using it carry on.
      </p>

      <h2 className={styles.h3} style={{ marginTop: 32 }}>Kinds of event</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>The coloured label on a card, and the filter buttons on the events page. Lowest number sorts first.</p>
      <div className={a.tableWrap}>
        <table className={a.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Plural, for the filter</th>
              <th>Order</th>
              <th>Used by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {/*
              * One form per row, but the fields sit in their own cells so they
              * line up under the headings and down the column. A form cannot
              * wrap a <tr>, so the form element is empty and each field names
              * it: that is what the form attribute is for.
              */}
            {types.map((t) => (
              <tr key={t.slug}>
                <td>
                  <form id={`type-${t.slug}`} action={saveEventType} />
                  <input type="hidden" name="slug" value={t.slug} form={`type-${t.slug}`} />
                  <input name="label" defaultValue={t.label} aria-label="Name" className={a.cellInput} form={`type-${t.slug}`} />
                </td>
                <td>
                  <input name="plural" defaultValue={t.plural} aria-label="Plural" className={a.cellInput} form={`type-${t.slug}`} />
                </td>
                <td>
                  <input name="sort" type="number" defaultValue={t.sort} aria-label="Order" className={a.cellInput} style={{ width: 80 }} form={`type-${t.slug}`} />
                </td>
                <td className={styles.small} style={{ whiteSpace: 'nowrap', paddingTop: 20 }}>
                  {t.events} event{t.events === 1 ? '' : 's'}
                </td>
                <td>
                  <div className={a.inline}>
                    <label className={styles.checkbox} style={{ minHeight: 40 }}>
                      <input type="checkbox" name="active" defaultChecked={t.active} form={`type-${t.slug}`} />
                      Offered
                    </label>
                    <button type="submit" form={`type-${t.slug}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Save
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <form id="type-new" action={saveEventType} />
                <input name="label" placeholder="New kind of event" aria-label="New kind of event" className={a.cellInput} form="type-new" required />
              </td>
              <td>
                <input name="plural" placeholder="Plural" aria-label="Plural" className={a.cellInput} form="type-new" />
              </td>
              <td>
                <input name="sort" type="number" placeholder="Order" aria-label="Order" className={a.cellInput} style={{ width: 80 }} form="type-new" />
              </td>
              <td />
              <td>
                <button type="submit" form="type-new" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className={styles.h3} style={{ marginTop: 32 }}>Causes</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>What an organization does. Drives &ldquo;Browse by cause&rdquo; and the cause picker on the form.</p>
      <div className={a.tableWrap}>
        <table className={a.table}>
          <tbody>
            {causes.map((c) => (
              <tr key={c.slug}>
                <td>
                  <form action={saveCause} className={a.inline}>
                    <input type="hidden" name="slug" value={c.slug} />
                    <input name="label" defaultValue={c.label} aria-label="Name" style={{ minWidth: 240 }} />
                    <input name="sort" type="number" defaultValue={c.sort} aria-label="Order" style={{ width: 80 }} />
                    <span className={styles.small}>
                      {c.organizations} organization{c.organizations === 1 ? '' : 's'}
                    </span>
                    <label className={styles.checkbox} style={{ minHeight: 40 }}>
                      <input type="checkbox" name="active" defaultChecked={c.active} />
                      Offered
                    </label>
                    <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Save
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <form action={saveCause} className={a.inline}>
                  <input name="label" placeholder="New cause" aria-label="New cause" style={{ minWidth: 240 }} required />
                  <input name="sort" type="number" placeholder="Order" aria-label="Order" style={{ width: 80 }} />
                  <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                    Add
                  </button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className={styles.h3} style={{ marginTop: 32 }}>Standard answers</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        Offered on the &ldquo;Don&apos;t approve&rdquo; form. Picking one fills the message, which you can still edit before it is sent. Write them as you
        would say them, since they go out as they are.
      </p>
      <div className={a.tableWrap}>
        <table className={a.table}>
          <tbody>
            {reasons.map((r) => (
              <tr key={r.id}>
                <td>
                  <form action={saveRejectionReason}>
                    <input type="hidden" name="id" value={r.id} />
                    <div className={a.inline}>
                      <input name="label" defaultValue={r.label} aria-label="Short name" style={{ minWidth: 220 }} />
                      <input name="sort" type="number" defaultValue={r.sort} aria-label="Order" style={{ width: 80 }} />
                      <label className={styles.checkbox} style={{ minHeight: 40 }}>
                        <input type="checkbox" name="active" defaultChecked={r.active} />
                        Offered
                      </label>
                      <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                        Save
                      </button>
                    </div>
                    <textarea name="body" defaultValue={r.body} aria-label="What it says" className={styles.textarea} rows={4} style={{ marginTop: 8 }} />
                  </form>
                  <form action={deleteRejectionReason} style={{ marginTop: 8 }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <form action={saveRejectionReason}>
                  <div className={a.inline}>
                    <input name="label" placeholder="Short name, for the list" aria-label="Short name" style={{ minWidth: 220 }} required />
                    <input name="sort" type="number" placeholder="Order" aria-label="Order" style={{ width: 80 }} />
                    <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                      Add
                    </button>
                  </div>
                  <textarea name="body" placeholder="What the organizer reads" aria-label="What it says" className={styles.textarea} rows={4} style={{ marginTop: 8 }} required />
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
