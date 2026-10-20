import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameKey, similarNames, similarPairs } from '../lib/names.ts';

/*
 * The names in here are real ones out of the WordPress export. The pairs that
 * must share a key are the ones the old site treated as one record and this
 * one has to as well; the pairs that must not are the traps, places whose
 * names differ by a single word that changes which building you drive to.
 *
 * public.name_key() in supabase/migrations has to agree with nameKey() on all
 * of them. The test suite has no database, so the two were compared by
 * running both over every venue and organizer name in the export; see the
 * note at the top of the migration.
 */

test('one name, one record', () => {
  const same: Array<[string, string]> = [
    ['The Whitley Event Center', 'Whitley Event Center'],
    ['Quarry Golf Club', 'The Quarry Golf Club'],
    ['The Tobin Center for the Performing Arts', 'Tobin Center for the Performing Arts'],
    ['San Antonio Council on Alcohol & Drug Awareness', 'San Antonio Council on Alcohol and Drug Awareness'],
    ['Special Reach', 'Special Reach Inc.'],
    ['Ronald McDonald House Charities of San Antonio, Texas', 'Ronald McDonald House Charities of San Antonio, Texas, Inc.'],
    ['Henry B. González Convention Center', 'Henry B. Gonzalez Convention Center']
  ];
  for (const [a, b] of same) assert.equal(nameKey(a), nameKey(b), `${a} / ${b}`);
});

test('names that only look alike keep their own records', () => {
  const apart: Array<[string, string]> = [
    ['World Car Kia North', 'World Car Kia South'],
    ['San Antonio Public Library - Carver', 'San Antonio Public Library - Central'],
    ['TPC San Antonio', 'UT San Antonio']
  ];
  for (const [a, b] of apart) assert.notEqual(nameKey(a), nameKey(b), `${a} / ${b}`);
});

test('the leading "the" goes as a word, not as three letters', () => {
  assert.equal(nameKey('Theater Row'), 'theaterrow');
  assert.equal(nameKey('The Atrium'), 'atrium');
  // A name that is only the word it would drop keeps it: an empty key would
  // match every other empty key.
  assert.equal(nameKey('The'), 'the');
  assert.equal(nameKey('Inc'), 'inc');
  assert.equal(nameKey('The Inc'), 'inc');
  assert.equal(nameKey(''), '');
  assert.equal(nameKey('   '), '');
});

test('only the last trailing company word goes', () => {
  assert.equal(nameKey('Special Reach LLC'), 'specialreach');
  assert.equal(nameKey('Special Reach Incorporated'), 'specialreach');
  // Not a suffix, part of the name.
  assert.equal(nameKey('Girls Inc. of San Antonio'), 'girlsincofsanantonio');
});

test('names close enough for a person to look at', () => {
  const flagged: Array<[string, string]> = [
    ['Shrine Auditorium', 'San Antonio Shrine Auditorium'],
    ['San Antonio Marriott Rivercenter', 'San Antonio Marriott Rivercenter Hotel'],
    ['Witte Museum', 'Wittie Museum'],
    ['Family Service', 'Family Service Association of San Antonio'],
    // A real, separate venue inside the first. Flagged anyway; the admin says
    // "Not the same" once and is not asked again.
    ['Witte Museum', 'Witte Museum - Mays Family Center']
  ];
  for (const [a, b] of flagged) assert.ok(similarNames(a, b), `${a} / ${b} should be flagged`);
});

test('similarNames says which rule flagged a pair', () => {
  assert.equal(similarNames('The Quarry Golf Club', 'Quarry Golf Club'), 'same');
  assert.equal(similarNames('Shrine Auditorium', 'San Antonio Shrine Auditorium'), 'contains');
  assert.equal(similarNames('Witte Museum', 'Wittie Museum'), 'distance');
  assert.equal(similarNames('Witte Museum - Mays Family Center', 'Witte Museum - Prassel Auditorium'), 'head');
  /*
   * The rules are tried in the old report's order, so the first one that
   * fits is the answer. These two branches match ahead of the dash: six
   * edits apart out of thirty-four is under a fifth, so "distance" gets
   * there before "head" does. Either way a person is asked.
   */
  assert.equal(similarNames('San Antonio Public Library - Carver', 'San Antonio Public Library - Central'), 'distance');
  assert.equal(similarNames('Witte Museum', 'Retama Park'), null);
  assert.equal(similarNames('', 'Witte Museum'), null);
});

test('a short name inside a longer one is not enough on its own', () => {
  // "contains" needs the shorter name to be at least 10 characters, or every
  // organization with a short name would swallow the ones that mention it.
  assert.equal(similarNames('CASA', 'CASA Gala Committee'), null);
});

test('similarPairs finds each pair once', () => {
  const pairs = similarPairs(['Witte Museum', 'Wittie Museum', 'Quarry Golf Club', 'The Quarry Golf Club', 'Retama Park'], (n) => n);
  assert.deepEqual(
    pairs.map((p) => [p.a, p.b, p.rule]),
    [
      ['Witte Museum', 'Wittie Museum', 'distance'],
      ['Quarry Golf Club', 'The Quarry Golf Club', 'same']
    ]
  );
});
