import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nextOccurrence, recurrenceKey } from '../lib/recurrence.ts';

/*
 * Titles taken from the calendar itself, because the shapes that matter are
 * the ones San Antonio nonprofits actually use.
 */

test('the year comes out of a title', () => {
  assert.equal(recurrenceKey('2026 Curtain Up Gala'), 'curtain up gala');
  assert.equal(recurrenceKey('Curtain Up Gala 2027'), 'curtain up gala');
  assert.equal(recurrenceKey('Día de Muertos 2026'), 'dia de muertos');
});

test('the ordinal comes out, however it is written', () => {
  assert.equal(recurrenceKey('44th Annual Zoobilation Ball'), 'zoobilation ball');
  assert.equal(recurrenceKey('45th Annual Zoobilation Ball'), 'zoobilation ball');
  assert.equal(recurrenceKey('1st Annual Prayer Breakfast'), 'prayer breakfast');
  assert.equal(recurrenceKey('SA Youth 42nd Birthday Celebration'), 'sa youth birthday celebration');
});

test('two years of the same event share a key', () => {
  assert.equal(recurrenceKey('5th Annual Legacy of Light'), recurrenceKey('Legacy of Light 2027'));
});

test('a number that is part of the name is kept', () => {
  // Not an ordinal and not a year: "5K" is what the event is.
  assert.ok(recurrenceKey('Girls on the Run 5K').includes('5k'));
  assert.ok(recurrenceKey('San Antonio Food Bank Turkey Trot 5K').includes('5k'));
});

test('different events do not share a key', () => {
  assert.notEqual(recurrenceKey('Spring Egg Hunt'), recurrenceKey('Fall Festival'));
  assert.notEqual(recurrenceKey('Red Shoes Fiesta'), recurrenceKey('Red Ribbon Luncheon'));
});

const ev = (slug: string, title: string, starts: string, ends: string): { slug: string; title: string; starts_at: string; ends_at: string } => ({
  slug,
  title,
  starts_at: starts,
  ends_at: ends
});

const NOW = Date.parse('2026-12-01T00:00:00Z');
const gala26 = ev('gala-2026', '2026 Curtain Up Gala', '2026-03-20T23:00:00Z', '2026-03-21T03:00:00Z');

test('a past event finds next year', () => {
  const gala27 = ev('gala-2027', '2027 Curtain Up Gala', '2027-03-19T23:00:00Z', '2027-03-20T03:00:00Z');
  assert.equal(nextOccurrence(gala26, [gala27], NOW)?.slug, 'gala-2027');
});

test('the soonest of several wins, so it points forward not back', () => {
  const g27 = ev('gala-2027', '2027 Curtain Up Gala', '2027-03-19T23:00:00Z', '2027-03-20T03:00:00Z');
  const g28 = ev('gala-2028', '2028 Curtain Up Gala', '2028-03-17T23:00:00Z', '2028-03-18T03:00:00Z');
  assert.equal(nextOccurrence(gala26, [g28, g27], NOW)?.slug, 'gala-2027');
});

test('an occurrence that has also finished is not offered', () => {
  // Listed every year, but 2026 is over too: there is nowhere to send anyone.
  const alsoPast = ev('gala-2026b', 'Curtain Up Gala 2026', '2026-09-20T23:00:00Z', '2026-09-21T03:00:00Z');
  assert.equal(nextOccurrence(gala26, [alsoPast], NOW), null);
});

test('an unrelated event from the same organization is not a successor', () => {
  const other = ev('lunch-2027', '2027 Spring Luncheon', '2027-04-10T17:00:00Z', '2027-04-10T19:00:00Z');
  assert.equal(nextOccurrence(gala26, [other], NOW), null);
});

test('an event never points at itself', () => {
  assert.equal(nextOccurrence(gala26, [gala26], NOW), null);
});

test('a one-word title too common to trust matches nothing', () => {
  // "Gala" alone could be any of an organization's evenings.
  const thin = ev('g1', '2026 Gala', '2026-03-20T23:00:00Z', '2026-03-21T03:00:00Z');
  const next = ev('g2', '2027 Gala', '2027-03-20T23:00:00Z', '2027-03-21T03:00:00Z');
  assert.equal(nextOccurrence(thin, [next], NOW), null);
});

test('a distinctive one-word title is trusted', () => {
  // "Siclovia" names one particular thing, unlike "Gala".
  const a = ev('sic-26', 'Siclovia 2026', '2026-03-22T15:00:00Z', '2026-03-22T20:00:00Z');
  const b = ev('sic-27', 'Siclovia 2027', '2027-03-21T15:00:00Z', '2027-03-21T20:00:00Z');
  assert.equal(nextOccurrence(a, [b], NOW)?.slug, 'sic-27');
});

test('nothing to point at gives null', () => {
  assert.equal(nextOccurrence(gala26, [], NOW), null);
});
