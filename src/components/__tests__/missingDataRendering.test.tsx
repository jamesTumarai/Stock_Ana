import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EarningsAnalysisSection } from '../EarningsAnalysisSection';
import { ForecastDashboard } from '../ForecastDashboard';
import { MorningstarResearchSection } from '../MorningstarResearchSection';
import { SmartMoneyCard } from '../SmartMoneyCard';
import { BusinessAnalysisCard } from '../BusinessAnalysisCard';
import { CompanyProfileCard } from '../CompanyProfileCard';
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

const malformedSmartMoneyHtml = renderToStaticMarkup(
  <SmartMoneyCard
    data={{
      holder_type_breakdown: [{ type: null, pct: 42 } as never],
      major_holders: [{ name: 'Empty Holder', shares_held: 'Data unavailable', pct_owned: null } as never],
    }}
    ticker="TEST"
    isThai={false}
  />,
);
assert.match(malformedSmartMoneyHtml, /Data unavailable/);
assert.doesNotMatch(malformedSmartMoneyHtml, /Empty Holder/);

const malformedBusinessHtml = renderToStaticMarkup(
  <BusinessAnalysisCard
    data={{
      revenue_breakdown: {
        by_business: [{ name: 'Empty Segment', revenue_usd: 'Data unavailable', ratio_pct: '-' } as never],
        by_region: [{ name: null, revenue_usd: null, ratio_pct: null } as never],
      },
      operational_efficiency: [{ period: 'FY2026', headcount: null } as never],
    }}
    ticker="TEST"
    isThai={false}
  />,
);
assert.match(malformedBusinessHtml, /Data unavailable/);
assert.doesNotMatch(malformedBusinessHtml, /Empty Segment|FY2026/);
assert.doesNotMatch(malformedBusinessHtml, /Commercial - AIP|Gotham Defense|United States \(สหรัฐอเมริกา\)/);

const malformedCompanyProfileHtml = renderToStaticMarkup(
  <CompanyProfileCard
    data={{
      overview: { company_name: 'Test Company', symbol: 'TEST' },
      executives: [{ name: null, title: null } as never],
    }}
    ticker="TEST"
    isThai={false}
  />,
);
assert.match(malformedCompanyProfileHtml, /Test Company/);

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
