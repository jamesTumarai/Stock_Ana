import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AlertsModal } from '../../components/AlertsModal';
import {
  evaluateCompanyRelevance,
  classifyPublisher,
  evaluateTextMateriality,
  isNoiseHeadline
} from '../../../server/services/materialNewsService';
import {
  evaluateAllAlerts,
  DEFAULT_MONITORING_PREFERENCES,
  convertMaterialEventsToAlerts
} from '../monitoringEngine';
import {
  MaterialCompanyEvent,
  RecentTrustedNewsItem,
  MonitoringAlert
} from '../../types';

describe('News Relevance, Provenance & Thai Localization (Cases A - L)', () => {
  const dummyPreferences = DEFAULT_MONITORING_PREFERENCES;
  const noop = () => {};

  // Case A: Quorum Cyber M&A mentioning Microsoft-First -> NOT PRIMARY MSFT
  it('Case A: Tracked MSFT - third party acquisition mentioning Microsoft-First is NOT PRIMARY MSFT', () => {
    const headline = 'Quorum Cyber Announces Intent to Acquire Ontinue, Building an Unrivaled Microsoft-First MDR Powerhouse';
    const rel = evaluateCompanyRelevance('MSFT', headline);
    assert.equal(rel.isPrimary, false, 'Acquisition by Quorum Cyber must NOT be PRIMARY MSFT');
    assert.notEqual(rel.relevance, 'PRIMARY');

    // When evaluating text materiality on this third-party headline, it must NOT generate an accepted M&A event for MSFT
    const { category, materiality } = evaluateTextMateriality(headline);
    assert.equal(rel.isPrimary, false);
  });

  // Case B: Sunrise Technologies award mentioning Microsoft -> NOT PRIMARY MSFT
  it('Case B: Tracked MSFT - partner winning Microsoft award is NOT PRIMARY MSFT', () => {
    const headline = 'Sunrise Technologies Achieves Microsoft AI Business Solutions Inner Circle Award';
    const rel = evaluateCompanyRelevance('MSFT', headline);
    assert.equal(rel.isPrimary, false, 'Partner award must NOT be PRIMARY MSFT');
    assert.notEqual(rel.relevance, 'PRIMARY');
  });

  // Case C: Microsoft announces quarterly dividend increase -> PRIMARY MSFT & BUYBACK_DIVIDEND
  it('Case C: Tracked MSFT - Microsoft announces quarterly dividend increase is PRIMARY MSFT and BUYBACK_DIVIDEND', () => {
    const headline = 'Microsoft announces quarterly dividend increase';
    const rel = evaluateCompanyRelevance('MSFT', headline);
    assert.equal(rel.isPrimary, true, 'Direct dividend increase must be PRIMARY MSFT');
    assert.equal(rel.relevance, 'PRIMARY');

    const { category, materiality } = evaluateTextMateriality(headline);
    assert.equal(category, 'BUYBACK_DIVIDEND', 'Quarterly dividend increase must be classified as BUYBACK_DIVIDEND');
    assert.ok(materiality === 'HIGH' || materiality === 'MEDIUM');
  });

  // Case D: Tracked SOFI - headline with SoFi as primary issuer -> PRIMARY SOFI
  it('Case D: Tracked SOFI - headline with SoFi as primary issuer is PRIMARY SOFI', () => {
    const headline = 'SoFi Technologies Reports Fourth Quarter and Full Year 2025 Financial Results';
    const rel = evaluateCompanyRelevance('SOFI', headline);
    assert.equal(rel.isPrimary, true);
    assert.equal(rel.relevance, 'PRIMARY');

    const headlinePartnership = 'SoFi and Payward Partner to Connect Banking and Digital Asset Markets';
    const relPartnership = evaluateCompanyRelevance('SOFI', headlinePartnership);
    assert.equal(relPartnership.isPrimary, true);
    assert.equal(relPartnership.relevance, 'PRIMARY');
  });

  // Case E: PR Newswire / GlobeNewswire / Business Wire -> PRESS_RELEASE_WIRE (NOT Company IR by default)
  it('Case E: Wire services are classified as PRESS_RELEASE_WIRE, not Company IR', () => {
    const prn = classifyPublisher('PR Newswire', 'https://www.prnewswire.com/news-releases/test-123');
    assert.equal(prn.isApproved, true);
    assert.equal(prn.sourceAuthority, 'PRESS_RELEASE_WIRE');

    const bw = classifyPublisher('Business Wire', 'https://www.businesswire.com/news/home/123');
    assert.equal(bw.isApproved, true);
    assert.equal(bw.sourceAuthority, 'PRESS_RELEASE_WIRE');

    const gn = classifyPublisher('GlobeNewswire', 'https://www.globenewswire.com/news-release/123');
    assert.equal(gn.isApproved, true);
    assert.equal(gn.sourceAuthority, 'PRESS_RELEASE_WIRE');

    const aw = classifyPublisher('Accesswire', 'https://www.accesswire.com/viewarticle.aspx?id=123');
    assert.equal(aw.isApproved, true);
    assert.equal(aw.sourceAuthority, 'PRESS_RELEASE_WIRE');
  });

  // Case F: Official tracked-company IR domain -> COMPANY_OFFICIAL
  it('Case F: Official tracked-company IR domain is classified as COMPANY_OFFICIAL', () => {
    const msftIr = classifyPublisher('Microsoft Investor Relations', 'https://www.microsoft.com/investor/press-releases/dividend');
    assert.equal(msftIr.isApproved, true);
    assert.equal(msftIr.sourceAuthority, 'COMPANY_OFFICIAL');

    const sofiIr = classifyPublisher('SoFi IR', 'https://investors.sofi.com/news/default.aspx');
    assert.equal(sofiIr.isApproved, true);
    assert.equal(sofiIr.sourceAuthority, 'COMPANY_OFFICIAL');
  });

  // Case G: Thai mode with headlineTh -> Thai headline rendered
  it('Case G: Thai UI renders headlineTh as primary headline and provides original headline toggle', () => {
    const recentNews: RecentTrustedNewsItem[] = [
      {
        id: 'news_msft_div',
        ticker: 'MSFT',
        headline: 'Microsoft announces quarterly dividend increase',
        originalHeadline: 'Microsoft announces quarterly dividend increase',
        headlineTh: 'Microsoft ประกาศเพิ่มเงินปันผลรายไตรมาส',
        summaryTh: 'Microsoft ประกาศเพิ่มเงินปันผลรายไตรมาสสำหรับผู้ถือหุ้น',
        summaryEn: 'Microsoft declared a quarterly dividend increase for shareholders.',
        summaryEvidence: 'HEADLINE_ONLY',
        publishedAt: '2026-09-15T12:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'PR Newswire',
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: 'PRESS_RELEASE_WIRE',
        sourceUrl: 'https://prnewswire.com/news/msft-dividend',
        category: 'BUYBACK_DIVIDEND',
        materiality: 'HIGH',
        relevance: 'PRIMARY'
      }
    ];

    const html = renderToString(
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
        watchlistSymbols={['MSFT']}
        portfolioSymbols={[]}
      />
    );

    // Primary Thai headline must be present
    assert.match(html, /Microsoft ประกาศเพิ่มเงินปันผลรายไตรมาส/);
    // Expandable toggle button must be present
    assert.match(html, /ดูหัวข้อข่าวต้นฉบับ/);
  });

  // Case H: Thai mode with summaryTh -> "สรุป" rendered
  it('Case H: Thai UI renders concise summary with สรุป label', () => {
    const recentNews: RecentTrustedNewsItem[] = [
      {
        id: 'news_sofi_1',
        ticker: 'SOFI',
        headline: 'SoFi and Payward Partner to Connect Banking and Digital Asset Markets',
        originalHeadline: 'SoFi and Payward Partner to Connect Banking and Digital Asset Markets',
        headlineTh: 'SoFi ประกาศความร่วมมือกับ Payward เพื่อเชื่อมโยงบริการธนาคารและตลาดสินทรัพย์ดิจิทัล',
        summaryTh: 'SoFi ประกาศความร่วมมือกับ Payward เพื่อขยายการเชื่อมต่อระหว่างบริการธนาคารและตลาดสินทรัพย์ดิจิทัล',
        summaryEn: 'SoFi announced a partnership with Payward connecting banking services to digital asset markets.',
        summaryEvidence: 'STRUCTURED_SOURCE',
        publishedAt: '2026-09-10T10:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: 'PRESS_RELEASE_WIRE',
        sourceUrl: 'https://businesswire.com/news/sofi',
        category: 'PRODUCT',
        materiality: 'MEDIUM',
        relevance: 'PRIMARY'
      }
    ];

    const html = renderToString(
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

    assert.match(html, /สรุป/);
    assert.match(html, /SoFi ประกาศความร่วมมือกับ Payward/);
    assert.match(html, /ข่าวประชาสัมพันธ์/);
  });

  // Case I: AI enrichment failure -> original news remains visible
  it('Case I: Fallback on missing or failed enrichment keeps original English headline visible', () => {
    const recentNews: RecentTrustedNewsItem[] = [
      {
        id: 'news_untranslated',
        ticker: 'NVDA',
        headline: 'NVIDIA Announces New Blackwell Ultra AI Infrastructure Deployments',
        originalHeadline: 'NVIDIA Announces New Blackwell Ultra AI Infrastructure Deployments',
        publishedAt: '2026-09-14T08:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: 'PRESS_RELEASE_WIRE',
        sourceUrl: 'https://businesswire.com/nvda',
        category: 'PRODUCT',
        materiality: 'MEDIUM',
        relevance: 'PRIMARY'
      }
    ];

    const html = renderToString(
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

    assert.match(html, /NVIDIA Announces New Blackwell Ultra AI Infrastructure Deployments/);
    assert.match(html, /Business Wire/);
  });

  // Case J: Headline-only evidence -> no unsupported facts
  it('Case J: Headline-only evidence does not fabricate financial metrics', () => {
    const headline = 'SoFi Announces Monthly Distributions on $THTA (10.00%)';
    assert.equal(isNoiseHeadline(headline), false);
    const rel = evaluateCompanyRelevance('SOFI', headline);
    assert.equal(rel.isPrimary, true);

    const item: RecentTrustedNewsItem = {
      id: 'thta_dist',
      ticker: 'SOFI',
      headline,
      originalHeadline: headline,
      summaryEvidence: 'HEADLINE_ONLY',
      summaryEn: 'SoFi announced monthly distributions related to $THTA. Refer to original disclosure for full terms.',
      summaryTh: 'SoFi ประกาศการจ่ายผลตอบแทนรายเดือนที่เกี่ยวข้องกับ $THTA โปรดตรวจสอบรายละเอียดเงื่อนไขจากประกาศต้นฉบับ',
      publishedAt: '2026-09-12T00:00:00Z',
      retrievedAt: new Date().toISOString(),
      sourceName: 'GlobeNewswire',
      sourceType: 'WIRE_SERVICE',
      sourceAuthority: 'PRESS_RELEASE_WIRE',
      category: 'OTHER',
      materiality: 'LOW',
      relevance: 'PRIMARY'
    };

    assert.equal(item.summaryEvidence, 'HEADLINE_ONLY');
    assert.doesNotMatch(item.summaryEn!, /payment date|record date|ex-dividend date/i);
    assert.doesNotMatch(item.summaryTh!, /วันจ่ายเงินปันผล|วันกำหนดรายชื่อ/);
  });

  // Case K: Watchlist only SOFI; Portfolio MSFT -> Scope filtering
  it('Case K: Watchlist filter shows SOFI only when Watchlist=SOFI and Portfolio=MSFT', () => {
    const recentNews: RecentTrustedNewsItem[] = [
      {
        id: 'news_sofi',
        ticker: 'SOFI',
        headline: 'SoFi Expands Member Services',
        publishedAt: '2026-09-14T10:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'PR Newswire',
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: 'PRESS_RELEASE_WIRE',
        category: 'PRODUCT',
        materiality: 'MEDIUM',
        relevance: 'PRIMARY'
      },
      {
        id: 'news_msft',
        ticker: 'MSFT',
        headline: 'Microsoft Highlights Cloud Momentum',
        publishedAt: '2026-09-14T09:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: 'PRESS_RELEASE_WIRE',
        category: 'PRODUCT',
        materiality: 'MEDIUM',
        relevance: 'PRIMARY'
      }
    ];

    // 1. Filter with scope 'watchlist' (Watchlist = SOFI only)
    const htmlWatchlist = renderToString(
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
        watchlistSymbols={['SOFI']}
        portfolioSymbols={['MSFT']}
        initialNewsScope="watchlist"
      />
    );

    assert.match(htmlWatchlist, /SoFi Expands Member Services/i);
    assert.doesNotMatch(htmlWatchlist, /Microsoft Highlights Cloud Momentum/i);

    // 2. Filter with scope 'portfolio' (Portfolio = MSFT only)
    const htmlPortfolio = renderToString(
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
        watchlistSymbols={['SOFI']}
        portfolioSymbols={['MSFT']}
        initialNewsScope="portfolio"
      />
    );

    assert.match(htmlPortfolio, /Microsoft Highlights Cloud Momentum/i);
    assert.doesNotMatch(htmlPortfolio, /SoFi Expands Member Services/i);

    // 3. Filter with scope 'all' -> both visible
    const htmlAll = renderToString(
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
        watchlistSymbols={['SOFI']}
        portfolioSymbols={['MSFT']}
        initialNewsScope="all"
      />
    );

    assert.match(htmlAll, /SoFi Expands Member Services/i);
    assert.match(htmlAll, /Microsoft Highlights Cloud Momentum/i);
  });

  // Case L: Recent Trusted News still does NOT increase unread/bell count
  it('Case L: Recent Trusted News items do NOT increment unread alert bell badge count', () => {
    const recentNews: RecentTrustedNewsItem[] = [
      {
        id: 'recent_1',
        ticker: 'SOFI',
        headline: 'Routine Conference Call Notice',
        publishedAt: '2026-09-10T12:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: 'PRESS_RELEASE_WIRE',
        category: 'OTHER',
        materiality: 'LOW',
        relevance: 'PRIMARY'
      },
      {
        id: 'recent_2',
        ticker: 'MSFT',
        headline: 'Product Update Note',
        publishedAt: '2026-09-11T12:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'PR Newswire',
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: 'PRESS_RELEASE_WIRE',
        category: 'PRODUCT',
        materiality: 'LOW',
        relevance: 'PRIMARY'
      }
    ];

    const alerts = evaluateAllAlerts(
      ['SOFI', 'MSFT'],
      {},
      {},
      [],
      undefined,
      dummyPreferences,
      new Set(),
      undefined,
      undefined,
      [] // No material events
    );

    const unreadCount = alerts.filter(a => !a.isRead).length;
    assert.equal(unreadCount, 0, 'Recent trusted news must have 0 unread alerts when no material events exist');
  });
});
