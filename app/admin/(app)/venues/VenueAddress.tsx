'use client';

import { useState } from 'react';
import type { AddressSuggestion } from '@/lib/places';
import { suggestVenueAddress } from '../../actions';
import a from '../../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * A venue's address in the whole-list table, with Google offered when the
 * street line is empty.
 *
 * Asking Google already existed, but only in the "No street address" queue on
 * the review tab, which is the list of venues with an upcoming event. A venue
 * whose events have all been and gone, or one you happened to open from the
 * whole list, had the same empty box and no way to fill it but another browser
 * tab. The button is the same server action; only where it can be reached is
 * new.
 *
 * Offered only while the box is empty. An address somebody has already
 * written is not improved by a machine's guess, and a button that overwrites
 * typing is a button nobody trusts.
 *
 * What comes back is a suggestion and nothing else: picking one fills the
 * boxes, and the row is saved when the admin saves it, having read it. An
 * address is a fact about the world, and a wrong one sends people to the
 * wrong building on the night.
 *
 * Three cells rather than three components, because they are three columns of
 * one row and have to line up with the headings above them.
 */
export default function VenueAddress({
  name,
  form,
  address,
  city,
  postal,
  canLookUp
}: {
  name: string;
  form: string;
  address: string | null;
  city: string | null;
  postal: string | null;
  canLookUp: boolean;
}) {
  const [line1, setLine1] = useState(address ?? '');
  const [town, setTown] = useState(city ?? '');
  const [zip, setZip] = useState(postal ?? '');
  const [found, setFound] = useState<AddressSuggestion[] | null>(null);
  const [looking, setLooking] = useState(false);

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
    setZip(s.postal ?? '');
    setFound(null);
  }

  return (
    <>
      <td>
        <input
          name="address"
          value={line1}
          onChange={(e) => setLine1(e.target.value)}
          placeholder="Street address"
          aria-label={`Street address for ${name}`}
          className={a.cellInput}
          form={form}
        />
        {canLookUp && !line1.trim() && (
          <div style={{ marginTop: 6 }}>
            <button type="button" onClick={look} disabled={looking} className={a.quietAction}>
              {looking ? 'Looking…' : 'Ask Google'}
            </button>
          </div>
        )}
        {found !== null && (
          <div style={{ marginTop: 6 }}>
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
        <input name="city" value={town} onChange={(e) => setTown(e.target.value)} placeholder="City" aria-label="City" className={a.cellInput} style={{ width: 140 }} form={form} />
      </td>
      <td>
        <input name="postal" value={zip} onChange={(e) => setZip(e.target.value)} placeholder="ZIP" aria-label="ZIP" className={a.cellInput} style={{ width: 90 }} form={form} />
      </td>
    </>
  );
}
