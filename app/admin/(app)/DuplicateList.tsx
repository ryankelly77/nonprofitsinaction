import type { EventPeek as Peek } from '@/lib/admin-data';
import type { DuplicatePair } from '@/lib/duplicates';
import type { NameKind } from '@/lib/types';
import EventPeek from './EventPeek';
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

export default function DuplicateList({
  kind,
  pairs,
  events
}: {
  kind: NameKind;
  pairs: DuplicatePair[];
  /* What is filed under each side, keyed by id. Loaded once by the page. */
  events: Map<string, Peek[]>;
}) {
  if (pairs.length === 0) {
    return <p className={styles.empty}>Nothing looks like a duplicate.</p>;
  }
  return (
    <div className={a.tableWrap}>
      <table className={a.table}>
        <thead>
          {/*
            * Numbered rather than "One" and "The other", which read as a
            * ranking and sent people looking for what made the first one
            * first. Neither side is preferred: the answers below name both.
            *
            * Which rule matched is not here any more. It explained the
            * machine's reasoning, and the question on this row is not whether
            * the comparison was clever but whether these two names are one
            * place, which is answered by reading them.
            */}
          <tr>
            <th>Version 1</th>
            <th>Version 2</th>
            <th>What to do</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={`${p.a.id}-${p.b.id}`}>
              {[p.a, p.b].map((side) => (
                <td key={side.id}>
                  <strong>{side.name}</strong>
                  {side.address && (
                    <>
                      <br />
                      <span className={styles.small}>{side.address}</span>
                    </>
                  )}
                  {/* What is under it, which is most of how you tell whether
                      two names are one place. */}
                  <EventPeek events={events.get(side.id) ?? []} count={side.events} />
                </td>
              ))}
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
