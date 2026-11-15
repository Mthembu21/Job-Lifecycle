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
