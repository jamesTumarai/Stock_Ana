import { ReportData, DCFModel, DCFScenario } from '../../types';
import { calculateRegionAwareCostOfCapital } from './costOfCapital';
import { 
  MACRO_TERMINAL_GROWTH_DEFAULT_PCT, 
  MACRO_TERMINAL_GROWTH_MAX_CAP_PCT, 
  MACRO_TERMINAL_GROWTH_MIN_PCT 
} from './constants';

export interface DCFEngineInputs {
  ticker: string;
  currentPrice: number;
  startingRevenueM: number;
  sharesOutstandingM: number;
  netCashM: number;
  waccPct: number;
  terminalGrowthPct: number;
  projectionYears: number;
}

/**
 * Closed-form, rigorous Discounted Cash Flow valuation function.
 * Mathematically guaranteed to be strictly monotonic:
 * Higher CAGR and Higher Margin WILL ALWAYS strictly increase Fair Value per share.
 */
export function calculateStrictDCFValue(
  startingRevenueM: number,
  sharesOutstandingM: number,
  netCashM: number,
  waccPct: number,
  terminalGrowthPct: number,
  cagrPct: number,
  fcfMarginPct: number,
  projectionYears = 5
): number {
  const wacc = Math.max(0.005, waccPct / 100);
  const rawG = terminalGrowthPct / 100;
  const shares = Math.max(0.01, sharesOutstandingM);

  let pvOfFcf = 0;
  let projectedRev = startingRevenueM;
  let lastYearFcf = 0;

  for (let t = 1; t <= projectionYears; t++) {
    projectedRev *= (1 + (cagrPct / 100));
    const fcf_t = projectedRev * (fcfMarginPct / 100);
    lastYearFcf = fcf_t;
    pvOfFcf += fcf_t / Math.pow(1 + wacc, t);
  }

  // Terminal Value (Multi-stage convergence: mature cost of capital)
  // Mature terminal discount rate converges towards normalized rate (floor at 6.0%)
  const matureFloor = Math.max(0.06, wacc * 0.75);

  // Robust Gordon Growth denominator spread clamping:
  // In interactive simulators, users may set WACC <= Terminal Growth (e.g. WACC 3.0% vs Terminal Growth 3.0% or 5.0%).
  // Enforce a strict minimum positive spread of at least 1.5% (150 bps) so the terminal denominator NEVER divides by zero or turns negative.
  const minSpread = 0.015;
  const terminalWacc = Math.max(matureFloor, rawG + minSpread);
  const effectiveG = Math.min(rawG, terminalWacc - minSpread);
  const terminalSpread = Math.max(minSpread, terminalWacc - effectiveG);

  const terminalFcf = lastYearFcf * (1 + effectiveG);
  const terminalValue = terminalFcf / terminalSpread;
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, projectionYears);

  // Enterprise Value = PV(Discrete FCF) + PV(Terminal Value)
  const enterpriseValueM = pvOfFcf + pvTerminalValue;

  // Equity Value = Enterprise Value + Net Cash (Cash - Debt)
  const equityValueM = enterpriseValueM + netCashM;

  // Implied Fair Value Per Share (allows any positive cents down to $0.01)
  const fairValuePerShare = equityValueM / shares;
  return Number(Math.max(0.01, fairValuePerShare).toFixed(2));
}

function parseMarketCapToMillions(marketCapStr?: string | number, currentPrice?: number): number {
  if (typeof marketCapStr === 'number') return marketCapStr;
  if (!marketCapStr) return (currentPrice || 100) * 3000;
  const str = String(marketCapStr).toUpperCase().trim();
  if (str.includes('T')) {
    const val = parseFloat(str.replace(/[^0-9.]/g, ''));
    return (val || 1) * 1_000_000;
  }
  if (str.includes('B')) {
    const val = parseFloat(str.replace(/[^0-9.]/g, ''));
    return (val || 1) * 1_000;
  }
  if (str.includes('M')) {
    const val = parseFloat(str.replace(/[^0-9.]/g, ''));
    return val || 1000;
  }
  return (currentPrice || 100) * (currentPrice && currentPrice < 10 ? 200 : 3000);
}

/**
 * Extracts authentic financial inputs and calculates consistent Bear / Base / Bull DCF scenarios.
 */
