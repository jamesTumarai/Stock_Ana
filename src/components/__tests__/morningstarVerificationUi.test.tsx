import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MorningstarResearchSection } from '../MorningstarResearchSection';
import type { MorningstarResearchData } from '../../types';

test('missing Morningstar data is unknown coverage, never evidence that analysts do not cover the company', () => {
  for (const data of [undefined, { has_coverage: false }]) {
    for (const isThai of [false, true]) {
      const html = renderToStaticMarkup(<MorningstarResearchSection ticker="TEST" data={data} isThai={isThai} />);
      assert.doesNotMatch(html, /Status: Uncovered|not under active coverage|สถานะ: ไม่อยู่ในกลุ่มจัดอันดับ|large-to-mid-cap/);
      assert.match(html, isThai ? /ยังยืนยันข้อมูลไม่ได้/ : /Coverage unverified/);
    }
  }
});

test('model status text cannot certify an external estimate, including immutable legacy reports', () => {
  const data: MorningstarResearchData = {
    has_coverage: true, fair_value_estimate: 210, rating_stars: 4,
    status_note: 'Verified from Morningstar Equity Research Report dated August 2026',
    status_note_th: 'ผ่านการตรวจสอบและเทียบเคียงข้อมูล',
  };
  const before = structuredClone(data);
  for (const isThai of [false, true]) {
    const html = renderToStaticMarkup(<MorningstarResearchSection ticker="TEST" data={data} currentPrice={100} isThai={isThai} />);
    assert.doesNotMatch(html, /institutional verification|Verified from Morningstar|ผ่านการตรวจสอบและเทียบเคียงข้อมูล/);
    assert.match(html, isThai ? /ยังไม่ได้ตรวจสอบอย่างอิสระ/ : /Not independently verified/);
    assert.match(html, /210/);
  }
  assert.deepEqual(data, before);
});
