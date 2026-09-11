import {
  ReportData,
  ValuationScenario,
  SensitivityMatrix,
  SensitivityCell,
  ReverseDcfResult,
  PeerNormalizedMetric
} from '../types';

/**
 * Standard Gordon Growth / DCF Enterprise Value Per Share calculation
 */
export function calculateDcfPerShare(
  baseFcfPerShare: number,
  growthRatePct: number,
  discountRatePct: number,
  terminalGrowthPct: number,
  projectionYears: number = 5
): number {
  if (baseFcfPerShare <= 0 || discountRatePct <= terminalGrowthPct) return 0;

  const r = discountRatePct / 100;
  const g = growthRatePct / 100;
  const tg = terminalGrowthPct / 100;

  let pvOfCashFlows = 0;
  let currentFcf = baseFcfPerShare;

  for (let t = 1; t <= projectionYears; t++) {
    currentFcf *= (1 + g);
    pvOfCashFlows += currentFcf / Math.pow(1 + r, t);
  }

  // Terminal Value at end of projection
  const terminalValue = (currentFcf * (1 + tg)) / (r - tg);
  const pvOfTerminalValue = terminalValue / Math.pow(1 + r, projectionYears);

  const totalFairValue = pvOfCashFlows + pvOfTerminalValue;
  return Number(totalFairValue.toFixed(2));
}

/**
 * Generates Bear, Base, and Bull scenario fair values deterministically
 */
export function generateValuationScenarios(
  baseFcfPerShare: number,
  currentPrice: number,
  baseGrowthPct: number = 10,
  baseWaccPct: number = 9.0,
  baseTerminalGrowthPct: number = 2.5
): ValuationScenario[] {
  const scenariosConfig = [
    {
      name: 'bear' as const,
      growth: Math.max(0, baseGrowthPct - 5),
      wacc: baseWaccPct + 1.5,
      tg: Math.max(1.0, baseTerminalGrowthPct - 0.5),
      marginFactor: -2
    },
    {
      name: 'base' as const,
      growth: baseGrowthPct,
      wacc: baseWaccPct,
      tg: baseTerminalGrowthPct,
      marginFactor: 0
    },
    {
      name: 'bull' as const,
      growth: baseGrowthPct + 5,
      wacc: Math.max(6.0, baseWaccPct - 1.0),
      tg: Math.min(4.5, baseTerminalGrowthPct + 0.5),
      marginFactor: 2
    }
  ];

  return scenariosConfig.map(cfg => {
    const fv = calculateDcfPerShare(
      baseFcfPerShare,
      cfg.growth,
      cfg.wacc,
      cfg.tg
    );

    const mos = (fv > 0 && currentPrice > 0)
      ? Number((((fv - currentPrice) / currentPrice) * 100).toFixed(1))
      : 0;

    const upside = (currentPrice > 0)
      ? Number((((fv - currentPrice) / currentPrice) * 100).toFixed(1))
      : 0;

    return {
      name: cfg.name,
      revenueGrowthPct: cfg.growth,
      operatingMarginPct: cfg.marginFactor,
      discountRatePct: cfg.wacc,
      terminalGrowthPct: cfg.tg,
      fairValuePerShare: fv,
      marginOfSafetyPct: mos,
      impliedUpsidePct: upside
    };
  });
}

/**
 * Computes a 2D Sensitivity Matrix varying WACC discount rates and Terminal Growth rates
 */
export function computeSensitivityMatrix(
  baseFcfPerShare: number,
  currentPrice: number,
  baseWaccPct: number = 9.0,
  baseTerminalGrowthPct: number = 2.5,
  growthRatePct: number = 10
): SensitivityMatrix {
  const discountRates = [
    Number((baseWaccPct - 1.5).toFixed(1)),
    Number((baseWaccPct - 0.75).toFixed(1)),
    baseWaccPct,
    Number((baseWaccPct + 0.75).toFixed(1)),
    Number((baseWaccPct + 1.5).toFixed(1))
  ].filter(r => r > 0);

  const terminalGrowthRates = [
    Number((baseTerminalGrowthPct - 1.0).toFixed(1)),
    Number((baseTerminalGrowthPct - 0.5).toFixed(1)),
    baseTerminalGrowthPct,
    Number((baseTerminalGrowthPct + 0.5).toFixed(1)),
    Number((baseTerminalGrowthPct + 1.0).toFixed(1))
  ].filter(g => g > 0);

  const cells: SensitivityCell[][] = discountRates.map(wacc => {
    return terminalGrowthRates.map(tg => {
      let fv = 0;
      if (wacc > tg) {
        fv = calculateDcfPerShare(baseFcfPerShare, growthRatePct, wacc, tg);
      }
      const mos = (fv > 0 && currentPrice > 0)
        ? Number((((fv - currentPrice) / currentPrice) * 100).toFixed(1))
        : 0;

      return {
        discountRatePct: wacc,
        terminalGrowthPct: tg,
        fairValue: fv,
        marginOfSafetyPct: mos
      };
    });
  });

  return {
    discountRates,
    terminalGrowthRates,
    cells
  };
}

/**
 * Reverse DCF: Back-solves for the implied annual FCF growth rate (g)
 * priced into the current stock price
 */
