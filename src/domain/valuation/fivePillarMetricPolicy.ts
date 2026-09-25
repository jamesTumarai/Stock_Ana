import type { BusinessArchetype } from '../financialMetricContext.js';

export interface PillarMetricConfig {
  key: string;
  nameEn: string;
  nameTh: string;
  unit?: string;
  prefix?: string;
  isGuardedForFinancial?: boolean;
}

export interface PeerBenchmarkDimensionConfig {
  dimension: 'valuation' | 'growth' | 'profitability' | 'capital_efficiency' | 'solvency';
  primaryKey: string;
  fallbackKeys?: string[];
  nameEn: string;
  nameTh: string;
  unit: string;
  lowerIsBetter?: boolean;
}

export interface FivePillarMetricPolicy {
  archetype: BusinessArchetype;
  archetypeLabelEn: string;
  archetypeLabelTh: string;
  pillar1: {
    titleEn: string;
    titleTh: string;
    badgeMetricKey: string;
    primaryMetrics: PillarMetricConfig[];
    fallbackMetrics?: PillarMetricConfig[];
  };
  pillar2: {
    titleEn: string;
    titleTh: string;
    badgeMetricKey: string;
    primaryMetrics: PillarMetricConfig[];
    fallbackMetrics?: PillarMetricConfig[];
    isFinancialSectorGuardActive: boolean;
  };
  pillar3: {
    titleEn: string;
    titleTh: string;
    badgeMetricKeyNetCash: string;
    badgeMetricKeyNetDebt: string;
    netCashMetrics: PillarMetricConfig[];
    netDebtMetrics: PillarMetricConfig[];
    fallbackMetrics?: PillarMetricConfig[];
    specializedMetrics?: PillarMetricConfig[];
  };
  pillar4: {
    titleEn: string;
    titleTh: string;
    badgeMetricKey: string;
    primaryMetrics: PillarMetricConfig[];
    fallbackMetrics?: PillarMetricConfig[];
  };
  pillar5: {
    titleEn: string;
    titleTh: string;
    candidateDimensions: PeerBenchmarkDimensionConfig[];
  };
  guardedMetrics: string[];
}

// -------------------------------------------------------------
// Base Reusable Metric Configurations
// -------------------------------------------------------------
const M_REV_GROWTH: PillarMetricConfig = { key: 'revenue_growth', nameEn: 'Revenue YoY Growth:', nameTh: 'รายได้เติบโต YoY (Revenue Growth):', unit: '%', prefix: '+' };
const M_EPS_GROWTH: PillarMetricConfig = { key: 'eps_growth', nameEn: 'EPS YoY Growth:', nameTh: 'กำไร EPS เติบโต YoY (EPS Growth):', unit: '%', prefix: '+' };
const M_FCF_GROWTH: PillarMetricConfig = { key: 'fcf_growth', nameEn: 'FCF YoY Growth:', nameTh: 'กระแสเงินสด FCF เติบโต YoY:', unit: '%', prefix: '+' };
const M_REV_CAGR_3Y: PillarMetricConfig = { key: 'rev_cagr_3yr', nameEn: '3Y Revenue CAGR:', nameTh: 'การเติบโตเฉลี่ย 3 ปี (3Y Rev CAGR):', unit: '%', prefix: '+' };

