import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPrice, parsePrice, priceLabel } from '../lib/money.ts';

test('a price is read however it is typed', () => {
  assert.equal(parsePrice('75'), 7500);
  assert.equal(parsePrice('$75'), 7500);
  assert.equal(parsePrice(' 75 '), 7500);
  assert.equal(parsePrice('75.00'), 7500);
  assert.equal(parsePrice('74.99'), 7499);
  assert.equal(parsePrice('1,250'), 125000);
  assert.equal(parsePrice('$1,250.50'), 125050);
});

test('free is zero, which is not nothing', () => {
  // The difference that the whole field turns on: 0 is free, null is nobody
  // said. A falsy check on this would call a free event unpriced.
  assert.equal(parsePrice('0'), 0);
  assert.equal(parsePrice('$0.00'), 0);
  assert.notEqual(parsePrice('0'), null);
});

test('what is not a price is refused rather than guessed at', () => {
  for (const bad of ['', '   ', 'free', 'TBD', 'call us', '$', '-5', '1.234', 'NaN', '1e5', '75$', '$$75']) {
    assert.equal(parsePrice(bad), null, bad);
  }
  assert.equal(parsePrice(null), null);
  assert.equal(parsePrice(undefined), null);
});

test('an absurd amount is refused', () => {
  assert.equal(parsePrice('1000000'), 100000000);
  assert.equal(parsePrice('1000001'), null);
});

test('money is kept in cents, so the arithmetic is exact', () => {
  // 74.99 as a float times 100 is 7498.999999999999; rounding is what keeps
  // the stored value honest.
  assert.equal(parsePrice('74.99'), 7499);
  assert.equal(parsePrice('0.07'), 7);
  assert.equal(parsePrice('19.99'), 1999);
});

test('whole dollars read as whole dollars', () => {
  assert.equal(formatPrice(7500), '$75');
  assert.equal(formatPrice(7499), '$74.99');
  assert.equal(formatPrice(0), '$0');
  assert.equal(formatPrice(125000), '$1,250');
});

test('the label says what a person would say', () => {
  assert.equal(priceLabel(0, null), 'Free');
  assert.equal(priceLabel(0, 0), 'Free');
  assert.equal(priceLabel(7500, null), '$75');
  assert.equal(priceLabel(7500, 7500), '$75');
  assert.equal(priceLabel(5000, 25000), '$50 to $250');
  assert.equal(priceLabel(0, 25000), 'Free to $250');
});

test('no price means no label, rather than a wrong one', () => {
  assert.equal(priceLabel(null, null), null);
  assert.equal(priceLabel(null, 25000), null);
});
