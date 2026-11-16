import assert from 'node:assert/strict';
import { test } from 'node:test';

/*
 * Whether the people who submitted listings are written to yet.
 *
 * The flag is read at import time, so each case sets the environment and then
 * imports a fresh copy of the module. Worth the awkwardness: the failure this
 * guards against is silent, and the people it would reach are real.
 */
async function emailSubmitters(value: string | undefined): Promise<boolean> {
  if (value === undefined) delete process.env.EMAIL_SUBMITTERS;
  else process.env.EMAIL_SUBMITTERS = value;
  // A query string makes it a different module specifier, so the cached copy
  // from an earlier case is not handed back.
  const mod = await import(`../lib/env.ts?case=${JSON.stringify(value)}`);
  return mod.EMAIL_SUBMITTERS;
}

test('unset means submitters are not emailed', async () => {
  assert.equal(await emailSubmitters(undefined), false);
});

test('only the word "on" turns it on', async () => {
  assert.equal(await emailSubmitters('on'), true);
});

test('anything else leaves it off, however much it looks like yes', async () => {
  // A half-set variable must never be read as permission to start emailing
  // people, so everything but the one word is off.
  for (const value of ['', 'off', 'true', '1', 'yes', 'ON', 'On', ' on', 'on ']) {
    assert.equal(await emailSubmitters(value), false, `EMAIL_SUBMITTERS=${JSON.stringify(value)} should be off`);
  }
});
