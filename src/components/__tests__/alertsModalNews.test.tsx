import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AlertsModal } from '../AlertsModal';
import { DEFAULT_MONITORING_PREFERENCES } from '../../utils/monitoringEngine';
import { MonitoringAlert, RecentTrustedNewsItem } from '../../types';

describe('AlertsModal News & Events Tab UX (Cases A, B, C, D)', () => {
  const dummyPreferences = DEFAULT_MONITORING_PREFERENCES;
  const noop = () => {};

  it('Case B: No material events, Recent Trusted News exists -> renders positive status banner and news items', () => {
    const recentNews: RecentTrustedNewsItem[] = [
      {
        id: 'sofi_recent_1',
        ticker: 'SOFI',
        headline: 'Goldman Sachs Communacopia & Technology Conference',
        publishedAt: '2026-09-08T14:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        sourceUrl: 'https://businesswire.com/news/sofi-conf',
        category: 'OTHER',
        materiality: 'LOW',
        factualSummary: 'Official conference appearance.'
      },
      {
        id: 'sofi_recent_2',
        ticker: 'SOFI',
        headline: 'SoFi and Payward Partner to Connect Banking and Digital Asset Markets',
        publishedAt: '2026-09-03T10:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'PR Newswire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        sourceUrl: 'https://prnewswire.com/news/sofi-payward',
        category: 'PRODUCT',
        materiality: 'MEDIUM',
        factualSummary: 'Partnership announcement.'
      }
    ];

    // Thai rendering
    const htmlTh = renderToString(
      <AlertsModal
        isOpen={true}
        onClose={noop}
        isThai={true}
        alerts={[]}
        recentNews={recentNews}
        preferences={dummyPreferences}
        onUpdatePreferences={noop}
        onMarkAsRead={noop}
        onMarkAllAsRead={noop}
        initialFilterType="news"
      />
    );

    assert.match(htmlTh, /ไม่มีเหตุการณ์สำคัญใน 72 ชั่วโมงล่าสุด/);
    assert.match(htmlTh, /ข่าวล่าสุดจากแหล่งที่เชื่อถือได้/);
    assert.match(htmlTh, /Goldman Sachs Communacopia/);
    assert.match(htmlTh, /SoFi and Payward Partner/);
    assert.match(htmlTh, /เปิดแหล่งข่าว/);
    assert.match(htmlTh, /href="https:\/\/businesswire.com\/news\/sofi-conf"/);

    // English rendering
    const htmlEn = renderToString(
      <AlertsModal
        isOpen={true}
        onClose={noop}
        isThai={false}
        alerts={[]}
        recentNews={recentNews}
        preferences={dummyPreferences}
        onUpdatePreferences={noop}
        onMarkAsRead={noop}
        onMarkAllAsRead={noop}
        initialFilterType="news"
      />
    );

    assert.match(htmlEn, /No material events in the last 72 hours/);
    assert.match(htmlEn, /Recent Trusted News/);
    assert.match(htmlEn, /Open Source/);
  });

  it('Case C: No material events and No recent news -> renders truthful 30-day empty message', () => {
    const htmlTh = renderToString(
      <AlertsModal
        isOpen={true}
        onClose={noop}
        isThai={true}
        alerts={[]}
        recentNews={[]}
        preferences={dummyPreferences}
        onUpdatePreferences={noop}
        onMarkAsRead={noop}
        onMarkAllAsRead={noop}
        initialFilterType="news"
      />
    );

    assert.match(htmlTh, /ไม่พบเหตุการณ์สำคัญล่าสุด/);
    assert.match(htmlTh, /ไม่พบข่าวล่าสุดจากแหล่งที่ผ่านเกณฑ์ในช่วง 30 วันที่ตรวจสอบ/);

    const htmlEn = renderToString(
      <AlertsModal
        isOpen={true}
        onClose={noop}
        isThai={false}
        alerts={[]}
        recentNews={[]}
        preferences={dummyPreferences}
        onUpdatePreferences={noop}
        onMarkAsRead={noop}
        onMarkAllAsRead={noop}
        initialFilterType="news"
      />
    );

    assert.match(htmlEn, /No Material Recent Events Found/);
    assert.match(htmlEn, /No trusted recent headlines found in the 30-day review window/);
  });

  it('Case D: Provider error -> renders failure message with retry, does NOT claim no news found', () => {
    const htmlTh = renderToString(
      <AlertsModal
        isOpen={true}
        onClose={noop}
        isThai={true}
        alerts={[]}
        recentNews={[]}
        preferences={dummyPreferences}
        onUpdatePreferences={noop}
        onMarkAsRead={noop}
        onMarkAllAsRead={noop}
        newsError="Network connection timed out"
        initialFilterType="news"
      />
    );

    assert.match(htmlTh, /ไม่สามารถดึงข้อมูลข่าวและเหตุการณ์ได้ในขณะนี้/);
    assert.doesNotMatch(htmlTh, /ไม่พบข่าวล่าสุดจากแหล่งที่ผ่านเกณฑ์ในช่วง 30 วันที่ตรวจสอบ/);

    const htmlEn = renderToString(
      <AlertsModal
        isOpen={true}
        onClose={noop}
        isThai={false}
        alerts={[]}
        recentNews={[]}
        preferences={dummyPreferences}
        onUpdatePreferences={noop}
        onMarkAsRead={noop}
        onMarkAllAsRead={noop}
        newsError="Network connection timed out"
        initialFilterType="news"
      />
    );

    assert.match(htmlEn, /Failed to Retrieve Recent News/);
    assert.doesNotMatch(htmlEn, /No trusted recent headlines found in the 30-day review window/);
  });

  it('Case A: Material event exists alongside recent news -> shows both material alert and additional recent news', () => {
    const materialAlert: MonitoringAlert = {
      id: 'alert_sofi_ceo',
      ticker: 'SOFI',
      type: 'NEWS_MATERIAL_EVENT',
      severity: 'warning',
      title: 'SoFi CEO Announces Resignation',
      titleTh: 'SoFi ประกาศการลาออกของ CEO',
      message: 'Executive leadership change announced.',
      messageTh: 'ประกาศการปรับเปลี่ยนผู้นำองค์กร',
      isRead: false,
      timestamp: Date.now() - 3600 * 1000,
      dateStr: '2026-09-15',
      sourceType: 'COMPANY_IR',
      sourceAuthority: 'COMPANY_PRIMARY_IR',
      evidence: {
        metricName: 'Source',
        currentValue: 'Business Wire'
      }
    };

    const recentNewsItem: RecentTrustedNewsItem = {
      id: 'sofi_extra_1',
      ticker: 'SOFI',
      headline: 'SoFi Partners With National Credit Union',
      publishedAt: '2026-09-02T10:00:00Z',
      retrievedAt: new Date().toISOString(),
      sourceName: 'PR Newswire',
      sourceType: 'COMPANY_IR',
      sourceAuthority: 'COMPANY_PRIMARY_IR',
      category: 'PRODUCT',
      materiality: 'MEDIUM'
    };

    const htmlTh = renderToString(
      <AlertsModal
        isOpen={true}
        onClose={noop}
        isThai={true}
        alerts={[materialAlert]}
        recentNews={[recentNewsItem]}
        preferences={dummyPreferences}
        onUpdatePreferences={noop}
        onMarkAsRead={noop}
        onMarkAllAsRead={noop}
        initialFilterType="news"
      />
    );

    // Material alert should be visible
    assert.match(htmlTh, /SoFi ประกาศการลาออกของ CEO/);

    // Additional recent news section should be visible
    assert.match(htmlTh, /ข่าวล่าสุดเพิ่มเติมจากแหล่งที่เชื่อถือได้/);
    assert.match(htmlTh, /SoFi Partners With National Credit Union/);
  });
});
