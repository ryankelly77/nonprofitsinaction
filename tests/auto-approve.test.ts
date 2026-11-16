import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoApproveRefusal } from '../lib/auto-approve.ts';

/*
 * Auto-approve is the only path that puts an event on the public calendar
 * with nobody reading it, so every reason it refuses is worth holding still.
 *
 * The rule that matters most is the last one: a trusted organization still
 * waits if the listing brings in a name nobody has read. Publishing an unread
 * name both puts it on the calendar and offers it to the next submitter as
 * something to pick, which is how one typo becomes two records for one
 * building.
 */

const trusted = { auto_approve: true, verified: true };
const checked = { verified: true };

test('a trusted organization at a known venue publishes', () => {
  assert.equal(autoApproveRefusal({ moderation: 'pending', organization: trusted, venue: checked, openQuestions: false }), null);
});

test('an event with no venue at all still publishes', () => {
  // Online events have no venue, and that is not a question about a name.
  assert.equal(autoApproveRefusal({ moderation: 'pending', organization: trusted, venue: null, openQuestions: false }), null);
});

test('an organization that has not been trusted waits', () => {
  const organization = { auto_approve: false, verified: true };
  assert.equal(autoApproveRefusal({ moderation: 'pending', organization, venue: checked, openQuestions: false }), 'not-trusted');
});

test('an event with no organization waits', () => {
  assert.equal(autoApproveRefusal({ moderation: 'pending', organization: null, venue: checked, openQuestions: false }), 'not-trusted');
});

test('anything already decided is left alone', () => {
  for (const moderation of ['approved', 'rejected']) {
    assert.equal(autoApproveRefusal({ moderation, organization: trusted, venue: checked, openQuestions: false }), 'not-pending');
  }
});

test('a name that looks like one already listed waits, however trusted the organization', () => {
  assert.equal(autoApproveRefusal({ moderation: 'pending', organization: trusted, venue: checked, openQuestions: true }), 'open-question');
});

test('a venue nobody has read yet waits, even with nothing to compare it against', () => {
  const venue = { verified: false };
  assert.equal(autoApproveRefusal({ moderation: 'pending', organization: trusted, venue, openQuestions: false }), 'unread-name');
});

test('an organization nobody has read yet waits, even when it is marked trusted', () => {
  const organization = { auto_approve: true, verified: false };
  assert.equal(autoApproveRefusal({ moderation: 'pending', organization, venue: checked, openQuestions: false }), 'unread-name');
});

test('the cheapest refusal is the one given', () => {
  // Not pending beats every other complaint, so the caller can refuse before
  // paying for the round trip that answers the name questions.
  const organization = { auto_approve: false, verified: false };
  assert.equal(autoApproveRefusal({ moderation: 'approved', organization, venue: { verified: false }, openQuestions: true }), 'not-pending');
});
