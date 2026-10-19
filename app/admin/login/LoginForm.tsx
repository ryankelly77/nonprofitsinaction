'use client';

import { useActionState } from 'react';
import { requestAdminLink } from '../actions';
import styles from '@/components/site.module.css';

export default function LoginForm() {
  const [state, action, pending] = useActionState(requestAdminLink, null);
  return (
    <form action={action} className={styles.calendarCard} style={{ marginTop: 28 }}>
      <div className={styles.field}>
        <label htmlFor="email" className={styles.label}>
          Email
        </label>
        <input id="email" name="email" type="email" className={styles.input} autoComplete="email" required />
      </div>
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 16, width: '100%' }} disabled={pending}>
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state?.message && (
        <p role="status" className={styles.body} style={{ margin: '16px 0 0' }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
