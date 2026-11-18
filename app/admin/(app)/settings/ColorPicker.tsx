'use client';

import { useState } from 'react';
import { typeTagClass } from '@/components/eventTypeTag';
import { EVENT_COLORS } from '@/lib/colors';
import a from '../../admin.module.css';

/*
 * Picking the colour a kind of event wears.
 *
 * A list, not a colour wheel. The twelve were measured against each other so
 * that no two read alike and none is mistaken for the Canceled red or the
 * brand teal, and a free picker would undo that the first time somebody
 * chose a nice green. Adding to the list is a deliberate act in three places,
 * which is the point.
 *
 * The swatch follows the menu before anything is saved, so the colour can be
 * seen rather than guessed from its name.
 */
export default function ColorPicker({ id, value, form }: { id: string; value: string; form: string }) {
  const [color, setColor] = useState(value);
  return (
    <div className={a.colorPick}>
      <span className={`${a.swatch} ${typeTagClass(color)}`} aria-hidden="true" />
      <select
        id={`color-${id}`}
        name="color"
        form={form}
        value={color}
        onChange={(e) => setColor(e.target.value)}
        aria-label="Colour"
        className={a.cellInput}
      >
        {EVENT_COLORS.map((c) => (
          <option key={c.name} value={c.name}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