const M_ROIC: PillarMetricConfig = { key: 'roic', nameEn: 'Return on Invested Capital (ROIC):', nameTh: 'ผลตอบแทนจากเงินลงทุน (ROIC):', unit: '%' };
const M_ROIC_WACC_SPREAD: PillarMetricConfig = { key: 'roic_wacc_spread', nameEn: 'ROIC - WACC Spread:', nameTh: 'ส่วนต่างผลตอบแทนต่อต้นทุนเงินทุน (ROIC - WACC Spread):', unit: '%', prefix: '+' };
const M_OP_MARGIN: PillarMetricConfig = { key: 'operating_margin', nameEn: 'Operating Margin:', nameTh: 'อัตรากำไรจากการดำเนินงาน (Operating Margin):', unit: '%' };
const M_FCF_MARGIN: PillarMetricConfig = { key: 'fcf_margin', nameEn: 'Free Cash Flow Margin:', nameTh: 'อัตรากระแสเงินสดอิสระ (FCF Margin):', unit: '%' };
const M_GROSS_MARGIN: PillarMetricConfig = { key: 'gross_margin', nameEn: 'Gross Margin:', nameTh: 'อัตรากำไรขั้นต้น (Gross Margin):', unit: '%' };
const M_NET_MARGIN: PillarMetricConfig = { key: 'net_margin', nameEn: 'Net Margin:', nameTh: 'อัตรากำไรสุทธิ (Net Margin):', unit: '%' };
const M_ROE: PillarMetricConfig = { key: 'roe', nameEn: 'Return on Equity (ROE):', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น (ROE):', unit: '%' };
const M_ROA: PillarMetricConfig = { key: 'roa', nameEn: 'Return on Assets (ROA):', nameTh: 'ผลตอบแทนต่อสินทรัพย์รวม (ROA):', unit: '%' };
const M_NIM: PillarMetricConfig = { key: 'nim', nameEn: 'Net Interest Margin (NIM):', nameTh: 'อัตราส่วนต่างดอกเบี้ยสุทธิ (NIM):', unit: '%' };
const M_EFFICIENCY_RATIO: PillarMetricConfig = { key: 'efficiency_ratio', nameEn: 'Efficiency Ratio:', nameTh: 'อัตราส่วนค่าใช้จ่ายต่อรายได้ (Efficiency Ratio):', unit: '%' };
const M_COMBINED_RATIO: PillarMetricConfig = { key: 'combined_ratio', nameEn: 'Combined Ratio:', nameTh: 'อัตราส่วนรวมธุรกิจประกัน (Combined Ratio):', unit: '%' };
const M_UNDERWRITING_MARGIN: PillarMetricConfig = { key: 'underwriting_margin', nameEn: 'Underwriting Margin:', nameTh: 'อัตรากำไรจากการรับประกัน:', unit: '%' };

const M_CASH: PillarMetricConfig = { key: 'cash', nameEn: 'Total Cash & ST Investments:', nameTh: 'เงินสด & เงินลงทุนระยะสั้น:', unit: 'B', prefix: '$' };
const M_DEBT: PillarMetricConfig = { key: 'debt', nameEn: 'Total Interest-Bearing Debt:', nameTh: 'หนี้สินที่มีภาระดอกเบี้ย (Total Debt):', unit: 'B', prefix: '$' };
const M_NET_CASH: PillarMetricConfig = { key: 'net_cash', nameEn: 'Net Cash Position:', nameTh: 'สถานะเงินสดสุทธิ (Net Cash):', unit: 'B', prefix: '+$' };
const M_NET_DEBT: PillarMetricConfig = { key: 'net_debt', nameEn: 'Net Debt Position:', nameTh: 'ภาระหนี้สินสุทธิ (Net Debt):', unit: 'B', prefix: '$' };
const M_NET_CASH_TO_MCAP: PillarMetricConfig = { key: 'net_cash_to_mcap', nameEn: 'Net Cash / Market Cap:', nameTh: 'สัดส่วนเงินสดสุทธิต่อมูลค่าตลาด (Net Cash / MCap):', unit: '%' };
const M_NET_DEBT_TO_EBITDA: PillarMetricConfig = { key: 'net_debt_to_ebitda', nameEn: 'Net Debt / EBITDA Ratio:', nameTh: 'หนี้สินสุทธิต่อ EBITDA (Net Debt / EBITDA):', unit: 'x' };
const M_DEBT_TO_EQUITY: PillarMetricConfig = { key: 'debt_to_equity', nameEn: 'Debt / Equity Ratio:', nameTh: 'อัตราส่วนหนี้สินต่อทุน (Debt / Equity):', unit: 'x' };
const M_INTEREST_COVERAGE: PillarMetricConfig = { key: 'interest_coverage', nameEn: 'Interest Coverage Ratio:', nameTh: 'ความสามารถจ่ายดอกเบี้ย (Interest Coverage):', unit: 'x' };
const M_CURRENT_RATIO: PillarMetricConfig = { key: 'current_ratio', nameEn: 'Current Ratio:', nameTh: 'อัตราส่วนสภาพคล่องหมุนเวียน (Current Ratio):', unit: 'x' };
const M_CASH_RUNWAY: PillarMetricConfig = { key: 'cash_runway', nameEn: 'Cash Runway:', nameTh: 'ระยะเวลากระแสเงินสดคงเหลือ (Cash Runway):', unit: ' Mo' };
const M_CASH_BURN: PillarMetricConfig = { key: 'cash_burn', nameEn: 'Annual Cash Burn Rate:', nameTh: 'อัตราการเผาเงินสดรายปี (Annual Cash Burn):', unit: 'B', prefix: '$' };

const M_FCF_YIELD: PillarMetricConfig = { key: 'fcf_yield', nameEn: 'FCF Yield (FCF / MCap):', nameTh: 'ผลตอบแทนกระแสเงินสดอิสระ (FCF Yield):', unit: '%' };
const M_EARNINGS_YIELD: PillarMetricConfig = { key: 'earnings_yield', nameEn: 'Earnings Yield (1 / PE):', nameTh: 'ผลตอบแทนจากกำไร (Earnings Yield):', unit: '%' };
const M_SHAREHOLDER_YIELD: PillarMetricConfig = { key: 'shareholder_yield', nameEn: 'Shareholder Yield (Div + Buyback):', nameTh: 'ผลตอบแทนรวมสู่ผู้ถือหุ้น (Shareholder Yield):', unit: '%' };
const M_FCF_CONVERSION: PillarMetricConfig = { key: 'fcf_conversion', nameEn: 'FCF Conversion (FCF / Net Income):', nameTh: 'อัตราแปลงกำไรเป็นเงินสด (FCF Conversion):', unit: '%' };
const M_DIVIDEND_YIELD: PillarMetricConfig = { key: 'dividend_yield', nameEn: 'Dividend Yield:', nameTh: 'อัตราผลตอบแทนเงินปันผล (Dividend Yield):', unit: '%' };
const M_NET_BUYBACK_YIELD: PillarMetricConfig = { key: 'net_buyback_yield', nameEn: 'Net Buyback Yield:', nameTh: 'อัตราซื้อหุ้นคืนสุทธิ (Net Buyback Yield):', unit: '%' };

// -------------------------------------------------------------
// Canonical Standard Operating Policy (Industrial, Manufacturing, Auto, Semi)
// -------------------------------------------------------------
const standardOperatingPolicy: FivePillarMetricPolicy = {
  archetype: 'general_operating',
  archetypeLabelEn: 'General Operating Company',
  archetypeLabelTh: 'บริษัทประกอบการทั่วไป',
  pillar1: {
    titleEn: '1. Growth Engine',
    titleTh: '1. เครื่องยนต์การเติบโต (Growth Engine)',
    badgeMetricKey: 'peg',
    primaryMetrics: [M_REV_GROWTH, M_EPS_GROWTH, M_FCF_GROWTH, M_REV_CAGR_3Y],
  },
  pillar2: {
    titleEn: '2. Capital Efficiency & Profitability',
    titleTh: '2. คุณภาพกำไร & ผลตอบแทนเงินทุน (ROIC / Margins)',
    badgeMetricKey: 'roic',
    primaryMetrics: [M_ROIC, M_ROIC_WACC_SPREAD, M_OP_MARGIN, M_FCF_MARGIN],
    fallbackMetrics: [M_ROE, M_GROSS_MARGIN, M_NET_MARGIN],
    isFinancialSectorGuardActive: false,
  },
  pillar3: {
    titleEn: '3. Balance Sheet & Solvency',
    titleTh: '3. ความแข็งแกร่งงบดุล (Balance Sheet Fortress)',
    badgeMetricKeyNetCash: 'net_cash',
    badgeMetricKeyNetDebt: 'net_debt',
    netCashMetrics: [M_CASH, M_NET_CASH, M_NET_CASH_TO_MCAP, M_INTEREST_COVERAGE],
    netDebtMetrics: [M_CASH, M_NET_DEBT, M_NET_DEBT_TO_EBITDA, M_INTEREST_COVERAGE],
    fallbackMetrics: [M_DEBT_TO_EQUITY, M_CURRENT_RATIO],
  },
  pillar4: {
    titleEn: '4. Shareholder Return & Cash Quality',
    titleTh: '4. ผลตอบแทนผู้ถือหุ้นและคุณภาพกระแสเงินสด (Shareholder Return & Cash Quality)',
    badgeMetricKey: 'fcf_yield',
    primaryMetrics: [M_FCF_YIELD, M_EARNINGS_YIELD, M_SHAREHOLDER_YIELD, M_FCF_CONVERSION],
    fallbackMetrics: [M_FCF_MARGIN, M_DIVIDEND_YIELD, M_NET_BUYBACK_YIELD],
  },
  pillar5: {
    titleEn: '5. Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบเชิงลึกกับค่ากลางกลุ่มคู่แข่ง (Peer Benchmark Matrix)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'pe_trailing', fallbackKeys: ['ev_ebitda', 'ev_sales', 'fcf_yield_pct'], nameEn: 'P/E (Trailing)', nameTh: 'อัตราส่วนราคาต่อกำไร', unit: 'x', lowerIsBetter: true },
      { dimension: 'solvency', primaryKey: 'ev_ebitda', fallbackKeys: ['ev_sales'], nameEn: 'EV / EBITDA', nameTh: 'มูลค่ากิจการต่อกำไรดำเนินงาน', unit: 'x', lowerIsBetter: true },
      { dimension: 'growth', primaryKey: 'revenue_growth_yoy_pct', fallbackKeys: [], nameEn: 'Revenue Growth YoY', nameTh: 'การเติบโตรายได้ YoY', unit: '%', lowerIsBetter: false },
      { dimension: 'capital_efficiency', primaryKey: 'roic_pct', fallbackKeys: ['operating_margin_pct', 'fcf_margin_pct', 'roe_pct'], nameEn: 'ROIC', nameTh: 'ผลตอบแทนเงินลงทุน', unit: '%', lowerIsBetter: false },
    ],
  },
  guardedMetrics: [],
};

