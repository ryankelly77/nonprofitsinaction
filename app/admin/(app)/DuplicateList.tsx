import type { DuplicatePair } from '@/lib/duplicates';
import type { NameKind } from '@/lib/types';
import { resolveDuplicateAction } from '../actions';
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
 *
 * One question, one answer, one button. Three buttons in a row read as three
 * equal choices when only ever one of them is right, and the row of them was
 * the widest thing on the page.
 */

const WHY: Record<DuplicatePair['rule'], string> = {
  same: 'Same name once punctuation and the little words are taken out.',
  contains: 'One name contains the other.',
  distance: 'Nearly the same spelling.',
  head: 'Same name before the dash or comma.',
  address: 'Same street address, whatever they are called.'
};

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
                <form action={resolveDuplicateAction} className={a.inline}>
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="a" value={p.a.id} />
                  <input type="hidden" name="b" value={p.b.id} />
                  <label htmlFor={`dup-${p.a.id}-${p.b.id}`} className={styles.visuallyHidden}>
                    What to do with {p.a.name} and {p.b.name}
                  </label>
                  <select id={`dup-${p.a.id}-${p.b.id}`} name="answer" defaultValue="" className={a.cellInput} style={{ width: 'auto', minWidth: 220 }}>
                    <option value="" disabled>
                      Choose…
                    </option>
                    <option value="keep-a">Keep {p.a.name}</option>
                    <option value="keep-b">Keep {p.b.name}</option>
                    <option value="apart">They are not the same</option>
                  </select>
                  <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                    Apply
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
