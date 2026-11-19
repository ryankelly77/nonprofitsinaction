'use client';

import { useState } from 'react';
import { matchesTyped } from '@/lib/names';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * Which record to fold this one into, found by typing.
 *
 * It was a menu of every venue or organization on the calendar, which is a
 * hundred and twenty three names in one dropdown with no way to search. The
 * option existed and could not be used: you had to already know the exact
 * wording of the name you were looking for, and scroll to it. The lookalike
 * list hands you both names, so it never noticed; merging anything the
 * comparison did not catch was the case that was really left out.
 *
 * Matched the way the submit form matches what somebody types, so "childrens"
 * finds "Children's" and an accent is not a wall.
 *
 * The id goes in a hidden field, and is cleared the moment the text changes,
 * so a name typed over a chosen one cannot leave the previous id behind and
 * merge into the wrong record. The hidden field is what the form requires, so
 * nothing can be submitted until something was actually picked from the list.
 */
export default function MergePicker({
  id,
  form,
  kind,
  targets,
  className
}: {
  id: string;
  form?: string;
  kind: 'venue' | 'organization';
  targets: Array<{ id: string; name: string }>;
  className: string;
}) {
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);

  const typed = text.trim();
  const matches = chosen || typed.length < 2 ? [] : targets.filter((t) => matchesTyped(typed, t.name)).slice(0, 8);

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <label htmlFor={`into-${id}`} className={styles.small}>
        Fold it into which {kind}?
      </label>
      <input
        id={`into-${id}`}
        type="text"
        className={className}
        value={chosen ? chosen.name : text}
        placeholder={`Start typing a ${kind} name`}
        autoComplete="off"
        onChange={(e) => {
          setChosen(null);
          setText(e.target.value);
        }}
      />
      {/* The answer, not the typing. Empty until one is picked, and required,
          so a half-typed name cannot be submitted as a merge. */}
      <input type="hidden" name="into" form={form} value={chosen?.id ?? ''} required />

      {chosen ? (
        <p className={styles.small} style={{ margin: 0 }}>
          Everything under this one moves to <strong>{chosen.name}</strong>, and its old address redirects there. This cannot be undone.
        </p>
      ) : typed.length >= 2 && matches.length === 0 ? (
        <p className={styles.small} style={{ margin: 0 }}>
          Nothing by that name. The one you are folding into has to already exist.
        </p>
      ) : (
        matches.length > 0 && (
          <ul className={a.suggestions}>
            {matches.map((t) => (
              <li key={t.id}>
                <button type="button" className={a.suggestion} onClick={() => setChosen(t)}>
                  <strong>{t.name}</strong>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
