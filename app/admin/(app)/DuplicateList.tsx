import type { DuplicatePair } from '@/lib/duplicates';
import type { NameKind } from '@/lib/types';
import { keepApartAction, mergePairAction } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * Pairs of records that might be one place, for a person to settle. Either
 * side can be the one kept, because which name is the right one is a
 * judgement the list cannot make: "Shrine Auditorium" and "San Antonio Shrine
 * Auditorium" are the same room, and only an admin knows which name the
 * calendar should show.
 *
 * "Not the same" is the other half of the job. Without it a real pair of
 * neighbours, like the Witte Museum and its Mays Family Center, would sit on
 * this list for ever and train everyone to ignore it.
 */

const WHY: Record<DuplicatePair['rule'], string> = {
  same: 'Same name once punctuation and the little words are taken out.',
  contains: 'One name contains the other.',
  distance: 'Nearly the same spelling.',
  head: 'Same name before the dash or comma.'
};

function Side({ kind, keep, drop }: { kind: NameKind; keep: DuplicatePair['a']; drop: DuplicatePair['a'] }) {
  return (
    <form action={mergePairAction} className={a.inline}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="from" value={drop.id} />
      <input type="hidden" name="into" value={keep.id} />
      <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
        Merge into {keep.name}
      </button>
    </form>
  );
}

export default function DuplicateList({ kind, pairs }: { kind: NameKind; pairs: DuplicatePair[] }) {
  if (pairs.length === 0) {
    return <p className={styles.empty}>Nothing looks like a duplicate.</p>;
  }
  return (
    <div className={a.tableWrap}>
      <table className={a.table}>
        <thead>
          <tr>
            <th>One</th>
            <th>The other</th>
            <th>Why</th>
            <th>What to do</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={`${p.a.id}-${p.b.id}`}>
              {[p.a, p.b].map((side) => (
                <td key={side.id}>
                  <strong>{side.name}</strong>
                  <br />
                  <span className={styles.small}>
                    {side.events} event{side.events === 1 ? '' : 's'}
                    {side.address ? ` · ${side.address}` : ''}
                  </span>
                </td>
              ))}
              <td className={styles.small}>{WHY[p.rule]}</td>
              <td>
                <div className={a.inline}>
                  <Side kind={kind} keep={p.a} drop={p.b} />
                  <Side kind={kind} keep={p.b} drop={p.a} />
                  <form action={keepApartAction} className={a.inline}>
                    <input type="hidden" name="kind" value={kind} />
                    <input type="hidden" name="a" value={p.a.id} />
                    <input type="hidden" name="b" value={p.b.id} />
                    <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                      Not the same
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
