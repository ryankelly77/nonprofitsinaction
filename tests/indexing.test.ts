import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasEnded } from '../lib/time.ts';

/*
 * What decides whether an event page is still offered to a search engine.
 *
 * The rule is one line, but everything about which pages the site advertises
 * hangs off it, and it is a boundary: an event is indexable right up to the
 * instant it finishes and not after. A calendar's finished events outnumber
 * its coming ones within a year, so getting this backwards would hand a
 * search engine mostly history.
 */

// A real event from the calendar: 10 November 2026, 8:30am to 4pm San Antonio
// time, which is 14:30 to 22:00 UTC.
const ENDS = '2026-11-10T22:00:00+00:00';
const at = (iso: string) => Date.parse(iso);

test('an event still to come is indexable', () => {
  assert.equal(hasEnded(ENDS, at('2026-11-01T12:00:00Z')), false);
});

test('an event running right now is indexable', () => {
  assert.equal(hasEnded(ENDS, at('2026-11-10T18:00:00Z')), false);
});

test('an event is still indexable in its final minute', () => {
  assert.equal(hasEnded(ENDS, at('2026-11-10T21:59:59Z')), false);
});

test('an event drops out the instant it ends', () => {
  assert.equal(hasEnded(ENDS, at('2026-11-10T22:00:01Z')), true);
});

test('the boundary itself does not count as ended', () => {
  // Strictly less than, so an event is never hidden while it is still on.
  assert.equal(hasEnded(ENDS, at('2026-11-10T22:00:00Z')), false);
});

test('long past events are out', () => {
  assert.equal(hasEnded(ENDS, at('2027-01-01T00:00:00Z')), true);
});

/*
 * The offset on the stored value must not change the answer. An end time is
 * an instant; the same instant written three ways is the same instant, and a
 * reading that used the wall clock would hide a San Antonio evening event
 * six hours early.
 */
test('the same instant written three ways agrees', () => {
  const now = at('2026-11-10T21:00:00Z');
  for (const written of ['2026-11-10T22:00:00+00:00', '2026-11-10T16:00:00-06:00', '2026-11-10T22:00:00Z']) {
    assert.equal(hasEnded(written, now), false, written);
  }
});
