import { ResearchMemorySnapshot } from './investmentMemory';
import { InvestmentThesisRecord, TrackedExpectation } from './thesisExpectations';
import { WhatChangedResult } from './whatChangedEngine';

export type AttentionPriority = 'URGENT_ATTENTION' | 'REVIEW_RECOMMENDED' | 'ROUTINE_MONITORING';

export interface WatchlistAttentionFactor {
  code: string;
  points: number;
  label: string;
  labelTh: string;
  detail: string;
  detailTh: string;
}

export interface WatchlistIntelligenceEntry {
  ticker: string;
  priority: AttentionPriority;
  attentionScore: number; // 0 - 100
  factors: WatchlistAttentionFactor[];
  latestResearchDate: string | null;
  daysSinceResearch: number | null;
  latestReportId: string | null;
  currentPrice: number | null;
  fairValue: number | null;
  marginOfSafetyPct: number | null;
  thesisStatus: string | null;
  unresolvedExpectationsCount: number;
  missedExpectationsCount: number;
  materialChangesCount: number;
  isOwnedInPortfolio: boolean;
  summaryReason: string;
  summaryReasonTh: string;
}

/**
 * Computes deterministic attention priority scoring and explainable reason breakdown for a watchlist ticker.
 */
export function computeWatchlistIntelligence(
  ticker: string,
  currentSnapshot: ResearchMemorySnapshot | null,
  previousSnapshot: ResearchMemorySnapshot | null,
  activeThesis: InvestmentThesisRecord | null,
  expectations: TrackedExpectation[] = [],
  whatChanged: WhatChangedResult | null = null,
  isOwned: boolean = false,
  livePrice?: number | null
): WatchlistIntelligenceEntry {
  const cleanTicker = ticker.toUpperCase().trim();
  const factors: WatchlistAttentionFactor[] = [];
  let score = 0;

  const now = Date.now();
  let daysSinceResearch: number | null = null;
  if (currentSnapshot?.createdTimestamp) {
    daysSinceResearch = Math.max(0, Math.round((now - currentSnapshot.createdTimestamp) / (1000 * 60 * 60 * 24)));
  }

  // 1. Invalidation Condition Trigger (+40 pts)
  if (activeThesis?.invalidationConditions && activeThesis.invalidationConditions.length > 0 && currentSnapshot) {
    for (const cond of activeThesis.invalidationConditions) {
      if (cond.toLowerCase().includes('margin') && currentSnapshot.financials.operatingMarginPct !== null) {
        const matchNum = cond.match(/(\d+(\.\d+)?)%/);
        if (matchNum && currentSnapshot.financials.operatingMarginPct < parseFloat(matchNum[1])) {
          score += 40;
          factors.push({
            code: 'INVAL_TRIGGER',
            points: 40,
            label: 'Thesis Invalidation Trigger',
            labelTh: 'เงื่อนไขหักล้างสมมติฐานถูกกระตุ้น',
            detail: `Operating margin (${currentSnapshot.financials.operatingMarginPct.toFixed(1)}%) breached threshold (${matchNum[1]}%).`,
            detailTh: `อัตรากำไรจากการดำเนินงาน (${currentSnapshot.financials.operatingMarginPct.toFixed(1)}%) หลุดกรอบที่กำหนด (${matchNum[1]}%)`
          });
          break;
        }
      }
    }
  }

  // 2. Missed Expectations (+30 pts)
  const missedCount = expectations.filter(e => e.status === 'MISSED').length;
  const pendingCount = expectations.filter(e => e.status === 'PENDING').length;
  if (missedCount > 0) {
    score += 30;
    factors.push({
      code: 'EXP_MISSED',
      points: 30,
      label: 'Expectation Missed',
      labelTh: 'ผลประกอบการพลาดเป้าที่คาดไว้',
      detail: `${missedCount} prior expectation(s) were missed in latest results.`,
      detailTh: `พบ ${missedCount} ความคาดหวังที่รายงานผลลัพธ์ต่ำกว่าเป้าหมาย`
    });
  }

  // 3. Valuation Divergence / Delta (+20 pts)
  const effPrice = (typeof livePrice === 'number' && livePrice > 0)
    ? livePrice
    : currentSnapshot?.marketPrice || null;
  const fv = currentSnapshot?.valuation.baseFairValue || null;

  let mosPct: number | null = null;
  if (effPrice && fv && effPrice > 0) {
    mosPct = Number((((fv - effPrice) / effPrice) * 100).toFixed(1));
    if (Math.abs(mosPct) >= 20.0) {
      score += 20;
      factors.push({
        code: 'VALUATION_DIVERGENCE',
        points: 20,
        label: 'Substantial Valuation Gap',
        labelTh: 'ส่วนต่างมูลค่ายุติธรรมมีนัยสำคัญ',
        detail: `Margin of safety stands at ${mosPct >= 0 ? '+' : ''}${mosPct.toFixed(1)}%.`,
        detailTh: `ส่วนต่างความปลอดภัย (MoS) อยู่ที่ ${mosPct >= 0 ? '+' : ''}${mosPct.toFixed(1)}%`
      });
    }
  }

  // 4. Material Changes in What-Changed (+15 pts)
  const materialCount = whatChanged?.materialChangesCount || 0;
  if (materialCount >= 2) {
    score += 15;
    factors.push({
      code: 'MATERIAL_CHANGES',
      points: 15,
      label: 'Multiple Material Changes',
      labelTh: 'พบการเปลี่ยนแปลงหลายด้าน',
      detail: `${materialCount} material changes detected since previous research.`,
      detailTh: `ตรวจพบการเปลี่ยนแปลงที่มีนัยสำคัญ ${materialCount} รายการนับจากการวิจัยเดิม`
    });
  }

  // 5. Stale Research (> 90 days) (+15 pts)
  if (daysSinceResearch !== null && daysSinceResearch >= 90) {
    score += 15;
    factors.push({
      code: 'STALE_RESEARCH',
      points: 15,
      label: 'Research Refresh Needed',
      labelTh: 'ควรอัปเดตการวิเคราะห์ใหม่',
      detail: `Last comprehensive research was performed ${daysSinceResearch} days ago.`,
      detailTh: `การวิเคราะห์ครั้งล่าสุดดำเนินการไปแล้ว ${daysSinceResearch} วัน`
    });
  }

  // 6. Portfolio Holding Relevance (+10 pts)
  if (isOwned) {
    score += 10;
    factors.push({
      code: 'OWNED_POSITION',
      points: 10,
      label: 'Active Portfolio Position',
      labelTh: 'มีสถานะการลงทุนในพอร์ตจริง',
      detail: 'Ticker is held as an active capital position in your portfolio.',
      detailTh: 'หุ้นนี้อยู่ในพอร์ตการลงทุนจริง จึงมีผลต่อเงินทุนโดยตรง'
    });
  }

  // Clamp score
  const attentionScore = Math.min(100, score);

  // Determine Priority
  let priority: AttentionPriority = 'ROUTINE_MONITORING';
  if (attentionScore >= 60) {
    priority = 'URGENT_ATTENTION';
  } else if (attentionScore >= 30) {
    priority = 'REVIEW_RECOMMENDED';
  }

  // Summary Reason
  let summaryReason = '';
  let summaryReasonTh = '';

  if (factors.length === 0) {
    summaryReason = 'No immediate attention flags. Routine tracking active.';
    summaryReasonTh = 'ไม่มีสัญญาณเตือนเร่งด่วน อยู่ในเกณฑ์ติดตามปกติ';
  } else {
    summaryReason = factors.map(f => f.label).join(' • ');
    summaryReasonTh = factors.map(f => f.labelTh).join(' • ');
  }

  return {
    ticker: cleanTicker,
    priority,
    attentionScore,
    factors,
    latestResearchDate: currentSnapshot?.asOfDate || null,
    daysSinceResearch,
    latestReportId: currentSnapshot?.reportId || null,
    currentPrice: effPrice,
    fairValue: fv,
    marginOfSafetyPct: mosPct,
    thesisStatus: activeThesis?.status || null,
    unresolvedExpectationsCount: pendingCount,
    missedExpectationsCount: missedCount,
    materialChangesCount: materialCount,
    isOwnedInPortfolio: isOwned,
    summaryReason,
    summaryReasonTh
  };
}

/**
 * Deterministically ranks watchlist entries by attention priority score (highest first).
 */
export function rankWatchlistByPriority(
  entries: WatchlistIntelligenceEntry[]
): WatchlistIntelligenceEntry[] {
  return [...entries].sort((a, b) => {
    if (b.attentionScore !== a.attentionScore) {
      return b.attentionScore - a.attentionScore;
    }
    // Secondary tie-breaker: days since research (stale first)
    const daysA = a.daysSinceResearch ?? -1;
    const daysB = b.daysSinceResearch ?? -1;
    return daysB - daysA;
  });
}
