import { harmonizeReportData } from '../../metricsHarmonizer';
import { ReportData } from '../../../types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('🚀 Running Morningstar Equity Research Harmonizer Test Suite...');

// Test 1: AAPL coverage matching user's reference screenshots
const rawAaplReport: ReportData = {
  ticker: 'AAPL',
  generated_at: new Date().toISOString(),
  summary: 'Apple Inc. analysis report',
  company_profile: {
    stock_price: 320.01,
    overview: { company_name: 'Apple Inc.', exchange: 'NASDAQ' }
  }
} as any;

const harmonizedAapl = harmonizeReportData(rawAaplReport, 'AAPL');
const mrAapl = harmonizedAapl.morningstar_research;

assert(!!mrAapl, 'AAPL has morningstar_research object');
assert(mrAapl?.has_coverage === true, 'AAPL has_coverage is true');
assert(mrAapl?.rating_stars === 2, 'AAPL rating_stars is 2 (2 Stars)');
assert(mrAapl?.fair_value_estimate === 285.00, 'AAPL fair_value_estimate is $285.00');
assert(mrAapl?.economic_moat === 'Wide', 'AAPL economic_moat is Wide');
assert(mrAapl?.uncertainty === 'Medium', 'AAPL uncertainty is Medium');
assert(mrAapl?.capital_allocation === 'Exemplary', 'AAPL capital_allocation is Exemplary');
assert(mrAapl?.analyst_name === 'William Kerwin, CFA', 'AAPL analyst is William Kerwin, CFA');
assert(Array.isArray(mrAapl?.bulls_say) && mrAapl.bulls_say.length === 3, 'AAPL bulls_say has 3 points');
assert(Array.isArray(mrAapl?.bears_say) && mrAapl.bears_say.length === 3, 'AAPL bears_say has 3 points');
assert(!!mrAapl?.analyst_note && !!mrAapl.analyst_note.headline, 'AAPL analyst_note has headline');
assert(mrAapl?.valuation_thesis?.implied_pe === 32.0, 'AAPL valuation_thesis implied_pe is 32.0');
assert(mrAapl?.valuation_thesis?.implied_ev_revenue === 8.0, 'AAPL valuation_thesis implied_ev_revenue is 8.0');
assert(mrAapl?.valuation_thesis?.implied_fcf_yield_pct === 3.0, 'AAPL valuation_thesis implied_fcf_yield_pct is 3.0%');
assert(mrAapl?.valuation_thesis?.projected_revenue_cagr_5yr === 9.0, 'AAPL valuation_thesis projected_revenue_cagr_5yr is 9.0%');

// Test 2: NVDA coverage matching Moomoo Morningstar Research ($310 Fair Value)
const rawNvdaReport: ReportData = {
  ticker: 'NVDA',
  generated_at: new Date().toISOString(),
  summary: 'NVIDIA Corporation analysis report',
  company_profile: {
    stock_price: 229.49,
    overview: { company_name: 'NVIDIA Corporation', exchange: 'NASDAQ' }
  }
} as any;

const harmonizedNvda = harmonizeReportData(rawNvdaReport, 'NVDA');
const mrNvda = harmonizedNvda.morningstar_research;

