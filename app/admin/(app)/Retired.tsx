import { restoreRecord } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';
import type { NameKind } from '@/lib/types';

/*
 * What has been retired, and the way back. Retiring is meant to be the safe
 * alternative to deleting, which it only is if an accidental click can be
 * undone without SQL. Shared by the venue and organization pages, which
 * retire records the same way.
 */
export default function Retired({ kind, rows, back }: { kind: NameKind; rows: Array<{ id: string; name: string; events: number }>; back: string }) {
  const plural = kind === 'venue' ? 'venues' : 'organizations';
  return (
    <>
      <div className={styles.sectionHead}>
        <h1 className={styles.h2Small}>Retired {plural}</h1>
        <p className={styles.small} style={{ margin: 0 }}>
          <a href={back}>Back to {plural}</a>
        </p>
      </div>
      <p className={styles.body} style={{ marginTop: 8 }}>
        These are off the submit form and out of the lists, and the events that already name them are untouched and still public. Restoring puts one back
        where it was.
      </p>
      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing is retired.</p>
      ) : (
        <div className={a.tableWrap}>
          <table className={a.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Events</th>
                <th>Restore</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.events}</td>
                  <td>
                    <form action={restoreRecord}>
                      <input type="hidden" name="kind" value={kind} />
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                        Restore
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