// -------------------------------------------------------------
// Industrial / Manufacturing / Automotive
// -------------------------------------------------------------
const industrialManufacturingPolicy: FivePillarMetricPolicy = {
  ...standardOperatingPolicy,
  archetype: 'industrial_manufacturing',
  archetypeLabelEn: 'Industrial & Manufacturing',
  archetypeLabelTh: 'อุตสาหกรรมการผลิต & ยานยนต์',
};

// -------------------------------------------------------------
// Automotive (Specific alias)
// -------------------------------------------------------------
const automotivePolicy: FivePillarMetricPolicy = {
  ...industrialManufacturingPolicy,
  archetype: 'automotive',
  archetypeLabelEn: 'Automotive & Mobility Manufacturing',
  archetypeLabelTh: 'ผู้ผลิตยานยนต์ & เทคโนโลยีการขับเคลื่อน',
};

// -------------------------------------------------------------
// Semiconductor
// -------------------------------------------------------------
const semiconductorPolicy: FivePillarMetricPolicy = {
  ...standardOperatingPolicy,
  archetype: 'semiconductor',
  archetypeLabelEn: 'Semiconductors & Capital Equipment',
  archetypeLabelTh: 'เซมิคอนดักเตอร์ & ฮาร์ดแวร์เทคโนโลยี',
  pillar2: {
    titleEn: '2. Capital Efficiency & Chip Economics',
    titleTh: '2. ประสิทธิภาพการจัดสรรเงินทุน & วงจรชิป (ROIC / Margins)',
    badgeMetricKey: 'roic',
    primaryMetrics: [M_ROIC, M_ROIC_WACC_SPREAD, M_OP_MARGIN, M_FCF_MARGIN],
    fallbackMetrics: [M_GROSS_MARGIN, M_ROE],
    isFinancialSectorGuardActive: false,
  },
};

// -------------------------------------------------------------
// SaaS / Enterprise Software
// -------------------------------------------------------------
const saasSoftwarePolicy: FivePillarMetricPolicy = {
  archetype: 'saas_software',
  archetypeLabelEn: 'SaaS & Enterprise Cloud Software',
  archetypeLabelTh: 'ซอฟต์แวร์คลาวด์ & บริการสมัครสมาชิก (SaaS)',
  pillar1: {
    titleEn: '1. Recurring Revenue Growth',
    titleTh: '1. การเติบโตของรายได้ต่อเนื่อง (Revenue Engine)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [M_REV_GROWTH, M_EPS_GROWTH, M_FCF_GROWTH, M_REV_CAGR_3Y],
  },
  pillar2: {
    titleEn: '2. Operating Leverage & Cash Margins',
    titleTh: '2. ประสิทธิภาพการทำกำไร & FCF Margin (Software Economics)',
    badgeMetricKey: 'fcf_margin',
    primaryMetrics: [M_OP_MARGIN, M_FCF_MARGIN, M_ROIC, M_GROSS_MARGIN],
    fallbackMetrics: [M_NET_MARGIN, M_ROE],
    isFinancialSectorGuardActive: false,
  },
  pillar3: {
    titleEn: '3. Balance Sheet & Liquidity Cushion',
    titleTh: '3. ความแข็งแกร่งงบดุล & สภาพคล่องเงินสด (Balance Sheet Strength)',
    badgeMetricKeyNetCash: 'net_cash',
    badgeMetricKeyNetDebt: 'net_debt',
    netCashMetrics: [M_CASH, M_NET_CASH, M_NET_CASH_TO_MCAP, M_CURRENT_RATIO],
    netDebtMetrics: [M_CASH, M_NET_DEBT, M_NET_DEBT_TO_EBITDA, M_INTEREST_COVERAGE],
    fallbackMetrics: [M_CURRENT_RATIO, M_DEBT_TO_EQUITY],
  },
  pillar4: {
    titleEn: '4. Shareholder Return & Cash Quality',
    titleTh: '4. ผลตอบแทนผู้ถือหุ้นและคุณภาพกระแสเงินสด (Shareholder Return & Cash Quality)',
    badgeMetricKey: 'fcf_yield',
    primaryMetrics: [M_FCF_YIELD, M_FCF_MARGIN, M_SHAREHOLDER_YIELD, M_FCF_CONVERSION],
    fallbackMetrics: [M_EARNINGS_YIELD, M_NET_BUYBACK_YIELD],
  },
  pillar5: {
    titleEn: '5. Software Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบกับคู่แข่งกลุ่มซอฟต์แวร์ (Peer Benchmark Matrix)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'ev_sales', fallbackKeys: ['pe_trailing', 'fcf_yield_pct'], nameEn: 'EV / Sales Multiple', nameTh: 'มูลค่ากิจการต่อรายได้ (EV/Sales)', unit: 'x', lowerIsBetter: true },
      { dimension: 'growth', primaryKey: 'revenue_growth_yoy_pct', fallbackKeys: [], nameEn: 'Revenue Growth YoY', nameTh: 'การเติบโตรายได้ YoY', unit: '%', lowerIsBetter: false },
      { dimension: 'profitability', primaryKey: 'fcf_margin_pct', fallbackKeys: ['operating_margin_pct', 'gross_margin_pct'], nameEn: 'FCF Margin', nameTh: 'อัตรากระแสเงินสดอิสระ (FCF Margin)', unit: '%', lowerIsBetter: false },
      { dimension: 'capital_efficiency', primaryKey: 'operating_margin_pct', fallbackKeys: ['roic_pct', 'roe_pct'], nameEn: 'Operating Margin', nameTh: 'อัตรากำไรจากการดำเนินงาน', unit: '%', lowerIsBetter: false },
    ],
  },
  guardedMetrics: [],
};

