import { requireAdmin } from '@/lib/admin-auth';
import { adminVenues, venueDuplicates, venuesWithoutAddress } from '@/lib/admin-data';
import DuplicateList from '../DuplicateList';
import { mergeVenueAction, verifyVenue } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Venues' };

/*
 * Clean up the venue list: fix names and addresses, mark checked venues as
 * verified (only verified ones are suggested on the form), and fold
 * duplicates ("Wittie Museum") into the real record.
 */
export default async function VenuesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const [all, duplicates, noAddress] = await Promise.all([adminVenues(), venueDuplicates(), venuesWithoutAddress()]);
  const venues = show === 'all' ? all : all.filter((v) => !v.verified);
  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Venues</h1>
        <p className={styles.small} style={{ margin: 0 }}>
          {show === 'all' ? <a href="/admin/venues/">Show only unverified</a> : <a href="/admin/venues/?show=all">Show all {all.length}</a>}
        </p>
      </div>
      <p className={styles.body} style={{ marginTop: 8 }}>
        Only verified venues are suggested on the submit form. Merging moves every event to the venue you pick and keeps the old name as a pointer.
      </p>

      <h2 className={styles.h3} style={{ marginTop: 32 }}>Possible duplicates</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        Names close enough that they may be one place. Nothing is merged until you say so, and &ldquo;Not the same&rdquo; keeps a pair off this list for good.
      </p>
      <DuplicateList kind="venue" pairs={duplicates} />

      <h2 className={styles.h3} style={{ marginTop: 32 }}>No street address</h2>
      <p className={styles.small} style={{ marginTop: 4 }}>
        Guests cannot find these. Add the address below, or merge the venue into the one it duplicates.
      </p>
      {noAddress.length === 0 ? (
        <p className={styles.empty}>Every venue has an address.</p>
      ) : (
        <p className={styles.body} style={{ marginTop: 8 }}>
          {noAddress.map((v, i) => (
            <span key={v.id}>
              {i > 0 ? ' · ' : ''}
              {v.name} <span className={styles.small}>({v.events})</span>
            </span>
          ))}
        </p>
      )}

      <h2 className={styles.h3} style={{ marginTop: 32 }}>All venues</h2>
      {venues.length === 0 ? (
        <p className={styles.empty}>Every venue has been checked.</p>
      ) : (
        <div className={a.tableWrap}>
          <table className={a.table}>
            <thead>
              <tr>
                <th>Venue</th>
                <th>Events</th>
                <th>Merge into</th>
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id}>
                  <td>
                    <form action={verifyVenue} className={a.inline}>
                      <input type="hidden" name="id" value={v.id} />
                      <input name="name" defaultValue={v.name} aria-label="Name" style={{ minWidth: 220 }} />
                      <input name="address" defaultValue={v.address_line1 ?? ''} placeholder="Street address" aria-label="Street address" />
                      <input name="city" defaultValue={v.city ?? ''} placeholder="City" aria-label="City" style={{ width: 130 }} />
                      <input name="postal" defaultValue={v.postal_code ?? ''} placeholder="ZIP" aria-label="ZIP" style={{ width: 80 }} />
                      <label className={styles.checkbox} style={{ minHeight: 40 }}>
                        <input type="checkbox" name="verified" defaultChecked={v.verified} />
                        Verified
                      </label>
                      <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                        Save
                      </button>
                    </form>
                  </td>
                  <td>{v.events}</td>
                  <td>
                    <form action={mergeVenueAction} className={a.inline}>
                      <input type="hidden" name="id" value={v.id} />
                      <select name="into" aria-label={`Merge ${v.name} into`} defaultValue="">
                        <option value="">Choose…</option>
                        {all
                          .filter((o) => o.id !== v.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
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
      )}
    </>
  );
}
