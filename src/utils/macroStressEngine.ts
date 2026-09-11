export interface MacroStressInput {
  fairValue: number;
  currentPrice: number;
  wacc: number;
  terminalGrowth: number;
  revenueGrowth: number;
  operatingMargin?: number;
}

export interface MacroStressScenario {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'moderate' | 'high' | 'opportunity';
  stressedWacc: number;
  stressedTerminalGrowth: number;
  stressedGrowth: number;
  stressedMargin: number;
  stressedFairValue: number;
  stressedMarginOfSafety: number;
  fairValueChangePct: number;
  driverImpacts: {
    waccDeltaBps: number;
    growthDeltaBps: number;
    marginDeltaBps: number;
    terminalGrowthDeltaBps: number;
  };
}

/**
 * Evaluates institutional macro stress-test scenarios deterministically against a DCF baseline.
 */
export function evaluateMacroStressScenarios(
  input: MacroStressInput,
  isThai = false
): MacroStressScenario[] {
  const { fairValue, currentPrice, wacc, terminalGrowth, revenueGrowth } = input;
  const operatingMargin = input.operatingMargin ?? 30.0;

  if (!fairValue || fairValue <= 0) return [];

  const definitions = [
    {
      id: 'base_case',
      nameEn: 'Base Case (Current Model)',
      nameTh: 'กรณีฐาน (สมมติฐานปัจจุบัน)',
      descEn: 'Unchanged valuation model reflecting base verified filings and company guidance.',
      descTh: 'แบบจำลองปัจจุบัน อ้างอิงงบการเงินและประมาณการตรวจสอบแล้ว',
      severity: 'low' as const,
      waccDeltaBps: 0,
      growthDeltaBps: 0,
      marginDeltaBps: 0,
      tgDeltaBps: 0,
    },
    {
      id: 'stagflation_shock',
      nameEn: 'Stagflation Shock',
      nameTh: 'วิกฤตภาวะเงินเฟ้อสูง + เศรษฐกิจชะลอ (Stagflation)',
      descEn: 'Persistent inflation spikes discount rates (+150 bps WACC) while cost inflation compresses margins (-200 bps).',
      descTh: 'เงินเฟ้อยืดเยื้อ ดอกเบี้ยพุ่ง (+150 bps WACC) และต้นทุนเบียดเบียนกำไร (-200 bps margin)',
      severity: 'high' as const,
      waccDeltaBps: 150,
      growthDeltaBps: -300,
      marginDeltaBps: -200,
      tgDeltaBps: -50,
    },
    {
      id: 'recession_demand_drop',
      nameEn: 'Recessionary Demand Contraction',
      nameTh: 'เศรษฐกิจถดถอย & อุปสงค์หดตัว (Recession)',
      descEn: 'Severe cyclical slowdown: revenue drops (-10%), credit spreads widen (+100 bps), low pricing power.',
      descTh: 'อุปสงค์ทรุดตัว การเติบโตชะลอ (-10%) และส่วนต่างอัตราดอกเบี้ยสูงขึ้น (+100 bps WACC)',
      severity: 'high' as const,
      waccDeltaBps: 100,
      growthDeltaBps: -1000,
      marginDeltaBps: -300,
      tgDeltaBps: -80,
    },
    {
      id: 'rates_higher_for_longer',
      nameEn: 'Higher-for-Longer Rates',
      nameTh: 'ดอกเบี้ยยืนสูงยาวนาน (Higher for Longer)',
      descEn: 'Central banks keep terminal rates elevated (+200 bps WACC); multiples compress across asset classes.',
      descTh: 'ธนาคารกลางตรึงดอกเบี้ยนโยบายระดับสูง (+200 bps WACC) กดดันตัวคูณ Valuation ทั่วตลาด',
      severity: 'moderate' as const,
      waccDeltaBps: 200,
      growthDeltaBps: -100,
      marginDeltaBps: 0,
      tgDeltaBps: 0,
    },
    {
      id: 'ai_productivity_wave',
      nameEn: 'AI & Productivity Wave',
      nameTh: 'คลื่นผลิตภาพ AI และขยายมาร์จิ้น (AI Productivity)',
      descEn: 'Automation accelerates revenue expansion (+400 bps) and operational operating leverage (+250 bps margin).',
      descTh: 'เทคโนโลยีและ AI เพิ่มผลิตภาพ ยอดขายเร่งตัว (+400 bps) และ Operating Leverage ขยายตัว (+250 bps)',
      severity: 'opportunity' as const,
      waccDeltaBps: -25,
      growthDeltaBps: 400,
      marginDeltaBps: 250,
      tgDeltaBps: 30,
    },
  ];

  return definitions.map((def) => {
    const stressedWacc = Math.max(4.0, wacc + (def.waccDeltaBps / 100));
    const stressedGrowth = revenueGrowth + (def.growthDeltaBps / 100);
    const stressedMargin = Math.max(1.0, operatingMargin + (def.marginDeltaBps / 100));
    const stressedTerminalGrowth = Math.max(1.0, terminalGrowth + (def.tgDeltaBps / 100));

    // DCF Sensitivity factors
    const waccMultiplier = 1 - ((def.waccDeltaBps / 100) * 0.10);
    const growthMultiplier = 1 + ((def.growthDeltaBps / 100) * 0.05);
    const marginMultiplier = operatingMargin > 0
      ? (1 + (def.marginDeltaBps / (operatingMargin * 100)))
      : 1;
    const tgMultiplier = 1 + ((def.tgDeltaBps / 100) * 0.07);

    let stressedFv = fairValue * waccMultiplier * growthMultiplier * marginMultiplier * tgMultiplier;
    stressedFv = Number(Math.max(1.0, stressedFv).toFixed(2));

    const price = currentPrice > 0 ? currentPrice : fairValue;
    const stressedMos = Number((((stressedFv - price) / price) * 100).toFixed(1));
    const fvChangePct = Number((((stressedFv - fairValue) / fairValue) * 100).toFixed(1));

    return {
      id: def.id,
      name: isThai ? def.nameTh : def.nameEn,
      description: isThai ? def.descTh : def.descEn,
      severity: def.severity,
      stressedWacc: Number(stressedWacc.toFixed(2)),
      stressedTerminalGrowth: Number(stressedTerminalGrowth.toFixed(2)),
      stressedGrowth: Number(stressedGrowth.toFixed(2)),
      stressedMargin: Number(stressedMargin.toFixed(2)),
      stressedFairValue: stressedFv,
      stressedMarginOfSafety: stressedMos,
      fairValueChangePct: fvChangePct,
      driverImpacts: {
        waccDeltaBps: def.waccDeltaBps,
        growthDeltaBps: def.growthDeltaBps,
        marginDeltaBps: def.marginDeltaBps,
        terminalGrowthDeltaBps: def.tgDeltaBps,
      },
    };
  });
}
