'use client';

import { useState } from 'react';
import { requestManageLinks } from '@/app/(site)/manage/actions';
import styles from './site.module.css';

export default function NewLinkForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={styles.calendarCard}
      style={{ marginTop: 28, maxWidth: 560 }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await requestManageLinks(email).catch(() => ({ message: 'We could not reach the server. Try again.' }));
        setMessage(r.message);
        setBusy(false);
      }}
    >
      <div className={styles.field}>
        <label htmlFor="ml-email" className={styles.label}>
          The email you listed with
        </label>
        <input id="ml-email" type="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </div>
      <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 16 }} disabled={busy}>
        {busy ? 'Sending…' : 'Email me a new link'}
      </button>
      <p role="status" className={styles.body} style={{ margin: message ? '16px 0 0' : 0 }}>
        {message}
      </p>
    </form>
  );
}