assert(!!mrNvda, 'NVDA has morningstar_research object');
assert(mrNvda?.has_coverage === true, 'NVDA has_coverage is true');
assert(mrNvda?.rating_stars === 4, 'NVDA rating_stars is 4 (4 Stars)');
assert(mrNvda?.fair_value_estimate === 310.00, 'NVDA fair_value_estimate is $310.00');
assert(mrNvda?.economic_moat === 'Wide', 'NVDA economic_moat is Wide');
assert(mrNvda?.uncertainty === 'Very High', 'NVDA uncertainty is Very High');
assert(mrNvda?.capital_allocation === 'Exemplary', 'NVDA capital_allocation is Exemplary');
assert(mrNvda?.analyst_name === 'Brian Colello, CPA', 'NVDA analyst is Brian Colello, CPA');
assert(Array.isArray(mrNvda?.bulls_say) && mrNvda.bulls_say.length === 3, 'NVDA bulls_say has 3 points');
assert(Array.isArray(mrNvda?.bears_say) && mrNvda.bears_say.length === 3, 'NVDA bears_say has 3 points');
assert(mrNvda?.valuation_thesis?.implied_pe === 33.0, 'NVDA valuation_thesis implied_pe is 33.0');
assert(mrNvda?.valuation_thesis?.projected_revenue_cagr_5yr === 36.0, 'NVDA valuation_thesis projected_revenue_cagr_5yr is 36.0%');
assert(mrNvda?.discount_premium_pct !== undefined && mrNvda.discount_premium_pct > 30, 'NVDA discount_premium_pct is > 30% (+35.08%)');
assert(!!mrNvda?.ai_analysis_summary_th && mrNvda.ai_analysis_summary_th.length > 50, 'NVDA has Thai ai_analysis_summary_th');
assert(Array.isArray(mrNvda?.bulls_say_th) && mrNvda.bulls_say_th.length === 3, 'NVDA has 3 Thai bulls_say_th points');
assert(Array.isArray(mrNvda?.bears_say_th) && mrNvda.bears_say_th.length === 3, 'NVDA has 3 Thai bears_say_th points');
assert(!!mrNvda?.analyst_note?.headline_th, 'NVDA has Thai analyst_note.headline_th');
assert(Array.isArray(mrNvda?.analyst_note?.content_paragraphs_th) && mrNvda.analyst_note.content_paragraphs_th.length > 0, 'NVDA has Thai analyst note paragraphs');
assert(!!mrNvda?.business_strategy?.title && mrNvda.business_strategy.content_paragraphs?.length === 4, 'NVDA has business_strategy (4 paragraphs)');
assert(!!mrNvda?.business_strategy?.content_paragraphs_th?.length, 'NVDA has Thai business_strategy paragraphs');
assert(!!mrNvda?.economic_moat_details?.content_paragraphs?.length && mrNvda.economic_moat_details.content_paragraphs.length >= 8, 'NVDA has economic_moat_details');
assert(!!mrNvda?.uncertainty_details?.content_paragraphs?.length, 'NVDA has uncertainty_details');
assert(mrNvda?.capital_allocation_details?.content_paragraphs?.length === 7, 'NVDA has capital_allocation_details (7 paragraphs)');
assert(mrNvda?.capital_allocation_details?.content_paragraphs_th?.length === 7, 'NVDA has Thai capital_allocation_details (7 paragraphs)');
assert(!!mrNvda?.financial_health?.content_paragraphs?.length, 'NVDA has financial_health');
assert(!!mrNvda?.financial_health?.content_paragraphs_th?.length, 'NVDA has Thai financial_health');

// Test 3: TSLA and SOFI Thai translations
const harmonizedTsla = harmonizeReportData({ ticker: 'TSLA' } as any, 'TSLA');
assert(!!harmonizedTsla.morningstar_research?.ai_analysis_summary_th, 'TSLA has Thai ai_analysis_summary_th');
assert(Array.isArray(harmonizedTsla.morningstar_research?.bulls_say_th) && harmonizedTsla.morningstar_research.bulls_say_th.length === 3, 'TSLA has 3 Thai bulls points');

const harmonizedSofi = harmonizeReportData({ ticker: 'SOFI' } as any, 'SOFI');
assert(!!harmonizedSofi.morningstar_research?.ai_analysis_summary_th, 'SOFI has Thai ai_analysis_summary_th');
assert(Array.isArray(harmonizedSofi.morningstar_research?.bears_say_th) && harmonizedSofi.morningstar_research.bears_say_th.length === 3, 'SOFI has 3 Thai bears points');

// Test 4: Palantir Technologies (PLTR) - Mark Giarelli $153 Fair Value
const harmonizedPltr = harmonizeReportData({ ticker: 'PLTR', company_profile: { stock_price: 155.0 } } as any, 'PLTR');
const mrPltr = harmonizedPltr.morningstar_research;
assert(!!mrPltr, 'PLTR has morningstar_research object');
assert(mrPltr?.has_coverage === true, 'PLTR has_coverage is true');
assert(mrPltr?.fair_value_estimate === 153.00, 'PLTR fair_value_estimate is $153.00');
assert(mrPltr?.analyst_name === 'Mark Giarelli', 'PLTR analyst is Mark Giarelli');
assert(mrPltr?.economic_moat === 'Narrow', 'PLTR economic_moat is Narrow');
assert(mrPltr?.uncertainty === 'Very High', 'PLTR uncertainty is Very High');
assert(mrPltr?.capital_allocation === 'Standard', 'PLTR capital_allocation is Standard');
assert(Array.isArray(mrPltr?.bulls_say_th) && mrPltr.bulls_say_th.length === 3, 'PLTR has 3 Thai bulls points');
assert(Array.isArray(mrPltr?.bears_say_th) && mrPltr.bears_say_th.length === 3, 'PLTR has 3 Thai bears points');
assert(!!mrPltr?.business_strategy?.title_th, 'PLTR has business_strategy title_th');
assert(!!mrPltr?.capital_allocation_details?.content_paragraphs_th?.length, 'PLTR has Thai capital allocation paragraphs');

