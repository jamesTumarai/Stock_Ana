import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReportTemplate from '../../ReportTemplate';
import { LandingView } from '../../LandingView';
import type { ReportData } from '../../types';

console.log('Running report layout and auth UX regression checks...');

// 1. Verify ReportTemplate layout order: Hero spotlight must appear BEFORE data provenance section
const sampleReport = {
  ticker: 'MSFT',
  analysis_type: 'combined',
  company_profile: {
    overview: { company_name: 'Microsoft Corporation', symbol: 'MSFT' },
    stock_price: 490,
  },
  intrinsic_value: {
    current_price: 490,
    summary: { base_case_fair_value: 520 },
  },
  report_provenance: {
    report_generated_by_version: 'lumina-phase3-provenance-v1',
    financial_statements: { source: 'report_snapshot' },
    dcf_financial_inputs: { source: 'report_snapshot' },
    sec_cross_check: { status: 'unavailable' },
  },
} as unknown as ReportData;

const reportHtml = renderToStaticMarkup(
  <ReportTemplate
    data={sampleReport}
    ticker="MSFT"
    onClose={() => undefined}
    language="Thai"
  />,
);

const heroIndex = reportHtml.indexOf('MSFT');
const provenanceIndex = reportHtml.indexOf('id="section-provenance"');

assert.notEqual(heroIndex, -1, 'Report must render MSFT ticker in hero');
assert.notEqual(provenanceIndex, -1, 'Report must contain section-provenance');
assert.ok(
  heroIndex < provenanceIndex,
  `Executive spotlight hero (index ${heroIndex}) must appear BEFORE provenance section (index ${provenanceIndex})`,
);

// 2. Verify LandingView renders error banner when error prop is provided
const landingWithErrorHtml = renderToStaticMarkup(
  <LandingView
    language="Thai"
    setLanguage={() => undefined}
    analysisType="combined"
    setAnalysisType={() => undefined}
    useSelfConsistency={false}
    setUseSelfConsistency={() => undefined}
    selectedModel="gemini-3.8-flash"
    setSelectedModel={() => undefined}
    ticker="MSFT"
    setTicker={() => undefined}
    instruction=""
    setInstruction={() => undefined}
    runAnalysis={() => undefined}
    running={false}
    user={null}
    onLogin={() => undefined}
    onLogout={() => undefined}
    onOpenHistory={() => undefined}
    error="กรุณาเข้าสู่ระบบก่อนเริ่มวิเคราะห์"
    onClearError={() => undefined}
  />,
);

assert.match(landingWithErrorHtml, /กรุณาเข้าสู่ระบบก่อนเริ่มวิเคราะห์/, 'LandingView must display error message');

console.log('Report layout and auth UX regression checks passed');
