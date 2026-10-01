import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntrinsicValueEngine } from '../IntrinsicValueEngine';
import type { IntrinsicValueData } from '../../types';

console.log('Running financial sector guard UI regression checks...');

// 1. Financial Sector Guard active
const fintechData: IntrinsicValueData = {
  current_price: 25,
  dcf_model: {
    inputs: {
      ticker: 'SOFI',
      currentPrice: 25,
      startingRevenueM: 3000,
      sharesOutstandingM: 1000,
      netCashM: 500,
      waccPct: 10,
      terminalGrowthPct: 3,
      projectionYears: 5,
      isValid: false,
      missingFields: ['operating-company FCFF model fit (fintech_pe selected)'],
      financialDataSource: 'sec_verified',
    },
    assumptions: {
      wacc_pct: 10,
      terminal_growth_pct: 3,
      projection_years: 5,
    },
    scenarios: {
      bear: { revenue_cagr_pct: null, terminal_margin_pct: null, fair_value_per_share: null, key_assumption_note: 'Sector guard applied' },
      base: { revenue_cagr_pct: null, terminal_margin_pct: null, fair_value_per_share: null, key_assumption_note: 'Sector guard applied' },
      bull: { revenue_cagr_pct: null, terminal_margin_pct: null, fair_value_per_share: null, key_assumption_note: 'Sector guard applied' },
    },
  },
  selected_model: {
    model_type: 'fintech_pe',
    model_name_th: 'FinTech Platform & Residual Income',
    model_name_en: 'FinTech Platform & Residual Income Model',
    sector_category: 'สถาบันการเงินดิจิทัล / FinTech',
    reason_th: 'ธนาคารดิจิทัลระดมเงินฝากเพื่อปล่อยสินเชื่อ จึงระงับแบบจำลอง FCFF',
    reason_en: 'Digital banks utilize deposits as operating assets; FCFF is prohibited.',
  },
  summary: {
    fair_value_range_low: null,
    fair_value_range_high: null,
    base_case_fair_value: null,
    margin_of_safety_pct: null,
    verdict_text: 'Financial Sector Guard applied',
  },
};

const fintechHtml = renderToStaticMarkup(
  <IntrinsicValueEngine
    data={fintechData}
    ticker="SOFI"
    isThai={true}
  />,
);

assert.match(
  fintechHtml,
  /Financial Sector Guard/,
  'Must display Financial Sector Guard message for fintech/banking firm',
);
assert.match(
  fintechHtml,
  /สถาบันการเงิน \/ FinTech/,
  'Must display financial/fintech badge',
);
assert.doesNotMatch(
  fintechHtml,
  /รายงานนี้ไม่มีข้อมูล DCF ที่ครบ/,
  'Must not mislabel financial sector guard as missing incomplete data',
);

// 2. Standard operating company with genuinely missing inputs
const missingData: IntrinsicValueData = {
  current_price: 100,
  dcf_model: {
    inputs: {
      ticker: 'TEST',
      currentPrice: 100,
      startingRevenueM: null,
      sharesOutstandingM: null,
      netCashM: null,
      waccPct: null,
      terminalGrowthPct: null,
      projectionYears: null,
      isValid: false,
      missingFields: ['current share price', 'starting revenue'],
      financialDataSource: 'report_statements',
    },
    assumptions: {
      wacc_pct: null,
      terminal_growth_pct: null,
      projection_years: null,
    },
    scenarios: {
      bear: { revenue_cagr_pct: null, terminal_margin_pct: null, fair_value_per_share: null, key_assumption_note: '' },
      base: { revenue_cagr_pct: null, terminal_margin_pct: null, fair_value_per_share: null, key_assumption_note: '' },
      bull: { revenue_cagr_pct: null, terminal_margin_pct: null, fair_value_per_share: null, key_assumption_note: '' },
    },
  },
  summary: {
    fair_value_range_low: null,
    fair_value_range_high: null,
    base_case_fair_value: null,
    margin_of_safety_pct: null,
    verdict_text: 'Inputs missing',
  },
};

const missingHtml = renderToStaticMarkup(
  <IntrinsicValueEngine
    data={missingData}
    ticker="TEST"
    isThai={true}
  />,
);

assert.match(
  missingHtml,
  /ยังไม่แสดงราคาเหมาะสม/,
  'Standard operating firm with missing inputs must display fair value unavailable',
);
assert.doesNotMatch(
  missingHtml,
  /Financial Sector Guard/,
  'Standard operating firm must not display financial sector guard',
);

console.log('Financial sector guard UI regression checks passed');

// Intrinsic value is independent of market availability. A complete FCFF
// contract still renders its cases while price-dependent measures remain empty.
const noQuote=structuredClone(fintechData);
noQuote.current_price=null;
noQuote.selected_model=undefined;
noQuote.dcf_model.inputs!.isValid=true;
noQuote.dcf_model.inputs!.missingFields=[];
noQuote.dcf_model.scenarios={
  bear:{revenue_cagr_pct:2,terminal_margin_pct:10,fair_value_per_share:30,key_assumption_note:''},
  base:{revenue_cagr_pct:5,terminal_margin_pct:16,fair_value_per_share:50,key_assumption_note:''},
  bull:{revenue_cagr_pct:8,terminal_margin_pct:20,fair_value_per_share:70,key_assumption_note:''}};
const withoutQuoteHtml=renderToStaticMarkup(<IntrinsicValueEngine data={noQuote} ticker="UNSEEN" isThai={false}/>);
assert.match(withoutQuoteHtml,/\$50\.00/);
assert.match(withoutQuoteHtml,/Market quote unavailable/);
assert.doesNotMatch(withoutQuoteHtml,/NaN|Infinity|Fair value is unavailable/);
