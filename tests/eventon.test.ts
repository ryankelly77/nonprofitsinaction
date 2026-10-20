import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  convertTimes,
  eventSlugs,
  parseAddress,
  parseTypedTime,
  plainText,
  readEntry,
  readEventonTime,
  venueKind,
  whichReadingMatches,
  type EventonExport
} from '../lib/eventon.ts';

const sample = JSON.parse(fs.readFileSync(new URL('./fixtures/eventon-sample.json', import.meta.url), 'utf8')) as EventonExport;
const byId = (id: number) => sample.events.find((e) => e.id === id)!;

test('both readings of an EventON number', () => {
  // Promise Ball, 6 PM CDT on May 1, 2027, is 23:00 UTC.
  const trueInstant = Date.parse('2027-05-01T23:00:00Z') / 1000;
  const wallClock = Date.parse('2027-05-01T18:00:00Z') / 1000;
  assert.equal(readEventonTime(trueInstant, 'instant').toISOString(), '2027-05-01T23:00:00.000Z');
  assert.equal(readEventonTime(wallClock, 'wallclock').toISOString(), '2027-05-01T23:00:00.000Z');
  assert.equal(whichReadingMatches(trueInstant, '2027-05-01', '18:00'), 'instant');
  assert.equal(whichReadingMatches(wallClock, '2027-05-01', '18:00'), 'wallclock');
});

test('a stored time that disagrees with the typed one is corrected and flagged', () => {
  const t = convertTimes(byId(118200), 'wallclock', { date: '2026-11-13', start: '18:00', endDate: '2026-11-13', end: '21:00' })!;
  assert.equal(t.starts_at, '2026-11-14T00:00:00.000Z'); // 6 PM CST
  assert.equal(t.ends_at, '2026-11-14T03:00:00.000Z');
  assert.deepEqual(t.flags, ['time-corrected']);
});

test('an unchecked event starting between midnight and 6 AM is flagged', () => {
  const t = convertTimes(byId(118200), 'wallclock')!;
  assert.deepEqual(t.flags, ['time-unverified']);
});

test('a time that agrees with the typed one is left alone', () => {
  const t = convertTimes(byId(118434), 'wallclock', { date: '2027-05-01', start: '18:00', endDate: '2027-05-01', end: '22:00' })!;
  assert.equal(t.starts_at, '2027-05-01T23:00:00.000Z');
  assert.deepEqual(t.flags, []);
});

test('midnight to 11:59 PM is stored as an all-day run', () => {
  const t = convertTimes(
    { id: 1, status: 'publish', title: 'Run', slug: 'run', content: '', date_gmt: '2026-02-16 17:36:39', featured_image: null, terms: [], meta: { evcal_srow: [String(Date.parse('2026-03-06T00:00:00Z') / 1000)], evcal_erow: [String(Date.parse('2026-03-08T23:59:00Z') / 1000)] } },
    'wallclock'
  )!;
  assert.equal(t.all_day, true);
  assert.equal(t.starts_at, '2026-03-06T06:00:00.000Z');
  assert.equal(t.ends_at, '2026-03-09T05:00:00.000Z'); // DST began Mar 8
  assert.deepEqual(t.flags, []);
});

test('all-day events become whole San Antonio days', () => {
  const t = convertTimes(byId(118461), 'wallclock')!;
  assert.equal(t.all_day, true);
  assert.equal(t.starts_at, '2026-12-12T06:00:00.000Z');
  assert.equal(t.ends_at, '2026-12-14T06:00:00.000Z');
});

test('Gravity Forms entries are read by label, event by event', () => {
  const e = readEntry(sample.entries[0], sample.forms[0]);
  assert.equal(e.organization, 'San Antonio Test Org');
  assert.equal(e.submitterName, 'Pat Doe');
  assert.equal(e.submitterEmail, 'pat@example.org');
  assert.equal(e.events.length, 2);
  assert.deepEqual([e.events[0].date, e.events[0].start, e.events[0].end], ['2026-11-13', '18:00', '21:00']);
  assert.equal(e.events[1].title, 'Cancelled Walk');
  assert.equal(parseTypedTime('12:15 am'), '00:15');
  assert.equal(parseTypedTime('12:15 PM'), '12:15');
});