// -------------------------------------------------------------
// Retail / Consumer Omnichannel
// -------------------------------------------------------------
const retailPolicy: FivePillarMetricPolicy = {
  ...standardOperatingPolicy,
  archetype: 'retail',
  archetypeLabelEn: 'Retail & Consumer Omnichannel',
  archetypeLabelTh: 'ค้าปลีก & สินค้าอุปโภคบริโภค',
  pillar2: {
    titleEn: '2. Retail Margins & Capital Productivity',
    titleTh: '2. อัตรากำไรค้าปลีก & ประสิทธิภาพเงินลงทุน (ROIC / Margins)',
    badgeMetricKey: 'roic',
    primaryMetrics: [M_OP_MARGIN, M_ROIC, M_FCF_MARGIN, M_GROSS_MARGIN],
    fallbackMetrics: [M_ROE, M_NET_MARGIN],
    isFinancialSectorGuardActive: false,
  },
  pillar3: {
    titleEn: '3. Working Capital & Balance Sheet Strength',
    titleTh: '3. สภาพคล่องเงินทุนหมุนเวียน & หนี้สิน (Balance Sheet & Solvency)',
    badgeMetricKeyNetCash: 'net_cash',
    badgeMetricKeyNetDebt: 'net_debt',
    netCashMetrics: [M_CASH, M_NET_CASH, M_CURRENT_RATIO, M_INTEREST_COVERAGE],
    netDebtMetrics: [M_CASH, M_NET_DEBT, M_NET_DEBT_TO_EBITDA, M_INTEREST_COVERAGE],
    fallbackMetrics: [M_DEBT_TO_EQUITY, M_CURRENT_RATIO],
  },
};

// -------------------------------------------------------------
// Energy & Commodities (Cyclical)
// -------------------------------------------------------------
const energyCommodityPolicy: FivePillarMetricPolicy = {
  ...standardOperatingPolicy,
  archetype: 'energy_commodity',
  archetypeLabelEn: 'Energy & Commodity Cyclicals',
  archetypeLabelTh: 'พลังงาน & สินค้าโภคภัณฑ์ตามวัฏจักร',
  pillar1: {
    titleEn: '1. Production & Revenue Growth',
    titleTh: '1. การเติบโตของรายได้และกำลังการผลิต (Energy & Cyclicals)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [M_REV_GROWTH, M_FCF_GROWTH, M_EPS_GROWTH, M_REV_CAGR_3Y],
  },
  pillar2: {
    titleEn: '2. Upstream Profitability & Capital Efficiency',
    titleTh: '2. อัตรากำไรดำเนินงาน & ประสิทธิภาพเงินทุน (ROIC / FCF Margin)',
    badgeMetricKey: 'operating_margin',
    primaryMetrics: [M_OP_MARGIN, M_FCF_MARGIN, M_ROIC, M_ROE],
    fallbackMetrics: [M_NET_MARGIN, M_ROIC_WACC_SPREAD],
    isFinancialSectorGuardActive: false,
  },
  pillar4: {
    titleEn: '4. Cash Generation & Capital Return',
    titleTh: '4. กระแสเงินสดอิสระ & การคืนทุนผู้ถือหุ้น (FCF & Capital Return)',
    badgeMetricKey: 'fcf_yield',
    primaryMetrics: [M_FCF_YIELD, M_SHAREHOLDER_YIELD, M_DIVIDEND_YIELD, M_FCF_CONVERSION],
    fallbackMetrics: [M_EARNINGS_YIELD, M_FCF_MARGIN],
  },
  pillar5: {
    titleEn: '5. Energy Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบคู่แข่งกลุ่มพลังงาน (Peer Benchmark Matrix)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'ev_ebitda', fallbackKeys: ['pe_trailing', 'fcf_yield_pct'], nameEn: 'EV / EBITDA', nameTh: 'มูลค่ากิจการต่อกำไรก่อนดอกเบี้ยภาษี', unit: 'x', lowerIsBetter: true },
      { dimension: 'solvency', primaryKey: 'fcf_yield_pct', fallbackKeys: ['pe_trailing'], nameEn: 'FCF Yield', nameTh: 'ผลตอบแทนกระแสเงินสดอิสระ', unit: '%', lowerIsBetter: false },
      { dimension: 'growth', primaryKey: 'revenue_growth_yoy_pct', fallbackKeys: [], nameEn: 'Revenue Growth YoY', nameTh: 'การเติบโตรายได้ YoY', unit: '%', lowerIsBetter: false },
      { dimension: 'profitability', primaryKey: 'operating_margin_pct', fallbackKeys: ['fcf_margin_pct', 'roic_pct'], nameEn: 'Operating Margin', nameTh: 'อัตรากำไรจากการดำเนินงาน', unit: '%', lowerIsBetter: false },
    ],
  },
};

