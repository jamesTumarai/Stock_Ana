import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { ReportData } from '../../../types';
import { normalizeReport } from '../../../utils/reportIntegrity';
import {
  calculatePeerSimilarity,
  discoverPeers,
  resolvePeerMetricCoverage,
  type CandidateDefinition,
} from '../peerDiscoveryEngine';
import type { PeerBusinessFingerprint } from '../types';

const targetReport = (overrides: Partial<ReportData> = {}): Partial<ReportData> => ({
  ticker: 'AUTX',
  as_of_date: '2026-09-23',
  company_profile: {
    company_name: 'Auto Target',
    description: 'Manufacturer of electric vehicles and energy storage systems.',
    overview: { sector: 'Consumer Cyclical', industry: 'Auto Manufacturers' } as any,
  } as any,
  valuation_ratios: [
    { name: 'P/E (Trailing)', value: 40 } as any,
    { name: 'EV/EBITDA', value: 20 } as any,
  ],
  financial_statements: {
    currency: 'USD',
    periods: ['Q2 2025', 'Q2 2026'],
    income_statement: {
      revenue: [8_000, 10_000], operating_income: [800, 1_000], income_before_tax: [700, 900],
      income_tax_expense: [140, 180], net_income: [560, 720], interest_expense: [90, 100],
      yoy_revenue_growth_pct: [null, 25],
    } as any,
    balance_sheet: { total_equity: [3_800, 4_000], total_debt: [2_100, 2_000], cash_and_equivalents: [900, 1_000] } as any,
  } as any,
  ...overrides,
});

type MetricSpec = Record<string, number | null | undefined>;

const candidate = (
  ticker: string,
  relation: 'DIRECT_PEER' | 'CLOSE_COMPARABLE' | 'BROADER_SECTOR_REFERENCE',
  metrics: MetricSpec,
  overrides: Partial<CandidateDefinition> = {},
): CandidateDefinition & { relation_type: typeof relation } => ({
  ticker,
  companyName: `${ticker} Motors`,
  archetype: 'industrial_manufacturing',
  sector: 'Consumer Cyclical',
  industry: 'Auto Manufacturers',
  subIndustry: 'automotive_manufacturing',
  revenueModels: ['vehicle_sales', 'energy_storage'],
  majorBusinessLines: ['vehicles'],
  geography: 'US',
  lifecycle: 'mature',
  profitabilityState: 'profitable',
  capitalIntensity: 'capital_intensive',
  regulatoryType: 'standard',
  scaleTier: 'large',
  metrics: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, {
    value: value ?? null,
    unit: key.includes('pct') ? '%' : 'x',
    period: 'FY2025',
    source: key === 'roic_pct' ? 'SEC Form 10-K' : 'Source-backed market snapshot',
    reportedOrDerived: 'DERIVED' as const,
  }])),
  relation_type: relation,
  ...overrides,
});

