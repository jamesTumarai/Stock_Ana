import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {buildSecVerifiedIntegrationPackage} from './secIntegration';
import {reconcileCanonicalTtmFlow} from '../../domain/canonicalTtmFlow';
import {aggregateQuarterlyToAnnual} from '../../utils/statementAggregation';
import {normalizeReport} from '../../utils/reportIntegrity';
import type {ReportData} from '../../types';
const captures=JSON.parse(readFileSync(new URL('./fixtures/verified-cross-sector-2026.json',import.meta.url),'utf8'));
const get=(ticker:string)=>buildSecVerifiedIntegrationPackage(structuredClone(captures.bundles.find((b:any)=>b.identity.ticker===ticker)));

for (const ticker of ['MSFT','CRM','NVDA','JPM','SOFI','V','PGR','PLD','CRSP']) test(`captured SEC ${ticker} observation identities, accounting and TTM are source true`,()=>{
  const p=get(ticker), fs=p.financialStatements!;
  assert.ok(fs?.verified_dataset);
  assert.deepEqual(fs.validation_summary?.failed_guards,[]);
  for(const period of fs.period_snapshots!)for(const value of Object.values(period.observations)){
    assert.equal(value.periodEnd,period.endDate);assert.equal(value.source?.periodEnd,period.endDate);
    assert.equal(value.period,period.label);assert.equal(value.currency||p.canonicalFinancials!.currency,'USD');
    assert.ok(value.source?.documentUrl?.startsWith('https://www.sec.gov/Archives/'));
  }
  const revenue=reconcileCanonicalTtmFlow(p.canonicalFinancials,'income_statement.revenue');
  assert.equal(revenue.canonicalValue,fs.income_statement.revenue.slice(-4).reduce((a,b)=>a!+b!,0));
  const annual=aggregateQuarterlyToAnnual(fs);
  if(annual.periods.length)assert.ok(annual.period_snapshots?.every(s=>s.periodType==='annual'));
});

test('non-calendar fiscal identity comes from actual source ends rather than Gregorian quarters',()=>{
 const fs=get('CRM').financialStatements!;
 assert.deepEqual(fs.periods.slice(-4),['Q3 2026','Q4 2026','Q1 2027','Q2 2027']);
 assert.deepEqual(fs.income_statement.revenue.slice(-4),[10259,11201,11133,11345]);
 assert.deepEqual(fs.period_snapshots!.slice(-4).map(s=>s.endDate),['2025-10-31','2026-01-31','2026-04-30','2026-07-31']);
});
test('52/53-week issuer uses exact reported durations in its four consecutive quarters',()=>{
 const fs=get('NVDA').financialStatements!;
 assert.deepEqual(fs.income_statement.revenue.slice(-4),[57006,68127,81615,96221]);
 assert.ok(fs.period_snapshots!.slice(-4).every(p=>p.durationDays!>=84&&p.durationDays!<=98));
 assert.equal(reconcileCanonicalTtmFlow(fs.verified_dataset,'income_statement.revenue').canonicalValue,302969);
});
test('preferred issuer common allocation is distinct from parent net income and total net income',()=>{
 const fs=get('JPM').financialStatements!;
 assert.equal(fs.income_statement.net_income_common?.at(-1),20752);
 assert.equal((fs.income_statement as any).net_income_parent.at(-1),21155);
 assert.equal(fs.period_snapshots!.at(-1)!.observations['income_statement.net_income_common'].concept,'NetIncomeLossAvailableToCommonStockholdersBasic');
 assert.equal(fs.indicator_details!.roic.at(-1)!.value,null);
});
test('lender, insurer and REIT preserve distinct applicability policies; payments are not a bank',()=>{
 assert.equal(get('SOFI').financialStatements!.statement_template,'banking');
 assert.equal(get('PGR').financialStatements!.statement_template,'insurance');
 assert.equal(get('V').financialStatements!.statement_template,'standard');
 const p=get('PLD');const report=normalizeReport({ticker:'PLD',company_profile:{sector:'Real Estate',industry:'REIT'},canonical_financials:p.canonicalFinancials} as unknown as ReportData,'PLD');
 assert.equal(report.financial_statements?.statement_template,'reit');
});
test('pre-profit losses and unavailable debt remain signed/missing rather than normalized to profit/zero',()=>{
 const fs=get('CRSP').financialStatements!;
 assert.ok((fs.income_statement as any).net_income_parent.at(-1)!<0);
 assert.ok(fs.cash_flow.free_cash_flow!.at(-1)!<0);
 assert.equal(fs.balance_sheet.total_debt?.at(-1),null);
 assert.equal(fs.indicator_details!.roic.at(-1)!.value,null);
});
test('foreign IFRS/20-F facts cannot be relabeled USD US-GAAP quarters',()=>{
 const p=get('TSM');assert.equal(p.canonicalFinancials,null);assert.equal(p.financialStatements,null);
 assert.equal(p.dcfCoverage.eligible,false);assert.ok(p.sourceBundle);
});