// -------------------------------------------------------------
// Utilities (Regulated Capital-Intensive)
// -------------------------------------------------------------
const utilityPolicy: FivePillarMetricPolicy = {
  archetype: 'utility',
  archetypeLabelEn: 'Regulated Utilities & Power Infrastructure',
  archetypeLabelTh: 'สาธารณูปโภค & โครงสร้างพื้นฐานพลังงาน (Regulated)',
  pillar1: {
    titleEn: '1. Rate-Base & Revenue Expansion',
    titleTh: '1. การเติบโตของฐานทรัพย์สินและรายได้ (Rate Base & Revenue)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [M_REV_GROWTH, M_EPS_GROWTH, M_REV_CAGR_3Y],
  },
  pillar2: {
    titleEn: '2. Regulated Return on Equity',
    titleTh: '2. ผลตอบแทนต่อส่วนผู้ถือหุ้นที่กำกับดูแล (Regulated ROE)',
    badgeMetricKey: 'roe',
    primaryMetrics: [M_ROE, M_OP_MARGIN, M_ROA, M_NET_MARGIN],
    isFinancialSectorGuardActive: false,
  },
  pillar3: {
    titleEn: '3. Debt Servicing & Capital Structure',
    titleTh: '3. ภาระหนี้สินและการรองรับดอกเบี้ย (Utility Debt Servicing)',
    badgeMetricKeyNetCash: 'debt_to_equity',
    badgeMetricKeyNetDebt: 'debt_to_equity',
    netCashMetrics: [M_DEBT, M_DEBT_TO_EQUITY, M_INTEREST_COVERAGE, M_CURRENT_RATIO],
    netDebtMetrics: [M_DEBT, M_DEBT_TO_EQUITY, M_INTEREST_COVERAGE, M_CURRENT_RATIO],
    fallbackMetrics: [M_CASH, M_NET_DEBT],
  },
  pillar4: {
    titleEn: '4. Dividend Stability & Shareholder Yield',
    titleTh: '4. เสถียรภาพเงินปันผล & ผลตอบแทนผู้ถือหุ้น (Dividend & Yield)',
    badgeMetricKey: 'dividend_yield',
    primaryMetrics: [M_DIVIDEND_YIELD, M_SHAREHOLDER_YIELD, M_EARNINGS_YIELD, M_FCF_YIELD],
    fallbackMetrics: [M_FCF_CONVERSION],
  },
  pillar5: {
    titleEn: '5. Utility Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบคู่แข่งกลุ่มสาธารณูปโภค (Utility Benchmark Matrix)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'pe_trailing', fallbackKeys: ['price_to_book'], nameEn: 'P/E (Trailing)', nameTh: 'อัตราส่วนราคาต่อกำไร', unit: 'x', lowerIsBetter: true },
      { dimension: 'solvency', primaryKey: 'price_to_book', fallbackKeys: ['ev_ebitda'], nameEn: 'P/B Ratio', nameTh: 'ราคาต่อมูลค่าทางบัญชี', unit: 'x', lowerIsBetter: true },
      { dimension: 'growth', primaryKey: 'revenue_growth_yoy_pct', fallbackKeys: [], nameEn: 'Revenue Growth YoY', nameTh: 'การเติบโตรายได้ YoY', unit: '%', lowerIsBetter: false },
      { dimension: 'capital_efficiency', primaryKey: 'roe_pct', fallbackKeys: ['operating_margin_pct'], nameEn: 'Return on Equity (ROE)', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', unit: '%', lowerIsBetter: false },
    ],
  },
  guardedMetrics: [],
};

// -------------------------------------------------------------
// Healthcare & Pharmaceuticals (Established)
// -------------------------------------------------------------
const healthcarePolicy: FivePillarMetricPolicy = {
  ...standardOperatingPolicy,
  archetype: 'healthcare',
  archetypeLabelEn: 'Healthcare & Pharmaceuticals',
  archetypeLabelTh: 'การแพทย์ & เภสัชกรรม (Healthcare & Pharma)',
  pillar2: {
    titleEn: '2. Operating Margin & Capital Returns',
    titleTh: '2. ประสิทธิภาพการทำกำไร & ผลตอบแทนเงินทุน (ROIC / Margins)',
    badgeMetricKey: 'roic',
    primaryMetrics: [M_OP_MARGIN, M_ROIC, M_FCF_MARGIN, M_GROSS_MARGIN],
    fallbackMetrics: [M_ROE, M_NET_MARGIN],
    isFinancialSectorGuardActive: false,
  },
};

// -------------------------------------------------------------
// Pre-Revenue Biotech / Early-Stage Tech (Pre-Profit)
// -------------------------------------------------------------
const preProfitPolicy: FivePillarMetricPolicy = {
  archetype: 'early_stage',
  archetypeLabelEn: 'Pre-Profit / Early-Stage Growth',
  archetypeLabelTh: 'ธุรกิจระยะเริ่มต้น / ช่วงลงทุนขยายงาน (Pre-Profit)',
  pillar1: {
    titleEn: '1. Commercialization & Revenue Trajectory',
    titleTh: '1. เส้นทางการเติบโตของรายได้ (Commercial Trajectory)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [M_REV_GROWTH, M_REV_CAGR_3Y],
  },
  pillar2: {
    titleEn: '2. Contribution Economics & Cost Trajectory',
    titleTh: '2. เศรษฐศาสตร์ต่อหน่วย & ทิศทางต้นทุน (Unit Margins)',
    badgeMetricKey: 'gross_margin',
    primaryMetrics: [M_GROSS_MARGIN, M_OP_MARGIN],
    fallbackMetrics: [M_NET_MARGIN],
    isFinancialSectorGuardActive: false,
  },
  pillar3: {
    titleEn: '3. Cash Runway & Liquidity Preservation',
    titleTh: '3. ระยะเวลากระแสเงินสดคงเหลือ & สภาพคล่อง (Cash Runway)',
    badgeMetricKeyNetCash: 'cash_runway',
    badgeMetricKeyNetDebt: 'cash_runway',
    netCashMetrics: [M_CASH, M_NET_CASH, M_CASH_RUNWAY, M_CURRENT_RATIO],
    netDebtMetrics: [M_CASH, M_CASH_RUNWAY, M_CURRENT_RATIO, M_DEBT],
    fallbackMetrics: [M_CASH_BURN],
  },
  pillar4: {
    titleEn: '4. Cash Burn Rate & Dilution Profile',
    titleTh: '4. อัตราการใช้เงินสด & การเจือจางหุ้น (Burn & Dilution)',
    badgeMetricKey: 'cash_burn',
    primaryMetrics: [M_CASH_BURN, M_CASH_RUNWAY, M_NET_BUYBACK_YIELD],
    fallbackMetrics: [M_FCF_GROWTH],
  },
  pillar5: {
    titleEn: '5. Growth Stage Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบคู่แข่งระยะเริ่มต้น (Early-Stage Benchmarks)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'ev_sales', fallbackKeys: [], nameEn: 'EV / Sales Multiple', nameTh: 'มูลค่ากิจการต่อรายได้ (EV/Sales)', unit: 'x', lowerIsBetter: true },
      { dimension: 'growth', primaryKey: 'revenue_growth_yoy_pct', fallbackKeys: [], nameEn: 'Revenue Growth YoY', nameTh: 'การเติบโตรายได้ YoY', unit: '%', lowerIsBetter: false },
      { dimension: 'profitability', primaryKey: 'gross_margin_pct', fallbackKeys: ['operating_margin_pct'], nameEn: 'Gross Margin', nameTh: 'อัตรากำไรขั้นต้น', unit: '%', lowerIsBetter: false },
      { dimension: 'capital_efficiency', primaryKey: 'operating_margin_pct', fallbackKeys: [], nameEn: 'Operating Margin', nameTh: 'อัตรากำไรจากการดำเนินงาน', unit: '%', lowerIsBetter: false },
    ],
  },
  guardedMetrics: ['roic', 'roic_wacc_spread', 'fcf_yield', 'earnings_yield', 'pe_trailing'],
};

// -------------------------------------------------------------
// Pre-Revenue Biotech Specific
// -------------------------------------------------------------
const biotechPolicy: FivePillarMetricPolicy = {
  ...preProfitPolicy,
  archetype: 'biotech',
  archetypeLabelEn: 'Clinical-Stage / Pre-Revenue Biotechnology',
  archetypeLabelTh: 'เทคโนโลยีชีวภาพระยะวิจัยทางคลินิก (Clinical Biotech)',
};

