import type { NameMatch } from '@/lib/duplicates';
import type { NameKind } from '@/lib/types';
import { keepAsNewAction, mergePairAction } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * Asked on the review page when an event brings in a venue nobody has
 * checked, or an organization with nothing approved yet, and the name looks
 * like something already listed.
 *
 * It has to be answered before the event can go out. Approving used to vouch
 * for a typed-in venue outright, so a misspelling became a suggestion on the
 * form and the next submitter picked it: one typo, then two venues for one
 * building. Answering here is what stops that, and "Keep as new" is a real
 * answer, remembered, so the same pair is never asked about again.
 */
export default function NameQuestion({
  kind,
  record,
  matches
}: {
  kind: NameKind;
  record: { id: string; name: string };
  matches: NameMatch[];
}) {
  const what = kind === 'venue' ? 'venue' : 'organization';
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>
        Is the {what} &ldquo;{record.name}&rdquo; one of these?
      </p>
      <ul style={{ margin: '8px 0 0', paddingLeft: 0, listStyle: 'none' }}>
        {matches.map((m) => (
          <li key={m.id} style={{ marginTop: 8 }}>
            <form action={mergePairAction} className={a.inline}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="from" value={record.id} />
              <input type="hidden" name="into" value={m.id} />
              <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                Use {m.name} instead
              </button>
            </form>
            <span className={styles.small}>
              {m.events} event{m.events === 1 ? '' : 's'}
              {m.address ? ` · ${m.address}` : ''}
            </span>
          </li>
        ))}
      </ul>
      <form action={keepAsNewAction} style={{ marginTop: 10 }}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={record.id} />
        {matches.map((m) => (
          <input key={m.id} type="hidden" name="other" value={m.id} />
        ))}
        <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
          Keep as new
        </button>
      </form>
    </div>
  );
}
