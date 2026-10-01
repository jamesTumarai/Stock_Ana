import type { TechnicalAnalysis } from '../types';

export interface TechnicalInputSnapshot {
  price: number | null;
  timestamp: string | null;
  timezone: string | null;
  timeframe: string | null;
  sourceUrl: string | null;
}
export interface TechnicalSnapshotAudit {
  status: 'STRUCTURALLY_COMPATIBLE' | 'UNVERIFIED' | 'CONFLICT';
  codes: string[];
  /** Source assertions are not independently verified OHLCV observations. */
  verification: 'SOURCE_ASSERTED';
}

export function auditTechnicalSnapshot(technical: Partial<TechnicalAnalysis>): TechnicalSnapshotAudit {
  const snapshot = technical.input_snapshot;
  const codes = new Set<string>();
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  if (!snapshot || !finite(snapshot.price) || snapshot.price <= 0
    || !snapshot.timestamp || !Number.isFinite(Date.parse(snapshot.timestamp))
    || !/(?:Z|[+-]\d{2}:\d{2})$/.test(snapshot.timestamp)
    || !snapshot.timezone || !snapshot.timeframe || !/^https:\/\//.test(snapshot.sourceUrl || '')) {
    codes.add('TECHNICAL_SNAPSHOT_METADATA_UNAVAILABLE');
  }
  if (snapshot && finite(snapshot.price) && finite(technical.key_levels?.current_price)
    && Math.abs(snapshot.price - technical.key_levels!.current_price!) > 0.005) {
    codes.add('TECHNICAL_PRICE_SNAPSHOT_CONFLICT');
  }
  for (const section of ['key_levels', 'trade_plan', 'trend_indicators', 'momentum_indicators', 'relative_strength'] as const) {
    const basis = technical.section_basis?.[section];
    if (!basis || !snapshot || !basis.timestamp || !basis.timeframe || !basis.timezone) {
      codes.add('TECHNICAL_SECTION_BASIS_UNAVAILABLE');
      continue;
    }
    // Multi-timeframe observations need their own dated basis; only prices and
    // time identity must agree. A 4h indicator may legitimately differ from 1d.
    if (Date.parse(basis.timestamp) !== Date.parse(snapshot.timestamp)
      || basis.timezone !== snapshot.timezone || !finite(basis.price)
      || !finite(snapshot.price) || Math.abs(basis.price - snapshot.price) > 0.005) {
      codes.add('TECHNICAL_SECTION_SNAPSHOT_CONFLICT');
    }
    if (section === 'relative_strength' && !basis.benchmark) codes.add('RELATIVE_STRENGTH_BENCHMARK_UNAVAILABLE');
  }
  const rsi = technical.momentum_indicators?.match(/\bRSI(?:\s*\(\s*\d+\s*\))?\s*(?:is|at|=|:|อยู่ที่|คือ|เท่ากับ|ระดับ)?\s*(\d+(?:\.\d+)?)/i);
  if (rsi && Number(rsi[1]) > 30 && /\bRSI\b[^.!?\n]{0,60}(?:oversold|ขายมากเกินไป)/i.test(technical.momentum_indicators || '')) {
    // Negative clauses and stochastic-only observations are not RSI claims.
    if (!/\bRSI\b[^.!?\n]{0,60}(?:not|ไม่)[^.!?\n]{0,20}(?:oversold|ขายมากเกินไป)/i.test(technical.momentum_indicators || '')
      && !/\bRSI\b[^.!?\n]{0,60}stochastic[^.!?\n]{0,20}oversold/i.test(technical.momentum_indicators || '')) codes.add('RSI_OVERSOLD_LABEL_CONFLICT');
  }
  const list = [...codes];
  return { status: list.some(code => code.endsWith('_CONFLICT')) ? 'CONFLICT'
    : list.length ? 'UNVERIFIED' : 'STRUCTURALLY_COMPATIBLE', codes: list, verification: 'SOURCE_ASSERTED' };
}
