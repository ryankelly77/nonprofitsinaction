import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressFromComponents } from '../lib/address.ts';

/*
 * Turning Google's pieces into the four fields the database keeps. Real
 * responses, trimmed to the components that matter.
 */

const witte = [
  { longText: '3801', shortText: '3801', types: ['street_number'] },
  { longText: 'Broadway Street', shortText: 'Broadway St', types: ['route'] },
  { longText: 'San Antonio', shortText: 'San Antonio', types: ['locality', 'political'] },
  { longText: 'Texas', shortText: 'TX', types: ['administrative_area_level_1', 'political'] },
  { longText: '78209', shortText: '78209', types: ['postal_code'] }
];

test('a full address comes apart into the four fields', () => {
  assert.deepEqual(addressFromComponents(witte), {
    line1: '3801 Broadway Street',
    city: 'San Antonio',
    state: 'TX',
    postal: '78209'
  });
});

test('the state is taken short, because that is how an address is written', () => {
  // "Texas" is the long form; the column holds "TX" everywhere else.
  assert.equal(addressFromComponents(witte).state, 'TX');
});

test('a street with no number is still worth having', () => {
  const plaza = [
    { longText: 'Hemisfair Plaza Way', shortText: 'Hemisfair Plaza Way', types: ['route'] },
    { longText: 'San Antonio', shortText: 'San Antonio', types: ['locality'] }
  ];
  assert.equal(addressFromComponents(plaza).line1, 'Hemisfair Plaza Way');
});

test('a number with no street is not an address', () => {
  const nonsense = [{ longText: '3801', shortText: '3801', types: ['street_number'] }];
  assert.equal(addressFromComponents(nonsense).line1, null);
});

test('missing pieces come back null rather than empty or guessed', () => {
  assert.deepEqual(addressFromComponents([]), { line1: null, city: null, state: null, postal: null });
  assert.deepEqual(addressFromComponents(undefined), { line1: null, city: null, state: null, postal: null });
});

test('a town that is not a locality is still a city', () => {
  const boerne = [
    { longText: '33 Herff Road', shortText: '33 Herff Rd', types: ['route'] },
    { longText: 'Boerne', shortText: 'Boerne', types: ['postal_town'] }
  ];
  assert.equal(addressFromComponents(boerne).city, 'Boerne');
});
