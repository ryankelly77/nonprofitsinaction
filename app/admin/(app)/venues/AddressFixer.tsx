'use client';

import { useState } from 'react';
import type { AddressSuggestion } from '@/lib/places';
import { acceptNoStreetAddress, suggestVenueAddress, verifyVenue } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * One venue that has a name and no address, and the way to give it one.
 *
 * Forty-eight of these came out of the import, because the old form never
 * made anybody type an address. Most are real places anyone could look up,
 * which is the whole problem: it is twenty seconds of work repeated fifty
 * times in another browser tab.
 *
 * Asking Google collapses that to a click, but the answer is still only ever
 * a suggestion. Picking one fills the boxes and nothing more; it is saved
 * when the admin saves it, having read it. An address is a fact about the
 * world, and a wrong one sends people to the wrong building on the night.
 */
export default function AddressFixer({
  id,
  name,
  city,
  events,
  upcoming,
  canLookUp
}: {
  id: string;
  name: string;
  city: string | null;
  events: number;
  upcoming: boolean;
  canLookUp: boolean;
}) {
  const [found, setFound] = useState<AddressSuggestion[] | null>(null);
  const [looking, setLooking] = useState(false);
  const [line1, setLine1] = useState('');
  const [town, setTown] = useState(city ?? 'San Antonio');
  const [postal, setPostal] = useState('');

  async function look() {
    setLooking(true);
    try {
      setFound(await suggestVenueAddress(name));
    } catch {
      setFound([]);
    } finally {
      setLooking(false);
    }
  }

  function take(s: AddressSuggestion) {
    setLine1(s.line1 ?? '');
    setTown(s.city ?? town);
    setPostal(s.postal ?? '');
  }

  return (
    <tr>
      <td>
        <strong>{name}</strong>
        <div className={styles.small} style={{ marginTop: 4 }}>
          {events} event{events === 1 ? '' : 's'}
          {upcoming ? ' · one still to come' : ''}
        </div>
        {found !== null && (
          <div style={{ marginTop: 8 }}>
            {found.length === 0 ? (
              <p className={styles.small} style={{ margin: 0 }}>
                Google had nothing for that name. Type the address, or retire the venue if it is not a place.
              </p>
            ) : (
              <ul className={a.suggestions}>
                {found.map((s) => (
                  <li key={s.formatted}>
                    <button type="button" onClick={() => take(s)} className={a.suggestion}>
                      <strong>{s.name}</strong>
                      <span>{s.formatted}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </td>
      <td>
        <form id={`addr-${id}`} action={verifyVenue} />
        <input type="hidden" name="id" value={id} form={`addr-${id}`} />
        <input type="hidden" name="name" value={name} form={`addr-${id}`} />
        <input type="hidden" name="verified" value="on" form={`addr-${id}`} />
        <input
          name="address"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="Street address"
          aria-label={`Street address for ${name}`}
          className={a.cellInput}
          form={`addr-${id}`}
        />
      </td>
      <td>
        <input name="city" value={town} onChange={(e) => setTown(e.target.value)} aria-label="City" className={a.cellInput} style={{ width: 140 }} form={`addr-${id}`} />
      </td>
      <td>
        <input name="postal" value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="ZIP" aria-label="ZIP" className={a.cellInput} style={{ width: 90 }} form={`addr-${id}`} />
      </td>
      <td>
        <div className={a.inline}>
          {canLookUp && (
            <button type="button" onClick={look} disabled={looking} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
              {looking ? 'Looking…' : 'Ask Google'}
            </button>
          )}
          <button type="submit" form={`addr-${id}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} disabled={!line1.trim()}>
            Save
          </button>
        </div>
        {/*
          * The third answer. Some venues are districts rather than doors:
          * the Historic Pearl, Hemisfair, Downtown. Without this the only
          * ways off the list are inventing an address or retiring a place
          * events are really held at, so they sat here for ever.
          */}
        <div className={a.inline} style={{ marginTop: 6 }}>
          <form action={acceptNoStreetAddress}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className={a.quietAction}>
              It has no street address
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}