test('addresses and online locations', () => {
  assert.deepEqual(parseAddress('3801 Broadway, San Antonio, TX 78209'), { line1: '3801 Broadway', city: 'San Antonio', state: 'TX', postal: '78209' });
  assert.equal(venueKind('Facebook Live'), 'online');
  assert.equal(venueKind('To Be Announced!'), 'undecided');
  assert.equal(venueKind('Witte Museum'), 'place');
});

test('an emoji slug gets a clean address and keeps the old one', () => {
  const s = eventSlugs(byId(118453));
  assert.equal(s.slug, 'art-rhythm-rhyme-a-family-art-adventure');
  assert.ok(s.legacy.includes('%e2%9c%a8-art-rhythm-rhyme-a-family-art-adventure'));
  assert.ok(s.legacy.includes('✨-art-rhythm-rhyme-a-family-art-adventure'));
});

test('post content becomes plain text', () => {
  assert.equal(plainText('<p>A night for <strong>T1D</strong> research.</p>[vc_row]'), 'A night for T1D research.');
});

test('the import script reads the sample export end to end (dry run)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npia-import-'));
  const script = path.resolve('scripts/import-eventon.ts');
  const out = execFileSync(process.execPath, ['--no-warnings', '--experimental-strip-types', script, path.resolve('tests/fixtures/eventon-sample.json')], { cwd: dir, encoding: 'utf8' });
  assert.match(out, /Stored as instants: 1. Stored as wall clock: 3. Matching neither: 1/);
  assert.match(out, /MIXED/);
  assert.match(out, /Dry run/);
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'import-report.json'), 'utf8'));
  const flagged = (id: number) => report.flagged.find((f: { postId: number }) => f.postId === id);
  assert.equal(report.times.majority, 'wallclock');
  assert.equal(report.counts.cancelled, 1);

  // Stored 10 hours late during the old bug; corrected from the form entry.
  assert.deepEqual(flagged(118200).flags, ['time-corrected']);
  assert.equal(flagged(118200).starts_at, '2026-11-14T00:00:00.000Z');

  // Its own entry says it was stored as a real instant: read that way, no time flag.
  assert.equal(flagged(117500).starts_at, '2025-04-10T16:00:00.000Z');
  assert.ok(!flagged(117500).flags.some((f: string) => f.startsWith('time-')));

  // No entry of its own, and the checked events around it disagree: flagged, not guessed silently.
  assert.ok(flagged(117501).flags.includes('time-unverified'));

  // Last year's edition of an annual event is not matched to this year's entry.
  assert.ok(!flagged(117000)?.flags.includes('time-corrected'));
  assert.ok(flagged(117000).starts_at.startsWith('2025-05-0'));

  // The duplicate lists now say which rule flagged a pair, and cover
  // organizations as well as venues.
  assert.deepEqual(report.venue_duplicates, [{ rule: 'distance', names: ['Witte Museum', 'Wittie Museum'] }]);
  assert.ok(Array.isArray(report.organization_duplicates));

  // The old site's holiday markers become holidays, not events.
  assert.equal(report.counts.holidays, 1);
  assert.equal(report.counts.events, 10);

  // Midnight to 11:59 PM over three days is an all-day run starting at local midnight.
  // (It is still flagged here only because this sample export is mixed.)
  assert.equal(flagged(118501).starts_at, '2026-03-06T06:00:00.000Z');
});

/*
 * Running the import again must add nothing and change nothing. In the
 * database that holds because every record is matched by the id it came in
 * with; what can be checked without a database is the step before it, that
 * the same export read twice decides on exactly the same records, names,
 * times and duplicate pairs. A reading that wandered between runs would move
 * events on the second pass even though the matching was sound.
 */
test('reading the same export twice decides exactly the same things', () => {
  const script = path.resolve('scripts/import-eventon.ts');
  const fixture = path.resolve('tests/fixtures/eventon-sample.json');
  // No Supabase settings: the run must not reach for a database to produce
  // its report, and the two runs must not differ by what one of them found.
  const env = { ...process.env };
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;

  const run = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'npia-again-'));
    execFileSync(process.execPath, ['--no-warnings', '--experimental-strip-types', script, fixture], { cwd: dir, encoding: 'utf8', env });
    const report = JSON.parse(fs.readFileSync(path.join(dir, 'import-report.json'), 'utf8'));
    delete report.generated_at; // the one thing that is meant to differ
    return report;
  };

  assert.deepEqual(run(), run());
});