describe('Peer Matrix truthful fallback regression', () => {
  it('keeps the matrix when no direct peer exists and labels the strongest close comparable truthfully', () => {
    const result = discoverPeers(targetReport(), 'AUTX', {
      candidates: [
        candidate('CLOSE1', 'CLOSE_COMPARABLE', { pe_trailing: 20, ev_ebitda: 12, revenue_growth_yoy_pct: 15 }),
        candidate('CLOSE2', 'CLOSE_COMPARABLE', { pe_trailing: 24, ev_ebitda: 14, revenue_growth_yoy_pct: 18 }),
        candidate('CLOSE3', 'CLOSE_COMPARABLE', { pe_trailing: 28, ev_ebitda: 16, revenue_growth_yoy_pct: 21 }),
      ],
      disableFixtureFallback: true,
    });

    assert.equal(result.peers.some(peer => peer.relationType === 'DIRECT_PEER'), false);
    assert.ok(result.benchmarkRows.length > 0);
    assert.equal(result.benchmarkRows[0].direct_peer_relation, 'CLOSE_COMPARABLE');
    assert.match(result.benchmarkRows[0].direct_peer_header_en || '', /^Closest Comparable:/);
  });

  it('calculates eligibility and medians independently for each metric', () => {
    const result = discoverPeers(targetReport(), 'AUTX', {
      candidates: [
        candidate('PEERA', 'CLOSE_COMPARABLE', { pe_trailing: 20, ev_ebitda: 10, revenue_growth_yoy_pct: 12 }),
        candidate('PEERB', 'CLOSE_COMPARABLE', { pe_trailing: 30, revenue_growth_yoy_pct: 18, roic_pct: 8 }),
        candidate('PEERC', 'CLOSE_COMPARABLE', { pe_trailing: 40, ev_ebitda: 20, revenue_growth_yoy_pct: 24, roic_pct: 12 }),
      ],
      disableFixtureFallback: true,
    });

    assert.deepEqual({
      pe: result.metricSampleCounts.pe_trailing,
      ev: result.metricSampleCounts.ev_ebitda,
      growth: result.metricSampleCounts.revenue_growth_yoy_pct,
      roic: result.metricSampleCounts.roic_pct,
    }, { pe: 3, ev: 2, growth: 3, roic: 2 });
    assert.equal(result.benchmarkRows.find(row => row.metric_name === 'P/E (Trailing)')?.peer_coverage_status, 'SUFFICIENT');
    assert.equal(result.benchmarkRows.find(row => row.metric_name === 'EV / EBITDA')?.peer_coverage_status, 'LIMITED');
    assert.equal(result.benchmarkRows.find(row => row.metric_name === 'ROIC')?.peer_coverage_status, 'LIMITED');
    assert.equal(result.medians.pe_trailing, 30);
    assert.equal(result.medians.ev_ebitda, 15);
    assert.equal(result.medians.roic_pct, 10);
  });

  it('treats lifecycle, profitability and scale differences as soft penalties', () => {
    const base: PeerBusinessFingerprint = {
      ticker: 'TARGET', companyName: 'Target', archetype: 'industrial_manufacturing', sector: 'Consumer Cyclical',
      industry: 'Auto Manufacturers', subIndustry: 'automotive_manufacturing', revenueModels: ['vehicle_sales'],
      majorBusinessLines: ['vehicles'], geography: 'US', lifecycle: 'mature', profitabilityState: 'profitable',
      capitalIntensity: 'capital_intensive', regulatoryType: 'standard', scaleTier: 'mega',
    };
    const smaller = {
      ...base, ticker: 'SMALL', companyName: 'Small Auto', lifecycle: 'early_stage' as const,
      profitabilityState: 'pre_profit' as const, scaleTier: 'small' as const,
    };
    assert.equal(calculatePeerSimilarity(base, smaller).relationType, 'CLOSE_COMPARABLE');
  });

  it('still hard-rejects a broad-sector candidate with mismatched core economics', () => {
    const result = discoverPeers({
      ticker: 'SHOPX',
      company_profile: { description: 'Physical stores selling consumer goods.', overview: { sector: 'Consumer Cyclical', industry: 'Retail Stores' } as any } as any,
    }, 'SHOPX', {
      candidates: [candidate('MARKET', 'CLOSE_COMPARABLE', { pe_trailing: 30 }, {
        archetype: 'digital_marketplace', industry: 'Internet Retail', subIndustry: 'digital_marketplace',
        revenueModels: ['marketplace_fees'], majorBusinessLines: ['online marketplace'], capitalIntensity: 'asset_light',
      })],
      disableFixtureFallback: true,
    });
    assert.equal(result.peerCount, 0);
    assert.equal(result.unavailableReason, 'BUSINESS_MODEL_AMBIGUOUS');
  });

  it('uses broader industry references after the close-comparable tier without mislabeling them', () => {
    const result = discoverPeers(targetReport(), 'AUTX', {
      candidates: [
        candidate('CLOSE', 'CLOSE_COMPARABLE', { pe_trailing: 20, revenue_growth_yoy_pct: 12 }),
        candidate('REF1', 'BROADER_SECTOR_REFERENCE', { pe_trailing: 30, revenue_growth_yoy_pct: 18 }),
        candidate('REF2', 'BROADER_SECTOR_REFERENCE', { pe_trailing: 40, revenue_growth_yoy_pct: 24 }),
      ],
      disableFixtureFallback: true,
    });
    assert.deepEqual(result.peers.map(peer => peer.relationType), [
      'CLOSE_COMPARABLE', 'BROADER_SECTOR_REFERENCE', 'BROADER_SECTOR_REFERENCE',
    ]);
    assert.equal(result.isBroadSectorUniverse, true);
    assert.equal(result.benchmarkRows[0].direct_peer_relation, 'CLOSE_COMPARABLE');

    const broaderOnly = discoverPeers(targetReport({ ticker: 'AUTY' }), 'AUTY', {
      candidates: [
        candidate('REF3', 'BROADER_SECTOR_REFERENCE', { pe_trailing: 25, revenue_growth_yoy_pct: 10 }),
        candidate('REF4', 'BROADER_SECTOR_REFERENCE', { pe_trailing: 35, revenue_growth_yoy_pct: 20 }),
      ],
      disableFixtureFallback: true,
    });
    assert.equal(broaderOnly.benchmarkRows[0].direct_peer_relation, 'BROADER_SECTOR_REFERENCE');
    assert.match(broaderOnly.benchmarkRows[0].direct_peer_header_en || '', /^Industry Reference:/);
  });

  it('widens median coverage per metric instead of mixing broader references unconditionally', () => {
    const strongCloseSet = discoverPeers(targetReport({ ticker: 'AUTM' }), 'AUTM', {
      candidates: [
        candidate('CLOSEA', 'CLOSE_COMPARABLE', { pe_trailing: 20, ev_ebitda: 10 }),
        candidate('CLOSEB', 'CLOSE_COMPARABLE', { pe_trailing: 30 }),
        candidate('CLOSEC', 'CLOSE_COMPARABLE', { pe_trailing: 40 }),
        candidate('BROADOUTLIER', 'BROADER_SECTOR_REFERENCE', { pe_trailing: 500, ev_ebitda: 20 }),
      ],
      disableFixtureFallback: true,
    });
    assert.equal(strongCloseSet.medians.pe_trailing, 30);
    assert.equal(strongCloseSet.metricSampleCounts.pe_trailing, 3);
    assert.equal(strongCloseSet.medians.ev_ebitda, 15);
    assert.equal(strongCloseSet.metricSampleCounts.ev_ebitda, 2);
  });

  it('keeps useful rows when peer ROIC is unavailable and applies the explicit small-sample policy', () => {
    assert.deepEqual(resolvePeerMetricCoverage(3), { status: 'SUFFICIENT', canPublishMedian: true });
    assert.deepEqual(resolvePeerMetricCoverage(2), { status: 'LIMITED', canPublishMedian: true });
    assert.deepEqual(resolvePeerMetricCoverage(1), { status: 'INSUFFICIENT', canPublishMedian: false });
    assert.deepEqual(resolvePeerMetricCoverage(0), { status: 'INSUFFICIENT', canPublishMedian: false });

    const result = discoverPeers(targetReport({ ticker: 'AUTZ' }), 'AUTZ', {
      candidates: [
        candidate('NOROIC1', 'CLOSE_COMPARABLE', { pe_trailing: 20, ev_ebitda: 10, revenue_growth_yoy_pct: 12 }),
        candidate('NOROIC2', 'CLOSE_COMPARABLE', { pe_trailing: 30, ev_ebitda: 20, revenue_growth_yoy_pct: 18 }),
        candidate('NOROIC3', 'CLOSE_COMPARABLE', { pe_trailing: 40, ev_ebitda: 30, revenue_growth_yoy_pct: 24 }),
      ],
      disableFixtureFallback: true,
    });
    assert.equal(result.benchmarkRows.find(row => row.metric_name === 'P/E (Trailing)')?.peer_coverage_status, 'SUFFICIENT');
    const profitability = result.benchmarkRows.find(row => ['ROIC', 'Operating Margin', 'Net Margin'].includes(row.metric_name));
    assert.ok(profitability);
    assert.equal(profitability.peer_coverage_status, 'INSUFFICIENT');
    assert.equal(profitability.sector_median, 'Insufficient Comparable Peer Data');
  });

  it('uses insurer-specific metrics instead of forcing a bank NIM matrix', () => {
    const insurerTarget = targetReport({
      ticker: 'INSUREX',
      company_profile: {
        company_name: 'Insure Target',
        description: 'Property and casualty insurance underwriting company.',
        overview: { sector: 'Financial Services', industry: 'Insurance—Property & Casualty' } as any,
      } as any,
      financial_statements: {
        statement_template: 'insurance', currency: 'USD', periods: ['FY2025'],
        income_statement: { revenue: [10_000], net_income: [900] } as any,
        balance_sheet: { total_equity: [8_000], total_assets: [40_000] } as any,
        key_indicators: { combined_ratio_pct: [92] } as any,
      } as any,
      key_indicators: { profitability: { roe_pct: 11.25, combined_ratio_pct: 92 } } as any,
    });
    const insurerCandidate = (ticker: string, pb: number, pe: number, roe: number, combined: number) => candidate(
      ticker,
      'CLOSE_COMPARABLE',
      { price_to_book: pb, pe_trailing: pe, roe_pct: roe, combined_ratio_pct: combined },
      {
        archetype: 'insurer', sector: 'Financial Services', industry: 'Insurance—Property & Casualty',
        subIndustry: 'property_casualty_insurance', revenueModels: ['insurance_premiums', 'investment_income'],
        majorBusinessLines: ['insurance underwriting'], capitalIntensity: 'financial_intermediary', regulatoryType: 'insurance',
      },
    );
    const result = discoverPeers(insurerTarget, 'INSUREX', {
      candidates: [insurerCandidate('INSA', 2, 12, 14, 90), insurerCandidate('INSB', 2.5, 14, 12, 94)],
      disableFixtureFallback: true,
    });
    const names = result.benchmarkRows.map(row => row.metric_name);
    assert.ok(names.includes('Combined Ratio'));
    assert.equal(names.includes('Net Interest Margin (NIM)'), false);
    assert.equal(result.benchmarkRows.find(row => row.metric_name === 'Combined Ratio')?.peer_coverage_status, 'LIMITED');
  });

  it('resolves recovered peer data before Five Pillars and renders only one total-failure warning', () => {
    const normalized = normalizeReport({
      ...targetReport({
        ticker: 'SAASORDER',
        company_profile: {
          company_name: 'Cloud Target',
          description: 'Enterprise subscription software and cloud services.',
          overview: { sector: 'Technology', industry: 'Software—Infrastructure' } as any,
        } as any,
      }),
      peer_comparison: { peers: [], industry_name: 'Software—Infrastructure' },
    } as ReportData, 'SAASORDER');
    assert.ok((normalized.peer_comparison?.peers.length || 0) > 0);
    assert.ok((normalized.five_pillars?.peer_matrix.length || 0) > 0);

    const source = readFileSync(new URL('../../../components/FivePillarsAnalysis.tsx', import.meta.url), 'utf8');
    assert.equal(source.match(/ยังไม่พบกลุ่มบริษัทที่เปรียบเทียบได้และมีข้อมูลที่ตรวจสอบแล้วเพียงพอ/g)?.length, 1);
    assert.equal(source.match(/No sufficiently comparable source-verified peer set is currently available\./g)?.length, 1);
  });

  it('normalizes production-shaped peer metadata and strict numeric strings before admission', () => {
    const productionPayload = targetReport({
      ticker: 'PRODAUTO',
      peer_comparison: {
        industry_name: 'Automotive / Clean Energy & AI',
        as_of_date: '2026-09-23',
        peers: [
          {
            ticker: 'AUTOA', company_name: 'Auto A', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers',
            subIndustry: 'Integrated Automaker', pe_trailing: '21.6', ev_ebitda: '12.4x',
            revenue_growth_yoy_pct: '22.4%', financial_period: 'Q2 2026', financial_source: 'Issuer filing and market snapshot',
          } as any,
          {
            ticker: 'AUTOB', company_name: 'Auto B', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers',
            subIndustry: 'EV Startup', pe_trailing: '37.3', ev_ebitda: '18.2x',
            revenue_growth_yoy_pct: '8.5%', financial_period: 'Q2 2026', financial_source: 'Issuer filing and market snapshot',
          } as any,
        ],
      },
    });
    const result = discoverPeers(productionPayload, 'PRODAUTO', { disableFixtureFallback: true });
    assert.equal(result.peerCount, 2);
    assert.equal(result.benchmarkRows.length > 0, true);
    assert.equal(result.metricSampleCounts.pe_trailing, 2);
    assert.equal(result.medians.pe_trailing, 29.45);
  });

  it('keeps an unknown automotive subtype as broader context but rejects an explicit non-automotive model', () => {
    const result = discoverPeers(targetReport({ ticker: 'AUTOEDGE' }), 'AUTOEDGE', {
      candidates: [
        candidate('OEMX', 'BROADER_SECTOR_REFERENCE', { pe_trailing: 18 }, { subIndustry: 'legacy_oem_platform' as any }),
        candidate('CHIPX', 'BROADER_SECTOR_REFERENCE', { pe_trailing: 24 }, {
          archetype: 'semiconductor', sector: 'Technology', industry: 'Semiconductors', subIndustry: 'fabless_accelerator',
          revenueModels: ['chip_sales'], majorBusinessLines: ['semiconductors'], capitalIntensity: 'asset_light',
        }),
      ],
      disableFixtureFallback: true,
    });
    assert.deepEqual(result.peers.map(peer => peer.ticker), ['OEMX']);
  });
});
