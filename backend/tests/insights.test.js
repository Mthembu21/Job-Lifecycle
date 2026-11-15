const test = require('node:test');
const assert = require('node:assert/strict');

const { buildInsights, customerKey } = require('../src/lib/insights');
const { toJobDto } = require('../src/modules/jobs/jobs.dto');

const NOW = new Date('2026-11-15T10:00:00.000Z');
const d = (ymd) => new Date(`${ymd}T00:00:00.000Z`);
let seq = 0;

/** A job as Prisma returns it (with the list relations), defaults filled in. */
function job({ customer = 'IVANPLATS', opened = '2026-11-01', jobType = 'CUSTOMER_REPAIR', poValue = 1000, woNumber = 'WO1', quotation = null, repair = null, dispatch = null, invoice = null } = {}) {
  seq++;
  return {
    id: `j${seq}`, referenceNumber: `REF${seq}`, description: 'x', customer, serialNumber: 'N/A',
    partNumber: null, machineNumber: null, machineSerialNumber: null, customerRef: null, customerAccount: null,
    dateReceived: null, woNumber, woNumberSetAt: woNumber ? d(opened) : null, poNumber: null, jobType, poValue,
    priority: 'MEDIUM', jobCreatedDate: d(opened), comments: null, forecastMonth: null, forecastAmount: null,
    isLegacyImport: false, legacySheetRow: null, createdById: 'u', createdBy: { id: 'u', name: 'U' },
    quotation: quotation && { quotedBy: null, ...quotation }, repair, dispatch: dispatch && { dispatchedBy: null, ...dispatch }, invoice,
    createdAt: d(opened), updatedAt: d(opened),
  };
}
const build = (jobs) => buildInsights(jobs.map((j) => toJobDto(j, NOW)), NOW, () => true);

test('delays by stage add up to the open jobs and the delayed ones', () => {
  const insights = build([
    job({ opened: '2026-11-13' }), // quotation, 2 days — on track
    job({ opened: '2026-10-01' }), // quotation, 45 days — past the 7-day target
    job({ opened: '2026-09-01', quotation: { epirocQuotationDate: d('2026-09-05') } }), // awaiting PO, late
    job({ opened: '2026-09-01', quotation: { epirocQuotationDate: d('2026-09-05') }, repair: { purchaseOrderDate: d('2026-09-10'), repairCompletionDate: d('2026-09-20') }, dispatch: { dispatchDate: d('2026-09-21') }, invoice: { invoiceDate: d('2026-09-22'), closingDate: d('2026-09-22') } }), // closed
  ]);
  const quote = insights.delaysByStage.find((s) => s.stage === 'QUOTATION');
  const po = insights.delaysByStage.find((s) => s.stage === 'AWAITING_PO');
  assert.deepEqual([quote.total, quote.delayed, po.total, po.delayed], [2, 1, 1, 1]);
  assert.equal(insights.waitingTime.reduce((s, b) => s + b.value, 0), 3, 'every open job is in one bucket');
  assert.equal(insights.overdueCount, 2);
  assert.equal(insights.overdue[0].daysOver >= insights.overdue[1].daysOver, true, 'worst first');
});

test('a job whose stage starts in the future still counts in the waiting-time chart', () => {
  const insights = build([job({ opened: '2026-11-28' })]);
  assert.equal(insights.waitingTime[0].value, 1);
});

test('customer names group however they were typed', () => {
  assert.equal(customerKey('  Sasol   Thubelisha '), customerKey('SASOL THUBELISHA'));
  const insights = build([job({ customer: 'SASOL  THUBELISHA' }), job({ customer: 'SASOL THUBELISHA' }), job({ customer: 'Sasol Thubelisha ' })]);
  assert.equal(insights.customers.length, 1);
  assert.equal(insights.customers[0].openJobs, 3);
  assert.equal(insights.customers[0].customer, 'SASOL THUBELISHA', 'the most-used spelling');
});

test('open value per customer leaves out warranty work and falls back to the quote amount', () => {
  const insights = build([
    job({ poValue: 0, quotation: { quotationAmount: 500, epirocQuotationDate: null } }),
    job({ jobType: 'WARRANTY', poValue: 9999 }),
  ]);
  assert.equal(insights.customers[0].openValue, 500);
});

test('delay reasons group loosely and ignore empty filler', () => {
  const late = (reason) => job({ opened: '2026-09-01', quotation: { epirocQuotationDate: d('2026-10-20'), delayReason: reason } });
  const insights = build([late('Waiting for spares.'), late('waiting for  spares'), late('.....'), late('Customer approval')]);
  assert.deepEqual(insights.delayReasons.map((r) => [r.reason, r.count]), [['Waiting for spares.', 2], ['Customer approval', 1]]);
});

test('jobs out at a supplier and jobs without a WO number are listed', () => {
  const insights = build([
    job({ woNumber: null, opened: '2026-10-01' }),
    job({ quotation: { epirocQuotationDate: d('2026-11-02') }, repair: { purchaseOrderDate: d('2026-11-03'), outworkDateSent: d('2026-11-05'), supplierName: 'Rea\'s' } }),
  ]);
  assert.equal(insights.awaitingWo.length, 1);
  assert.equal(insights.awaitingWo[0].daysWaiting, 45);
  assert.equal(insights.outwork.count, 1);
  assert.equal(insights.outwork.atSupplier[0].supplier, 'Rea\'s');
});
