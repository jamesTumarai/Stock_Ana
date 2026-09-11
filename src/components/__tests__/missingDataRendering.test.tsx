import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EarningsAnalysisSection } from '../EarningsAnalysisSection';
import { ForecastDashboard } from '../ForecastDashboard';
import { MorningstarResearchSection } from '../MorningstarResearchSection';
import { SmartMoneyCard } from '../SmartMoneyCard';
import ReportTemplate from '../../ReportTemplate';
import type { ReportData } from '../../types';

console.log('Running missing-data rendering checks...');

const forecastHtml = renderToStaticMarkup(<ForecastDashboard ticker="TEST" isThai={false} />);
assert.match(forecastHtml, /Data unavailable/);

const earningsHtml = renderToStaticMarkup(<EarningsAnalysisSection isThai={false} ticker="TEST" />);
assert.match(earningsHtml, /Data unavailable/);

const morningstarHtml = renderToStaticMarkup(
  <MorningstarResearchSection data={{ has_coverage: true }} ticker="TEST" isThai={false} />,
);
assert.match(morningstarHtml, /Data unavailable/);
assert.doesNotMatch(morningstarHtml, />3<|\$100\.00|Exemplary|>Wide</);

const smartMoneyHtml = renderToStaticMarkup(<SmartMoneyCard ticker="TEST" isThai={false} />);
assert.match(smartMoneyHtml, /Data unavailable/);
assert.doesNotMatch(smartMoneyHtml, /Vanguard|BlackRock|PEER_1|1\.28B|56\.73%/);

const partialReportHtml = renderToStaticMarkup(
  <ReportTemplate
    data={{
      ticker: 'TEST',
      analysis_type: 'combined',
      company_profile: { company_name: 'Test Company' },
    } as unknown as ReportData}
    ticker="TEST"
    onClose={() => undefined}
    language="English"
  />,
);
assert.match(partialReportHtml, /Target Customers/);
assert.match(partialReportHtml, /Data unavailable/);

console.log('Missing-data rendering checks passed');
