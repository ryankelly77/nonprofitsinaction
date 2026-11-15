'use client';

import { useState } from 'react';
import type { RejectionReason } from '@/lib/types';
import { reject } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * Turning a listing down.
 *
 * Picking a standard answer fills the box rather than replacing the form, so
 * the common reply is one click and still editable: the sentence that needs
 * adding is usually about this listing in particular. Choosing a second one
 * replaces the text only while it is untouched, so a reply already being
 * written is never thrown away by a stray click on the list.
 */
export default function RejectForm({ eventId, back, tellByDefault, reasons }: { eventId: string; back: string; tellByDefault: boolean; reasons: RejectionReason[] }) {
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);

  function pick(id: string) {
    const chosen = reasons.find((r) => r.id === id);
    if (!chosen) return;
    if (edited && text.trim() && !window.confirm('Replace what you have written?')) return;
    setText(chosen.body);
    setEdited(false);
  }

  return (
    <form action={reject} className={a.reject}>
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="back" value={back} />
      {reasons.length > 0 && (
        <>
          <label htmlFor={`canned-${eventId}`} className={styles.small}>
            Standard answers
          </label>
          <select id={`canned-${eventId}`} className={styles.select} defaultValue="" onChange={(e) => pick(e.target.value)}>
            <option value="">Write my own</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor={`r-${eventId}`} className={styles.small}>
        Reason (sent to the submitter if ticked below)
      </label>
      <textarea
        id={`r-${eventId}`}
        name="reason"
        className={styles.textarea}
        rows={5}
        style={{ minHeight: 110 }}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setEdited(true);
        }}
      />
      <label className={styles.checkbox}>
        <input type="checkbox" name="tell" defaultChecked={tellByDefault} />
        Email the submitter
      </label>
      <button type="submit" className={`${styles.btn} ${styles.btnOutline}`}>
        Don&apos;t approve
      </button>
    </form>
  );
}
