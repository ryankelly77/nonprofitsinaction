import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describeActor, describeChange } from '../lib/history.ts';

/*
 * Every shape the log actually holds, taken from the 230 rows in the
 * calendar today, plus the ones lib/edit.ts writes as events get edited.
 */

test('the commonest line in the admin says something', () => {
  // 219 of 230 rows are this one, and it used to render as raw JSON.
  assert.deepEqual(describeChange({ wordpress_post: 118442 }), ['Brought over from WordPress, post 118442']);
});

test('a merge says what happened to the listing, not which row it points at', () => {
  assert.deepEqual(describeChange({ venue_merged: { from: 'a', into: 'b' } }), ['Its venue was folded into another record']);
  assert.deepEqual(describeChange({ organization_merged: { from: 'a', into: 'b' } }), ['Its host was folded into another record']);
});

test('an edit reads as before and after', () => {
  assert.deepEqual(describeChange({ title: { from: 'Gala', to: '2027 Gala' } }), ['Name: Gala → 2027 Gala']);
});

test('an empty value is "nothing", not blank', () => {
  assert.deepEqual(describeChange({ ticket_url: { from: null, to: 'https://x.org' } }), ['Ticket link: nothing → https://x.org']);
  assert.deepEqual(describeChange({ description: { from: 'Some words', to: '' } }), ['Description: Some words → nothing']);
});

test('money reads as money, and free reads as free', () => {
  assert.deepEqual(describeChange({ price_cents: { from: null, to: 7500 } }), ['Cost: nothing → $75']);
  assert.deepEqual(describeChange({ price_cents: { from: 7500, to: 0 } }), ['Cost: $75 → free']);
});

test('a time reads as a time', () => {
  const [line] = describeChange({ starts_at: { from: '2026-11-07T23:00:00Z', to: '2026-11-08T00:00:00Z' } });
  assert.ok(line.startsWith('Start: '), line);
  assert.ok(!line.includes('T23:00'), `should not print the stored instant: ${line}`);
});

test('an id is not read out, because it tells a reviewer nothing', () => {
  const [line] = describeChange({ venue_id: { from: '26773f19-4e54-498f-a3af-83bca9682371', to: 'bfb5ce9e-3a1b-4f8e-9c2d-0a1b2c3d4e5f' } });
  assert.equal(line, 'Venue: another record → another record');
});

test('a boolean reads as yes or no', () => {
  assert.deepEqual(describeChange({ all_day: { from: false, to: true } }), ['All day: no → yes']);
});

test('a list reads as a list', () => {
  assert.deepEqual(describeChange({ legacy_slugs: { from: [], to: ['whole-child-whole-community-conference'] } }), [
    'Old addresses: nothing → whole-child-whole-community-conference'
  ]);
});

test('what an admin wrote is shown as written', () => {
  assert.deepEqual(describeChange({ reason: 'Duplicate listing.' }), ['Duplicate listing.']);
});

test('a flag clearing is a plain value, not a before and after', () => {
  assert.deepEqual(describeChange({ review_flags: 'cleared' }), ['Flags: cleared']);
});

test('a question put to the organizer is shown as written', () => {
  assert.deepEqual(describeChange({ asked: 'Where is this being held?' }), ['Where is this being held?']);
});

/*
 * Whether the question reached anybody is the point of logging it. A question
 * that was written and not sent is still waiting on somebody, and reading
 * "emailed: no" as though it were a field that changed would hide that.
 */
test('whether a question was emailed is said either way', () => {
  assert.deepEqual(describeChange({ asked: 'Which venue?', emailed: true }), ['Which venue?', 'Emailed to the organizer']);
  assert.deepEqual(describeChange({ asked: 'Which venue?', emailed: false }), ['Which venue?', 'Not emailed']);
});

test('a very long value is cut rather than filling the column', () => {
  const [line] = describeChange({ description: { from: null, to: 'x'.repeat(200) } });
  assert.ok(line.length < 120, `${line.length} characters is too many`);
  assert.ok(line.endsWith('…'));
});

test('nothing to add gives nothing', () => {
  assert.deepEqual(describeChange(null), []);
  assert.deepEqual(describeChange(undefined), []);
  assert.deepEqual(describeChange({}), []);
});

test('a field nobody has named still reads as words', () => {
  assert.deepEqual(describeChange({ some_new_column: { from: 1, to: 2 } }), ['some new column: 1 → 2']);
});

test('who did it reads as who did it', () => {
  assert.equal(describeActor('import'), 'the WordPress import');
  assert.equal(describeActor('admin:ryan@pearanalytics.com'), 'ryan@pearanalytics.com');
  assert.equal(describeActor('auto-approve'), 'auto-approve');
  assert.equal(describeActor('submitter'), 'the organizer');
});
