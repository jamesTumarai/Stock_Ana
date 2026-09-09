import assert from 'node:assert/strict';
import { describeDcfFinancialSource } from '../dcfSourceDescriptor';

console.log('Running DCF source descriptor checks...');

{
  const descriptor = describeDcfFinancialSource({
    ticker: 'AAPL',
    currentPrice: 250,
    startingRevenueM: 420000,
    sharesOutstandingM: 14594,
    netCashM: -40000,
    waccPct: 9,
    terminalGrowthPct: 3,
    projectionYears: 5,
    isValid: true,
    sourcePeriod: 'Q4 2025–Q3 2026',
    financialDataSource: 'sec_verified',
    financialDataAsOf: '2026-06-27',
    sharesAsOf: '2026-07-17',
  });
  assert.equal(descriptor.kind, 'sec_verified');
  assert.match(descriptor.labelEn, /SEC Verified/);
  assert.equal(descriptor.financialDataAsOf, '2026-06-27');
  assert.equal(descriptor.sharesAsOf, '2026-07-17');
}

{
  const descriptor = describeDcfFinancialSource({
    ticker: 'TEST',
    currentPrice: 50,
    startingRevenueM: 460,
    sharesOutstandingM: 100,
    netCashM: -4,
    waccPct: 10,
    terminalGrowthPct: 3,
    projectionYears: 5,
    isValid: true,
    sourcePeriod: 'Q1 2025–Q4 2025',
    financialDataSource: 'report_statements',
  });
  assert.equal(descriptor.kind, 'report_snapshot');
  assert.doesNotMatch(descriptor.labelEn, /SEC Verified/);
}

{
  const descriptor = describeDcfFinancialSource(undefined);
  assert.equal(descriptor.kind, 'report_snapshot');
  assert.equal(descriptor.financialDataAsOf, undefined);
}

console.log('DCF source descriptor checks passed');
