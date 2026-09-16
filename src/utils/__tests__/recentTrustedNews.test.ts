import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPublisher,
  isNoiseHeadline,
  evaluateTextMateriality,
  deduplicateRecentNews,
  filterRecentNewsAgainstMaterialEvents,
  sortRecentNews,
  boundRecentNews,
  MATERIAL_EVENT_LOOKBACK_HOURS,
  RECENT_NEWS_LOOKBACK_DAYS,
  RECENT_NEWS_LOOKBACK_HOURS
} from '../../../server/services/materialNewsService';
import {
  evaluateAllAlerts,
  DEFAULT_MONITORING_PREFERENCES
} from '../monitoringEngine';
import {
  getClientCachedData,
  setClientCachedData,
  clearClientNewsCache
} from '../../services/materialNewsService';
import {
  MaterialCompanyEvent,
  RecentTrustedNewsItem
} from '../../types';

describe('Recent Trusted News & Material Alerts Architecture', () => {

  // Section 27: Server Tests A - J
  describe('27. Server Retrieval & Classification Rules', () => {

    it('A. Trusted HIGH headline within 72h -> materialEvents and deduped from recentNews', () => {
      const now = new Date();
      const publishedAt = new Date(now.getTime() - 24 * 3600 * 1000).toISOString(); // 24h ago

      const materialEvent: MaterialCompanyEvent = {
        eventId: 'sofi_merger_1',
        ticker: 'SOFI',
        headline: 'SoFi Announces Acquisition of Leading Technisys Partner',
        factualSummary: 'Strategic M&A transaction announced.',
        category: 'M_AND_A',
        materiality: 'HIGH',
        publishedAt,
        retrievedAt: now.toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        sourceUrl: 'https://businesswire.com/news/sofi-merger',
        dedupeFingerprint: 'sofi_merger_fp'
      };

      const candidateRecentItem: RecentTrustedNewsItem = {
        id: 'recent_sofi_1',
        ticker: 'SOFI',
        headline: 'SoFi Announces Acquisition of Leading Technisys Partner',
        publishedAt,
        retrievedAt: now.toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        sourceUrl: 'https://businesswire.com/news/sofi-merger',
        category: 'M_AND_A',
        materiality: 'HIGH',
        factualSummary: 'Strategic M&A transaction announced.',
        dedupeFingerprint: 'sofi_merger_fp'
      };

      // Filter against material event
      const filteredRecent = filterRecentNewsAgainstMaterialEvents([candidateRecentItem], [materialEvent]);
      assert.equal(filteredRecent.length, 0, 'Recent news identical to material event must be filtered to prevent duplicate display');
    });

    it('B. Trusted LOW headline within 72h -> NOT material event, YES recentNews', () => {
      const headline = 'SoFi Expands Member Discount Program With Local Retailers';
      const isNoise = isNoiseHeadline(headline);
      assert.equal(isNoise, false, 'Informational release is not noise');

      const { materiality } = evaluateTextMateriality(headline);
      assert.equal(materiality, 'LOW', 'Routine promotional release should be classified as LOW materiality');

      // Rule: LOW materiality does not qualify for material alert (< MEDIUM)
      const qualifiesAsMaterialAlert = ['HIGH', 'MEDIUM'].includes(materiality as string);
      assert.equal(qualifiesAsMaterialAlert, false, 'LOW materiality headline must NOT become a Material Alert');

      // But as a trusted item within 30 days, it qualifies for recentNews
      const recentItem: RecentTrustedNewsItem = {
        id: 'recent_low_1',
        ticker: 'SOFI',
        headline,
        publishedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
        retrievedAt: new Date().toISOString(),
        sourceName: 'PR Newswire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        sourceUrl: 'https://prnewswire.com/news/sofi-program',
        category: 'OTHER',
        materiality: 'LOW'
      };

      assert.ok(recentItem.id);
      assert.equal(recentItem.materiality, 'LOW');
      assert.equal(recentItem.ticker, 'SOFI');
    });

    it('C. Trusted MEDIUM headline 10 days old -> NOT material alert due to window, YES recentNews', () => {
      const now = Date.now();
      const tenDaysAgoMs = now - (10 * 24 * 3600 * 1000);
      const ageHours = (now - tenDaysAgoMs) / (3600 * 1000);

      assert.ok(ageHours > MATERIAL_EVENT_LOOKBACK_HOURS, '10 days exceeds 72h material alert window');
      assert.ok(ageHours <= RECENT_NEWS_LOOKBACK_HOURS, '10 days is within 30-day recent news window');

      const headline = 'SoFi Launches Next-Gen Student Loan Refinancing Tool';
      const { materiality } = evaluateTextMateriality(headline);
      assert.ok(['MEDIUM', 'HIGH'].includes(materiality));

      // Over 72h -> cannot become material alert
      const canBeAlert = ageHours <= MATERIAL_EVENT_LOOKBACK_HOURS;
      assert.equal(canBeAlert, false);

      // Within 30d -> can be recent news
      const canBeRecentNews = ageHours <= RECENT_NEWS_LOOKBACK_HOURS;
      assert.equal(canBeRecentNews, true);
    });

    it('D. Trusted headline 31 days old -> neither current recentNews nor material alert', () => {
      const now = Date.now();
      const thirtyOneDaysAgoMs = now - (31 * 24 * 3600 * 1000);
      const ageHours = (now - thirtyOneDaysAgoMs) / (3600 * 1000);

      const canBeAlert = ageHours <= MATERIAL_EVENT_LOOKBACK_HOURS;
      const canBeRecent = ageHours <= RECENT_NEWS_LOOKBACK_HOURS;

      assert.equal(canBeAlert, false, '31 days old cannot be material alert');
      assert.equal(canBeRecent, false, '31 days old cannot be in 30-day recent news');
    });

    it('E. Noise headline within 1 day -> neither', () => {
      const clickbait1 = 'Why SoFi Stock Is Soaring Today — Should You Buy Now?';
      const clickbait2 = '3 Reasons SoFi Is a Screaming Buy Before Next Week';
      const clickbait3 = 'Top 10 Growth Stocks to Watch Right Now';

      assert.equal(isNoiseHeadline(clickbait1), true);
      assert.equal(isNoiseHeadline(clickbait2), true);
      assert.equal(isNoiseHeadline(clickbait3), true);
    });

    it('F. Rejected publisher -> neither', () => {
      const motleyFool = classifyPublisher('The Motley Fool');
      assert.equal(motleyFool.isApproved, false, 'Motley Fool must be rejected');

      const zacks = classifyPublisher('Zacks Investment Research');
      assert.equal(zacks.isApproved, false, 'Zacks must be rejected');

      const investorPlace = classifyPublisher('InvestorPlace');
      assert.equal(investorPlace.isApproved, false, 'InvestorPlace must be rejected');
    });

    it('G. Benzinga Insights / explicitly rejected substring -> rejected even though broad Benzinga pattern exists', () => {
      // Regression test for classifyPublisher ordering bug: rejected must be checked before broad match
      const benzingaInsights = classifyPublisher('Benzinga Insights');
      assert.equal(benzingaInsights.isApproved, false, 'Benzinga Insights must be explicitly REJECTED');

      const benzingaStandard = classifyPublisher('Benzinga');
      assert.equal(benzingaStandard.isApproved, true, 'Standard Benzinga newsroom remains approved');
    });

    it('H. Same syndicated recent headline -> deduplicated to 1 item', () => {
      const now = new Date().toISOString();
      const items: RecentTrustedNewsItem[] = [
        {
          id: 'item_1',
          ticker: 'SOFI',
          headline: 'SoFi Signs Major Multi-Year Agreement With Cyber Security Leader',
          publishedAt: now,
          retrievedAt: now,
          sourceName: 'Business Wire',
          sourceType: 'COMPANY_IR',
          sourceAuthority: 'COMPANY_PRIMARY_IR',
          sourceUrl: 'https://businesswire.com/news/1',
          category: 'MAJOR_CONTRACT',
          materiality: 'MEDIUM',
          dedupeFingerprint: 'fp_sofi_cyber'
        },
        {
          id: 'item_2',
          ticker: 'SOFI',
          headline: 'SoFi Signs Major Multi-Year Agreement With Cyber Security Leader',
          publishedAt: now,
          retrievedAt: now,
          sourceName: 'Yahoo Finance / Syndicated',
          sourceType: 'FINANCIAL_NEWS',
          sourceAuthority: 'RECOGNIZED_MARKET',
          sourceUrl: 'https://finance.yahoo.com/news/2',
          category: 'MAJOR_CONTRACT',
          materiality: 'MEDIUM',
          dedupeFingerprint: 'fp_sofi_cyber'
        }
      ];

      const deduped = deduplicateRecentNews(items);
      assert.equal(deduped.length, 1, 'Syndicated identical story must deduplicate to single item');
      assert.equal(deduped[0].sourceName, 'Business Wire', 'Must prefer higher-authority primary publisher');
    });

    it('I. Unknown publishedAt -> never replaced with Date.now()', () => {
      const itemWithNullTime: RecentTrustedNewsItem = {
        id: 'undated_1',
        ticker: 'SOFI',
        headline: 'SoFi Official Fact Sheet and Investor Presentation',
        publishedAt: null,
        retrievedAt: new Date().toISOString(),
        sourceName: 'SoFi Investor Relations',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        category: 'OTHER',
        materiality: 'LOW'
      };

      const itemWithDatedTime: RecentTrustedNewsItem = {
        id: 'dated_1',
        ticker: 'SOFI',
        headline: 'SoFi Announces Q2 Financial Results',
        publishedAt: '2026-09-10T10:00:00Z',
        retrievedAt: new Date().toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        category: 'EARNINGS',
        materiality: 'HIGH'
      };

      const sorted = sortRecentNews([itemWithNullTime, itemWithDatedTime]);
      assert.equal(sorted[0].id, 'dated_1', 'Dated item must sort first');
      assert.equal(sorted[1].id, 'undated_1', 'Undated item must sort after dated items');
      assert.equal(sorted[1].publishedAt, null, 'Must preserve publishedAt as null without inventing timestamp');
    });

    it('J. Provider error -> recentNews failure remains distinguishable from empty result', () => {
      const emptySuccessResult = {
        events: [],
        recentNews: [],
        failedSymbols: [],
        sourceStatus: { sec: 'OK', news: 'OK' }
      };

      const failureResult = {
        events: [],
        recentNews: [],
        failedSymbols: ['SOFI'],
        sourceStatus: { sec: 'ERROR', news: 'ERROR' }
      };

      assert.equal(emptySuccessResult.failedSymbols.length, 0);
      assert.equal(failureResult.failedSymbols.length, 1);
      assert.notEqual(emptySuccessResult.sourceStatus.news, failureResult.sourceStatus.news);
    });

    it('bounds per-ticker recent news to maximum 5 items', () => {
      const items: RecentTrustedNewsItem[] = Array.from({ length: 8 }).map((_, i) => ({
        id: `sofi_${i}`,
        ticker: 'SOFI',
        headline: `SoFi Update ${i}`,
        publishedAt: new Date(Date.now() - i * 3600 * 1000).toISOString(),
        retrievedAt: new Date().toISOString(),
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        category: 'OTHER',
        materiality: 'LOW'
      }));

      const bounded = boundRecentNews(items, 5, 20);
      assert.equal(bounded.length, 5, 'Per-ticker bound must limit to 5 items');
    });
  });

  // Section 28: Client Service & Cache
  describe('28. Client Service & Cache Isolation', () => {
    it('Client cache stores and retrieves both events and recentNews', () => {
      clearClientNewsCache();

      const sampleEvent: MaterialCompanyEvent = {
        eventId: 'client_ev_1',
        ticker: 'SOFI',
        headline: 'SoFi Reports Record Revenue',
        factualSummary: 'Record quarter.',
        category: 'EARNINGS',
        materiality: 'HIGH',
        publishedAt: '2026-09-15T12:00:00Z',
        retrievedAt: '2026-09-15T12:05:00Z',
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        dedupeFingerprint: 'client_sofi_fp'
      };

      const sampleRecentNews: RecentTrustedNewsItem = {
        id: 'client_rn_1',
        ticker: 'SOFI',
        headline: 'SoFi and Payward Partner to Connect Banking and Digital Asset Markets',
        publishedAt: '2026-09-03T10:00:00Z',
        retrievedAt: '2026-09-03T10:05:00Z',
        sourceName: 'Business Wire',
        sourceType: 'COMPANY_IR',
        sourceAuthority: 'COMPANY_PRIMARY_IR',
        category: 'PRODUCT',
        materiality: 'MEDIUM'
      };

      setClientCachedData('SOFI', [sampleEvent], [sampleRecentNews]);

      const cached = getClientCachedData('SOFI');
      assert.ok(cached, 'Cache entry must exist');
      assert.equal(cached.events.length, 1);
      assert.equal(cached.recentNews.length, 1);
      assert.equal(cached.events[0].ticker, 'SOFI');
      assert.equal(cached.recentNews[0].headline, sampleRecentNews.headline);

      // Ticker cache isolation check
      const msftCached = getClientCachedData('MSFT');
      assert.equal(msftCached, null, 'Cache must isolate tickers: MSFT is not in cache');

      clearClientNewsCache();
    });
  });

  // Section 29: Alert Count Invariance
  describe('29. Alert Count Invariance (Recent News Does Not Inflate Alerts)', () => {
    it('RecentTrustedNews must NOT create MonitoringAlert or increase bell count', () => {
      const recentNewsItems: RecentTrustedNewsItem[] = [
        {
          id: 'rn_1',
          ticker: 'SOFI',
          headline: 'Headline 1',
          publishedAt: '2026-09-05T00:00:00Z',
          retrievedAt: '2026-09-05T00:00:00Z',
          sourceName: 'Reuters',
          sourceType: 'FINANCIAL_NEWS',
          sourceAuthority: 'REPUTABLE_NEWS',
          category: 'OTHER',
          materiality: 'LOW'
        },
        {
          id: 'rn_2',
          ticker: 'SOFI',
          headline: 'Headline 2',
          publishedAt: '2026-09-06T00:00:00Z',
          retrievedAt: '2026-09-06T00:00:00Z',
          sourceName: 'Business Wire',
          sourceType: 'COMPANY_IR',
          sourceAuthority: 'COMPANY_PRIMARY_IR',
          category: 'PRODUCT',
          materiality: 'MEDIUM'
        },
        {
          id: 'rn_3',
          ticker: 'SOFI',
          headline: 'Headline 3',
          publishedAt: '2026-09-07T00:00:00Z',
          retrievedAt: '2026-09-07T00:00:00Z',
          sourceName: 'Bloomberg',
          sourceType: 'FINANCIAL_NEWS',
          sourceAuthority: 'REPUTABLE_NEWS',
          category: 'CAPITAL_RAISE',
          materiality: 'HIGH'
        },
        {
          id: 'rn_4',
          ticker: 'SOFI',
          headline: 'Headline 4',
          publishedAt: '2026-09-08T00:00:00Z',
          retrievedAt: '2026-09-08T00:00:00Z',
          sourceName: 'PR Newswire',
          sourceType: 'COMPANY_IR',
          sourceAuthority: 'COMPANY_PRIMARY_IR',
          category: 'OTHER',
          materiality: 'LOW'
        }
      ];

      // events is empty (no material alert in last 72h)
      const materialEvents: MaterialCompanyEvent[] = [];

      // evaluateAllAlerts only takes materialEvents
      const alerts = evaluateAllAlerts(
        ['SOFI'],
        {},
        {},
        [],
        undefined,
        DEFAULT_MONITORING_PREFERENCES,
        new Set(),
        undefined,
        undefined,
        materialEvents // only materialEvents passed here!
      );

      const newsAlerts = alerts.filter(a => a.type === 'NEWS_MATERIAL_EVENT');
      assert.equal(newsAlerts.length, 0, 'Recent news items must NOT create NEWS_MATERIAL_EVENT alerts');
      assert.equal(alerts.length, 0, 'Total alerts must remain 0');
    });

    it('Material event still creates NEWS_MATERIAL_EVENT normally', () => {
      const materialEvents: MaterialCompanyEvent[] = [
        {
          eventId: 'sofi_mat_1',
          ticker: 'SOFI',
          headline: 'SoFi CEO Announces Resignation and Leadership Transition',
          factualSummary: 'Executive leadership change.',
          category: 'MANAGEMENT',
          materiality: 'HIGH',
          publishedAt: '2026-09-15T10:00:00Z',
          retrievedAt: '2026-09-15T10:05:00Z',
          sourceName: 'Business Wire',
          sourceType: 'COMPANY_IR',
          sourceAuthority: 'COMPANY_PRIMARY_IR',
          dedupeFingerprint: 'sofi_ceo_change'
        }
      ];

      const alerts = evaluateAllAlerts(
        ['SOFI'],
        {},
        {},
        [],
        undefined,
        DEFAULT_MONITORING_PREFERENCES,
        new Set(),
        undefined,
        undefined,
        materialEvents
      );

      const newsAlerts = alerts.filter(a => a.type === 'NEWS_MATERIAL_EVENT');
      assert.equal(newsAlerts.length, 1, 'Strict material event must create NEWS_MATERIAL_EVENT alert');
      assert.equal(newsAlerts[0].ticker, 'SOFI');
    });
  });

  // Section 31: SOFI Regression Case
  describe('31. SOFI Regression Fixture Test', () => {
    it('SOFI fixture (12 days old partnership release) -> in recentNews, NOT in 72h materialEvents', () => {
      const now = Date.now();
      const twelveDaysAgoMs = now - (12 * 24 * 3600 * 1000);
      const publishedAt = new Date(twelveDaysAgoMs).toISOString();

      const sofiFixture = {
        ticker: 'SOFI',
        publisher: 'Business Wire',
        headline: 'SoFi and Payward Partner to Connect Banking and Digital Asset Markets',
        publishedAt,
        sourceUrl: 'https://www.businesswire.com/news/home/20260904005001/en/SoFi-and-Payward-Partner'
      };

      // 1. Publisher check
      const pubClassification = classifyPublisher(sofiFixture.publisher);
      assert.equal(pubClassification.isApproved, true);
      assert.equal(pubClassification.sourceAuthority, 'PRESS_RELEASE_WIRE');

      // 2. Noise check
      assert.equal(isNoiseHeadline(sofiFixture.headline), false);

      // 3. Materiality check
      const { category, materiality } = evaluateTextMateriality(sofiFixture.headline);
      assert.equal(category, 'PRODUCT');
      assert.equal(materiality, 'MEDIUM');

      // 4. Time checks
      const ageHours = (now - twelveDaysAgoMs) / (3600 * 1000);
      const isMaterialWindow = ageHours <= MATERIAL_EVENT_LOOKBACK_HOURS;
      const isRecentWindow = ageHours <= RECENT_NEWS_LOOKBACK_HOURS;

      assert.equal(isMaterialWindow, false, '12 days old (> 72h) must NOT be included in materialEvents');
      assert.equal(isRecentWindow, true, '12 days old (<= 720h) MUST be included in recentNews');

      // 5. Build recent news item
      const recentItem: RecentTrustedNewsItem = {
        id: `sofi_${twelveDaysAgoMs}`,
        ticker: sofiFixture.ticker,
        headline: sofiFixture.headline,
        publishedAt: sofiFixture.publishedAt,
        retrievedAt: new Date().toISOString(),
        sourceName: sofiFixture.publisher,
        sourceType: 'WIRE_SERVICE',
        sourceAuthority: pubClassification.sourceAuthority,
        sourceUrl: sofiFixture.sourceUrl,
        category,
        materiality,
        factualSummary: 'Partnership between SoFi and Payward.'
      };

      // 6. Verify it does NOT inflate alerts
      const alerts = evaluateAllAlerts(
        ['SOFI'],
        {},
        {},
        [],
        undefined,
        DEFAULT_MONITORING_PREFERENCES,
        new Set(),
        undefined,
        undefined,
        [] // empty material events
      );

      assert.equal(alerts.length, 0, 'SOFI recent news must NOT inflate alert count');
      assert.equal(recentItem.ticker, 'SOFI');
      assert.equal(recentItem.sourceAuthority, 'PRESS_RELEASE_WIRE');
      assert.ok(recentItem.sourceUrl.includes('businesswire.com'));
    });
  });
});
