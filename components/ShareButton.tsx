'use client';

import { useState } from 'react';
import Icon from './Icon';
import styles from './site.module.css';

/** The phone's share sheet where there is one; otherwise copies the link. */
export default function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // Closed the sheet. Nothing to do.
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt('Copy this link', url);
    }
  }
  return (
    <button type="button" onClick={share} className={`${styles.btn} ${styles.btnOutline}`}>
      <Icon name="share" size={18} />
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}
