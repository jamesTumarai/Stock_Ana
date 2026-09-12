import { FinancialStatementsData } from '../types';

export interface CalculationVariable {
  symbol: string;
  nameEn: string;
  nameTh: string;
  value: number | null | undefined;
  unit?: string;
  isCurrency?: boolean;
}

export interface MetricCalculationDetail {
  key: string;
  nameEn: string;
  nameTh: string;
  category: 'profitability' | 'solvency' | 'operating_capacity' | 'cash_flow' | 'income' | 'valuation';
  formulaLaTeX?: string;
  formulaDisplay: string;
  variables: CalculationVariable[];
  resultValue: number | null | undefined;
  resultUnit: string;
  explanationEn: string;
  explanationTh: string;
  standardBenchmarkEn?: string;
  standardBenchmarkTh?: string;
}

export function getMetricCalculationDetail(
  key: string,
  periodIndex: number,
  data?: FinancialStatementsData,
  valuationContext?: {
    currentPrice?: number;
    fairValue?: number;
    waccPct?: number;
    terminalGrowthPct?: number;
  }
): MetricCalculationDetail | null {
  if (!data && !valuationContext) return null;

  const income = data?.income_statement;
  const balance = data?.balance_sheet;
  const cashflow = data?.cash_flow;

  const p = periodIndex >= 0 ? periodIndex : 0;

  switch (key) {
    case 'free_cash_flow': {
      const ocf = cashflow?.operating_cash_flow?.[p];
      const capexRaw = cashflow?.capex?.[p];
      const capex = capexRaw !== null && capexRaw !== undefined ? Math.abs(capexRaw) : null;
      const fcf = (ocf !== null && ocf !== undefined && capex !== null && capex !== undefined)
        ? ocf - capex
        : (cashflow?.free_cash_flow?.[p] ?? null);

      return {
        key: 'free_cash_flow',
        nameEn: 'Free Cash Flow (FCF)',
        nameTh: 'กระแสเงินสดอิสระ (FCF)',
        category: 'cash_flow',
        formulaDisplay: 'Free Cash Flow = Operating Cash Flow (OCF) - Capital Expenditures (CapEx)',
        variables: [
          { symbol: 'OCF', nameEn: 'Operating Cash Flow', nameTh: 'กระแสเงินสดจากการดำเนินงาน', value: ocf, isCurrency: true },
          { symbol: 'CapEx', nameEn: 'Capital Expenditures', nameTh: 'รายจ่ายฝ่ายทุน (ซื้อสินทรัพย์ถาวร)', value: capex, isCurrency: true },
        ],
        resultValue: fcf,
        resultUnit: '$M',
        explanationEn: 'Represents pure cash generated from core business operations after funding necessary capital expenditures to maintain or expand physical assets. This is the canonical cash flow used in DCF equity valuation.',
        explanationTh: 'เงินสดสุทธิที่แท้จริงซึ่งบริษัทสร้างได้จากการดำเนินงานหลัก หักด้วยเงินลงทุนซื้อหรือบำรุงรักษาทรัพย์สินถาวร (CapEx) เป็นหัวใจสำคัญของแบบจำลอง DCF ในการประเมินมูลค่ากิจการ',
        standardBenchmarkEn: 'Consistent positive FCF with conversion ratio > 80% of Net Income indicates top-tier cash earnings quality.',
        standardBenchmarkTh: 'FCF ที่เป็นบวกต่อเนื่องและคิดเป็นสัดส่วนมากกว่า 80% ของกำไรสุทธิ บ่งชี้ถึงคุณภาพกำไรระดับสถาบันที่มั่นคง'
      };
    }

    case 'gross_margin': {
      const rev = income?.revenue?.[p];
      const gp = income?.gross_profit?.[p] ?? (rev !== null && rev !== undefined && income?.cogs?.[p] !== null && income?.cogs?.[p] !== undefined ? rev - income.cogs[p]! : null);
      const gm = (gp !== null && gp !== undefined && rev !== null && rev !== undefined && rev > 0)
        ? Number(((gp / rev) * 100).toFixed(2))
        : null;

      return {
        key: 'gross_margin',
        nameEn: 'Gross Profit Margin',
        nameTh: 'อัตรากำไรขั้นต้น (Gross Margin)',
        category: 'profitability',
        formulaDisplay: 'Gross Margin (%) = (Gross Profit / Total Revenue) × 100',
        variables: [
          { symbol: 'GP', nameEn: 'Gross Profit', nameTh: 'กำไรขั้นต้น', value: gp, isCurrency: true },
          { symbol: 'Rev', nameEn: 'Total Revenue', nameTh: 'รายได้รวม', value: rev, isCurrency: true }
        ],
        resultValue: gm,
        resultUnit: '%',
        explanationEn: 'Measures pricing power and cost efficiency of producing core goods and services before corporate overhead and R&D.',
        explanationTh: 'วัดอำนาจการกำหนดราคาและประสิทธิภาพการบริหารต้นทุนการผลิตสินค้าหรือบริการหลัก ก่อนหักค่าใช้จ่ายบริหารและการวิจัย (R&D)',
        standardBenchmarkEn: '> 50% generally reflects a strong competitive economic moat (software/pharma can exceed 70%).',
        standardBenchmarkTh: '> 50% มักสะท้อนถึงคูเมืองทางเศรษฐกิจ (Economic Moat) ที่แข็งแกร่ง (กลุ่มซอฟต์แวร์อาจสูงเกิน 70%)'
      };
    }

    case 'operating_margin': {
      const rev = income?.revenue?.[p];
      const ebit = income?.operating_income?.[p];
      const opm = (ebit !== null && ebit !== undefined && rev !== null && rev !== undefined && rev > 0)
        ? Number(((ebit / rev) * 100).toFixed(2))
        : null;

      return {
        key: 'operating_margin',
        nameEn: 'Operating Margin (EBIT Margin)',
        nameTh: 'อัตรากำไรจากการดำเนินงาน (Operating Margin)',
        category: 'profitability',
        formulaDisplay: 'Operating Margin (%) = (Operating Income (EBIT) / Total Revenue) × 100',
        variables: [
          { symbol: 'EBIT', nameEn: 'Operating Income', nameTh: 'กำไรจากการดำเนินงาน (EBIT)', value: ebit, isCurrency: true },
          { symbol: 'Rev', nameEn: 'Total Revenue', nameTh: 'รายได้รวม', value: rev, isCurrency: true }
        ],
        resultValue: opm,
        resultUnit: '%',
        explanationEn: 'Demonstrates operating leverage and how much profit a company extracts from each dollar of revenue after paying SG&A and R&D expenses.',
        explanationTh: 'แสดงอัตรากำไรหลังหักต้นทุนขาย ค่าใช้จ่ายในการขาย บริหาร และวิจัยพัฒนา สะท้อน Operating Leverage ที่แท้จริงของกิจการ',
        standardBenchmarkEn: '> 15-20% indicates solid operational efficiency; > 30% denotes exceptional industry leadership.',
        standardBenchmarkTh: '> 15-20% บ่งชี้ถึงประสิทธิภาพการดำเนินงานที่ดีเยี่ยม; หากเกิน 30% ถือเป็นผู้นำอุตสาหกรรมชั้นนำ'
      };
    }

    case 'net_margin': {
      const rev = income?.revenue?.[p];
      const ni = income?.net_income?.[p];
      const nm = (ni !== null && ni !== undefined && rev !== null && rev !== undefined && rev > 0)
        ? Number(((ni / rev) * 100).toFixed(2))
        : null;

      return {
        key: 'net_margin',
        nameEn: 'Net Profit Margin',
        nameTh: 'อัตรากำไรสุทธิ (Net Margin)',
        category: 'profitability',
        formulaDisplay: 'Net Margin (%) = (Net Income / Total Revenue) × 100',
        variables: [
          { symbol: 'NI', nameEn: 'Net Income to Common', nameTh: 'กำไรสุทธิสำหรับผู้ถือหุ้น', value: ni, isCurrency: true },
          { symbol: 'Rev', nameEn: 'Total Revenue', nameTh: 'รายได้รวม', value: rev, isCurrency: true }
        ],
        resultValue: nm,
        resultUnit: '%',
        explanationEn: 'The percentage of revenue that flows to the bottom line for common shareholders after accounting for all expenses, interest, and taxes.',
        explanationTh: 'สัดส่วนของรายได้รวมที่แปลงเป็นกำไรบรรทัดสุดท้ายสำหรับผู้ถือหุ้นสามัญ หลังหักค่าใช้จ่าย ดอกเบี้ย และภาษีครบถ้วน',
        standardBenchmarkEn: '> 10-15% is healthy for established firms; > 20% indicates superior profitability.',
        standardBenchmarkTh: '> 10-15% ถือว่าแข็งแกร่งสำหรับบริษัทขนาดใหญ่; หากเกิน 20% ถือว่ามีความสามารถในการทำกำไรสูงมาก'
      };
    }

    case 'current_ratio': {
      const ca = balance?.total_current_assets?.[p];
      const cl = balance?.total_current_liabilities?.[p];
      const cr = (ca !== null && ca !== undefined && cl !== null && cl !== undefined && cl > 0)
        ? Number((ca / cl).toFixed(2))
        : null;

      return {
        key: 'current_ratio',
        nameEn: 'Current Ratio (Working Capital Solvency)',
        nameTh: 'อัตราส่วนสภาพคล่องหมุนเวียน (Current Ratio)',
        category: 'solvency',
        formulaDisplay: 'Current Ratio = Total Current Assets / Total Current Liabilities',
        variables: [
          { symbol: 'CA', nameEn: 'Total Current Assets', nameTh: 'สินทรัพย์หมุนเวียนรวม', value: ca, isCurrency: true },
          { symbol: 'CL', nameEn: 'Total Current Liabilities', nameTh: 'หนี้สินหมุนเวียนรวม', value: cl, isCurrency: true }
        ],
        resultValue: cr,
        resultUnit: 'x',
        explanationEn: 'Assesses short-term liquidity: whether the company possesses sufficient liquid assets due within 12 months to satisfy short-term obligations.',
        explanationTh: 'วัดสภาพคล่องระยะสั้นเพื่อดูว่าบริษัทมีสินทรัพย์หมุนเวียนที่แปลงเป็นเงินสดได้ใน 1 ปี เพียงพอชำระหนี้สินหมุนเวียนที่จะครบกำหนดหรือไม่',
        standardBenchmarkEn: '1.2x - 2.0x is generally optimal. Ratios significantly below 1.0x may signal near-term liquidity stress.',
        standardBenchmarkTh: '1.2x - 2.0x ถือเป็นระดับที่สมดุล หากต่ำกว่า 1.0x อย่างมีนัยสำคัญอาจสะท้อนความตึงตัวด้านสภาพคล่อง'
      };
    }

    case 'quick_ratio': {
      const cashRaw = balance?.cash_and_equivalents?.[p];
      const stiRaw = balance?.short_term_investments?.[p];
      const recRaw = balance?.receivables?.[p] ?? balance?.accounts_receivable?.[p];
      const cl = balance?.total_current_liabilities?.[p];

      // Fail-closed solvency verification: never assume missing cash, ST investments, or receivables are zero
      const hasCash = typeof cashRaw === 'number' && Number.isFinite(cashRaw) && cashRaw >= 0;
      const hasRec = typeof recRaw === 'number' && Number.isFinite(recRaw) && recRaw >= 0;
      // Short-term investments: if present, must be valid number >= 0. If field is explicitly absent from balance sheet structure, treat as 0 (no separate marketable securities line); if the array exists but this period is missing/null, it is unverified missing data.
      const stiVal = (typeof stiRaw === 'number' && Number.isFinite(stiRaw) && stiRaw >= 0)
        ? stiRaw
        : (balance?.short_term_investments === undefined ? 0 : null);

      const hasValidInputs = hasCash && hasRec && stiVal !== null &&
        typeof cl === 'number' && Number.isFinite(cl) && cl > 0;

      const quickAssets = hasValidInputs ? (cashRaw! + stiVal! + recRaw!) : null;
      const qr = (quickAssets !== null && typeof cl === 'number' && cl > 0)
        ? Number((quickAssets / cl).toFixed(2))
        : null;

      const cashSecVal = (hasCash && stiVal !== null) ? cashRaw! + stiVal! : (hasCash ? cashRaw! : null);

      return {
        key: 'quick_ratio',
        nameEn: 'Quick Ratio (Acid-Test)',
        nameTh: 'อัตราส่วนสภาพคล่องเร็ว (Quick Ratio / Acid-Test)',
        category: 'solvency',
        formulaDisplay: 'Quick Ratio = (Cash + Short-Term Investments + Receivables) / Current Liabilities',
        variables: [
          { symbol: 'Cash+Sec', nameEn: 'Cash & Liquid Investments', nameTh: 'เงินสดและหลักทรัพย์เผื่อขาย', value: cashSecVal, isCurrency: true },
          { symbol: 'Rec', nameEn: 'Accounts Receivable', nameTh: 'ลูกหนี้การค้า', value: hasRec ? recRaw! : null, isCurrency: true },
          { symbol: 'CL', nameEn: 'Total Current Liabilities', nameTh: 'หนี้สินหมุนเวียนรวม', value: (typeof cl === 'number' && Number.isFinite(cl)) ? cl : null, isCurrency: true }
        ],
        resultValue: qr,
        resultUnit: 'x',
        explanationEn: 'A strict solvency test that excludes illiquid inventories and prepayments, measuring immediate coverage of short-term debts.',
        explanationTh: 'การทดสอบสภาพคล่องแบบเข้มงวด โดยตัดสินค้าคงเหลือและค่าใช้จ่ายจ่ายล่วงหน้าที่เปลี่ยนเป็นเงินสดช้าออก',
        standardBenchmarkEn: '≥ 1.0x indicates robust ability to meet obligations immediately without liquidating physical inventory.',
        standardBenchmarkTh: '≥ 1.0x บ่งชี้ว่าบริษัทสามารถชำระหนี้ระยะสั้นได้ทันทีโดยไม่ต้องพึ่งพาการเร่งระบายสต็อกสินค้า'
      };
    }

    case 'debt_to_equity': {
      const td = balance?.total_debt?.[p] ?? (
        balance?.short_term_debt?.[p] !== undefined && balance?.long_term_debt?.[p] !== undefined
          ? (balance.short_term_debt[p] ?? 0) + (balance.long_term_debt[p] ?? 0)
          : null
      );
      const eq = balance?.total_equity?.[p];
      const de = (td !== null && td !== undefined && eq !== null && eq !== undefined && eq > 0)
        ? Number((td / eq).toFixed(2))
        : null;

      return {
        key: 'debt_to_equity',
        nameEn: 'Debt-to-Equity Ratio (D/E)',
        nameTh: 'อัตราส่วนหนี้สินต่อทุน (D/E Ratio)',
        category: 'solvency',
        formulaDisplay: 'D/E Ratio = Total Interest-Bearing Debt / Total Stockholders\' Equity',
        variables: [
          { symbol: 'Debt', nameEn: 'Total Debt (STD + LTD)', nameTh: 'หนี้สินที่มีภาระดอกเบี้ยรวม', value: td, isCurrency: true },
          { symbol: 'Equity', nameEn: 'Total Stockholders\' Equity', nameTh: 'ส่วนของผู้ถือหุ้นรวม', value: eq, isCurrency: true }
        ],
        resultValue: de,
        resultUnit: 'x',
        explanationEn: 'Quantifies balance sheet leverage: how much debt financing is employed relative to net shareholder capital.',
        explanationTh: 'วัดระดับการก่อหนี้เทียบกับฐานทุนของผู้ถือหุ้น แสดงว่ากิจการใช้เงินกู้ยืมมาผลักดันการเติบโตมากน้อยเพียงใด',
        standardBenchmarkEn: '< 1.0x reflects conservative balance sheet capitalization; > 2.0x warrants scrutiny of interest coverage.',
        standardBenchmarkTh: '< 1.0x สะท้อนโครงสร้างทุนที่ปลอดภัย; หากเกิน 2.0x ต้องตรวจความสามารถในการจ่ายดอกเบี้ยอย่างละเอียด'
      };
    }

    case 'roe': {
      const ni = income?.net_income?.[p];
      const eq = balance?.total_equity?.[p];
      const roe = (ni !== null && ni !== undefined && eq !== null && eq !== undefined && eq > 0)
        ? Number(((ni / eq) * 100 * (data?.periods[p]?.includes('Q') ? 4 : 1)).toFixed(2))
        : null;

      return {
        key: 'roe',
        nameEn: 'Return on Equity (ROE - Annualized)',
        nameTh: 'ผลตอบแทนต่อส่วนของผู้ถือหุ้น (ROE คำนวณต่อปี)',
        category: 'operating_capacity',
        formulaDisplay: 'ROE (%) = (Net Income / Total Stockholders\' Equity) × 100 (Annualized for quarterly data)',
        variables: [
          { symbol: 'NI', nameEn: 'Net Income', nameTh: 'กำไรสุทธิ', value: ni, isCurrency: true },
          { symbol: 'Equity', nameEn: 'Stockholders\' Equity', nameTh: 'ส่วนของผู้ถือหุ้นรวม', value: eq, isCurrency: true }
        ],
        resultValue: roe,
        resultUnit: '%',
        explanationEn: 'Measures how efficiently management allocates shareholder capital to generate profits.',
        explanationTh: 'วัดประสิทธิภาพของฝ่ายบริหารในการนำเงินลงทุนของผู้ถือหุ้นไปสร้างผลตอบแทนที่เป็นกำไรสุทธิ',
        standardBenchmarkEn: '> 15-20% indicates superior capital compounding ability.',
        standardBenchmarkTh: '> 15-20% บ่งบอกถึงความสามารถในการทบต้นของเงินทุนระดับสูง'
      };
    }

    case 'margin_of_safety': {
      const price = valuationContext?.currentPrice;
      const fv = valuationContext?.fairValue;
      const mos = (price && fv && price > 0)
        ? Number((((fv - price) / price) * 100).toFixed(1))
        : null;

      return {
        key: 'margin_of_safety',
        nameEn: 'Margin of Safety (Base DCF)',
        nameTh: 'ส่วนเผื่อความปลอดภัย (Margin of Safety)',
        category: 'valuation',
        formulaDisplay: 'Margin of Safety (%) = ((Intrinsic Fair Value - Market Price) / Market Price) × 100',
        variables: [
          { symbol: 'FV', nameEn: 'Base Intrinsic Fair Value', nameTh: 'มูลค่าแท้จริงสถานการณ์ฐาน', value: fv, isCurrency: true },
          { symbol: 'Price', nameEn: 'Current Market Price', nameTh: 'ราคาตลาดปัจจุบัน', value: price, isCurrency: true }
        ],
        resultValue: mos,
        resultUnit: '%',
        explanationEn: 'The core value investing principle established by Benjamin Graham: the discount of market price relative to estimated intrinsic value providing protection against analytical error.',
        explanationTh: 'หลักการหัวใจของ Value Investing ตามแนวทาง Benjamin Graham: ส่วนลดของราคาตลาดเมื่อเทียบกับมูลค่าแท้จริง เพื่อเป็นเกราะป้องกันความผิดพลาดในการประเมิน',
        standardBenchmarkEn: '> +20% represents an attractive institutional buffer; negative values indicate trading at a valuation premium.',
        standardBenchmarkTh: '> +20% ถือเป็นช่วงความปลอดภัยที่น่าสนใจสำหรับนักลงทุน; ค่าติดลบหมายถึงหุ้นเทรดบนพรีเมียมเหนือมูลค่าพื้นฐาน'
      };
    }

    default:
      return null;
  }
}
