'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { reorderCauses, saveCause } from '../actions';
import a from '../admin.module.css';
import styles from '@/components/site.module.css';

/*
 * The causes, in the order they are offered, editable, with a row at the
 * bottom for a new one.
 *
 * The order is dragged. It was a number in a box on every row, which is a
 * worse version of the question: you want this one above that one, and to say
 * so in numbers you have to read every other number first, then type one that
 * falls between two of them. Dragging says it directly.
 *
 * Dropping saves straight away. There is no Save for the order because there
 * is nothing to review: the list in front of you is the answer, and the row
 * you moved is still where you put it while it saves.
 *
 * Dragging is not available to a keyboard, so the same move is an up and a
 * down button on every row, which is the control a keyboard and a touch
 * screen both get. Neither is hidden behind the other.
 *
 * It is on two pages: under Settings, with the other lists the form offers,
 * and as a tab on the organizations page, because the moment you find a cause
 * missing is the moment you are giving one to an organization. One component,
 * so the two cannot drift into disagreeing about what the list is.
 */
export default function CauseList({
  causes
}: {
  causes: Array<{ slug: string; label: string; sort: number; active: boolean; organizations: number }>;
}) {
  type Cause = (typeof causes)[number];
  const [order, setOrder] = useState<Cause[]>(causes);
  const [dragging, setDragging] = useState<string | null>(null);
  const [, startSaving] = useTransition();

  /*
   * Anything the server says about these rows wins, including a name just
   * saved on one of them. The signature is every value shown, not just the
   * slugs, or an edited name would sit behind the copy held here.
   */
  const signature = causes.map((c) => `${c.slug}:${c.label}:${c.active}:${c.organizations}`).join('|');
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setOrder(causes);
  }

  function moveTo(from: number, to: number): void {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setOrder(next);
    startSaving(() => {
      void reorderCauses(next.map((c) => c.slug));
    });
  }

  /* While dragging, the row follows the pointer without saving; the save is
     the drop. */
  function dragOver(index: number): void {
    if (dragging === null) return;
    const from = order.findIndex((c) => c.slug === dragging);
    if (from === -1 || from === index) return;
    const next = [...order];
    const [row] = next.splice(from, 1);
    next.splice(index, 0, row);
    setOrder(next);
  }

  return (
    <div className={a.tableWrap}>
      <table className={a.table}>
        <thead>
          <tr>
            <th>
              <span className={styles.visuallyHidden}>Order</span>
            </th>
            <th>Name</th>
            <th>Used by</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {order.map((c, i) => (
            <tr
              key={c.slug}
              draggable
              onDragStart={() => setDragging(c.slug)}
              onDragOver={(e) => {
                e.preventDefault();
                dragOver(i);
              }}
              onDragEnd={() => {
                setDragging(null);
                startSaving(() => {
                  void reorderCauses(order.map((x) => x.slug));
                });
              }}
              className={dragging === c.slug ? a.rowDragging : undefined}
            >
              <td>
                <div className={a.dragCell}>
                  <span className={a.grip} aria-hidden title="Drag to reorder">
                    <Icon name="grip" size={18} />
                  </span>
                  <button type="button" className={a.nudge} onClick={() => moveTo(i, i - 1)} disabled={i === 0} aria-label={`Move ${c.label} up`}>
                    <Icon name="chevronUp" size={14} />
                  </button>
                  <button
                    type="button"
                    className={a.nudge}
                    onClick={() => moveTo(i, i + 1)}
                    disabled={i === order.length - 1}
                    aria-label={`Move ${c.label} down`}
                  >
                    <Icon name="chevronDown" size={14} />
                  </button>
                </div>
              </td>
              <td>
                {/*
                  * One form per row, with the fields in their own cells so
                  * they line up down the column. A form cannot wrap a <tr>,
                  * so the form element is empty and each field names it: that
                  * is what the form attribute is for.
                  */}
                <form id={`cause-${c.slug}`} action={saveCause} />
                <input type="hidden" name="slug" value={c.slug} form={`cause-${c.slug}`} />
                <input name="label" defaultValue={c.label} aria-label="Name" className={a.cellInput} form={`cause-${c.slug}`} />
              </td>
              {/*
                * The count is a way in, not a statistic: a cause with sixteen
                * organizations under it is usually the start of going to read
                * the sixteen. A nought is plain text, since there is nothing
                * behind it.
                */}
              <td className={styles.small} style={{ whiteSpace: 'nowrap', paddingTop: 20 }}>
                {c.organizations === 0 ? (
                  'none'
                ) : (
                  <Link href={`/admin/organizations/?show=all&cause=${encodeURIComponent(c.slug)}`}>
                    {c.organizations} organization{c.organizations === 1 ? '' : 's'}
                  </Link>
                )}
              </td>
              <td>
                <div className={a.inline}>
                  <label className={styles.checkbox} style={{ minHeight: 40 }}>
                    <input type="checkbox" name="active" defaultChecked={c.active} form={`cause-${c.slug}`} />
                    On the form
                  </label>
                  <button type="submit" form={`cause-${c.slug}`} className={`${styles.btn} ${styles.btnSmall} ${styles.btnOutline}`}>
                    Save
                  </button>
                </div>
              </td>
            </tr>
          ))}
          <tr>
            <td />
            <td>
              <form id="cause-new" action={saveCause} />
              <input name="label" placeholder="New cause" aria-label="New cause" className={a.cellInput} form="cause-new" required />
            </td>
            <td className={styles.small} style={{ paddingTop: 20 }}>
              goes last
            </td>
            <td>
              <button type="submit" form="cause-new" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`}>
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