// -------------------------------------------------------------
// Commercial / Retail Bank Policy
// -------------------------------------------------------------
const bankPolicy: FivePillarMetricPolicy = {
  archetype: 'bank',
  archetypeLabelEn: 'Commercial & Retail Banking',
  archetypeLabelTh: 'ธนาคารพาณิชย์ & สถาบันการเงินรับฝากเงิน',
  pillar1: {
    titleEn: '1. Franchise Expansion & Asset Growth',
    titleTh: '1. การเติบโตของสินทรัพย์ & พอร์ตสินเชื่อ (Franchise Expansion)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [
      { key: 'nii_growth', nameEn: 'Net Interest Income YoY:', nameTh: 'รายได้ดอกเบี้ยสุทธิเติบโต YoY:', unit: '%', prefix: '+' },
      { key: 'loan_growth', nameEn: 'Gross Loan Growth YoY:', nameTh: 'การเติบโตของพอร์ตสินเชื่อ YoY:', unit: '%', prefix: '+' },
      { key: 'deposit_growth', nameEn: 'Deposit Base Growth YoY:', nameTh: 'การขยายฐานเงินฝาก YoY:', unit: '%', prefix: '+' },
      M_REV_GROWTH,
    ],
  },
  pillar2: {
    titleEn: '2. Profitability & Capital Efficiency (ROE / NIM)',
    titleTh: '2. ผลตอบแทนต่อส่วนผู้ถือหุ้น & ส่วนต่างดอกเบี้ย (ROE / NIM)',
    badgeMetricKey: 'roe',
    primaryMetrics: [M_ROE, M_ROA, M_NIM, M_EFFICIENCY_RATIO],
    fallbackMetrics: [M_OP_MARGIN, M_NET_MARGIN],
    isFinancialSectorGuardActive: true,
  },
  pillar3: {
    titleEn: '3. Capital Adequacy & Deposit Funding',
    titleTh: '3. ความเพียงพอของเงินกองทุน & โครงสร้างเงินฝาก (Capital & Funding)',
    badgeMetricKeyNetCash: 'debt_to_equity',
    badgeMetricKeyNetDebt: 'debt_to_equity',
    netCashMetrics: [
      { key: 'cash', nameEn: 'Cash & Central Bank Reserves:', nameTh: 'เงินสดและสินทรัพย์สภาพคล่องสูง:', unit: 'B', prefix: '$' },
      { key: 'debt', nameEn: 'Senior Notes & Borrowings:', nameTh: 'เงินกู้ยืมและตราสารหนี้ (Borrowings):', unit: 'B', prefix: '$' },
      M_DEBT_TO_EQUITY,
      { key: 'cet1_ratio', nameEn: 'CET1 Capital Ratio:', nameTh: 'อัตราส่วนเงินกองทุนขั้นที่ 1 (CET1):', unit: '%' },
    ],
    netDebtMetrics: [
      { key: 'cash', nameEn: 'Cash & Central Bank Reserves:', nameTh: 'เงินสดและสินทรัพย์สภาพคล่องสูง:', unit: 'B', prefix: '$' },
      { key: 'debt', nameEn: 'Senior Notes & Borrowings:', nameTh: 'เงินกู้ยืมและตราสารหนี้ (Borrowings):', unit: 'B', prefix: '$' },
      M_DEBT_TO_EQUITY,
      { key: 'cet1_ratio', nameEn: 'CET1 Capital Ratio:', nameTh: 'อัตราส่วนเงินกองทุนขั้นที่ 1 (CET1):', unit: '%' },
    ],
  },
  pillar4: {
    titleEn: '4. Capital Return & Shareholder Yield',
    titleTh: '4. การคืนเงินทุน & ผลตอบแทนผู้ถือหุ้น (Shareholder Return)',
    badgeMetricKey: 'earnings_yield',
    primaryMetrics: [M_DIVIDEND_YIELD, M_NET_BUYBACK_YIELD, M_SHAREHOLDER_YIELD, M_EARNINGS_YIELD],
    fallbackMetrics: [],
  },
  pillar5: {
    titleEn: '5. Banking Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบกับคู่แข่งกลุ่มธนาคาร (Financial Peer Benchmark)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'price_to_tbv', fallbackKeys: ['price_to_book', 'pe_trailing'], nameEn: 'Price / Tangible Book (P/TBV)', nameTh: 'ราคาต่อมูลค่าทางบัญชีที่จับต้องได้', unit: 'x', lowerIsBetter: true },
      { dimension: 'solvency', primaryKey: 'price_to_book', fallbackKeys: ['pe_forward'], nameEn: 'P/B Ratio', nameTh: 'ราคาต่อมูลค่าทางบัญชี', unit: 'x', lowerIsBetter: true },
      { dimension: 'capital_efficiency', primaryKey: 'roe_pct', fallbackKeys: ['roa_pct'], nameEn: 'Return on Equity (ROE)', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', unit: '%', lowerIsBetter: false },
      { dimension: 'profitability', primaryKey: 'net_interest_margin_pct', fallbackKeys: ['roa_pct'], nameEn: 'Net Interest Margin (NIM)', nameTh: 'อัตราส่วนต่างดอกเบี้ยสุทธิ', unit: '%', lowerIsBetter: false },
    ],
  },
  guardedMetrics: ['roic', 'roic_wacc_spread', 'fcf_yield', 'fcf_growth', 'fcf_conversion', 'net_debt_to_ebitda', 'interest_coverage'],
};

// -------------------------------------------------------------
// Non-Bank Lender / Consumer Finance / FinTech
// -------------------------------------------------------------
const lenderFintechPolicy: FivePillarMetricPolicy = {
  ...bankPolicy,
  archetype: 'fintech',
  archetypeLabelEn: 'FinTech & Consumer Lending Platforms',
  archetypeLabelTh: 'เทคโนโลยีการเงิน & แพลตฟอร์มสินเชื่อดิจิทัล',
  pillar1: {
    titleEn: '1. Origination & Revenue Growth',
    titleTh: '1. การเติบโตของยอดปล่อยสินเชื่อ & รายได้ (Origination & Growth)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [M_REV_GROWTH, M_EPS_GROWTH, M_REV_CAGR_3Y],
  },
  pillar5: {
    titleEn: '5. FinTech Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบกับคู่แข่งกลุ่ม FinTech (Peer Benchmark Matrix)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'price_to_book', fallbackKeys: ['pe_trailing', 'ev_sales'], nameEn: 'P/B Ratio', nameTh: 'ราคาต่อมูลค่าทางบัญชี', unit: 'x', lowerIsBetter: true },
      { dimension: 'growth', primaryKey: 'revenue_growth_yoy_pct', fallbackKeys: [], nameEn: 'Revenue Growth YoY', nameTh: 'การเติบโตรายได้ YoY', unit: '%', lowerIsBetter: false },
      { dimension: 'capital_efficiency', primaryKey: 'roe_pct', fallbackKeys: ['roa_pct'], nameEn: 'Return on Equity (ROE)', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', unit: '%', lowerIsBetter: false },
      { dimension: 'profitability', primaryKey: 'operating_margin_pct', fallbackKeys: ['net_interest_margin_pct', 'roa_pct'], nameEn: 'Operating Margin', nameTh: 'อัตรากำไรจากการดำเนินงาน', unit: '%', lowerIsBetter: false },
    ],
  },
};

