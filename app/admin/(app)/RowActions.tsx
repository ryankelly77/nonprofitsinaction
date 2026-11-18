'use client';

import { useState } from 'react';
import { applyRecordAction } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * Everything an admin can do to one venue or organization, as one choice.
 *
 * It used to be a button for each: Set, Merge, Retire, each in its own form,
 * three or four to a row and a hundred rows down the page. Any one of them
 * was a click away at all times, including the two that are hard to undo,
 * and the row was unreadable. Now it is a question with an answer, and the
 * answer has to be chosen before anything can be pressed.
 *
 * Merging is the one answer that needs somewhere to go, so picking it brings
 * out a second menu and nothing can be applied until that is answered too.
 */
export default function RowActions({
  kind,
  id,
  name,
  verified,
  trusted,
  retired,
  mergeInto
}: {
  kind: 'venue' | 'organization';
  id: string;
  name: string;
  verified?: boolean;
  trusted?: boolean;
  retired?: boolean;
  mergeInto: Array<{ id: string; name: string }>;
}) {
  const [answer, setAnswer] = useState('');
  const [into, setInto] = useState('');
  const needsTarget = answer === 'merge';

  return (
    <form action={applyRecordAction} className={a.inline}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`act-${id}`} className={styles.visuallyHidden}>
        What to do with {name}
      </label>
      <select id={`act-${id}`} name="answer" value={answer} onChange={(e) => setAnswer(e.target.value)} className={a.cellInput} style={{ width: 'auto', minWidth: 170, maxWidth: 200 }}>
        <option value="">Choose…</option>
        {retired ? (
          <option value="restore">Put back on the list</option>
        ) : (
          <>
            <option value={verified ? 'unverify' : 'verify'}>{verified ? 'Mark as unchecked' : 'Mark as checked'}</option>
            {kind === 'organization' && (
              <option value={trusted ? 'untrust' : 'trust'}>{trusted ? 'Stop auto-publishing' : 'Auto-publish its events'}</option>
            )}
            <option value="merge">Merge into…</option>
            <option value="retire">Retire</option>
          </>
        )}
      </select>
      {needsTarget && (
        <>
          <label htmlFor={`into-${id}`} className={styles.visuallyHidden}>
            Merge {name} into
          </label>
          <select id={`into-${id}`} name="into" value={into} onChange={(e) => setInto(e.target.value)} className={a.cellInput} style={{ width: 'auto', minWidth: 170, maxWidth: 200 }}>
            <option value="">Merge into…</option>
            {mergeInto.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </>
      )}
      <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`} disabled={!answer || (needsTarget && !into)}>
        Apply
      </button>
    </form>
  );
}
