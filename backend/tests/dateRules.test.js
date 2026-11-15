const test = require('node:test');
const assert = require('node:assert/strict');

const {
  dayKey,
  futureDateProblems,
  dateOrderWarnings,
  checkJobDates,
} = require('../src/lib/dateRules');

// Form dates arrive as UTC midnight; Excel dates as South African midnight (22:00 UTC the day before).
const form = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
const excel = (ymd) => new Date(new Date(`${ymd}T00:00:00.000Z`).getTime() - 2 * 3600e3);
const NOW = new Date('2026-11-15T10:00:00.000Z');

test('form and Excel dates for the same day compare as the same day', () => {
  assert.equal(dayKey(form('2026-07-01')), '2026-07-01');
  assert.equal(dayKey(excel('2026-07-01')), '2026-07-01');
});

test('an actual date after today is a problem; today is fine', () => {
  assert.deepEqual(futureDateProblems({ closingDate: form('2026-11-15') }, NOW), []);
  const problems = futureDateProblems({ closingDate: form('2026-11-17'), jobCreatedDate: form('2026-11-16') }, NOW);
  assert.equal(problems.length, 2);
  assert.match(problems.join(' '), /Actual Job Closing can't be in the future/);
  assert.match(problems.join(' '), /Job Opening can't be in the future/);
});

test('dates in flow order give no warnings', () => {
  const dates = {
    dateReceived: form('2026-07-01'),
    jobCreatedDate: form('2026-07-02'),
    evaluationDate: form('2026-07-03'),
    epirocQuotationDate: form('2026-07-06'),
    purchaseOrderDate: form('2026-07-10'),
    repairStartDate: form('2026-07-11'),
    repairCompletionDate: form('2026-07-20'),
    actualAssemblyDate: form('2026-07-18'), // assembly may come before Repair End
    dispatchDate: form('2026-07-21'),
    invoiceDate: form('2026-07-22'),
    closingDate: form('2026-07-22'),
  };
  assert.deepEqual(dateOrderWarnings(dates), []);
});

test('a date before the step it follows is reported once, against the closest step', () => {
  const warnings = dateOrderWarnings({
    jobCreatedDate: form('2026-07-01'),
    repairStartDate: form('2026-07-20'),
    repairCompletionDate: form('2026-07-10'),
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^Repair End \(.*\) is before Repair Start/);
});

test('only problems involving the dates being saved are reported', () => {
  const dates = {
    jobCreatedDate: form('2026-07-10'),
    evaluationDate: form('2026-07-01'), // old mistake
    dispatchDate: form('2026-08-01'),
    closingDate: form('2026-07-20'),
  };
  const warnings = dateOrderWarnings(dates, ['closingDate']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^Actual Job Closing/);
});

test('go-ahead with no quote date is flagged', () => {
  const warnings = dateOrderWarnings({ jobCreatedDate: form('2026-07-01'), purchaseOrderDate: form('2026-07-05') });
  assert.match(warnings.join(' '), /no Date Quoted/);
});

test('checkJobDates: future dates are blocked even when warnings are confirmed', () => {
  assert.throws(
    () => checkJobDates({}, { jobCreatedDate: form('2026-11-20') }, { confirmDateWarnings: true }, NOW),
    (err) => err.status === 400 && /in the future/.test(err.message)
  );
});

test('checkJobDates: out-of-order dates need confirming, then save', () => {
  const current = { jobCreatedDate: form('2026-07-10') };
  const changes = { evaluationDate: form('2026-07-01') };
  assert.throws(
    () => checkJobDates(current, changes, {}, NOW),
    (err) => err.status === 409 && err.extra.dateWarnings.length === 1
  );
  assert.doesNotThrow(() => checkJobDates(current, changes, { confirmDateWarnings: true }, NOW));
});
