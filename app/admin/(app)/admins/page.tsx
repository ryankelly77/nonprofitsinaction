import { requireSuperAdmin } from '@/lib/admin-auth';
import { adminPeople } from '@/lib/admin-data';
import { dateAndTime, shortDate } from '@/lib/time';
import InviteForm from './InviteForm';
import { removeAdmin, saveAdmin } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Admins' };

/*
 * Who reviews listings. A super admin adds and removes the others; everyone
 * else never sees this page, and is sent back to the queue if they try the
 * address.
 */
export default async function AdminsPage() {
  const me = await requireSuperAdmin();
  const people = await adminPeople();
  const supers = people.filter((p) => p.super_admin).length;

  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Admins</h1>
      </div>
      <p className={styles.body} style={{ marginTop: 8 }}>
        Everyone here can review listings. There is no password: they enter their address on the sign-in page and we email them a code, a new one
        each time. Removing somebody takes effect the moment they load their next page, even if they are signed in.
      </p>

      <h2 className={styles.h3} style={{ marginTop: 32 }}>Invite somebody</h2>
      <InviteForm />

      <h2 className={styles.h3} style={{ marginTop: 36 }}>The admin list</h2>
      <div className={a.tableWrap}>
        <table className={a.table}>
          <thead>
            <tr>
              <th>Person</th>
              <th>Added</th>
              <th>New listing emails</th>
              <th>Super admin</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const isMe = p.email === me.email;
              const lastSuper = p.super_admin && supers <= 1;
              return (
                <tr key={p.email}>
                  <td>
                    {/*
                      * One form for the whole row, so there is one Save. The
                      * form element is empty and each field names it, because
                      * a form cannot wrap a <tr>.
                      */}
                    <form id={`admin-${p.email}`} action={saveAdmin} />
                    <input type="hidden" name="email" value={p.email} form={`admin-${p.email}`} />
                    {/*
                      * The name, editable. It was read-only, and the only way
                      * to correct one was to remove the person and invite them
                      * again, which is what somebody did.
                      */}
                    <input
                      name="name"
                      defaultValue={p.name ?? ''}
                      placeholder="Their name"
                      aria-label={`Name for ${p.email}`}
                      className={a.cellInput}
                      form={`admin-${p.email}`}
                    />
                    <div className={styles.small} style={{ marginTop: 4 }}>{p.email}</div>
                    {/*
                      * The whole timestamp, in San Antonio time. It was the
                      * month and day alone, which cannot answer either
                      * question anybody asks it: whether somebody has used
                      * their invitation, and whether they were here today.
                      */}
                    <div className={styles.small}>
                      {p.last_seen_at ? `Last signed in ${dateAndTime(p.last_seen_at)}` : 'Has not signed in yet'}
                      {p.invited_by ? ` · invited by ${p.invited_by}` : ''}
                    </div>
                  </td>
                  <td>{shortDate(p.created_at)}</td>
                  <td>
                    <label className={styles.checkbox} style={{ minHeight: 40 }}>
                      <input type="checkbox" name="notify" defaultChecked={p.notify} form={`admin-${p.email}`} />
                      Email me
                    </label>
                  </td>
                  <td>
                    <label className={styles.checkbox} style={{ minHeight: 40 }}>
                      <input type="checkbox" name="super" defaultChecked={p.super_admin} disabled={lastSuper} form={`admin-${p.email}`} />
                      Can manage admins
                    </label>
                    {lastSuper && (
                      <p className={styles.small} style={{ margin: '4px 0 0' }}>
                        The only one. Make somebody else a super admin first.
                      </p>
                    )}
                  </td>
                  <td>
                    <button type="submit" form={`admin-${p.email}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Save
                    </button>
                    {/*
                      * Removing is not a way to edit anything, which is what
                      * it was being used for. Kept apart from Save, and said
                      * plainly, because it takes effect at once and the person
                      * cannot sign in afterwards.
                      */}
                    {isMe ? (
                      <p className={styles.small} style={{ margin: '8px 0 0' }}>This is you</p>
                    ) : (
                      <form action={removeAdmin} style={{ marginTop: 8 }}>
                        <input type="hidden" name="email" value={p.email} />
                        <button type="submit" className={a.quietAction} disabled={lastSuper}>
                          Remove {p.name ?? p.email} from the admin
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
