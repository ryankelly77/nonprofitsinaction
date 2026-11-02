'use client';

import { useState } from 'react';
import { saveEventAsAdmin } from '@/app/admin/actions';
import EventFields, { draftToInput, type EventDraft } from './EventFields';
import Icon from './Icon';
import styles from './site.module.css';

export default function AdminEventForm({
  id,
  slug,
  initial,
  organizationId,
  featured,
  organizations,
  types
}: {
  id: string;
  slug: string;
  initial: EventDraft;
  organizationId: string;
  featured: boolean;
  organizations: Array<{ id: string; name: string }>;
  types: Array<{ slug: string; label: string }>;
}) {
  const [draft, setDraft] = useState(initial);
  const [org, setOrg] = useState(organizationId);
  const [feat, setFeat] = useState(featured);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setNote(null);
    const r = await saveEventAsAdmin(id, draftToInput(draft), { organizationId: org, featured: feat }).catch(() => ({ ok: false as const, errors: {}, message: 'Could not reach the server.' }));
    setBusy(false);
    setErrors(r.ok ? {} : r.errors);
    setNote({ ok: r.ok, text: r.message });
  }

  return (
    <div className={styles.formCard}>
      <div className={styles.field}>
        <label htmlFor="org" className={styles.label}>
          Host organization
        </label>
        <select id="org" className={styles.select} value={org} onChange={(e) => setOrg(e.target.value)}>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <EventFields draft={draft} index={0} types={types} errors={errors} onChange={(p) => setDraft((d) => ({ ...d, ...p }))} ignoreSlug={slug} />
      <label className={styles.checkbox} style={{ marginTop: 16 }}>
        <input type="checkbox" checked={feat} onChange={(e) => setFeat(e.target.checked)} />
        Featured
      </label>
      {note && (
        <div className={`${styles.notice} ${note.ok ? styles.noticeOk : styles.noticeError}`} style={{ marginTop: 16 }} role="status">
          <Icon name={note.ok ? 'check' : 'alert'} size={20} />
          <p style={{ margin: 0, fontWeight: 600 }}>{note.text}</p>
        </div>
      )}
      <div className={styles.formFoot}>
        <span className={styles.small}>Saving an imported event&apos;s time clears its time check.</span>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