export function calculateReverseDcf(
  currentPrice: number,
  baseFcfPerShare: number,
  discountRatePct: number = 9.0,
  terminalGrowthPct: number = 2.5,
  projectionYears: number = 5
): ReverseDcfResult {
  if (currentPrice <= 0 || baseFcfPerShare <= 0 || discountRatePct <= terminalGrowthPct) {
    return {
      currentPrice,
      baseFcfPerShare,
      discountRatePct,
      terminalGrowthPct,
      projectionYears,
      impliedGrowthPct: 0,
      isHurdleHigh: false,
      assessment: 'Unable to calculate reverse DCF with negative or zero inputs.',
      assessmentTh: 'ไม่สามารถคำนวณ Reverse DCF ได้เนื่องจากกระแสเงินสดหรือราคาเป็นศูนย์/ติดลบ'
    };
  }

  // Binary search for implied growth rate g between -50% and +150%
  let low = -50;
  let high = 150;
  let impliedG = 0;

  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    const modelPrice = calculateDcfPerShare(
      baseFcfPerShare,
      mid,
      discountRatePct,
      terminalGrowthPct,
      projectionYears
    );

    if (Math.abs(modelPrice - currentPrice) < 0.05) {
      impliedG = mid;
      break;
    }

    if (modelPrice > currentPrice) {
      high = mid;
    } else {
      low = mid;
    }
    impliedG = mid;
  }

  impliedG = Number(impliedG.toFixed(1));

  let assessment = '';
  let assessmentTh = '';
  const isHurdleHigh = impliedG >= 18;

  if (impliedG <= 5) {
    assessment = 'Low hurdle: Market prices in modest/conservative growth. Higher probability of outperformance.';
    assessmentTh = 'เกณฑ์ความคาดหวังต่ำ: ตลาดคาดการณ์การเติบโตแบบอนุรักษ์นิยม มีโอกาสสร้างผลตอบแทนชนะตลาดสูงหากทำได้ดีกว่าคาด';
  } else if (impliedG <= 14) {
    assessment = 'Moderate hurdle: Market implies realistic compounder growth in line with historical baseline.';
    assessmentTh = 'เกณฑ์ความคาดหวังปานกลาง: ตลาดคาดหวังการเติบโตระดับปกติ สอดคล้องกับศักยภาพธุรกิจของหุ้นคุณภาพ';
  } else if (impliedG <= 22) {
    assessment = 'Demanding hurdle: Market requires aggressive sustained expansion. Execution risk is elevated.';
    assessmentTh = 'เกณฑ์ความคาดหวังสูง: ราคาตลาดตั้งอยู่บนสมมติฐานการเติบโตอย่างรวดเร็วต่อเนื่อง มีความเสี่ยงหากสะดุด';
  } else {
    assessment = 'Priced for perfection: Market prices in hyper-growth. Any macroeconomic slowdown may cause severe multiple compression.';
    assessmentTh = 'ราคาถูกตรึงไว้กับความสมบูรณ์แบบ: ตลาดคาดหวังการเติบโตสูงมาก หากผิดเป้ามีความเสี่ยงที่ Valuation จะหดตัวรุนแรง';
  }

  return {
    currentPrice,
    baseFcfPerShare,
    discountRatePct,
    terminalGrowthPct,
    projectionYears,
    impliedGrowthPct: impliedG,
    isHurdleHigh,
    assessment,
    assessmentTh
  };
}

/**
 * Extracts and normalizes peer comparisons from report without fabricating data
 */
export function extractNormalizedPeers(report?: ReportData): PeerNormalizedMetric[] {
  if (!report?.peer_comparison) return [];

  const rawPeers = report.peer_comparison;
  const list: PeerNormalizedMetric[] = [];

  // If peer_comparison is an array of peers
  if (Array.isArray(rawPeers)) {
    for (const p of rawPeers) {
      if (!p || typeof p !== 'object') continue;
      const tick = String(p.ticker || p.symbol || '').toUpperCase().trim();
      if (!tick) continue;

      list.push({
        ticker: tick,
        companyName: p.company_name || p.name || tick,
        marketCap: typeof p.market_cap === 'number' ? p.market_cap : null,
        peRatio: typeof p.pe_ratio === 'number' ? p.pe_ratio : null,
        evToEbitda: typeof p.ev_to_ebitda === 'number' ? p.ev_to_ebitda : null,
        grossMarginPct: typeof p.gross_margin === 'number' ? p.gross_margin : null,
        operatingMarginPct: typeof p.operating_margin === 'number' ? p.operating_margin : null,
        fcfMarginPct: typeof p.fcf_margin === 'number' ? p.fcf_margin : null,
        revenueGrowthYoYPct: typeof p.revenue_growth === 'number' ? p.revenue_growth : null,
        roePct: typeof p.roe === 'number' ? p.roe : null,
        debtToEquity: typeof p.debt_to_equity === 'number' ? p.debt_to_equity : null
      });
    }
  } else if (typeof rawPeers === 'object' && Array.isArray((rawPeers as any).peers)) {
    for (const p of (rawPeers as any).peers) {
      if (!p || typeof p !== 'object') continue;
      const tick = String(p.ticker || p.symbol || '').toUpperCase().trim();
      if (!tick) continue;

      list.push({
        ticker: tick,
        companyName: p.company_name || p.name || tick,
        marketCap: typeof p.market_cap === 'number' ? p.market_cap : null,
        peRatio: typeof p.pe_ratio === 'number' ? p.pe_ratio : null,
        evToEbitda: typeof p.ev_to_ebitda === 'number' ? p.ev_to_ebitda : null,
        grossMarginPct: typeof p.gross_margin === 'number' ? p.gross_margin : null,
        operatingMarginPct: typeof p.operating_margin === 'number' ? p.operating_margin : null,
        fcfMarginPct: typeof p.fcf_margin === 'number' ? p.fcf_margin : null,
        revenueGrowthYoYPct: typeof p.revenue_growth === 'number' ? p.revenue_growth : null,
        roePct: typeof p.roe === 'number' ? p.roe : null,
        debtToEquity: typeof p.debt_to_equity === 'number' ? p.debt_to_equity : null
      });
    }
  }

  return list;
}
