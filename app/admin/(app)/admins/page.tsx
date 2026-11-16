import { requireSuperAdmin } from '@/lib/admin-auth';
import { adminPeople } from '@/lib/admin-data';
import { shortDate } from '@/lib/time';
import InviteForm from './InviteForm';
import { removeAdmin, setAdminNotify, setAdminSuper } from '../../actions';
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
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const isMe = p.email === me.email;
              const lastSuper = p.super_admin && supers <= 1;
              return (
                <tr key={p.email}>
                  <td>
                    <strong>{p.name ?? p.email}</strong>
                    {p.name && <div className={styles.small}>{p.email}</div>}
                    <div className={styles.small}>
                      {p.last_seen_at ? `Last signed in ${shortDate(p.last_seen_at)}` : 'Has not signed in yet'}
                      {p.invited_by ? ` · invited by ${p.invited_by}` : ''}
                    </div>
                  </td>
                  <td>{shortDate(p.created_at)}</td>
                  <td>
                    <form action={setAdminNotify} className={a.inline}>
                      <input type="hidden" name="email" value={p.email} />
                      <label className={styles.checkbox} style={{ minHeight: 40 }}>
                        <input type="checkbox" name="notify" defaultChecked={p.notify} />
                        Email me
                      </label>
                      <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                        Set
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={setAdminSuper} className={a.inline}>
                      <input type="hidden" name="email" value={p.email} />
                      <label className={styles.checkbox} style={{ minHeight: 40 }}>
                        <input type="checkbox" name="super" defaultChecked={p.super_admin} disabled={lastSuper} />
                        Can manage admins
                      </label>
                      {!lastSuper && (
                        <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                          Set
                        </button>
                      )}
                    </form>
                    {lastSuper && (
                      <p className={styles.small} style={{ margin: '4px 0 0' }}>
                        The only one. Make somebody else a super admin first.
                      </p>
                    )}
                  </td>
                  <td>
                    {isMe ? (
                      <span className={styles.small}>This is you</span>
                    ) : (
                      <form action={removeAdmin}>
                        <input type="hidden" name="email" value={p.email} />
                        <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`} disabled={lastSuper}>
                          Remove
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
