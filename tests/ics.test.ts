import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldLine } from '../lib/ics.ts';
import { isoWithOffset } from '../lib/time.ts';

test('long calendar lines fold at 75 octets', () => {
  const line = `DESCRIPTION:${'x'.repeat(200)}`;
  const folded = foldLine(line).split('\r\n');
  assert.ok(folded.every((l) => Buffer.byteLength(l) <= 75));
  assert.equal(folded.map((l, i) => (i ? l.slice(1) : l)).join(''), line);
});

test('folding never splits a multi-byte character', () => {
  const line = `SUMMARY:${'é'.repeat(80)}`;
  for (const l of foldLine(line).split('\r\n')) assert.ok(!l.includes('�'));
});

test('schema.org dates carry the Central offset for the season', () => {
  assert.equal(isoWithOffset('2026-11-08T00:00:00Z'), '2026-11-07T18:00:00-06:00');
  assert.equal(isoWithOffset('2027-05-01T23:00:00Z'), '2027-05-01T18:00:00-05:00');
});

test('text values escape semicolons, commas, backslashes and every line break', async () => {
  const { eventLines } = await import('../lib/ics.ts');
  const lines = eventLines(
    {
      id: 'x',
      slug: 's',
      title: 'Gala; dinner, and dance\\ show\rnight',
      description: null,
      format: 'in_person',
      starts_at: '2026-11-08T00:00:00Z',
      ends_at: '2026-11-08T04:00:00Z',
      all_day: false,
      time_zone: 'America/Chicago',
      online_url: null,
      ticket_url: null,
      image_path: null,
      status: 'scheduled',
      featured: false,
      published_at: null,
      organization: { id: 'o', name: 'Friends "of" the Park', slug: 'f', cause_slug: null },
      venue: null,
      event_type: null
    },
    'https://example.org'
  );
  assert.ok(lines.includes('SUMMARY:Gala\\; dinner\\, and dance\\\\ show\\nnight'));
  assert.ok(lines.includes('ORGANIZER;CN="Friends of the Park":mailto:noreply@nonprofitsinaction.org'));
});