const lenderPolicy: FivePillarMetricPolicy = {
  ...lenderFintechPolicy,
  archetype: 'lender',
  archetypeLabelEn: 'Non-Bank Lending & Specialty Finance',
  archetypeLabelTh: 'ผู้ให้บริการสินเชื่อเฉพาะทาง & สินเชื่อเพื่อผู้บริโภค',
};

// -------------------------------------------------------------
// Insurance
// -------------------------------------------------------------
const insurerPolicy: FivePillarMetricPolicy = {
  archetype: 'insurer',
  archetypeLabelEn: 'Insurance Underwriting & Carrier',
  archetypeLabelTh: 'ธุรกิจประกันภัย & ประกันชีวิต (Underwriting)',
  pillar1: {
    titleEn: '1. Gross Premiums & Revenue Growth',
    titleTh: '1. การเติบโตของเบี้ยประกันภัยรับ & รายได้ (Premiums & Growth)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [
      { key: 'premium_growth', nameEn: 'Gross Written Premiums YoY:', nameTh: 'เบี้ยประกันภัยรับรวมเติบโต YoY:', unit: '%', prefix: '+' },
      M_REV_GROWTH,
      M_EPS_GROWTH,
      M_REV_CAGR_3Y,
    ],
  },
  pillar2: {
    titleEn: '2. Underwriting Profitability & ROE',
    titleTh: '2. กำไรจากการรับประกัน & ผลตอบแทนผู้ถือหุ้น (Underwriting & ROE)',
    badgeMetricKey: 'roe',
    primaryMetrics: [M_ROE, M_COMBINED_RATIO, M_UNDERWRITING_MARGIN, M_ROA],
    fallbackMetrics: [M_NET_MARGIN],
    isFinancialSectorGuardActive: true,
  },
  pillar3: {
    titleEn: '3. Capital Solvency & Investment Portfolio',
    titleTh: '3. ความเพียงพอของเงินสำรอง & พอร์ตลงทุน (Reserves & Solvency)',
    badgeMetricKeyNetCash: 'debt_to_equity',
    badgeMetricKeyNetDebt: 'debt_to_equity',
    netCashMetrics: [
      { key: 'cash', nameEn: 'Investment Portfolio & Cash:', nameTh: 'พอร์ตเงินลงทุน & เงินสดสำรอง:', unit: 'B', prefix: '$' },
      { key: 'debt', nameEn: 'Financial Debt & Notes:', nameTh: 'หนี้สินทางการเงินและตราสารหนี้:', unit: 'B', prefix: '$' },
      M_DEBT_TO_EQUITY,
      { key: 'reserve_ratio', nameEn: 'Capital Adequacy / Solvency:', nameTh: 'อัตราส่วนความเพียงพอของเงินทุน:', unit: '%' },
    ],
    netDebtMetrics: [
      { key: 'cash', nameEn: 'Investment Portfolio & Cash:', nameTh: 'พอร์ตเงินลงทุน & เงินสดสำรอง:', unit: 'B', prefix: '$' },
      { key: 'debt', nameEn: 'Financial Debt & Notes:', nameTh: 'หนี้สินทางการเงินและตราสารหนี้:', unit: 'B', prefix: '$' },
      M_DEBT_TO_EQUITY,
      { key: 'reserve_ratio', nameEn: 'Capital Adequacy / Solvency:', nameTh: 'อัตราส่วนความเพียงพอของเงินทุน:', unit: '%' },
    ],
  },
  pillar4: {
    titleEn: '4. Capital Return & Shareholder Yield',
    titleTh: '4. การคืนเงินทุน & ผลตอบแทนผู้ถือหุ้น (Shareholder Return)',
    badgeMetricKey: 'earnings_yield',
    primaryMetrics: [M_DIVIDEND_YIELD, M_NET_BUYBACK_YIELD, M_SHAREHOLDER_YIELD, M_EARNINGS_YIELD],
    fallbackMetrics: [],
  },
  pillar5: {
    titleEn: '5. Insurance Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบกับคู่แข่งกลุ่มประกันภัย (Insurance Peer Benchmark)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'price_to_book', fallbackKeys: ['pe_trailing'], nameEn: 'P/B Ratio', nameTh: 'ราคาต่อมูลค่าทางบัญชี', unit: 'x', lowerIsBetter: true },
      { dimension: 'solvency', primaryKey: 'pe_trailing', fallbackKeys: ['price_to_book'], nameEn: 'P/E (Trailing)', nameTh: 'อัตราส่วนราคาต่อกำไร', unit: 'x', lowerIsBetter: true },
      { dimension: 'capital_efficiency', primaryKey: 'roe_pct', fallbackKeys: ['roa_pct'], nameEn: 'Return on Equity (ROE)', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', unit: '%', lowerIsBetter: false },
      { dimension: 'profitability', primaryKey: 'combined_ratio_pct', fallbackKeys: ['roe_pct'], nameEn: 'Combined Ratio', nameTh: 'อัตราส่วนรวมธุรกิจประกัน', unit: '%', lowerIsBetter: true },
    ],
  },
  guardedMetrics: ['roic', 'roic_wacc_spread', 'fcf_yield', 'fcf_growth', 'fcf_conversion', 'net_debt_to_ebitda', 'interest_coverage', 'nim'],
};

