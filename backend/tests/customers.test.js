const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeCustomerName, customerMatchKey, findMatchingCustomer, customerNameProblem } = require('../src/lib/customers');

test('names are stored in capitals with single spaces', () => {
  assert.equal(normalizeCustomerName('  Sasol   thubelisha '), 'SASOL THUBELISHA');
  assert.equal(normalizeCustomerName('sasol-impumelelo'), 'SASOL-IMPUMELELO');
});

test('names that differ only by spaces, case or punctuation are the same customer', () => {
  const list = [{ name: 'IVANPLATS' }, { name: 'EPIROC BOTSWANA' }];
  assert.equal(findMatchingCustomer('Ivan Plats', list)?.name, 'IVANPLATS');
  assert.equal(findMatchingCustomer('epiroc-botswana', list)?.name, 'EPIROC BOTSWANA');
  assert.equal(findMatchingCustomer('EPIROC ZAMBIA', list), undefined);
  assert.equal(customerMatchKey('Moab  Khotsong'), customerMatchKey('MOAB-KHOTSONG'));
});

test('empty or letter-less names are refused', () => {
  assert.ok(customerNameProblem('  '));
  assert.ok(customerNameProblem('....'));
  assert.ok(customerNameProblem('1234'));
  assert.equal(customerNameProblem('Afrimat'), null);
});

test('every Sasol site is the one customer SASOL', () => {
  const list = [{ name: 'SASOL' }, { name: 'IVANPLATS' }];
  for (const typed of ['SASOL IMPUMELELO', 'Sasol-Shondoni', 'sasol  thubelisha', 'SASOL']) {
    assert.equal(findMatchingCustomer(typed, list)?.name, 'SASOL', typed);
  }
  assert.match(customerNameProblem('SASOL IMPUMELELO'), /use SASOL/);
  assert.equal(customerNameProblem('SASOL'), null);
});

test('names one or two letters off, or inside another name, look like a typo of it', () => {
  const { namesLookAlike, similarCustomers } = require('../src/lib/customers');
  assert.ok(namesLookAlike('WESSEL', 'WESSELS'));
  assert.ok(namesLookAlike('IVANPLATZ', 'IVANPLATS'));
  assert.ok(namesLookAlike('IVNAPLATS', 'IVANPLATS')); // swapped letters
  assert.ok(namesLookAlike('BOOYSENDAAL', 'BOOYSENDAL'));
  assert.ok(namesLookAlike('SOUTH DEEP MINE', 'SOUTH DEEP'));
  assert.ok(namesLookAlike('Exaro', 'EXXARO'));
  assert.ok(!namesLookAlike('IVANPLATS', 'IVAN PLATS'), 'same customer is handled by the exact match, not here');
  assert.ok(!namesLookAlike('EPIROC ZAMBIA', 'EPIROC BOTSWANA'));
  assert.ok(!namesLookAlike('ABC', 'ABD'), 'very short names are only compared exactly');
  const list = [{ name: 'WESSELS' }, { name: 'MARULA' }];
  assert.deepEqual(similarCustomers('wessel', list).map((c) => c.name), ['WESSELS']);
});

test("today's customer list has no look-alike pairs apart from WESSEL / WESSELS", () => {
  const { namesLookAlike } = require('../src/lib/customers');
  const names = ['AFRIMAT', 'BARBERTON', 'BOKONI', 'BOOYSENDAL', 'EPIROC BOTSWANA', 'EVANDER', 'EXXARO', 'IVANPLATS',
    'MARC CONTRACT', 'MARULA', 'MOAB KHOTSONG', 'MOGALAKWENA', 'MPONENG', 'PLANTCOR', 'REDPATH', 'SASOL', 'SOUTH DEEP',
    'STUART COAL', 'WESSELS', 'WESSEL'];
  const pairs = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (namesLookAlike(names[i], names[j])) pairs.push(`${names[i]}/${names[j]}`);
  assert.deepEqual(pairs, ['WESSELS/WESSEL']);
});