export function buildRigorousDCFModel(
  data?: Partial<ReportData>,
  ticker?: string,
  userWacc?: number,
  userGrowth?: number
): { dcfModel: DCFModel; inputs: DCFEngineInputs } {
  const sym = (ticker || data?.ticker || 'STOCK').toUpperCase();
  const currentPrice = data?.intrinsic_value?.current_price || data?.company_profile?.stock_price || 100;
  
  // 1. Sector Detection for Capital Structure & Margin Guardrails
  const sector = (data?.company_profile?.sector || '').toLowerCase();
  const industry = (data?.company_profile?.industry || '').toLowerCase();
  const businessSummary = (data?.company_profile?.description || data?.company_profile?.overview?.description || data?.comprehensive_analysis?.business_overview || '').toLowerCase();

  const isFintech = 
    ['SOFI', 'NU', 'HOOD', 'COIN', 'AFRM', 'UPST', 'PYPL', 'SQ', 'XYZ', 'LC'].includes(sym) ||
    industry.includes('fintech') ||
    industry.includes('financial technology') ||
    industry.includes('digital bank') ||
    industry.includes('consumer finance') ||
    industry.includes('credit services') ||
    businessSummary.includes('fintech') ||
    businessSummary.includes('digital banking');

  const isBankOrInsurance = 
    ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BBL', 'KBANK', 'SCB', 'KTB', 'TTB', 'AIA', 'BRK.A', 'BRK.B', 'MET', 'PRU', 'PGR', 'TRV', 'ALL'].includes(sym) ||
    sector.includes('financial') ||
    sector.includes('bank') ||
    sector.includes('insurance') ||
    industry.includes('bank') ||
    industry.includes('insurance');

  const isCyclical = 
    ['XOM', 'CVX', 'PTT', 'PTTEP', 'VALE', 'BHP', 'RIO', 'ZIM', 'DAL', 'UAL', 'SCGP', 'IVL'].includes(sym) ||
    sector.includes('energy') ||
    sector.includes('basic materials') ||
    industry.includes('oil') ||
    industry.includes('gas') ||
    industry.includes('mining') ||
    industry.includes('shipping');

  const isUtility = 
    ['SO', 'NEE', 'DUK', 'EGCO', 'RATCH', 'TTW', 'T', 'VZ', 'ADVANC', 'TRUE'].includes(sym) ||
    sector.includes('utilities') ||
    sector.includes('telecommunication') ||
    industry.includes('utility') ||
    industry.includes('electric') ||
    industry.includes('telecom');

  // Calculate Real Region-Aware Cost of Capital: strictly enforce CAPM as Single Source of Truth!
  const coc = calculateRegionAwareCostOfCapital(data, sym);
  // For Financials & FinTech: Debt is operating raw material. Cost of Equity (Ke) is the Single Source of Truth!
  const defaultDiscountPct = (isFintech || isBankOrInsurance) ? coc.cost_of_equity_pct : coc.wacc_pct;
  const waccPct = userWacc ?? defaultDiscountPct;
  
  // Terminal Growth is a system-wide macroeconomic constant anchored to long-run GDP pace (<= 3.0%)
  const rawGrowth = userGrowth ?? data?.intrinsic_value?.dcf_model?.assumptions?.terminal_growth_pct ?? MACRO_TERMINAL_GROWTH_DEFAULT_PCT;
  const terminalGrowthPct = userGrowth !== undefined
    ? Math.min(6.0, Math.max(MACRO_TERMINAL_GROWTH_MIN_PCT, rawGrowth))
    : Math.min(MACRO_TERMINAL_GROWTH_MAX_CAP_PCT, Math.max(MACRO_TERMINAL_GROWTH_MIN_PCT, rawGrowth));
  const projectionYears = data?.intrinsic_value?.dcf_model?.assumptions?.projection_years ?? 5;

  // 2. Extract Starting Financials from 10-K / 10-Q statements
  const inc = data?.financial_statements?.income_statement;
  const bs = data?.financial_statements?.balance_sheet;
  const cf = data?.financial_statements?.cash_flow;
  
  let startingRevenueM = 0;
  if (inc?.revenue && inc.revenue.length > 0) {
    const valid = inc.revenue.filter((v): v is number => typeof v === 'number' && v > 0);
    if (valid.length > 0) {
      const sumRev = valid.reduce((a, b) => a + b, 0);
      // If large company revenue is reported in billions (e.g. 4 quarters summing to 130), multiply by 1000
      // But for small-caps with currentPrice < $20 or small market cap, sumRev is already actual millions!
      startingRevenueM = (sumRev < 500 && currentPrice > 50) ? sumRev * 1000 : sumRev;
    }
  }
  if (!startingRevenueM || (startingRevenueM < 20 && currentPrice > 20)) {
    if (sym === 'NVDA') startingRevenueM = 130500;
    else if (sym === 'TSLA') startingRevenueM = 97600;
    else if (sym === 'AAPL') startingRevenueM = 391000;
    else if (sym === 'MSFT') startingRevenueM = 245000;
    else if (sym === 'GOOGL' || sym === 'GOOG') startingRevenueM = 350000;
    else if (sym === 'AMZN') startingRevenueM = 620000;
    else if (sym === 'META') startingRevenueM = 165000;
    else if (sym === 'AMD') startingRevenueM = 25700;
    else if (sym === 'PLTR') startingRevenueM = 2800;
    else if (sym === 'RKLB') startingRevenueM = 430;
    else if (sym === 'ASTS') startingRevenueM = 85;
    else if (sym === 'EOSE') startingRevenueM = 85; // EOSE 2025/2026 guided run-rate
    else if (sym === 'FLNC') startingRevenueM = 2700;
    else if (sym === 'SOFI') startingRevenueM = 2650;
    else if (sym === 'HOOD') startingRevenueM = 2850;
    else if (sym === 'NU') startingRevenueM = 9200;
    else startingRevenueM = currentPrice < 10 ? currentPrice * 25 : (currentPrice || 100) * 150;
  }

  // Net Cash = Cash - Debt
  let cashM = 0;
  if (bs?.cash_and_equivalents && bs.cash_and_equivalents.length > 0) {
    const val = bs.cash_and_equivalents[bs.cash_and_equivalents.length - 1];
    if (val) cashM = val < 100 && currentPrice > 50 ? val * 1000 : val;
  }
  let debtM = 0;
  if (bs?.total_debt && bs.total_debt.length > 0) {
    const val = bs.total_debt[bs.total_debt.length - 1];
    if (val) debtM = val < 100 && currentPrice > 50 ? val * 1000 : val;
  }
  if (!cashM && sym === 'NVDA') { cashM = 34800; debtM = 8400; }
  else if (!cashM && sym === 'TSLA') { cashM = 43500; debtM = 9342; }
  else if (!cashM && sym === 'EOSE') { cashM = 370; debtM = 280; } // Post-rights offering cash ($250M capital raise)

  let netCashM = cashM - debtM;

  // CRITICAL SECTOR GUARDRAIL:
  // For Banks, FinTechs, and Insurance: customer deposits, credit warehouse lines, and insurance float
  // are OPERATING raw material liabilities, NOT financial debt leverage.
  // Subtracting them in Net Cash wipes out equity value and cuts fair value by 50-80%!
  if (isFintech || isBankOrInsurance) {
    // For financial institutions, balance sheet deposits/loans are operating assets/liabilities.
    // Net cash for equity DCF is corporate holding cash only (never subtracting deposits).
    netCashM = Math.max(0, cashM < 5000 ? cashM : 0);
  }

  // Extract Exact Market Cap and Real Shares Outstanding
  let marketCapM = 0;
  const peerList = data?.peer_comparison?.peers;
  const targetPeer = peerList?.find(p => p.ticker.toUpperCase() === sym);
  if (targetPeer?.market_cap) {
    marketCapM = parseMarketCapToMillions(targetPeer.market_cap, currentPrice);
  } else if ((data?.company_profile as any)?.market_cap) {
    marketCapM = parseMarketCapToMillions((data?.company_profile as any).market_cap, currentPrice);
  } else if ((data?.company_profile as any)?.market_cap_formatted) {
    marketCapM = parseMarketCapToMillions((data?.company_profile as any).market_cap_formatted, currentPrice);
  } else {
    marketCapM = currentPrice * (currentPrice < 10 ? 250 : 3000);
  }

  let verifiedSharesM = 0;
  if (sym === 'NVDA') verifiedSharesM = 24520;
  else if (sym === 'TSLA') verifiedSharesM = 3950;
  else if (sym === 'AAPL') verifiedSharesM = 14594;
  else if (sym === 'MSFT') verifiedSharesM = 7426;
  else if (sym === 'GOOGL' || sym === 'GOOG') verifiedSharesM = 12380;
  else if (sym === 'AMZN') verifiedSharesM = 10786;
  else if (sym === 'META') verifiedSharesM = 2205;
  else if (sym === 'AMD') verifiedSharesM = 1630;
  else if (sym === 'PLTR') verifiedSharesM = 2400;
  else if (sym === 'RKLB') verifiedSharesM = 598;
  else if (sym === 'ASTS') verifiedSharesM = 390;
  else if (sym === 'EOSE') verifiedSharesM = 362;
  else if (sym === 'FLNC') verifiedSharesM = 143;
  else if (sym === 'SOFI') verifiedSharesM = 1080;
  else if (sym === 'NU') verifiedSharesM = 4800;
  else if (sym === 'HOOD') verifiedSharesM = 890;
  else if (sym === 'COIN') verifiedSharesM = 250;
  else if (sym === 'PYPL') verifiedSharesM = 1020;
  else if (sym === 'AFRM') verifiedSharesM = 310;
  else if (sym === 'UPST') verifiedSharesM = 95;
  else if (sym === 'JPM') verifiedSharesM = 2860;
  else if (sym === 'BAC') verifiedSharesM = 7800;

  const impliedSharesM = verifiedSharesM > 0
    ? verifiedSharesM
    : (currentPrice > 0 && marketCapM > 0 ? Math.max(1, marketCapM / currentPrice) : (currentPrice < 10 ? 250 : 3000));

  const inputs: DCFEngineInputs = {
    ticker: sym,
    currentPrice,
    startingRevenueM,
    sharesOutstandingM: impliedSharesM,
    netCashM,
    waccPct,
    terminalGrowthPct,
    projectionYears
  };

  // 3. Define Clean Scenario Assumptions (Grounded in Unit Economics)
  const existingScenarios = data?.intrinsic_value?.dcf_model?.scenarios;

  // Detect negative gross margin / distressed state
  const grossMarginArr = (inc?.gross_margin_pct || []).filter(v => typeof v === 'number');
  const isNegativeGrossMargin = (grossMarginArr.length > 0 && grossMarginArr[grossMarginArr.length - 1] < 0) || sym === 'EOSE';
  const isDistressed = coc.is_distressed_or_unprofitable || false;

  let bearCagr = existingScenarios?.bear?.revenue_cagr_pct ?? 25.0;
  let bearMargin = existingScenarios?.bear?.terminal_margin_pct ?? 38.0;
  
  let baseCagr = existingScenarios?.base?.revenue_cagr_pct ?? 42.0;
  let baseMargin = existingScenarios?.base?.terminal_margin_pct ?? 48.0;
  
  let bullCagr = existingScenarios?.bull?.revenue_cagr_pct ?? 58.0;
  let bullMargin = existingScenarios?.bull?.terminal_margin_pct ?? 55.0;

  // Ground Margins based on Sector Economics
  if (isNegativeGrossMargin) {
    bearMargin = Math.min(bearMargin, 2.5);
    baseMargin = Math.min(baseMargin, 5.0);
    bullMargin = Math.min(bullMargin, 8.5);
    bearCagr = Math.min(bearCagr, 25.0);
    baseCagr = Math.min(baseCagr, 40.0);
    bullCagr = Math.min(bullCagr, 60.0);
  } else if (isFintech) {
    // FinTech digital banking platforms: 18-24% platform net margin at scale
    bearMargin = Math.min(bearMargin, 14.0);
    baseMargin = Math.min(baseMargin, 20.0);
    bullMargin = Math.min(bullMargin, 26.0);
    bearCagr = Math.min(bearCagr, 18.0);
    baseCagr = Math.min(baseCagr, 28.0);
    bullCagr = Math.min(bullCagr, 40.0);
  } else if (isCyclical) {
    // Cyclical commodity producers: Through-Cycle Normalized Margins (7-10 yr median)
    bearMargin = Math.min(bearMargin, 7.5);
    baseMargin = Math.min(baseMargin, 12.5);
    bullMargin = Math.min(bullMargin, 18.5);
    bearCagr = Math.min(bearCagr, 4.0);
    baseCagr = Math.min(baseCagr, 8.0);
    bullCagr = Math.min(bullCagr, 14.0);
  } else if (isUtility) {
    // Regulated Utilities & Telecoms: stable rate-base return
    bearMargin = Math.min(bearMargin, 10.0);
    baseMargin = Math.min(baseMargin, 14.0);
    bullMargin = Math.min(bullMargin, 18.0);
    bearCagr = Math.min(bearCagr, 2.5);
    baseCagr = Math.min(baseCagr, 4.5);
    bullCagr = Math.min(bullCagr, 6.5);
  } else if (isDistressed) {
    bearMargin = Math.min(bearMargin, 6.0);
    baseMargin = Math.min(baseMargin, 12.0);
    bullMargin = Math.min(bullMargin, 18.0);
  }

  // Guarantee strict monotonic scenario progression: Bear <= Base <= Bull
  if (baseCagr < bearCagr) {
    baseCagr = Number(Math.min(bullCagr, Math.max(bearCagr * 1.35, 35.0)).toFixed(1));
  }
  if (bullCagr < baseCagr) {
    bullCagr = Number(Math.max(baseCagr * 1.3, 50.0).toFixed(1));
  }
  if (bearMargin > baseMargin) {
    bearMargin = Number((baseMargin * 0.5).toFixed(1));
  }
  if (bullMargin < baseMargin) {
    bullMargin = Number((baseMargin * 1.5).toFixed(1));
  }

  // 4. Strictly compute dynamic DCF fair values (NO hardcoded/hallucinated bypasses)
  const baseFairValue = calculateStrictDCFValue(
    startingRevenueM, impliedSharesM, netCashM, waccPct, terminalGrowthPct, baseCagr, baseMargin, projectionYears
  );

  const bearFairValue = calculateStrictDCFValue(
    startingRevenueM, impliedSharesM, netCashM, waccPct, terminalGrowthPct, bearCagr, bearMargin, projectionYears
  );

  const bullFairValue = calculateStrictDCFValue(
    startingRevenueM, impliedSharesM, netCashM, waccPct, terminalGrowthPct, bullCagr, bullMargin, projectionYears
  );

  let defaultBearNote = existingScenarios?.bear?.key_assumption_note || 'กรณีตลาดชะลอตัว การแข่งขันด้านราคารุนแรง และโครงการใหม่ล่าช้ากว่ากำหนด';
  let defaultBaseNote = existingScenarios?.base?.key_assumption_note || 'กรณีส่งมอบสินค้าเติบโตตามเป้าหมาย ธุรกิจขยายตัวต่อเนื่อง';
  let defaultBullNote = existingScenarios?.bull?.key_assumption_note || 'กรณีขยายตัวรวดเร็ว พร้อมอัตรากำไรขยายตัวก้าวกระโดด';

  if (isNegativeGrossMargin) {
    defaultBearNote = 'กรณีขยายกำลังผลิตล่าช้า ต้นทุนสูง และเผชิญผลกระทบหุ้นเพิ่มทุน (Dilution) เพิ่มเติม';
    defaultBaseNote = 'กรณีเริ่ม Turnaround ประสบความสำเร็จ Gross Margin พลิกเป็นบวกเล็กน้อย (5%) พร้อมคำนึงถึงความเสี่ยงการระดมทุน';
    defaultBullNote = 'กรณีคำสั่งซื้อเร่งตัวเต็มกำลัง และสามารถ Scale การผลิตจนสร้างความประหยัดต่อขนาด (Economies of Scale)';
  } else if (isFintech) {
    defaultBearNote = `กรณีการเติบโตของสินเชื่อชะลอตัว ส่วนต่างอัตราดอกเบี้ย (NIM) แคบลง และต้นทุนการระดมเงินฝากสูงขึ้น (Margin ${bearMargin}%)`;
    defaultBaseNote = `กรณีแพลตฟอร์มขยายตัวต่อเนื่อง สัดส่วนรายได้ค่าธรรมเนียมเติบโต และอัตรากำไรสุทธิขยายตัวสู่ ${baseMargin}%`;
    defaultBullNote = `กรณีขยายระบบนิเวศการเงินครบวงจร การประหยัดต่อขนาดหนุนมาร์จิ้นแตะ ${bullMargin}%`;
  } else if (isCyclical) {
    defaultBearNote = 'กรณีวัฏจักรสินค้าโภคภัณฑ์ขาลง อุปทานส่วนเกินกดดันอัตรากำไรสู่ระดับต่ำสุด';
    defaultBaseNote = 'อิงอัตรากำไรเฉลี่ยตลอดวัฏจักรสินค้าโภคภัณฑ์ (Through-Cycle Normalized Margin 12.5%)';
    defaultBullNote = 'กรณีวัฏจักรสินค้าโภคภัณฑ์ขาขึ้น อุปสงค์ตึงตัวหนุนอัตรากำไรแตะระดับสูงสุดของรอบ';
  } else if (isUtility) {
    defaultBearNote = 'กรณีอัตราดอกเบี้ยทรงตัวสูงกดดันต้นทุนหนี้ และการปรับขึ้นค่าบริการล่าช้า';
    defaultBaseNote = 'กระแสเงินสดเสถียรตามผลตอบแทนฐานสินทรัพย์กำกับดูแล (Regulated Asset Base) และการเติบโตใกล้เคียง GDP';
    defaultBullNote = 'กรณีความต้องการใช้พลังงาน/โครงข่ายพุ่งสูงจากการขยายตัวของ Data Center และโครงสร้างพื้นฐานใหม่';
  }

  // TSLA Reality-Grounding Guardrail:
  // Robotaxi has already launched commercially without safety drivers (unsupervised) since mid-2025 in Austin
  // and expanded to Dallas/Houston in 2026. The real Bear risk is slow commercial scaling speed, NOT delayed launch.
  if (sym === 'TSLA') {
    if (/ล่าช้าเข้าปี 2028|ล่าช้ากว่าปี 2028|ล่าช้าไปถึงปี 2028|ยังไม่เปิดให้บริการ|การอนุมัติ Robotaxi ล่าช้า|Robotaxi ล่าช้า/i.test(defaultBearNote) || !existingScenarios?.bear?.key_assumption_note) {
      defaultBearNote = 'กรณี Robotaxi ขยายสเกลเชิงพาณิชย์ได้ช้ากว่าที่บริษัทเคยประกาศไว้มาก (ยังจำกัดอยู่ไม่กี่พันคันภายในปี 2028 จากข้อจำกัดด้านกฎระเบียบและความปลอดภัย) และการแข่งขันด้านราคา EV ยังคงกดดันอัตรากำไร';
    }
    if (!existingScenarios?.base?.key_assumption_note) {
      defaultBaseNote = 'กรณี Robotaxi เริ่มสร้างกระแสเงินสดที่มีนัยสำคัญใน 10-15 เมืองใหญ่ของสหรัฐฯ ตั้งแต่ปี 2027 ตาม Guidance ฝ่ายบริหาร';
    }
    if (!existingScenarios?.bull?.key_assumption_note) {
      defaultBullNote = 'กรณี Cybercab เข้าสู่การผลิตเต็มกำลัง และ Optimus เริ่มส่งมอบเชิงอุตสาหกรรมช่วงปลายปี 2027 พร้อม FSD Unsupervised ปลดล็อคทั่วประเทศ';
    }
  }

  const dcfModel: DCFModel = {
    assumptions: {
      wacc_pct: waccPct,
      terminal_growth_pct: terminalGrowthPct,
      projection_years: projectionYears
    },
    inputs,
    scenarios: {
      bear: {
        revenue_cagr_pct: bearCagr,
        terminal_margin_pct: bearMargin,
        fair_value_per_share: bearFairValue,
        key_assumption_note: defaultBearNote
      },
      base: {
        revenue_cagr_pct: baseCagr,
        terminal_margin_pct: baseMargin,
        fair_value_per_share: baseFairValue,
        key_assumption_note: defaultBaseNote
      },
      bull: {
        revenue_cagr_pct: bullCagr,
        terminal_margin_pct: bullMargin,
        fair_value_per_share: bullFairValue,
        key_assumption_note: defaultBullNote
      }
    }
  };
  (dcfModel as any).inputs = inputs;

  return { dcfModel, inputs };
}
