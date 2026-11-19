'use client';

import { useState } from 'react';
import { askOrganizer } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * Asking the organizer what is missing: the third thing to do with a listing
 * that needs a check, beside fixing it yourself and deciding it is fine.
 *
 * It arrives with the question already written, from the flags on the
 * listing, because the flag already knows what is wrong and making a reviewer
 * retype it in their own words every time is how the useful option becomes
 * the one nobody takes. Editable, since the sentence that actually gets an
 * answer is usually about this listing in particular.
 *
 * No "email them" tick, unlike turning a listing down. Asking a question
 * nobody is sent is not a thing anybody wants to do.
 */
export default function AskForm({
  eventId,
  back,
  suggested,
  canEmail,
  submitter
}: {
  eventId: string;
  back: string;
  suggested: string;
  canEmail: boolean;
  submitter: string | null;
}) {
  const [text, setText] = useState(suggested);

  if (!submitter) {
    return (
      <p className={styles.small} style={{ margin: 0 }}>
        No address on file for whoever listed this, so there is nobody to ask. Most of the imported listings from before October are like this.
      </p>
    );
  }

  return (
    <form action={askOrganizer} className={a.reject}>
      <input type="hidden" name="id" value={eventId} />
      <input type="hidden" name="back" value={back} />
      <label htmlFor={`ask-${eventId}`} className={styles.small}>
        Sent to {submitter}, with a private link for fixing it themselves
      </label>
      <textarea
        id={`ask-${eventId}`}
        name="question"
        className={styles.textarea}
        rows={5}
        style={{ minHeight: 110 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        required
      />
      {!canEmail && (
        <p className={styles.small} style={{ margin: 0 }}>
          Nothing can be sent yet: &ldquo;Email submitters&rdquo; is off under Settings. Turn it on there first, or this question goes nowhere.
        </p>
      )}
      <button type="submit" className={`${styles.btn} ${styles.btnOutline}`} disabled={!text.trim()}>
        Send the question
      </button>
    </form>
  );
}
