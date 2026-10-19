import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  dateTile,
  dayRange,
  isDateString,
  localParts,
  longDateFromString,
  monthGrid,
  monthRange,
  timeRange,
  zonedToUtc
} from '../lib/time.ts';

/*
 * Real events from the WordPress calendar, as their own pages showed them in
 * October 2026, with the instant each one is. Promise Ball's instant is also
 * what EventON put in its own Google Calendar link (20270501T230000Z), which
 * is the independent check that these are right.
 */
const FIXTURES = [
  { name: 'Halloween Wooftacular', date: '2026-10-17', start: '10:00', end: '14:00', utcStart: '2026-10-17T15:00:00.000Z', utcEnd: '2026-10-17T19:00:00.000Z' },
  { name: 'NAMIWalks Kendall County', date: '2026-10-31', start: '10:00', end: '12:00', utcStart: '2026-10-31T15:00:00.000Z', utcEnd: '2026-10-31T17:00:00.000Z' },
  { name: 'Gallery of Hope Gala', date: '2026-11-07', start: '18:00', end: '22:00', utcStart: '2026-11-08T00:00:00.000Z', utcEnd: '2026-11-08T04:00:00.000Z' },
  { name: 'Care Warriors scramble', date: '2026-12-04', start: '10:00', end: '17:00', utcStart: '2026-12-04T16:00:00.000Z', utcEnd: '2026-12-04T23:00:00.000Z' },
  { name: 'Promise Ball', date: '2027-05-01', start: '18:00', end: '22:00', utcStart: '2027-05-01T23:00:00.000Z', utcEnd: '2027-05-02T03:00:00.000Z' },
  { name: 'Keeping Kids In School Luncheon', date: '2027-05-07', start: '11:00', end: '13:00', utcStart: '2027-05-07T16:00:00.000Z', utcEnd: '2027-05-07T18:00:00.000Z' }
];

for (const f of FIXTURES) {
  test(`${f.name}: typed time becomes the right instant`, () => {
    assert.equal(zonedToUtc(f.date, f.start).toISOString(), f.utcStart);
    assert.equal(zonedToUtc(f.date, f.end).toISOString(), f.utcEnd);
  });

  test(`${f.name}: instant reads back as the typed time`, () => {
    const s = localParts(f.utcStart);
    assert.equal(s.date, f.date);
    assert.equal(s.time, f.start);
  });
}

test('an evening event in UTC tomorrow is still today in San Antonio', () => {
  // The Gala starts at 00:00 UTC on Nov 8. Shown as Nov 7.
  assert.equal(localParts('2026-11-08T00:00:00Z').date, '2026-11-07');
  assert.deepEqual(dateTile('2026-11-08T00:00:00Z'), { weekday: 'SAT', day: 7, month: 'NOV', year: 2026 });
});

test('daylight saving: the offset changes on Nov 1, 2026 and Mar 14, 2027', () => {
  assert.equal(zonedToUtc('2026-10-31', '12:00').toISOString(), '2026-10-31T17:00:00.000Z'); // CDT, -5
  assert.equal(zonedToUtc('2026-11-02', '12:00').toISOString(), '2026-11-02T18:00:00.000Z'); // CST, -6
  assert.equal(zonedToUtc('2027-03-13', '12:00').toISOString(), '2027-03-13T18:00:00.000Z'); // CST, -6
  assert.equal(zonedToUtc('2027-03-15', '12:00').toISOString(), '2027-03-15T17:00:00.000Z'); // CDT, -5
});

test('the day DST ends is 25 hours long, the day it starts is 23', () => {
  const fall = dayRange('2026-11-01');
  assert.equal((fall.end.getTime() - fall.start.getTime()) / 3_600_000, 25);
  const spring = dayRange('2027-03-14');
  assert.equal((spring.end.getTime() - spring.start.getTime()) / 3_600_000, 23);
});

test('month range runs from local midnight to local midnight', () => {
  const r = monthRange('2026-11');
  assert.equal(r.start.toISOString(), '2026-11-01T05:00:00.000Z');
  assert.equal(r.end.toISOString(), '2026-12-01T06:00:00.000Z');
});

test('month grid starts on the right weekday', () => {
  const grid = monthGrid('2026-11'); // Nov 1, 2026 is a Sunday
  assert.equal(grid[0]?.date, '2026-11-01');
  assert.equal(grid.length % 7, 0);
  const oct = monthGrid('2026-10'); // Oct 1, 2026 is a Thursday
  assert.equal(oct.findIndex((c) => c !== null), 4);
});

test('time ranges read the way people say them', () => {
  assert.equal(timeRange('2026-11-08T00:00:00Z', '2026-11-08T04:00:00Z'), '6:00 – 10:00 PM');
  assert.equal(timeRange('2026-10-17T15:00:00Z', '2026-10-17T19:00:00Z'), '10:00 AM – 2:00 PM');
  assert.equal(timeRange('2026-11-08T00:00:00Z', '2026-11-08T08:00:00Z'), '6:00 PM – Nov 8, 2:00 AM');
  assert.equal(timeRange('2026-11-07T06:00:00Z', '2026-11-08T06:00:00Z', true), 'All day');
});

test('date helpers', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(longDateFromString('2026-11-07'), 'Saturday, November 7, 2026');
  assert.equal(isDateString('2026-02-30'), false);
  assert.equal(isDateString('2026-02-28'), true);
});
