'use client';

import { useActionState } from 'react';
import { CODE_LENGTH } from '@/lib/admins';
import { requestAdminCode, verifyAdminCode } from '../actions';
import styles from '@/components/site.module.css';

/*
 * Two steps: ask for a code, then type it in. Which one is showing is decided
 * by whether the first step came back with an address, so a failed attempt
 * keeps you on the code box instead of making you type the address again.
 */
export default function LoginForm() {
  const [asked, ask, asking] = useActionState(requestAdminCode, null);
  if (!asked?.email) {
    return (
      <form action={ask} className={styles.calendarCard} style={{ marginTop: 28 }}>
        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input id="email" name="email" type="email" className={styles.input} autoComplete="email" autoFocus required />
        </div>
        <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 16, width: '100%' }} disabled={asking}>
          {asking ? 'Sending…' : 'Email me a code'}
        </button>
        {asked?.message && (
          <p role="status" className={styles.body} style={{ margin: '16px 0 0' }}>
            {asked.message}
          </p>
        )}
      </form>
    );
  }
  return <CodeForm email={asked.email} sent={asked.message} />;
}

function CodeForm({ email, sent }: { email: string; sent: string }) {
  const [state, verify, verifying] = useActionState(verifyAdminCode, null);
  return (
    <form action={verify} className={styles.calendarCard} style={{ marginTop: 28 }}>
      <input type="hidden" name="email" value={email} />
      <p className={styles.body} style={{ margin: 0 }}>
        {state?.message ?? sent}
      </p>
      <div className={styles.field} style={{ marginTop: 16 }}>
        <label htmlFor="code" className={styles.label}>
          {CODE_LENGTH} digit code
        </label>
        <input
          id="code"
          name="code"
          /*
           * Not type="number": a code is a string of digits, and a number box
           * drops a leading zero and shows spinner arrows on it.
           */
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          className={styles.input}
          style={{ letterSpacing: '0.3em', fontSize: 20 }}
          autoFocus
          required
        />
      </div>
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 16, width: '100%' }} disabled={verifying}>
        {verifying ? 'Checking…' : 'Sign in'}
      </button>
      <p className={styles.small} style={{ marginTop: 14 }}>
        Sending to {email}. <a href="/admin/login/">Use a different address</a>, or ask for a new code there if this one does not arrive.
      </p>
    </form>
  );
}
