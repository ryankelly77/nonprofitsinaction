import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { adminCauses, adminEventTypes, adminRejectionReasons } from '@/lib/admin-data';
import { emailingSubmitters } from '@/lib/settings-store';
import { DEFAULT_EVENT_COLOR } from '@/lib/colors';
import ColorPicker from './ColorPicker';
import CauseList from '../CauseList';
import Tabs from '../Tabs';
import { deleteRejectionReason, saveEmailSubmitters, saveEventType, saveRejectionReason } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Settings' };

/*
 * Three tabs, because three different questions got stacked down one page and
 * the one that matters most at launch was at the top with no way to link to
 * it.
 *
 * Email first: whether the people who submit listings hear from us at all,
 * and what a refusal says when they do. The two belong together, since both
 * are about what leaves here addressed to somebody.
 *
 * Then the two lists the submit form offers. Neither is ever deleted out from
 * under an event using it: unticking "On the form" retires one, and the
 * events already filed under it carry on.
 */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const tab = show === 'types' ? 'types' : show === 'causes' ? 'causes' : 'email';

  return (
    <>
      <h1 className={styles.h2Small}>Settings</h1>

      <Tabs
        current={tab}
        tabs={[
          { key: 'email', label: 'Email', href: '/admin/settings/' },
          { key: 'types', label: 'Event types', href: '/admin/settings/?show=types' },
          { key: 'causes', label: 'Causes', href: '/admin/settings/?show=causes' }
        ]}
      />

      {tab === 'email' && <EmailTab />}
      {tab === 'types' && <EventTypesTab />}
      {tab === 'causes' && <CausesTab />}
    </>
  );
}

/* ---- email ---------------------------------------------------------------- */

async function EmailTab() {
  const [emailing, reasons] = await Promise.all([emailingSubmitters(), adminRejectionReasons()]);

  return (
    <>
      <h2 className={styles.h3} style={{ marginTop: 32 }}>Email the people who submit listings</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        Off while the imported listings are worked through, because approving one of those is not news to the person whose name is on it: they submitted it
        to the old site, often months ago. With it on, submitting gets a confirmation and a private edit link, and approving or turning a listing down tells
        the person who sent it. Admin emails and sign-in codes are sent either way.
      </p>
      <form action={saveEmailSubmitters} className={a.card} style={{ marginTop: 12, maxWidth: 640 }}>
        <label className={styles.checkbox} style={{ minHeight: 44 }}>
          <input type="checkbox" name="email_submitters" defaultChecked={emailing} />
          Email submitters
        </label>
        <p className={styles.small} style={{ margin: '4px 0 12px' }}>
          {emailing
            ? 'On. Anything you do to a listing from here is heard about by the person who submitted it.'
            : 'Off. Nothing has been sent to a submitter, and nothing will be until this is ticked and saved.'}
        </p>
        <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
          Save
        </button>
      </form>

      <h2 className={styles.h3} style={{ marginTop: 40 }}>Standard answers</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        Offered on the &ldquo;Don&apos;t approve&rdquo; form. Picking one fills the message, which you can still edit before it is sent. Write them as you
        would say them, since they go out as they are.{' '}
        {emailing ? 'These are reaching submitters now.' : 'Nothing is sent to a submitter while the setting above is off.'}
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
                        On the reject form
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

/* ---- event types ---------------------------------------------------------- */

async function EventTypesTab() {
  const types = await adminEventTypes();

  return (
    <>
      <h2 className={styles.h3} style={{ marginTop: 32 }}>Kinds of event</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        The coloured label on a card, and the filter buttons on the events page. Lowest number sorts first. Nothing here is ever deleted out from under an
        event using it: untick &ldquo;On the form&rdquo; to retire one, and the events already filed under it carry on.
      </p>
      <div className={a.tableWrap}>
        <table className={a.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Plural, for the filter</th>
              <th>Colour</th>
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
                  <ColorPicker id={t.slug} value={t.color} form={`type-${t.slug}`} />
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
                      On the form
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
                <ColorPicker id="new" value={DEFAULT_EVENT_COLOR} form="type-new" />
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
    </>
  );
}

/* ---- causes --------------------------------------------------------------- */

async function CausesTab() {
  const causes = await adminCauses();

  return (
    <>
      <h2 className={styles.h3} style={{ marginTop: 32 }}>Causes</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        What an organization does. Drives &ldquo;Browse by cause&rdquo; and the cause picker on the form. The same list is a tab on the{' '}
        <Link href="/admin/organizations/?show=causes">organizations page</Link>, since that is where a missing cause is usually noticed.
      </p>
      <CauseList causes={causes} />
    </>
  );
}
