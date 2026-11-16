import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksLikeEmail, refuseInvite, refuseRemove, refuseSetSuper, tidyEmail, type AdminRow } from '../lib/admins.ts';

/*
 * The admin list is the one place where a wrong answer locks everybody out of
 * the page that would put it right, so the two things that must stay true are
 * tested from every direction: there is always a super admin, and nobody
 * removes themselves.
 */

const ryan: AdminRow = { email: 'ryan@pearanalytics.com', super_admin: true };
const dana: AdminRow = { email: 'dana@tncouncil.org', super_admin: false };
const sam: AdminRow = { email: 'sam@tncouncil.org', super_admin: true };

test('an ordinary admin cannot change the list at all', () => {
  const list = [ryan, dana];
  assert.equal(refuseRemove(list, dana.email, ryan.email), 'not-super');
  assert.equal(refuseSetSuper(list, dana.email, dana.email, true), 'not-super');
  assert.equal(refuseInvite(list, dana.email, 'new@example.org'), 'not-super');
});

test('somebody who is not on the list at all is refused', () => {
  assert.equal(refuseRemove([ryan], 'stranger@example.org', ryan.email), 'not-super');
  assert.equal(refuseInvite([ryan], 'stranger@example.org', 'new@example.org'), 'not-super');
});

test('a super admin may remove an ordinary admin', () => {
  assert.equal(refuseRemove([ryan, dana], ryan.email, dana.email), null);
});

test('nobody removes themselves', () => {
  // Even with another super admin to fall back on: the point is that it is
  // always an accident.
  assert.equal(refuseRemove([ryan, sam], ryan.email, ryan.email), 'self');
});

test('the last super admin cannot be removed or stood down', () => {
  const list = [ryan, dana];
  assert.equal(refuseSetSuper(list, ryan.email, ryan.email, false), 'last-super');
  // And not by way of removing them, either.
  assert.equal(refuseRemove([ryan, dana], dana.email, ryan.email), 'not-super');
});

test('a second super admin frees the first to stand down', () => {
  const list = [ryan, sam, dana];
  assert.equal(refuseSetSuper(list, ryan.email, ryan.email, false), null);
  assert.equal(refuseRemove(list, sam.email, ryan.email), null);
});

test('removing an address that is not on the list says so', () => {
  assert.equal(refuseRemove([ryan], ryan.email, 'nobody@example.org'), 'unknown');
  assert.equal(refuseSetSuper([ryan], ryan.email, 'nobody@example.org', true), 'unknown');
});

test('a change that is already true is refused rather than written again', () => {
  assert.equal(refuseSetSuper([ryan, dana], ryan.email, ryan.email, true), 'already');
  assert.equal(refuseInvite([ryan, dana], ryan.email, dana.email), 'already');
});

test('inviting somebody new is allowed', () => {
  assert.equal(refuseInvite([ryan], ryan.email, 'new@tncouncil.org'), null);
});

test('addresses are compared after tidying, so case and spaces never duplicate a person', () => {
  assert.equal(tidyEmail('  Dana@TNCouncil.org '), 'dana@tncouncil.org');
  assert.equal(refuseInvite([ryan, dana], ryan.email, tidyEmail(' DANA@tncouncil.org ')), 'already');
});

test('what counts as an email address', () => {
  assert.ok(looksLikeEmail('dana@tncouncil.org'));
  assert.ok(!looksLikeEmail('dana'));
  assert.ok(!looksLikeEmail('dana@tncouncil'));
  assert.ok(!looksLikeEmail('dana @tncouncil.org'));
  assert.ok(!looksLikeEmail(''));
});
