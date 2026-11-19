import assert from 'node:assert/strict';
import { test } from 'node:test';
import { meansOn } from '../lib/settings.ts';

/*
 * Whether the people who submitted listings are written to yet.
 *
 * This was an environment variable read at import time, and is now a row in
 * site_settings an admin can change under "Lists". What is worth holding on
 * to is the same either way, and it is not where the value is kept: it is
 * that only one exact value turns it on. The failure this guards against is
 * silent, and the people it would reach are real.
 */

test('nothing stored means submitters are not emailed', () => {
  assert.equal(meansOn(null), false);
});

test('only the word "on" turns it on', () => {
  assert.equal(meansOn('on'), true);
});

test('anything else leaves it off, however much it looks like yes', () => {
  for (const value of ['', 'off', 'true', '1', 'yes', 'ON', 'On', ' on', 'on ']) {
    assert.equal(meansOn(value), false, `a stored value of ${JSON.stringify(value)} should be off`);
  }
});
