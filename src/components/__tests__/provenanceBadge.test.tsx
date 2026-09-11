import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ProvenanceBadge } from '../ProvenanceBadge';

// 1. Render Verified Badge (English)
const verifiedHtml = renderToString(<ProvenanceBadge classification="verified" isThai={false} />);
assert.match(verifiedHtml, /Verified Fact/);
assert.match(verifiedHtml, /bg-emerald-50/);
assert.match(verifiedHtml, /border-emerald-200/);

// 2. Render Verified Badge (Thai)
const verifiedThHtml = renderToString(<ProvenanceBadge classification="verified" isThai={true} />);
assert.match(verifiedThHtml, /ข้อมูลตรวจสอบแล้ว/);

// 3. Render Calculated Badge
const calcHtml = renderToString(<ProvenanceBadge classification="calculated" isThai={false} />);
assert.match(calcHtml, /Calculated/);
assert.match(calcHtml, /bg-sky-50/);

// 4. Render Model Assumption Badge
const assumptionHtml = renderToString(<ProvenanceBadge classification="assumption" isThai={true} />);
assert.match(assumptionHtml, /สมมติฐานแบบจำลอง/);
assert.match(assumptionHtml, /bg-amber-50/);

// 5. Render AI Interpretation Badge
const aiHtml = renderToString(<ProvenanceBadge classification="ai_interpretation" isThai={false} />);
assert.match(aiHtml, /AI Interpretation/);
assert.match(aiHtml, /bg-purple-50/);

// 6. Custom label override
const customHtml = renderToString(
  <ProvenanceBadge classification="verified" isThai={false} label="SEC 10-K Verified" />
);
assert.match(customHtml, /SEC 10-K Verified/);

console.log('✓ ProvenanceBadge component tests passed completely.');
