import React from 'react';
import { renderToString } from 'react-dom/server';
import assert from 'node:assert/strict';
import { CalculationModal } from '../CalculationModal';
import { MetricCalculationDetail } from '../../utils/metricCalculations';

const mockDetail: MetricCalculationDetail = {
  key: 'free_cash_flow',
  nameEn: 'Free Cash Flow (FCF)',
  nameTh: 'กระแสเงินสดอิสระ (FCF)',
  category: 'cash_flow',
  formulaDisplay: 'Free Cash Flow = Operating Cash Flow (OCF) - Capital Expenditures (CapEx)',
  variables: [
    { symbol: 'OCF', nameEn: 'Operating Cash Flow', nameTh: 'กระแสเงินสดจากการดำเนินงาน', value: 420, isCurrency: true },
    { symbol: 'CapEx', nameEn: 'Capital Expenditures', nameTh: 'รายจ่ายฝ่ายทุน (ซื้อสินทรัพย์ถาวร)', value: 140, isCurrency: true },
  ],
  resultValue: 280,
  resultUnit: '$M',
  explanationEn: 'Represents pure cash generated from core business operations after funding necessary capital expenditures.',
  explanationTh: 'เงินสดสุทธิที่แท้จริงซึ่งบริษัทสร้างได้จากการดำเนินงานหลัก หักด้วยเงินลงทุนซื้อหรือบำรุงรักษาทรัพย์สินถาวร',
  standardBenchmarkEn: 'Consistent positive FCF with conversion ratio > 80% indicates top-tier cash earnings quality.',
  standardBenchmarkTh: 'FCF ที่เป็นบวกต่อเนื่องและคิดเป็นสัดส่วนมากกว่า 80% บ่งชี้ถึงคุณภาพกำไรระดับสถาบัน'
};

// 1. Does not render when isOpen is false
const closedHtml = renderToString(
  <CalculationModal
    detail={mockDetail}
    isOpen={false}
    onClose={() => {}}
    isThai={false}
  />
);
assert.equal(closedHtml, '', 'Should render empty string when closed');
console.log('✓ CalculationModal closed state verified');

// 2. Renders open state with formula and variables in English
const openEnHtml = renderToString(
  <CalculationModal
    detail={mockDetail}
    isOpen={true}
    onClose={() => {}}
    isThai={false}
    periodLabel="2024-Q4"
  />
);
assert(openEnHtml.includes('Free Cash Flow (FCF)'), 'Should render metric name in English');
assert(openEnHtml.includes('Free Cash Flow = Operating Cash Flow (OCF) - Capital Expenditures (CapEx)'), 'Should render formula');
assert(openEnHtml.includes('OCF'), 'Should render variable symbol');
assert(openEnHtml.includes('CapEx'), 'Should render variable symbol');
assert(openEnHtml.includes('$420.0M'), 'Should format currency variable value');
assert(openEnHtml.includes('280$M'), 'Should render result value and unit');
assert(openEnHtml.includes('Consistent positive FCF'), 'Should render benchmark');
console.log('✓ CalculationModal English rendering verified');

// 3. Renders open state in Thai
const openThHtml = renderToString(
  <CalculationModal
    detail={mockDetail}
    isOpen={true}
    onClose={() => {}}
    isThai={true}
    periodLabel="2024-Q4"
  />
);
assert(openThHtml.includes('กระแสเงินสดอิสระ (FCF)'), 'Should render metric name in Thai');
assert(openThHtml.includes('เงินสดสุทธิที่แท้จริงซึ่งบริษัทสร้างได้จากการดำเนินงานหลัก'), 'Should render explanation in Thai');
assert(openThHtml.includes('FCF ที่เป็นบวกต่อเนื่องและคิดเป็นสัดส่วนมากกว่า 80%'), 'Should render benchmark in Thai');
console.log('✓ CalculationModal Thai rendering verified');

console.log('All CalculationModal component tests passed cleanly.');
