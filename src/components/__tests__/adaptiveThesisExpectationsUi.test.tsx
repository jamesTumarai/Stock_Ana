import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThesisExpectationsCard } from '../ThesisExpectationsCard';
import { InvestmentThesisRecord, TrackedExpectation } from '../../domain/thesisExpectations';

console.log('Running Adaptive Thesis & Tracked Expectations UI regression checks...');

// 1. SOFI - Financial Sector Guard active
const sofiReport: any = {
  ticker: 'SOFI',
  company_profile: {
    sector: 'Financial Services',
    industry: 'Credit Services',
    description: 'SoFi Technologies is a digital bank and fintech platform.'
  },
  intrinsic_value: {
    current_price: 15.2,
    summary: {
      base_case_fair_value: 18.0,
      verdict_text: 'Financial Sector Guard applied'
    },
    // Generic assumptions that must be filtered out by Financial Sector Guard
    assumptions: {
      discount_rate: 10.5,
      terminal_growth_rate: 3.0
    },
    dcf_model: {
      inputs: {
        isValid: false,
        missingFields: ['fintech_pe selected']
      }
    }
  },
  financial_statements: {
    periods: ['Q3 2026'],
    income_statement: {
      revenue: [750],
      net_income: [65]
    }
  },
  verdict: {
    conviction_score: 75,
    summary: 'Fintech deposit growth driving financial platform scalability.',
    key_takeaways: ['Digital banking scale', 'Galileo technology segment']
  },
  comprehensive_analysis: {
    beginner_summary: {
      top_3_risks: ['Credit quality deterioration', 'Interest rate margin compression']
    }
  }
};

const initialSofiThesis: InvestmentThesisRecord = {
  thesisId: 'thesis_sofi_1',
  ticker: 'SOFI',
  version: 1,
  summary: 'Fintech deposit growth driving financial platform scalability.',
  keyDrivers: ['Digital banking scale', 'Galileo technology segment'],
  keyAssumptions: ['Deposit growth remains strong'],
  keyRisks: ['Credit quality deterioration', 'Interest rate margin compression'],
  catalysts: ['Bank charter leverage'],
  invalidationConditions: ['Material deterioration in consumer lending credit quality'],
  status: 'ACTIVE',
  confirmationStatus: 'AI_DRAFT',
  sourceReportId: 'rep_sofi_1',
  createdAt: '2026-06-15T10:00:00.000Z',
  updatedAt: '2026-06-15T10:00:00.000Z'
};

const sofiHtml = renderToStaticMarkup(
  <ThesisExpectationsCard
    ticker="SOFI"
    currentReport={sofiReport}
    externalThesis={initialSofiThesis}
    externalExpectations={[]}
    isThai={true}
  />
);

// Assert: Must show "ฐานและสมมติฐานการประเมินมูลค่า"
assert.match(
  sofiHtml,
  /ฐานและสมมติฐานการประเมินมูลค่า/,
  'Must display modern model-aware header: ฐานและสมมติฐานการประเมินมูลค่า'
);

// Assert: Must show Financial Sector Guard status
assert.match(
  sofiHtml,
  /Financial Sector Guard/,
  'Must display Financial Sector Guard in thesis card for SOFI'
);
assert.match(
  sofiHtml,
  /แบบจำลอง FCFF DCF: ไม่ใช้กับธุรกิจประเภทนี้/,
  'Must explain that FCFF DCF is not applicable for banking/fintech'
);

// Assert: Must NOT show generic WACC or Terminal Growth bullets for SOFI
assert.doesNotMatch(
  sofiHtml,
  /10\.5%/,
  'Must NOT display generic 10.5% WACC assumption for guarded SOFI'
);
assert.doesNotMatch(
  sofiHtml,
  /Terminal growth rate/,
  'Must NOT display terminal growth assumption for guarded SOFI'
);

