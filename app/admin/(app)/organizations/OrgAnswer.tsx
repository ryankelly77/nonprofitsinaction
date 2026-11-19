'use client';

import { useState } from 'react';
import styles from '@/components/site.module.css';

/*
 * The one other change to make to an organization, as a field rather than a
 * form of its own.
 *
 * It used to be its own form with its own Apply button, sitting next to the
 * Save button for the details, and the page could not answer the obvious
 * question of which button kept your typing. Worse, picking something here
 * and pressing Save did the saving and silently dropped the choice, because
 * the two were separate forms.
 *
 * So it is an ordinary field now, and whatever submits the form it belongs to
 * applies it. `form` is how it joins a form it is not inside: in a table the
 * row's form has to be an empty element elsewhere in the row, since a form
 * cannot wrap a <tr>.
 */
export default function OrgAnswer({
  id,
  form,
  verified,
  autoApprove,
  retired,
  mergeInto,
  className,
  label
}: {
  id: string;
  form?: string;
  verified: boolean;
  autoApprove: boolean;
  retired: boolean;
  mergeInto: Array<{ id: string; name: string }>;
  className: string;
  label?: 'visible' | 'hidden';
}) {
  const [answer, setAnswer] = useState('');
  const [into, setInto] = useState('');
  const needsTarget = answer === 'merge';

  return (
    <>
      <label htmlFor={`answer-${id}`} className={label === 'visible' ? styles.label : styles.visuallyHidden}>
        Anything else
      </label>
      <select
        id={`answer-${id}`}
        name="answer"
        form={form}
        className={className}
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          setInto('');
        }}
      >
        <option value="">Nothing else</option>
        {retired ? (
          <option value="restore">Put it back on the list</option>
        ) : (
          <>
            <option value={verified ? 'unverify' : 'verify'}>{verified ? 'Mark as unchecked' : 'Mark as checked'}</option>
            <option value={autoApprove ? 'untrust' : 'trust'}>{autoApprove ? 'Stop auto-publishing its events' : 'Auto-publish its events'}</option>
            <option value="merge">Merge it into another organization</option>
            <option value="retire">Retire it</option>
          </>
        )}
      </select>

      {needsTarget && (
        <>
          <label htmlFor={`into-${id}`} className={styles.visuallyHidden}>
            Merge into
          </label>
          {/*
            * Nothing is merged by accident: until this is answered the form
            * cannot be submitted at all, and the choice is spelled out in
            * full rather than offered as a tick.
            */}
          <select id={`into-${id}`} name="into" form={form} className={className} value={into} onChange={(e) => setInto(e.target.value)} required>
            <option value="">Pick an organization…</option>
            {mergeInto.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </>
      )}

      {answer !== '' && (
        <p className={styles.small} style={{ margin: 0, gridColumn: '1 / -1' }}>
          {answer === 'trust'
            ? 'Its events will go straight onto the calendar without waiting for review.'
            : answer === 'merge'
              ? 'Its events and submissions move to the one you pick, and its old address redirects there. This cannot be undone.'
              : answer === 'retire'
                ? 'It comes off the submit form and the lists. Its events are left alone, and it is removed outright only if nothing points at it.'
                : 'Applied when you save.'}
        </p>
      )}
    </>
  );
}