// Test 4.1: PLTR Financial Performance 4Q Scaling & Sanity
const rawPltrWithMismatch = {
  ticker: 'PLTR',
  financial_charts: {
    financial_performance_4q: [
      { quarter: 'Q3 2025', revenue: 1.18, net_income: 373 } // 373M accidentally unscaled
    ]
  }
} as any;
const harmonizedPltrChart = harmonizeReportData(rawPltrWithMismatch, 'PLTR').financial_charts?.financial_performance_4q;
assert(!!harmonizedPltrChart && harmonizedPltrChart.length > 0, 'PLTR chart exists');
assert(harmonizedPltrChart[0].revenue === 1.18, 'PLTR Q3 revenue is $1.18B');
assert(harmonizedPltrChart[0].net_income === 0.37, `PLTR Q3 net income is correctly scaled to $0.37B (got ${harmonizedPltrChart[0].net_income})`);


// Test 5: MSFT, GOOGL, AMD Institutional Reports
const mrMsft = harmonizeReportData({ ticker: 'MSFT' } as any, 'MSFT').morningstar_research;
assert(mrMsft?.has_coverage === true, 'MSFT has_coverage is true');
assert(mrMsft?.fair_value_estimate === 505.00, 'MSFT fair_value_estimate is $505.00');
assert(mrMsft?.analyst_name === 'Dan Romanoff, CFA', 'MSFT analyst is Dan Romanoff, CFA');

const mrGoogl = harmonizeReportData({ ticker: 'GOOGL' } as any, 'GOOGL').morningstar_research;
assert(mrGoogl?.has_coverage === true, 'GOOGL has_coverage is true');
assert(mrGoogl?.fair_value_estimate === 225.00, 'GOOGL fair_value_estimate is $225.00');

const mrAmd = harmonizeReportData({ ticker: 'AMD' } as any, 'AMD').morningstar_research;
assert(mrAmd?.has_coverage === true, 'AMD has_coverage is true');
assert(mrAmd?.fair_value_estimate === 165.00, 'AMD fair_value_estimate is $165.00');

// Test 6: Universal Dynamic Synthesizer (e.g. CrowdStrike CRWD)
const rawCrwd = {
  ticker: 'CRWD',
  company_profile: { stock_price: 340.0, overview: { company_name: 'CrowdStrike Holdings Inc.', sector: 'Cybersecurity' } },
  financial_statements: { gross_margin: 75.0, debt_to_equity: 0.2 },
  five_pillars: { roic: { value: 18.0 } }
} as any;
const mrCrwd = harmonizeReportData(rawCrwd, 'CRWD').morningstar_research;
assert(mrCrwd?.has_coverage === true, 'CRWD dynamically receives active Morningstar coverage (no stock left behind!)');
assert(mrCrwd?.economic_moat === 'Wide', 'CRWD dynamically calculates Wide Moat based on ROIC > 15 & GM > 50');
assert(!!mrCrwd?.analyst_note?.content_paragraphs_th?.length, 'CRWD has Thai analyst note');
assert(!!mrCrwd?.business_strategy?.content_paragraphs_th?.length, 'CRWD has Thai business strategy');
assert(!!mrCrwd?.capital_allocation_details?.content_paragraphs_th?.length, 'CRWD has Thai capital allocation');

// Test 7: Uncovered micro-cap (EOSE)
const rawEoseReport: ReportData = {
  ticker: 'EOSE',
  generated_at: new Date().toISOString(),
  summary: 'Eos Energy Enterprises analysis report'
} as any;

const harmonizedEose = harmonizeReportData(rawEoseReport, 'EOSE');
const mrEose = harmonizedEose.morningstar_research;

assert(!!mrEose, 'EOSE has morningstar_research object');
assert(mrEose?.has_coverage === false, 'EOSE has_coverage is false (gracefully handled)');

console.log('🎉 ALL MORNINGSTAR RESEARCH & THAI TRANSLATION TESTS PASSED SUCCESSFULLY!');

