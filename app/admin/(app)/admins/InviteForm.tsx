'use client';

import { useActionState } from 'react';
import { inviteAdmin } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * Inviting somebody. The answer comes back on the page rather than as a
 * redirect, because "already on the list" and "not added: ..." are worth
 * reading, and a redirect would throw them away.
 */
export default function InviteForm() {
  const [state, invite, pending] = useActionState(inviteAdmin, null);
  return (
    <>
      <form action={invite} className={a.inline} style={{ marginTop: 8 }}>
        <input name="email" type="email" placeholder="Email address" aria-label="Email address" style={{ minWidth: 260 }} required />
        <input name="name" placeholder="Name (optional)" aria-label="Name" style={{ minWidth: 200 }} />
        <label className={styles.checkbox} style={{ minHeight: 40 }}>
          <input type="checkbox" name="notify" defaultChecked />
          Email them new listings
        </label>
        <button type="submit" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} disabled={pending}>
          {pending ? 'Inviting…' : 'Invite'}
        </button>
      </form>
      {state?.message && (
        <p role="status" className={styles.body} style={{ marginTop: 10 }}>
          {state.message}
        </p>
      )}
      <p className={styles.small} style={{ marginTop: 6 }}>
        They get an email with the sign-in address. An invitation can be withdrawn by removing them below, whether or not they have used it.
      </p>
    </>
  );
}
