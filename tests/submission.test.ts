import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSubmission } from '../lib/submission.ts';

const ctx = {
  today: '2026-10-19',
  typeSlugs: new Set(['gala', 'luncheon', 'run-walk']),
  causeSlugs: new Set(['education', 'animals']),
  now: 1_000_000
};

function base(overrides: Record<string, unknown> = {}) {
  return {
    organization: { name: 'Child Advocates San Antonio', cause: 'education', sector: 'nonprofit' },
    submitter: { name: 'Pat Doe', email: 'Pat@Example.org ' },
    events: [
      {
        title: 'Gallery of Hope Gala',
        type: 'gala',
        format: 'in_person',
        date: '2026-11-07',
        start: '18:00',
        end: '22:00',
        allDay: false,
        venue: { id: '00000000-0000-4000-b000-000000000002' },
        ticketUrl: 'https://casa-satx.org'
      }
    ],
    website: '',
    startedAt: 1_000_000 - 60_000,
    ...overrides
  };
}

test('a good submission becomes UTC instants and a lower-cased email', () => {
  const r = parseSubmission(base(), ctx);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.bot, false);
  assert.equal(r.value.submitter.email, 'pat@example.org');
  assert.equal(r.value.events[0].starts_at, '2026-11-08T00:00:00.000Z');
  assert.equal(r.value.events[0].ends_at, '2026-11-08T04:00:00.000Z');
  assert.deepEqual(r.value.events[0].venue, { id: '00000000-0000-4000-b000-000000000002' });
});

test('an end time before the start time is caught and keyed to the field', () => {
  const b = base();
  (b.events as Array<Record<string, unknown>>)[0].end = '09:00';
  const r = parseSubmission(b, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors['events.0.end'], /ends before it starts/);
});

test('an event past midnight works when it ends the next day', () => {
  const b = base();
  Object.assign((b.events as Array<Record<string, unknown>>)[0], { start: '20:00', end: '01:00', endDate: '2026-11-08' });
  const r = parseSubmission(b, ctx);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].ends_at, '2026-11-08T07:00:00.000Z');
});

test('all-day events run local midnight to local midnight', () => {
  const b = base();
  Object.assign((b.events as Array<Record<string, unknown>>)[0], { allDay: true, start: undefined, end: undefined });
  const r = parseSubmission(b, ctx);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].starts_at, '2026-11-07T06:00:00.000Z');
  assert.equal(r.value.events[0].ends_at, '2026-11-08T06:00:00.000Z');
});

test('past dates, unknown types and missing venues are refused', () => {
  const b = base();
  Object.assign((b.events as Array<Record<string, unknown>>)[0], { date: '2026-10-01', type: 'rodeo', venue: null });
  const r = parseSubmission(b, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors['events.0.date']);
  assert.ok(r.errors['events.0.type']);
  assert.ok(r.errors['events.0.venue']);
});

test('online events need a link but no venue', () => {
  const b = base();
  Object.assign((b.events as Array<Record<string, unknown>>)[0], { format: 'virtual', venue: null });
  let r = parseSubmission(b, ctx);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors['events.0.onlineUrl']);
  Object.assign((b.events as Array<Record<string, unknown>>)[0], { onlineUrl: 'https://zoom.us/j/1' });
  r = parseSubmission(b, ctx);
  assert.equal(r.ok, true);
});

test('a new venue typed by hand is carried through', () => {
  const b = base();
  Object.assign((b.events as Array<Record<string, unknown>>)[0], { venue: { name: 'The Witte', address: '3801 Broadway', city: 'San Antonio' } });
  const r = parseSubmission(b, ctx);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value.events[0].venue, { new: { name: 'The Witte', address: '3801 Broadway', city: 'San Antonio', postalCode: null } });
});

test('javascript: links are refused', () => {
  const b = base();
  (b.events as Array<Record<string, unknown>>)[0].ticketUrl = 'javascript:alert(1)';
  const r = parseSubmission(b, ctx);
  assert.equal(r.ok, false);
});

test('the honeypot and a too-fast form mark a bot', () => {
  let r = parseSubmission(base({ website: 'spam.example' }), ctx);
  assert.equal(r.ok && r.bot, true);
  r = parseSubmission(base({ startedAt: ctx.now - 1000 }), ctx);
  assert.equal(r.ok && r.bot, true);
});

/*
 * Cost. The field has three states and only one of them is a number, so the
 * tests that matter are about telling "free" apart from "nobody said".
 */

function withCost(cost: unknown, priceMin?: string, priceMax?: string) {
  const e = { ...base().events[0], cost, priceMin, priceMax };
  return parseSubmission(base({ events: [e] }), ctx);
}

test('saying nothing about cost is allowed and stores nothing', () => {
  const r = parseSubmission(base(), ctx);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].price_cents, null);
  assert.equal(r.value.events[0].price_max_cents, null);
});

test('free is stored as zero, not as nothing', () => {
  const r = withCost('free');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].price_cents, 0);
  assert.equal(r.value.events[0].price_max_cents, null);
});

test('one price is stored in cents', () => {
  const r = withCost('paid', '$75');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].price_cents, 7500);
  assert.equal(r.value.events[0].price_max_cents, null);
});

test('a range is kept as a range', () => {
  const r = withCost('paid', '50', '250');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].price_cents, 5000);
  assert.equal(r.value.events[0].price_max_cents, 25000);
});

test('one price written twice is one price', () => {
  const r = withCost('paid', '75', '75');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].price_max_cents, null);
});

test('saying it costs money without saying how much is refused', () => {
  const r = withCost('paid', '');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors['events.0.priceMin']);
});

test('a price that is not a number is refused rather than dropped', () => {
  const r = withCost('paid', 'call us');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors['events.0.priceMin']);
});

test('a range that runs backwards is refused', () => {
  const r = withCost('paid', '250', '50');
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors['events.0.priceMax']);
});

test('a price left over from a change of mind is ignored', () => {
  // The form stops sending the amounts when cost goes back to free, and the
  // server does not read them either way.
  const r = withCost('free', '75', '250');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.events[0].price_cents, 0);
  assert.equal(r.value.events[0].price_max_cents, null);
});
