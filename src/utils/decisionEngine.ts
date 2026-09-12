import {
  ReportData,
  ValuationScenario,
  SensitivityMatrix,
  SensitivityCell,
  ReverseDcfResult,
  PeerNormalizedMetric
} from '../types';
import { calculateStrictDCFValue } from './valuation/dcfMathEngine';
import type { CanonicalValuationSandboxInputs } from './valuationSandboxAdapter';

/**
 * Standard Gordon Growth / DCF Enterprise Value Per Share calculation.
 * Note: Requires verified explicit inputs; never assumes default WACC or terminal growth.
 */
export function calculateDcfPerShare(
  baseFcfPerShare: number,
  growthRatePct: number,
  discountRatePct: number,
  terminalGrowthPct: number,
  projectionYears: number = 5
): number {
  if (
    !Number.isFinite(baseFcfPerShare) ||
    !Number.isFinite(growthRatePct) ||
    !Number.isFinite(discountRatePct) ||
    !Number.isFinite(terminalGrowthPct) ||
    baseFcfPerShare <= 0 ||
    discountRatePct <= 0 ||
    terminalGrowthPct < 0 ||
    discountRatePct <= terminalGrowthPct
  ) {
    return 0;
  }

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
 * Generates Bear, Base, and Bull scenario fair values deterministically.
 * Requires all verified base inputs explicitly; zero fabricated defaults.
 */
export function generateValuationScenarios(
  baseFcfPerShare: number,
  currentPrice: number,
  baseGrowthPct: number,
  baseWaccPct: number,
  baseTerminalGrowthPct: number
): ValuationScenario[] {
  if (
    !Number.isFinite(baseFcfPerShare) || baseFcfPerShare <= 0 ||
    !Number.isFinite(currentPrice) || currentPrice <= 0 ||
    !Number.isFinite(baseGrowthPct) ||
    !Number.isFinite(baseWaccPct) || baseWaccPct <= 0 ||
    !Number.isFinite(baseTerminalGrowthPct) || baseTerminalGrowthPct < 0 ||
    baseWaccPct <= baseTerminalGrowthPct
  ) {
    return [];
  }

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
    let fv: number | null = null;
    if (cfg.wacc > cfg.tg) {
      const calculated = calculateDcfPerShare(
        baseFcfPerShare,
        cfg.growth,
        cfg.wacc,
        cfg.tg
      );
      if (Number.isFinite(calculated) && calculated > 0) {
        fv = calculated;
      }
    }

    const mos = (fv !== null && currentPrice > 0)
      ? Number((((fv - currentPrice) / currentPrice) * 100).toFixed(1))
      : null;

    const upside = (fv !== null && currentPrice > 0)
      ? Number((((fv - currentPrice) / currentPrice) * 100).toFixed(1))
      : null;

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
 * Computes a 2D Sensitivity Matrix varying WACC discount rates and Terminal Growth rates.
 * Descriptive stress matrix; handles boundary conditions safely.
 */
export function computeSensitivityMatrix(
  baseFcfPerShare: number,
  currentPrice: number,
  baseWaccPct: number,
  baseTerminalGrowthPct: number,
  growthRatePct: number = 8.0
): SensitivityMatrix {
  if (
    baseFcfPerShare <= 0 ||
    baseWaccPct <= 0 ||
    baseTerminalGrowthPct <= 0 ||
    baseWaccPct <= baseTerminalGrowthPct
  ) {
    return {
      discountRates: [],
      terminalGrowthRates: [],
      cells: []
    };
  }

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
  ].filter(g => g >= 0);

  const cells: SensitivityCell[][] = discountRates.map(wacc => {
    return terminalGrowthRates.map(tg => {
      let fv: number | null = null;
      if (wacc > tg) {
        const calculated = calculateDcfPerShare(baseFcfPerShare, growthRatePct, wacc, tg);
        if (Number.isFinite(calculated) && calculated > 0) {
          fv = calculated;
        }
      }
      const mos = (fv !== null && currentPrice > 0)
        ? Number((((fv - currentPrice) / currentPrice) * 100).toFixed(1))
        : null;

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
 * priced into the current stock price.
 * Descriptive language only; never claims speculative probabilities.
 */
export function calculateReverseDcf(
  currentPrice: number,
  baseFcfPerShare: number,
  discountRatePct: number,
  terminalGrowthPct: number,
  projectionYears: number = 5
): ReverseDcfResult {
  if (
    !Number.isFinite(currentPrice) || currentPrice <= 0 ||
    !Number.isFinite(baseFcfPerShare) || baseFcfPerShare <= 0 ||
    !Number.isFinite(discountRatePct) || discountRatePct <= 0 ||
    !Number.isFinite(terminalGrowthPct) || terminalGrowthPct < 0 ||
    discountRatePct <= terminalGrowthPct
  ) {
    return {
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
      baseFcfPerShare: Number.isFinite(baseFcfPerShare) ? baseFcfPerShare : 0,
      discountRatePct: Number.isFinite(discountRatePct) ? discountRatePct : 0,
      terminalGrowthPct: Number.isFinite(terminalGrowthPct) ? terminalGrowthPct : 0,
      projectionYears,
      impliedGrowthPct: null,
      isHurdleHigh: false,
      assessment: 'Unable to calculate reverse DCF: missing or invalid verified inputs.',
      assessmentTh: 'ไม่สามารถคำนวณ Reverse DCF ได้เนื่องจากข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง'
    };
  }

  // Check if target price is bracketed by [-50%, +150%]
  const priceAtLow = calculateDcfPerShare(
    baseFcfPerShare,
    -50,
    discountRatePct,
    terminalGrowthPct,
    projectionYears
  );
  const priceAtHigh = calculateDcfPerShare(
    baseFcfPerShare,
    150,
    discountRatePct,
    terminalGrowthPct,
    projectionYears
  );

  const isBracketed = Number.isFinite(priceAtLow) && Number.isFinite(priceAtHigh) &&
    currentPrice >= priceAtLow && currentPrice <= priceAtHigh;

  if (!isBracketed) {
    const isAbove = Number.isFinite(priceAtHigh) && currentPrice > priceAtHigh;
    return {
      currentPrice,
      baseFcfPerShare,
      discountRatePct,
      terminalGrowthPct,
      projectionYears,
      impliedGrowthPct: null,
      isHurdleHigh: true,
      isOutOfRange: true,
      assessment: isAbove
        ? `Market price of $${currentPrice.toFixed(2)} exceeds the valuation at +150% annual growth ($${priceAtHigh.toFixed(2)}). Implied growth is outside the modeled range [-50%, +150%].`
        : `Market price of $${currentPrice.toFixed(2)} is below the valuation at -50% annual growth ($${priceAtLow.toFixed(2)}). Implied growth is outside the modeled range [-50%, +150%].`,
      assessmentTh: isAbove
        ? `ราคาตลาด $${currentPrice.toFixed(2)} สูงกว่ามูลค่าภายใต้การเติบโต +150% ($${priceAtHigh.toFixed(2)}) อัตราการเติบโตที่ตลาดคาดหวังอยู่นอกกรอบแบบจำลอง [-50%, +150%]`
        : `ราคาตลาด $${currentPrice.toFixed(2)} ต่ำกว่ามูลค่าภายใต้การเติบโต -50% ($${priceAtLow.toFixed(2)}) อัตราการเติบโตที่ตลาดคาดหวังอยู่นอกกรอบแบบจำลอง [-50%, +150%]`,
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
  const isHurdleHigh = impliedG >= 18;

  const assessment = `Market price of $${currentPrice.toFixed(2)} implies approximately ${impliedG}% annual FCF growth under stated assumptions (WACC: ${discountRatePct}%, Terminal Growth: ${terminalGrowthPct}%).`;
  const assessmentTh = `ราคาตลาด $${currentPrice.toFixed(2)} สะท้อนอัตราการเติบโตของ FCF ประมาณ ${impliedG}% ต่อปี ภายใต้สมมติฐานที่ระบุ (WACC: ${discountRatePct}%, Terminal Growth: ${terminalGrowthPct}%)`;

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

// =========================================================================
// CANONICAL SCENARIO, SENSITIVITY & REVERSE DCF (REUSES dcfMathEngine.ts)
// =========================================================================

/**
 * Generates canonical scenarios reusing calculateStrictDCFValue from dcfMathEngine.
 * Guarantees that the base scenario matches the report's canonical DCF fair value.
 */
export function generateCanonicalScenarios(
  inputs: CanonicalValuationSandboxInputs,
  overrides?: {
    growthPct?: number;
    waccPct?: number;
    terminalGrowthPct?: number;
    fcfMarginPct?: number;
  }
): ValuationScenario[] {
  const baseGrowth = overrides?.growthPct ?? inputs.baseRevenueCagrPct;
  const baseWacc = overrides?.waccPct ?? inputs.waccPct;
  const baseTg = overrides?.terminalGrowthPct ?? inputs.terminalGrowthPct;
  const baseMargin = overrides?.fcfMarginPct ?? inputs.baseFcfMarginPct;

  const scenariosConfig = [
    {
      name: 'bear' as const,
      growth: Math.max(0, baseGrowth - 5),
      wacc: baseWacc + 1.5,
      tg: Math.max(1.0, baseTg - 0.5),
      margin: Math.max(-100, baseMargin - 2)
    },
    {
      name: 'base' as const,
      growth: baseGrowth,
      wacc: baseWacc,
      tg: baseTg,
      margin: baseMargin
    },
    {
      name: 'bull' as const,
      growth: baseGrowth + 5,
      wacc: Math.max(6.0, baseWacc - 1.0),
      tg: Math.min(4.5, baseTg + 0.5),
      margin: Math.min(100, baseMargin + 2)
    }
  ];

  return scenariosConfig.map(cfg => {
    let validFv: number | null = null;
    if (cfg.wacc > cfg.tg) {
      const fv = calculateStrictDCFValue(
        inputs.startingRevenueM,
        inputs.sharesOutstandingM,
        inputs.netCashM,
        cfg.wacc,
        cfg.tg,
        cfg.growth,
        cfg.margin,
        inputs.projectionYears
      );
      if (Number.isFinite(fv) && fv > 0) {
        validFv = fv;
      }
    }

    const mos = (validFv !== null && inputs.currentPrice > 0)
      ? Number((((validFv - inputs.currentPrice) / inputs.currentPrice) * 100).toFixed(1))
      : null;

    const upside = (inputs.currentPrice > 0 && validFv !== null)
      ? Number((((validFv - inputs.currentPrice) / inputs.currentPrice) * 100).toFixed(1))
      : null;

    return {
      name: cfg.name,
      revenueGrowthPct: cfg.growth,
      operatingMarginPct: cfg.margin,
      discountRatePct: cfg.wacc,
      terminalGrowthPct: cfg.tg,
      fairValuePerShare: validFv,
      marginOfSafetyPct: mos,
      impliedUpsidePct: upside
    };
  });
}

/**
 * Computes a 5x5 sensitivity matrix reusing calculateStrictDCFValue from dcfMathEngine.
 */
export function computeCanonicalSensitivityMatrix(
  inputs: CanonicalValuationSandboxInputs,
  growthRatePct?: number
): SensitivityMatrix {
  const cagr = typeof growthRatePct === 'number' && Number.isFinite(growthRatePct)
    ? growthRatePct
    : inputs.baseRevenueCagrPct;

  const baseWaccPct = inputs.waccPct;
  const baseTerminalGrowthPct = inputs.terminalGrowthPct;

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
  ].filter(g => g >= 0);

  const cells: SensitivityCell[][] = discountRates.map(wacc => {
    return terminalGrowthRates.map(tg => {
      let fv: number | null = null;
      if (wacc > tg) {
        const strictFv = calculateStrictDCFValue(
          inputs.startingRevenueM,
          inputs.sharesOutstandingM,
          inputs.netCashM,
          wacc,
          tg,
          cagr,
          inputs.baseFcfMarginPct,
          inputs.projectionYears
        );
        if (Number.isFinite(strictFv) && strictFv > 0) {
          fv = strictFv;
        }
      }
      const mos = (fv !== null && inputs.currentPrice > 0)
        ? Number((((fv - inputs.currentPrice) / inputs.currentPrice) * 100).toFixed(1))
        : null;

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
 * Reverse DCF solving for implied revenue CAGR using the canonical strict DCF engine.
 */
export function calculateCanonicalReverseDcf(
  inputs: CanonicalValuationSandboxInputs,
  overrides?: {
    discountRatePct?: number;
    terminalGrowthPct?: number;
  }
): ReverseDcfResult {
  const currentPrice = inputs.currentPrice;
  const discountRatePct = overrides?.discountRatePct ?? inputs.waccPct;
  const terminalGrowthPct = overrides?.terminalGrowthPct ?? inputs.terminalGrowthPct;

  if (
    !Number.isFinite(currentPrice) || currentPrice <= 0 ||
    !Number.isFinite(discountRatePct) || discountRatePct <= 0 ||
    !Number.isFinite(terminalGrowthPct) || terminalGrowthPct < 0 ||
    discountRatePct <= terminalGrowthPct
  ) {
    return {
      currentPrice: Number.isFinite(currentPrice) ? currentPrice : 0,
      baseFcfPerShare: 0,
      discountRatePct: Number.isFinite(discountRatePct) ? discountRatePct : 0,
      terminalGrowthPct: Number.isFinite(terminalGrowthPct) ? terminalGrowthPct : 0,
      projectionYears: inputs.projectionYears,
      impliedGrowthPct: null,
      isHurdleHigh: false,
      assessment: 'Unable to calculate reverse DCF: missing or invalid verified inputs.',
      assessmentTh: 'ไม่สามารถคำนวณ Reverse DCF ได้เนื่องจากข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง'
    };
  }

  // Verify target price is bracketed by [-50%, +150%]
  const priceAtLow = calculateStrictDCFValue(
    inputs.startingRevenueM,
    inputs.sharesOutstandingM,
    inputs.netCashM,
    discountRatePct,
    terminalGrowthPct,
    -50,
    inputs.baseFcfMarginPct,
    inputs.projectionYears
  );

  const priceAtHigh = calculateStrictDCFValue(
    inputs.startingRevenueM,
    inputs.sharesOutstandingM,
    inputs.netCashM,
    discountRatePct,
    terminalGrowthPct,
    150,
    inputs.baseFcfMarginPct,
    inputs.projectionYears
  );

  const startingFcfM = inputs.startingRevenueM * (inputs.baseFcfMarginPct / 100);
  const baseFcfPerShare = inputs.sharesOutstandingM > 0
    ? Number((startingFcfM / inputs.sharesOutstandingM).toFixed(2))
    : 0;

  const isBracketed = Number.isFinite(priceAtLow) && Number.isFinite(priceAtHigh) &&
    currentPrice >= priceAtLow && currentPrice <= priceAtHigh;

  if (!isBracketed) {
    const isAbove = Number.isFinite(priceAtHigh) && currentPrice > priceAtHigh;
    return {
      currentPrice,
      baseFcfPerShare,
      discountRatePct,
      terminalGrowthPct,
      projectionYears: inputs.projectionYears,
      impliedGrowthPct: null,
      isHurdleHigh: true,
      isOutOfRange: true,
      assessment: isAbove
        ? `Market price of $${currentPrice.toFixed(2)} exceeds the valuation at +150% revenue CAGR ($${priceAtHigh.toFixed(2)}). Implied revenue CAGR expectation is outside the modeled range [-50%, +150%].`
        : `Market price of $${currentPrice.toFixed(2)} is below the valuation at -50% revenue CAGR ($${priceAtLow.toFixed(2)}). Implied revenue CAGR expectation is outside the modeled range [-50%, +150%].`,
      assessmentTh: isAbove
        ? `ราคาตลาด $${currentPrice.toFixed(2)} สูงกว่ามูลค่าภายใต้อัตราการเติบโตรายได้ (Revenue CAGR) +150% ($${priceAtHigh.toFixed(2)}) สมมติฐานการเติบโตที่ตลาดคาดหวังอยู่นอกกรอบการจำลอง [-50%, +150%]`
        : `ราคาตลาด $${currentPrice.toFixed(2)} ต่ำกว่ามูลค่าภายใต้อัตราการเติบโตรายได้ (Revenue CAGR) -50% ($${priceAtLow.toFixed(2)}) สมมติฐานการเติบโตที่ตลาดคาดหวังอยู่นอกกรอบการจำลอง [-50%, +150%]`,
    };
  }

  // Binary search for implied revenue CAGR between -50% and +150%
  let low = -50;
  let high = 150;
  let impliedG = 0;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const modelPrice = calculateStrictDCFValue(
      inputs.startingRevenueM,
      inputs.sharesOutstandingM,
      inputs.netCashM,
      discountRatePct,
      terminalGrowthPct,
      mid,
      inputs.baseFcfMarginPct,
      inputs.projectionYears
    );

    if (!Number.isFinite(modelPrice)) {
      break;
    }

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
  const isHurdleHigh = impliedG >= 18;

  const baseGrowthNote = Number.isFinite(inputs.baseRevenueCagrPct)
    ? ` (Base report assumption: ${inputs.baseRevenueCagrPct}%)`
    : '';
  const baseGrowthNoteTh = Number.isFinite(inputs.baseRevenueCagrPct)
    ? ` (เทียบกับสมมติฐานกรณีฐานในรายงาน: ${inputs.baseRevenueCagrPct}%)`
    : '';

  const assessment = `Market price of $${currentPrice.toFixed(2)} implies approximately ${impliedG}% annual revenue CAGR under stated assumptions (WACC: ${discountRatePct}%, Terminal Growth: ${terminalGrowthPct}%).${baseGrowthNote}`;
  const assessmentTh = `ราคาตลาด $${currentPrice.toFixed(2)} สะท้อนอัตราการเติบโตของรายได้ (Revenue CAGR) ประมาณ ${impliedG}% ต่อปี ภายใต้สมมติฐานที่ระบุ (WACC: ${discountRatePct}%, Terminal Growth: ${terminalGrowthPct}%)${baseGrowthNoteTh}`;

  return {
    currentPrice,
    baseFcfPerShare,
    discountRatePct,
    terminalGrowthPct,
    projectionYears: inputs.projectionYears,
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