// 2. MSFT - Operating Company with Active DCF
const msftReport: any = {
  ticker: 'MSFT',
  company_profile: {
    sector: 'Technology',
    industry: 'Software - Infrastructure'
  },
  intrinsic_value: {
    current_price: 430.0,
    summary: {
      base_case_fair_value: 480.0
    },
    assumptions: {
      discount_rate: 8.5,
      terminal_growth_rate: 2.5,
      revenue_growth_rate: 12.0,
      target_fcf_margin: 32.0,
      forecast_years: 5
    },
    dcf_model: {
      inputs: {
        isValid: true
      },
      assumptions: {
        wacc_pct: 8.5,
        terminal_growth_pct: 2.5,
        projection_years: 5
      },
      scenarios: {
        base: {
          revenue_cagr_pct: 12.0,
          terminal_margin_pct: 32.0
        }
      }
    }
  },
  financial_statements: {
    periods: ['Q3 2026'],
    income_statement: {
      revenue: [62000],
      operating_margin_pct: [45.0],
      net_income: [21900]
    },
    cash_flow: {
      free_cash_flow: [19500]
    }
  },
  verdict: {
    conviction_score: 88,
    summary: 'Azure AI enterprise monetization driving cloud operating leverage.',
    key_takeaways: ['Copilot monetization', 'Data center expansion']
  },
  comprehensive_analysis: {
    beginner_summary: {
      top_3_risks: ['Cloud slowdown', 'Regulatory antitrust']
    }
  }
};

const initialMsftThesis: InvestmentThesisRecord = {
  thesisId: 'thesis_msft_1',
  ticker: 'MSFT',
  version: 1,
  summary: 'Azure AI enterprise monetization driving cloud operating leverage.',
  keyDrivers: ['Copilot monetization', 'Data center expansion'],
  keyAssumptions: ['Discount rate (WACC): 8.5%'],
  keyRisks: ['Cloud slowdown', 'Regulatory antitrust'],
  catalysts: ['Ignite showcase'],
  invalidationConditions: ['Operating margin drops below 35.0%'],
  status: 'ACTIVE',
  confirmationStatus: 'AI_DRAFT',
  sourceReportId: 'rep_msft_1',
  createdAt: '2026-06-15T10:00:00.000Z',
  updatedAt: '2026-06-15T10:00:00.000Z'
};

const msftExps: TrackedExpectation[] = [
  {
    expectationId: 'exp_msft_1',
    ticker: 'MSFT',
    metricOrEvent: 'free_cash_flow',
    metricLabel: 'Free Cash Flow ($M)',
    targetValue: 18000,
    condition: 'gte',
    targetPeriod: 'Q3 2026',
    status: 'MET',
    origin: 'USER_EXPECTATION',
    actualValue: 19500,
    evaluationDate: '2026-06-15T10:00:00.000Z',
    createdAt: '2026-06-15T10:00:00.000Z',
    updatedAt: '2026-06-15T10:00:00.000Z',
    sourceReportId: 'rep_msft_1'
  }
];

const msftHtml = renderToStaticMarkup(
  <ThesisExpectationsCard
    ticker="MSFT"
    currentReport={msftReport}
    externalThesis={initialMsftThesis}
    externalExpectations={msftExps}
    isThai={true}
  />
);

// Assert: Must show DCF valuation assumptions for MSFT
assert.match(
  msftHtml,
  /8\.5%/,
  'Must display 8.5% WACC for MSFT operating company with active DCF'
);
assert.match(
  msftHtml,
  /2\.5%/,
  'Must display 2.5% terminal growth for MSFT'
);
assert.doesNotMatch(
  msftHtml,
  /Financial Sector Guard/,
  'Must NOT display Financial Sector Guard for MSFT'
);

// Assert: Must display tracked expectation with actual value
assert.match(
  msftHtml,
  /Free Cash Flow/,
  'Must display Free Cash Flow expectation row'
);
assert.match(
  msftHtml,
  /19500/,
  'Must display actual evaluated value for MSFT expectation'
);

console.log('All Adaptive Thesis & Tracked Expectations UI regression checks passed!');