// -------------------------------------------------------------
// Real Estate Investment Trust (REIT)
// -------------------------------------------------------------
const reitPolicy: FivePillarMetricPolicy = {
  archetype: 'reit',
  archetypeLabelEn: 'Real Estate Investment Trust (REIT)',
  archetypeLabelTh: 'ทรัสต์เพื่อการลงทุนในอสังหาริมทรัพย์ (REIT)',
  pillar1: {
    titleEn: '1. Property & NOI Growth',
    titleTh: '1. การเติบโตของรายได้ค่าเช่า & ทรัพย์สิน (Property & NOI Growth)',
    badgeMetricKey: 'revenue_growth',
    primaryMetrics: [
      { key: 'ffo_growth', nameEn: 'FFO / AFFO Growth YoY:', nameTh: 'กระแสเงินสด FFO/AFFO เติบโต YoY:', unit: '%', prefix: '+' },
      { key: 'noi_growth', nameEn: 'Net Operating Income (NOI) Growth:', nameTh: 'กำไรจากการดำเนินงานทรัพย์สิน (NOI Growth):', unit: '%', prefix: '+' },
      M_REV_GROWTH,
      M_REV_CAGR_3Y,
    ],
  },
  pillar2: {
    titleEn: '2. FFO / AFFO Quality & Occupancy',
    titleTh: '2. คุณภาพกระแสเงินสด FFO/AFFO & อัตราการเช่า (REIT Economics)',
    badgeMetricKey: 'occupancy_rate',
    primaryMetrics: [
      { key: 'occupancy_rate', nameEn: 'Portfolio Occupancy Rate:', nameTh: 'อัตราการเช่าพื้นที่เฉลี่ย (Occupancy Rate):', unit: '%' },
      { key: 'ffo_margin', nameEn: 'FFO Margin:', nameTh: 'อัตรากำไรกระแสเงินสด FFO (FFO Margin):', unit: '%' },
      M_OP_MARGIN,
      M_ROE,
    ],
    fallbackMetrics: [M_NET_MARGIN],
    isFinancialSectorGuardActive: false,
  },
  pillar3: {
    titleEn: '3. Leverage & Debt Maturity Profile',
    titleTh: '3. ภาระหนี้สินกองทรัสต์ & อัตราส่วนครอบคลุม (REIT Leverage)',
    badgeMetricKeyNetCash: 'debt_to_equity',
    badgeMetricKeyNetDebt: 'debt_to_equity',
    netCashMetrics: [M_CASH, M_DEBT, M_INTEREST_COVERAGE, M_DEBT_TO_EQUITY],
    netDebtMetrics: [
      M_CASH,
      M_DEBT,
      { key: 'net_debt_to_ebitdare', nameEn: 'Net Debt / EBITDAre:', nameTh: 'หนี้สินสุทธิต่อ EBITDAre:', unit: 'x' },
      M_INTEREST_COVERAGE,
    ],
    fallbackMetrics: [M_DEBT_TO_EQUITY],
  },
  pillar4: {
    titleEn: '4. Dividend Yield & AFFO Payout',
    titleTh: '4. ผลตอบแทนเงินปันผล & สัดส่วนจ่าย AFFO (Dividend & AFFO Quality)',
    badgeMetricKey: 'dividend_yield',
    primaryMetrics: [
      M_DIVIDEND_YIELD,
      { key: 'affo_payout_ratio', nameEn: 'AFFO Payout Ratio:', nameTh: 'สัดส่วนจ่ายปันผลต่อ AFFO (AFFO Payout):', unit: '%' },
      { key: 'ffo_yield', nameEn: 'FFO Yield:', nameTh: 'ผลตอบแทนกระแสเงินสด FFO (FFO Yield):', unit: '%' },
      M_SHAREHOLDER_YIELD,
    ],
    fallbackMetrics: [M_EARNINGS_YIELD],
  },
  pillar5: {
    titleEn: '5. REIT Peer Benchmark Matrix',
    titleTh: '5. ตารางเปรียบเทียบคู่แข่งกลุ่มกองทรัสต์ (REIT Benchmark Matrix)',
    candidateDimensions: [
      { dimension: 'valuation', primaryKey: 'p_ffo_multiple', fallbackKeys: ['p_affo_multiple', 'pe_trailing'], nameEn: 'Price / FFO Multiple', nameTh: 'ราคาต่อกระแสเงินสดดำเนินงาน (P/FFO)', unit: 'x', lowerIsBetter: true },
      { dimension: 'solvency', primaryKey: 'occupancy_rate_pct', fallbackKeys: ['p_affo_multiple'], nameEn: 'Occupancy Rate', nameTh: 'อัตราการเช่าพื้นที่ (Occupancy)', unit: '%', lowerIsBetter: false },
      { dimension: 'growth', primaryKey: 'revenue_growth_yoy_pct', fallbackKeys: [], nameEn: 'Revenue Growth YoY', nameTh: 'การเติบโตรายได้ YoY', unit: '%', lowerIsBetter: false },
      { dimension: 'capital_efficiency', primaryKey: 'roe_pct', fallbackKeys: ['operating_margin_pct'], nameEn: 'Return on Equity (ROE)', nameTh: 'ผลตอบแทนต่อส่วนผู้ถือหุ้น', unit: '%', lowerIsBetter: false },
    ],
  },
  guardedMetrics: ['fcf_conversion', 'roic', 'roic_wacc_spread'],
};

// -------------------------------------------------------------
// Central Registry Map
// -------------------------------------------------------------
export const fivePillarMetricPolicies: Record<string, FivePillarMetricPolicy> = {
  general_operating: standardOperatingPolicy,
  industrial_manufacturing: industrialManufacturingPolicy,
  automotive: automotivePolicy,
  saas_software: saasSoftwarePolicy,
  semiconductor: semiconductorPolicy,
  retail: retailPolicy,
  energy_commodity: energyCommodityPolicy,
  utility: utilityPolicy,
  healthcare: healthcarePolicy,
  biotech: biotechPolicy,
  early_stage: preProfitPolicy,
  bank: bankPolicy,
  lender: lenderPolicy,
  fintech: lenderFintechPolicy,
  insurer: insurerPolicy,
  reit: reitPolicy,
  hardware_device: standardOperatingPolicy,
  digital_marketplace: saasSoftwarePolicy,
  telecom: utilityPolicy,
  asset_manager: bankPolicy,
  broker_exchange: bankPolicy,
};

/**
 * Resolves the authoritative 5 Pillars Metric Policy for any business archetype.
 * Falls back to conservative generic operating policy if archetype is unknown or ambiguous.
 */
export function getFivePillarMetricPolicy(
  archetype?: BusinessArchetype | string,
  subIndustry?: string
): FivePillarMetricPolicy {
  if (archetype === 'industrial_manufacturing' && subIndustry && /auto/i.test(subIndustry)) {
    return automotivePolicy;
  }
  if (archetype && fivePillarMetricPolicies[archetype]) {
    return fivePillarMetricPolicies[archetype];
  }
  return standardOperatingPolicy;
}
