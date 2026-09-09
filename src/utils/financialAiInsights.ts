export interface FinancialAiInsight {
  key: string;
  name: string;
  name_th: string;
  category: 'profitability' | 'solvency' | 'operating' | 'income' | 'balance' | 'cashflow';
  status: 'excellent' | 'good' | 'neutral' | 'warning';
  status_label_th: string;
  status_label_en: string;
  what_is_it_th: string;
  what_is_it_en: string;
  interpretation_th: string;
  interpretation_en: string;
  pros_th: string[];
  pros_en: string[];
  benchmark_th: string;
  benchmark_en: string;
  watchouts_th: string;
  watchouts_en: string;
  model?: string;
}

export function getFinancialAiInsight(
  key: string,
  latestValue: number | string | null | undefined,
  unit: string = '',
  isThai: boolean = true,
  historyValues: (number | null | undefined)[] = [],
  yoyPcts: (number | null | undefined)[] = [],
  periods: string[] = [],
  rowTitle: string = '',
  isCurrency: boolean = false
): FinancialAiInsight {
  // 1. Format value string
  let formattedVal = '-';
  let numVal: number | null = null;

  if (latestValue !== null && latestValue !== undefined) {
    if (typeof latestValue === 'number') {
      numVal = latestValue;
      if (isCurrency || unit === '$' || unit === 'USD' || unit === '$M' || unit === 'M') {
        const absVal = Math.abs(latestValue);
        const sign = latestValue < 0 ? '-' : '';
        if (absVal >= 1000) {
          formattedVal = `${sign}$${(absVal / 1000).toFixed(2)}B`;
        } else {
          formattedVal = `${sign}$${absVal.toFixed(2)}M`;
        }
      } else if (unit === '%') {
        formattedVal = `${latestValue.toFixed(1)}%`;
      } else if (unit === 'x') {
        formattedVal = `${latestValue.toFixed(2)}x`;
      } else {
        formattedVal = `${latestValue.toLocaleString()}${unit ? ' ' + unit : ''}`;
      }
    } else {
      const parsed = parseFloat(String(latestValue).replace(/[^0-9.-]/g, ''));
      if (!isNaN(parsed)) numVal = parsed;
      formattedVal = `${latestValue}${unit}`;
    }
  }
  const valStr = formattedVal;

  if (numVal === null) {
    const title = rowTitle || key.replace(/_/g, ' ').toUpperCase();
    return {
      key,
      name: title,
      name_th: `รายการ ${title}`,
      category: 'operating',
      status: 'neutral',
      status_label_th: 'ไม่มีข้อมูล',
      status_label_en: 'Data unavailable',
      what_is_it_th: 'ไม่มีข้อมูลเพียงพอสำหรับอธิบายตัวชี้วัดนี้',
      what_is_it_en: 'Data unavailable for this metric.',
      interpretation_th: 'ไม่มีข้อมูล จึงไม่สร้างค่าหรือข้อสรุปทดแทน',
      interpretation_en: 'Data unavailable; no substitute value or conclusion was generated.',
      pros_th: [],
      pros_en: [],
      benchmark_th: 'ไม่มีข้อมูล',
      benchmark_en: 'Data unavailable',
      watchouts_th: 'รอข้อมูลงบการเงินจากแหล่งอ้างอิงก่อนประเมิน',
      watchouts_en: 'Wait for sourced financial-statement data before evaluating this metric.',
    };
  }

  // 2. Compute historical trend dynamics
  const validHistory = historyValues.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  const validYoYs = yoyPcts.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
  const latestYoY = validYoYs.length > 0 ? validYoYs[validYoYs.length - 1] : null;
  const prevVal = validHistory.length >= 2 ? validHistory[validHistory.length - 2] : null;

  // Calculate consecutive drops and gains
  let consecutiveDrops = 0;
  let consecutiveGains = 0;
  if (validHistory.length >= 2) {
    for (let i = validHistory.length - 1; i >= 1; i--) {
      if (validHistory[i] < validHistory[i - 1]) {
        if (consecutiveGains === 0) consecutiveDrops++;
        else break;
      } else if (validHistory[i] > validHistory[i - 1]) {
        if (consecutiveDrops === 0) consecutiveGains++;
        else break;
      } else {
        break;
      }
    }
  }

  // Trend flags
  const isNegative = numVal !== null && numVal < 0;
  const isTurnedNegative = isNegative && prevVal !== null && prevVal >= 0;
  const isTurnedPositive = numVal !== null && numVal > 0 && prevVal !== null && prevVal <= 0;
  const isSevereDrop = (latestYoY !== null && latestYoY <= -20) || (consecutiveDrops >= 3 && (latestYoY === null || latestYoY < 0));
  const isModerateDrop = latestYoY !== null && latestYoY > -20 && latestYoY <= -5;
  const isStable = latestYoY !== null && Math.abs(latestYoY) < 5;
  const isModerateGrowth = latestYoY !== null && latestYoY >= 5 && latestYoY < 20;
  const isHighGrowth = latestYoY !== null && latestYoY >= 20;

  // Helper string for YoY
  const yoyText = latestYoY !== null
    ? `${latestYoY >= 0 ? '+' : ''}${latestYoY.toFixed(1)}% YoY`
    : '';

  // ==========================================
  // SECTION A: INCOME STATEMENT DOLLAR ITEMS
  // ==========================================

  // 1. Operating Profit / EBIT (Currency)
  if (key === 'operating_income' || key === 'operating_profit' || key === 'ebit') {
    if (isNegative) {
      return {
        key,
        name: 'Operating Profit (EBIT)',
        name_th: 'กำไรจากการดำเนินงาน (Operating Profit / EBIT)',
        category: 'income',
        status: 'warning',
        status_label_th: isTurnedNegative
          ? 'พลิกเป็นขาดทุนจากการดำเนินงาน (Operating Loss)'
          : 'ขาดทุนจากการดำเนินงาน (Operating Loss)',
        status_label_en: 'Operating Loss (EBIT < 0)',
        what_is_it_th: 'กำไรจากกิจกรรมการค้าและบริการหลักของบริษัท ก่อนหักดอกเบี้ยเงินกู้และภาษี (EBIT)',
        what_is_it_en: 'Profit generated directly from core business operations before interest and taxes.',
        interpretation_th: `ผลการดำเนินงานขาดทุนจากการดำเนินงานอยู่ที่ **${valStr}** แสดงว่ารายได้จากการขายไม่ครอบคลุมต้นทุนขายและค่าใช้จ่ายในการดำเนินงาน (COGS + SG&A + R&D) กิจการหลักยังไม่ถึงจุดคุ้มทุน (Breakeven) และยังต้องอาศัยสภาพคล่องภายนอกหรือเงินสดสะสมมาหล่อเลี้ยง`,
        interpretation_en: `Core operations generated an operating loss of **${valStr}**, indicating that revenue fails to cover production and operational overhead.`,
        pros_th: [
          'หากเป็นบริษัทอยู่ในช่วงเติบโต/ขยายตลาด อาจเกิดจากการเร่งลงทุน R&D และสร้างฐานลูกค้าล่วงหน้า',
          'มีโอกาสฟื้นตัวอย่างรวดเร็วหากสามารถปลดล็อก Operating Leverage ได้เมื่อยอดขายแตะสเกล'
        ],
        pros_en: [
          'May indicate aggressive early-stage investment into R&D and platform expansion',
          'High operating leverage potential once revenue scales past breakeven'
        ],
        benchmark_th: 'เกณฑ์ปกติ: ควรมีกำไรจากการดำเนินงานเป็นบวกและเติบโตสอดคล้องกับรายได้รวม',
        benchmark_en: 'Rule of Thumb: Operating profit should consistently remain positive and scale alongside top-line growth.',
        watchouts_th: 'จับตาอัตราการเผาเงินสด (Operating Burn Rate) และระดับเงินสดคงเหลือเพื่อหลีกเลี่ยงความเสี่ยงในการเพิ่มทุน',
        watchouts_en: 'Watch operating burn rate and runway to prevent premature equity dilution.'
      };
    }

    if (isSevereDrop) {
      return {
        key,
        name: 'Operating Profit (EBIT)',
        name_th: 'กำไรจากการดำเนินงาน (Operating Profit / EBIT)',
        category: 'income',
        status: 'warning',
        status_label_th: `หดตัวแรง (${yoyText || 'ลดลงต่อเนื่อง'}) — Operating De-leverage`,
        status_label_en: `Sharp Contraction (${yoyText || 'Declining'}) — De-leverage`,
        what_is_it_th: 'กำไรจากกิจกรรมการค้าและบริการหลักของบริษัท ก่อนหักดอกเบี้ยเงินกู้และภาษี (EBIT)',
        what_is_it_en: 'Profit generated from core business operations before interest and taxes.',
        interpretation_th: `แม้บริษัทยังรักษากำไรจากการดำเนินงานเป็นบวกอยู่ที่ **${valStr}** แต่กำไรหดตัวลงอย่างมีนัยสำคัญ ${yoyText}${consecutiveDrops >= 2 ? ` (และลดลงติดต่อกัน ${consecutiveDrops} ไตรมาส)` : ''} สะท้อนสภาวะ **Operating De-leverage** ที่เกิดจากแรงกดดันด้านสงครามราคาหรือต้นทุน/ค่าใช้จ่ายดำเนินงาน (SG&A, R&D) ที่ลดลงไม่ทันการชะลอตัวของรายได้ ส่งผลให้อัตรากำไรจากการดำเนินงานถูกบีบอัดลงอย่างรวดเร็ว`,
        interpretation_en: `While EBIT remains positive at **${valStr}**, it suffered a sharp contraction of ${yoyText}${consecutiveDrops >= 2 ? ` (declining for ${consecutiveDrops} consecutive quarters)` : ''}. This signals **Operating De-leverage**, where operating expenses and cost pressures squeezed operating margins faster than revenue.`,
        pros_th: [
          `บริษัทยังคงรักษากำไรจากการดำเนินงานเป็นบวก (${valStr}) กิจกรรมทางธุรกิจหลักยังไม่ตกอยู่ในภาวะขาดทุน`,
          'ฐานกำไรยังเพียงพอรองรับภาระดอกเบี้ยจ่ายและค่าใช้จ่ายคงที่ได้ในระดับหนึ่ง'
        ],
        pros_en: [
          `Maintains positive core operating profitability (${valStr}) avoiding operational losses`,
          'Generates adequate operating income to cover ongoing debt service'
        ],
        benchmark_th: 'เกณฑ์ปกติ: EBIT ควรมีแนวโน้มเติบโตสอดคล้องกับรายได้ และไม่ควรหดตัวติดต่อกันหลายไตรมาส',
        benchmark_en: 'Rule of Thumb: Operating profit should expand in tandem with revenue without prolonged quarterly erosion.',
        watchouts_th: 'จับตาความสามารถในการควบคุมค่าใช้จ่ายขายและบริหาร (SG&A) การปรับปรุงต้นทุนการผลิต และการฟื้นตัวของราคาขายเฉลี่ย (ASP) เพื่อหยุดยั้งการหดตัวของมาร์จิ้น',
        watchouts_en: 'Monitor SG&A overhead control, unit production costs, and average selling prices (ASP) to halt margin compression.'
      };
    }

    if (isModerateDrop) {
      return {
        key,
        name: 'Operating Profit (EBIT)',
        name_th: 'กำไรจากการดำเนินงาน (Operating Profit / EBIT)',
        category: 'income',
        status: 'neutral',
        status_label_th: `ชะลอตัว (${yoyText})`,
        status_label_en: `Moderating Growth (${yoyText})`,
        what_is_it_th: 'กำไรจากกิจกรรมการค้าและบริการหลักของบริษัท ก่อนหักดอกเบี้ยเงินกู้และภาษี (EBIT)',
        what_is_it_en: 'Profit generated from core business operations before interest and taxes.',
        interpretation_th: `กำไรจากการดำเนินงานอยู่ที่ **${valStr}** ชะลอตัวลง ${yoyText} สะท้อนแรงกดดันด้านต้นทุนระยะสั้น หรือการขยายการลงทุนในโครงสร้างพื้นฐานใหม่ที่ยังไม่ได้รับผลตอบแทนเต็มเม็ดเต็มหน่วย`,
        interpretation_en: `Operating profit stands at **${valStr}**, moderating by ${yoyText} due to near-term cost pressures or growth reinvestment.`,
        pros_th: [
          'ยังคงรักษากระแสกำไรจากการดำเนินงานหลักได้อย่างมั่นคง',
          'โครงสร้างธุรกิจหลักยังมีความสามารถในการทำกำไรได้ดี'
        ],
        pros_en: [
          'Core business generates robust ongoing operational income',
          'Sound underlying unit economics despite temporary headwinds'
        ],
        benchmark_th: 'เกณฑ์ปกติ: EBIT เติบโตตามรอบวงจรธุรกิจ',
        benchmark_en: 'Rule of Thumb: Cyclical fluctuations within ±10% are standard for capital-intensive industries.',
        watchouts_th: 'เฝ้าระวังไม่ให้ค่าใช้จ่ายดำเนินงานขยายตัวเร็วกว่ารายได้ในไตรมาสถัดไป',
        watchouts_en: 'Watch for overhead costs outpacing revenue growth in subsequent quarters.'
      };
    }

    if (isHighGrowth) {
      return {
        key,
        name: 'Operating Profit (EBIT)',
        name_th: 'กำไรจากการดำเนินงาน (Operating Profit / EBIT)',
        category: 'income',
        status: 'excellent',
        status_label_th: `เติบโตก้าวกระโดด (${yoyText}) — Operating Leverage สูง`,
        status_label_en: `Rapid Expansion (${yoyText}) — High Operating Leverage`,
        what_is_it_th: 'กำไรจากกิจกรรมการค้าและบริการหลักของบริษัท ก่อนหักดอกเบี้ยเงินกู้และภาษี (EBIT)',
        what_is_it_en: 'Profit generated from core business operations before interest and taxes.',
        interpretation_th: `ที่ระดับ **${valStr}** ขยายตัวโดดเด่น ${yoyText} บ่งบอกว่า **บริษัทมี Operating Leverage ที่ยอดเยี่ยม** ค่าใช้จ่ายคงที่ถูกเฉลี่ยด้วยขนาดธุรกิจที่ใหญ่ขึ้น ทำให้ยอดขายที่เพิ่มขึ้นเปลี่ยนเป็นกำไรจากการดำเนินงานได้ในอัตราเร่ง`,
        interpretation_en: `At **${valStr}**, operating profit surged by ${yoyText}, demonstrating exceptional **Operating Leverage** as fixed costs are diluted across a growing revenue base.`,
        pros_th: [
          'ประสิทธิภาพการบริหารค่าใช้จ่ายสำนักงานและทีมขายเป็นเลิศ กำไรโตเร็วกว่ายอดขาย',
          'สะท้อนความสามารถในการทำกำไรของธุรกิจหลักเพียวๆ โดยปราศจากการบิดเบือนโครงสร้างภาษี'
        ],
        pros_en: [
          'Superior overhead cost control and sales efficiency',
          'Reflects pure operational strength unclouded by debt or tax structures'
        ],
        benchmark_th: 'เกณฑ์ปกติ: EBIT เติบโตเร็วกว่ารายได้รวม (Operating Leverage บรรลุผล)',
        benchmark_en: 'Rule of Thumb: Operating profit expanding faster than top-line revenue demonstrates strong operating leverage.',
        watchouts_th: 'ระวังค่าใช้จ่ายพนักงานหรือค่าตอบแทนด้วยหุ้น (Stock-Based Compensation) ที่อาจบวมโตตามขนาดองค์กร',
        watchouts_en: 'Keep an eye on excessive Stock-Based Compensation diluting operating profitability.'
      };
    }

    // Default Good
    return {
      key,
      name: 'Operating Profit (EBIT)',
      name_th: 'กำไรจากการดำเนินงาน (Operating Profit / EBIT)',
      category: 'income',
      status: 'good',
      status_label_th: yoyText ? `เติบโตต่อเนื่อง (${yoyText})` : 'กำไรจากการดำเนินงานมีเสถียรภาพ',
      status_label_en: 'Stable Operating Performance',
      what_is_it_th: 'กำไรจากกิจกรรมการค้าและบริการหลักของบริษัท ก่อนหักดอกเบี้ยเงินกู้และภาษี (EBIT)',
      what_is_it_en: 'Profit generated from core business operations before interest and taxes.',
      interpretation_th: `กำไรจากการดำเนินงานอยู่ที่ **${valStr}** ดำเนินไปอย่างมั่นคง สะท้อนการควบคุมต้นทุนและค่าใช้จ่ายที่มีวินัย`,
      interpretation_en: `Operating profit at **${valStr}** reflects disciplined cost management and steady operational execution.`,
      pros_th: [
        'กิจกรรมการค้าหลักสร้างผลกำไรได้อย่างสม่ำเสมอ',
        'ฐานกำไรมั่นคงรองรับภาระดอกเบี้ยจ่ายและภาษี'
      ],
      pros_en: [
        'Core business consistently generates operational returns',
        'Solid foundation covering debt financing costs and tax liabilities'
      ],
      benchmark_th: 'เกณฑ์ปกติ: รักษาระดับกำไรให้เติบโตสอดคล้องกับภาพรวมอุตสาหกรรม',
      benchmark_en: 'Rule of Thumb: Maintain EBIT growth in line with broader industry benchmarks.',
      watchouts_th: 'ติดตามประสิทธิภาพการบริหารจัดการค่าใช้จ่ายในการขายและบริหาร (SG&A)',
      watchouts_en: 'Monitor SG&A expense efficiency relative to market peers.'
    };
  }

  // 2. Net Income (Currency)
  if (key === 'net_income' || key === 'net_income_cont') {
    if (isNegative) {
      return {
        key,
        name: 'Net Income',
        name_th: 'กำไรสุทธิส่วนของผู้ถือหุ้น (Net Income)',
        category: 'income',
        status: 'warning',
        status_label_th: isTurnedNegative ? 'พลิกเป็นขาดทุนสุทธิ (Net Loss)' : 'ขาดทุนสุทธิ (Net Loss)',
        status_label_en: 'Net Loss',
        what_is_it_th: 'กำไรสุทธิบรรทัดสุดท้ายที่เป็นของส่วนผู้ถือหุ้น หลังหักต้นทุน ค่าใช้จ่ายดำเนินงาน ดอกเบี้ย และภาษีทั้งหมด',
        what_is_it_en: 'Net profit attributable to common shareholders after all expenses, interest, and taxes.',
        interpretation_th: `ผลประกอบการบรรทัดสุดท้ายรายงานผลขาดทุนสุทธิ **${valStr}** สะท้อนว่าค่าใช้จ่ายทั้งหมดของบริษัทสูงกว่ารายได้รวม ส่งผลให้ส่วนของผู้ถือหุ้นลดลง`,
        interpretation_en: `Bottom-line performance reflects a net loss of **${valStr}**, reducing retained earnings and equity value.`,
        pros_th: ['หากเกิดจากการตัดจำหน่ายทางบัญชีครั้งเดียว (Non-cash impairment) อาจไม่กระทบกระแสเงินสดจริง'],
        pros_en: ['Non-cash one-off charges may not reflect underlying operational cash generation'],
        benchmark_th: 'เกณฑ์ปกติ: บริษัทจดทะเบียนควรสร้างกำไรสุทธิเป็นบวกและเติบโตสม่ำเสมอ',
        benchmark_en: 'Rule of Thumb: Public companies should aim for positive, sustainable net profit compounding.',
        watchouts_th: 'ตรวจสอบว่าเป็นผลขาดทุนจากการดำเนินงานหลัก หรือมีค่าใช้จ่ายดอกเบี้ย/การด้อยค่าสินทรัพย์ก้อนใหญ่เข้ามากดดัน',
        watchouts_en: 'Determine whether the loss is driven by core operations or non-operating interest/impairments.'
      };
    }

    if (isSevereDrop) {
      return {
        key,
        name: 'Net Income',
        name_th: 'กำไรสุทธิส่วนของผู้ถือหุ้น (Net Income)',
        category: 'income',
        status: 'warning',
        status_label_th: `กำไรสุทธิหดตัวแรง (${yoyText || 'ลดลงมาก'})`,
        status_label_en: `Net Income Contraction (${yoyText || 'Declining'})`,
        what_is_it_th: 'กำไรสุทธิบรรทัดสุดท้ายที่เป็นของส่วนผู้ถือหุ้น หลังหักต้นทุน ค่าใช้จ่ายดำเนินงาน ดอกเบี้ย และภาษีทั้งหมด',
        what_is_it_en: 'Net profit attributable to common shareholders after all expenses, interest, and taxes.',
        interpretation_th: `กำไรสุทธิส่วนของผู้ถือหุ้นอยู่ที่ **${valStr}** ปรับลดลงอย่างมีนัยสำคัญ ${yoyText}${consecutiveDrops >= 2 ? ` (ลดลงติดต่อกัน ${consecutiveDrops} ไตรมาส)` : ''} สะท้อนแรงกดดันจากการหดตัวของมาร์จิ้น ต้นทุนขายที่เพิ่มขึ้น หรือค่าใช้จ่ายด้านภาษี/ดอกเบี้ย`,
        interpretation_en: `Net income for common stockholders stands at **${valStr}**, contracting by ${yoyText}${consecutiveDrops >= 2 ? ` (declining for ${consecutiveDrops} consecutive quarters)` : ''} due to margin compression or elevated expenses.`,
        pros_th: [
          `บริษัทยังคงรักษากำไรสุทธิเป็นบวกได้ (${valStr}) ไม่ตกอยู่ในภาวะขาดทุนสุทธิ`,
          'ยังคงมีความสามารถในการสะสมกำไรเข้าสู่ส่วนของผู้ถือหุ้น (Retained Earnings)'
        ],
        pros_en: [
          `Maintains positive bottom-line profit (${valStr}) avoiding net losses`,
          'Continues accumulating retained earnings to support balance sheet equity'
        ],
        benchmark_th: 'เกณฑ์ปกติ: กำไรสุทธิควรเติบโตสอดคล้องกับรายได้รวม',
        benchmark_en: 'Rule of Thumb: Bottom-line net income should track top-line revenue expansion.',
        watchouts_th: 'ตรวจเช็คว่ากำไรที่ลดลงเป็นผลกระทบชั่วคราว หรือแนวโน้มการแข่งขันที่ส่งผลให้มาร์จิ้นลดลงถาวร',
        watchouts_en: 'Verify whether the earnings contraction is temporary or driven by structural competitive pressures.'
      };
    }

    if (isHighGrowth) {
      return {
        key,
        name: 'Net Income',
        name_th: 'กำไรสุทธิส่วนของผู้ถือหุ้น (Net Income)',
        category: 'income',
        status: 'excellent',
        status_label_th: `กำไรสุทธิเติบโตก้าวกระโดด (${yoyText})`,
        status_label_en: `Robust Net Income Growth (${yoyText})`,
        what_is_it_th: 'กำไรสุทธิบรรทัดสุดท้ายที่เป็นของส่วนผู้ถือหุ้น หลังหักต้นทุน ค่าใช้จ่ายดำเนินงาน ดอกเบี้ย และภาษีทั้งหมด',
        what_is_it_en: 'Net profit attributable to common shareholders after all expenses, interest, and taxes.',
        interpretation_th: `กำไรสุทธิอยู่ที่ **${valStr}** เติบโตก้าวกระโดด ${yoyText} สะท้อนการแปลงรายได้เป็นกำไรสุทธิที่มีประสิทธิภาพสูงและการควบคุมค่าใช้จ่ายได้อย่างยอดเยี่ยม`,
        interpretation_en: `Net income reached **${valStr}**, surging by ${yoyText}, demonstrating high revenue conversion efficiency.`,
        pros_th: [
          'เป็นแรงขับเคลื่อนสำคัญที่สุดต่อราคาหุ้นและผลตอบแทนต่อผู้ถือหุ้นในระยะยาว',
          'เพิ่มมูลค่าทางบัญชีต่อหุ้น (Book Value) และสร้างกระแสเงินสดส่วนเกิน'
        ],
        pros_en: [
          'Primary fundamental catalyst for long-term equity appreciation',
          'Expands book value per share and funds future growth capital'
        ],
        benchmark_th: 'เกณฑ์ปกติ: กำไรสุทธิโต > 15-20% ต่อปีจัดอยู่ในกลุ่มหุ้น High-Quality Growth',
        benchmark_en: 'Rule of Thumb: 15-20%+ annual net income growth commands premium valuation multiples.',
        watchouts_th: 'ตรวจสอบว่าเป็นกำไรจากการดำเนินงานจริง หรือมีกำไรพิเศษทางบัญชี (One-off gains) เข้ามาปะปน',
        watchouts_en: 'Ensure bottom-line growth is driven by core business operations rather than one-time accounting gains.'
      };
    }

    // Default Good / Neutral
    return {
      key,
      name: 'Net Income',
      name_th: 'กำไรสุทธิส่วนของผู้ถือหุ้น (Net Income)',
      category: 'income',
      status: isModerateDrop ? 'neutral' : 'good',
      status_label_th: yoyText ? `กำไรสุทธิ (${yoyText})` : 'กำไรสุทธิมีเสถียรภาพ',
      status_label_en: 'Stable Net Income',
      what_is_it_th: 'กำไรสุทธิบรรทัดสุดท้ายที่เป็นของส่วนผู้ถือหุ้น หลังหักต้นทุน ค่าใช้จ่ายดำเนินงาน ดอกเบี้ย และภาษีทั้งหมด',
      what_is_it_en: 'Net profit attributable to common shareholders after all expenses, interest, and taxes.',
      interpretation_th: `กำไรสุทธิอยู่ที่ **${valStr}** ดำเนินไปอย่างมีเสถียรภาพ สะท้อนความสามารถในการสร้างกำไรสุทธิเข้าสู่ส่วนของผู้ถือหุ้นได้อย่างสม่ำเสมอ`,
      interpretation_en: `Net income stands at **${valStr}**, demonstrating stable profitability for common shareholders.`,
      pros_th: ['สร้างผลตอบแทนสม่ำเสมอให้แก่ผู้ถือหุ้น'],
      pros_en: ['Provides consistent earnings stability for equity holders'],
      benchmark_th: 'เกณฑ์ปกติ: กำไรสุทธิมีแนวโน้มเติบโตสม่ำเสมอในระยะยาว',
      benchmark_en: 'Rule of Thumb: Consistent long-term profit compounding.',
      watchouts_th: 'ติดตามผลกระทบจากอัตราดอกเบี้ยจ่ายและภาระภาษีต่อกำไรสุทธิ',
      watchouts_en: 'Monitor debt interest rates and effective tax rates on bottom-line earnings.'
    };
  }

  // 3. Gross Profit (Currency)
  if (key === 'gross_profit') {
    return {
      key,
      name: 'Gross Profit',
      name_th: 'กำไรขั้นต้น (Gross Profit)',
      category: 'income',
      status: isSevereDrop ? 'warning' : isHighGrowth ? 'excellent' : isModerateDrop ? 'neutral' : 'good',
      status_label_th: isSevereDrop
        ? `กำไรขั้นต้นหดตัว (${yoyText})`
        : isHighGrowth
        ? `กำไรขั้นต้นเติบโตสูง (${yoyText})`
        : yoyText ? `กำไรขั้นต้น (${yoyText})` : 'กำไรขั้นต้นมีเสถียรภาพ',
      status_label_en: isSevereDrop ? 'Gross Profit Contraction' : 'Healthy Gross Profit',
      what_is_it_th: 'กำไรเบื้องต้นจากการขายสินค้าและบริการ หลังหักเฉพาะต้นทุนขายทางตรง (COGS) โดยยังไม่รวมค่าใช้จ่ายสำนักงานและการตลาด',
      what_is_it_en: 'Revenue remaining after deducting direct cost of goods sold (COGS).',
      interpretation_th: `กำไรขั้นต้นอยู่ที่ **${valStr}** ${yoyText ? `(เปลี่ยนแปลง ${yoyText})` : ''} สะท้อนผลต่างระหว่างรายได้กับต้นทุนวัตถุดิบและค่าแรงทางตรง เป็นเบาะรองรับค่าใช้จ่ายดำเนินงานในขั้นถัดไป`,
      interpretation_en: `Gross profit stands at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, reflecting the spread between revenue and direct production outlays.`,
      pros_th: [
        'เป็นแหล่งเงินทุนหลักในการนำไปจัดสรรค่าใช้จ่าย R&D และการตลาด',
        'สะท้อนความสามารถในการสร้างมูลค่าเพิ่มของผลิตภัณฑ์'
      ],
      pros_en: [
        'Primary funding pool for R&D and customer acquisition initiatives',
        'Reflects underlying product value creation over direct materials'
      ],
      benchmark_th: 'เกณฑ์ปกติ: ควรขยายตัวสอดคล้องหรือเร็วกว่ารายได้รวม',
      benchmark_en: 'Rule of Thumb: Gross profit should grow in lockstep with or faster than top-line sales.',
      watchouts_th: 'ระวังต้นทุนวัตถุดิบและค่าแรงทางตรงที่เพิ่มขึ้นจนบีบอัดกำไรขั้นต้น',
      watchouts_en: 'Watch for raw material and direct labor inflation squeezing gross profit margins.'
    };
  }

  // 4. Total Revenue (Currency)
  if (key === 'revenue') {
    return {
      key,
      name: 'Total Revenue',
      name_th: 'รายได้รวมตามรายงาน (Total Revenue)',
      category: 'income',
      status: isSevereDrop ? 'warning' : isHighGrowth ? 'excellent' : isModerateDrop ? 'neutral' : 'good',
      status_label_th: isSevereDrop
        ? `รายได้หดตัว (${yoyText})`
        : isHighGrowth
        ? `รายได้เติบโตก้าวกระโดด (${yoyText})`
        : isModerateDrop
        ? `รายได้ชะลอตัว (${yoyText})`
        : yoyText ? `รายได้เติบโตสม่ำเสมอ (${yoyText})` : 'รายได้รวมมีเสถียรภาพ',
      status_label_en: isSevereDrop ? 'Revenue Contraction' : isHighGrowth ? 'Rapid Revenue Growth' : 'Steady Revenue Growth',
      what_is_it_th: 'มูลค่ายอดขายรวมสุทธิจากการส่งมอบสินค้าและบริการทั้งหมดของบริษัทในรอบระยะเวลา',
      what_is_it_en: 'Total gross inflow of economic benefits arising in the course of ordinary activities.',
      interpretation_th: isSevereDrop
        ? `รายได้รวมอยู่ที่ **${valStr}** ปรับลดลง ${yoyText} สะท้อนอุปสงค์ในตลาดที่ชะลอตัวลง หรือแรงกดดันจากการแข่งขันในอุตสาหกรรม`
        : `ที่ระดับ **${valStr}** ${yoyText ? `(${yoyText})` : ''} บ่งบอกถึงความต้องการสินค้าและส่วนแบ่งทางการตลาดของบริษัทที่ยังคงมีเสถียรภาพ`,
      interpretation_en: `Total revenue stands at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, indicating commercial demand volume and market presence.`,
      pros_th: [
        'เป็นเครื่องยนต์หลักในการผลักดันการเติบโตของกำไรในระยะยาว',
        'ยอดขายขนาดใหญ่ช่วยสร้างการประหยัดจากขนาด (Economies of Scale)'
      ],
      pros_en: [
        'Primary engine driving long-term operational scale',
        'Large commercial footprint enables economies of scale'
      ],
      benchmark_th: 'เกณฑ์ปกติ: โตเร็วกว่าค่าเฉลี่ยอุตสาหกรรมและ GDP แสดงถึงส่วนแบ่งการตลาดที่เพิ่มขึ้น',
      benchmark_en: 'Rule of Thumb: Outpacing sector GDP indicates expanding market share.',
      watchouts_th: 'ตรวจสอบการกระจายตัวของรายได้และสัดส่วนรายได้ที่เกิดขึ้นซ้ำ (Recurring Revenue)',
      watchouts_en: 'Monitor customer concentration and the stability of recurring revenue streams.'
    };
  }

  // 5. Cost of Revenue / COGS (Currency)
  if (key === 'cogs') {
    return {
      key,
      name: 'Cost of Revenue',
      name_th: 'ต้นทุนขายและบริการ (COGS)',
      category: 'income',
      status: 'good',
      status_label_th: 'ต้นทุนขายตามระดับกิจกรรมการผลิต',
      status_label_en: 'Direct Production Cost',
      what_is_it_th: 'ต้นทุนทางตรงที่เกิดขึ้นเพื่อผลิตสินค้าหรือให้บริการ เช่น ค่าวัตถุดิบ ค่าชิ้นส่วน ค่าแรงประกอบโรงงาน',
      what_is_it_en: 'Direct costs attributable to the production and delivery of goods sold.',
      interpretation_th: `ต้นทุนขายและบริการอยู่ที่ **${valStr}** สอดคล้องกับปริมาณการส่งมอบสินค้าและบริการในงบการเงิน`,
      interpretation_en: `Cost of revenue stands at **${valStr}**, tracking unit delivery volume and production scale.`,
      pros_th: ['การประหยัดจากขนาดช่วยกดต้นทุนเฉลี่ยต่อหน่วยให้ลดลงเมื่อผลิตจำนวนมาก'],
      pros_en: ['Economies of scale drive down marginal unit costs over time'],
      benchmark_th: 'เกณฑ์ปกติ: สัดส่วน COGS/Revenue ควรมีเสถียรภาพหรือลดลงตามขนาดการผลิต',
      benchmark_en: 'Rule of Thumb: COGS as a percentage of revenue should remain stable or trend lower with scale.',
      watchouts_th: 'จับตาเงินเฟ้อด้านวัตถุดิบ ห่วงโซ่อุปทาน และค่าขนส่งที่อาจส่งผลกระทบต่อต้นทุนขาย',
      watchouts_en: 'Watch for raw material price volatility and supply chain bottlenecks.'
    };
  }

  // 6. Operating Expenses / OPEX (Currency)
  if (key === 'opex') {
    return {
      key,
      name: 'Operating Expense',
      name_th: 'ค่าใช้จ่ายในการดำเนินงาน (Operating Expense - OPEX)',
      category: 'income',
      status: 'good',
      status_label_th: 'ค่าใช้จ่ายดำเนินงานตามแผนธุรกิจ',
      status_label_en: 'Operational Overhead',
      what_is_it_th: 'ค่าใช้จ่ายในการบริหาร การขาย การตลาด (SG&A) และการวิจัยพัฒนา (R&D) เพื่อขับเคลื่อนธุรกิจ',
      what_is_it_en: 'Overhead expenses outside direct production, encompassing SG&A and R&D.',
      interpretation_th: `ค่าใช้จ่ายในการดำเนินงานอยู่ที่ **${valStr}** ครอบคลุมการวิจัยและพัฒนาผลิตภัณฑ์ใหม่ การตลาด และการบริหารจัดการองค์กร`,
      interpretation_en: `Operating expenses stand at **${valStr}**, financing continuous product innovation and go-to-market operations.`,
      pros_th: ['การลงทุนใน R&D และการตลาดช่วยเสริมสร้างความได้เปรียบในการแข่งขันในอนาคต'],
      pros_en: ['Disciplined overhead investment builds long-term technological and brand moats'],
      benchmark_th: 'เกณฑ์ปกติ: OPEX/Revenue ควรมีสัดส่วนลดลงเมื่อรายได้ขยายตัว (Operating Leverage)',
      benchmark_en: 'Rule of Thumb: Overhead ratio should taper downward as revenue scales.',
      watchouts_th: 'ระวังค่าใช้จ่ายสำนักงานหรือค่าตอบแทนผู้บริหาร/พนักงานที่บวมโตเร็วกว่ายอดขาย',
      watchouts_en: 'Watch for administrative bloat outpacing revenue growth.'
    };
  }

  // 7. Diluted EPS
  if (key === 'eps') {
    return {
      key,
      name: 'Diluted EPS',
      name_th: 'กำไรต่อหุ้นปรับลด (Diluted EPS)',
      category: 'income',
      status: isNegative ? 'warning' : isSevereDrop ? 'warning' : isHighGrowth ? 'excellent' : 'good',
      status_label_th: isNegative
        ? 'ขาดทุนต่อหุ้น (Negative EPS)'
        : isSevereDrop
        ? `EPS หดตัวแรง (${yoyText})`
        : isHighGrowth
        ? `EPS เติบโตสูง (${yoyText})`
        : yoyText ? `EPS เติบโต (${yoyText})` : 'กำไรต่อหุ้นมีเสถียรภาพ',
      status_label_en: isNegative ? 'Negative EPS' : isSevereDrop ? 'EPS Contraction' : 'Accretive EPS Growth',
      what_is_it_th: 'กำไรสุทธิต่อหุ้นสามัญ 1 หุ้น โดยคำนึงถึงหุ้นที่อาจเกิดขึ้นจากการแปลงสภาพ (เช่น Stock Options, Warrants) ทั้งหมดแล้ว',
      what_is_it_en: 'Net income available to common stockholders divided by the weighted average diluted shares outstanding.',
      interpretation_th: `กำไรต่อหุ้นปรับลดอยู่ที่ **${valStr}** ${yoyText ? `(${yoyText})` : ''} เป็นตัวสะท้อนผลประโยชน์ทางการเงินที่แท้จริงของผู้ถือหุ้นในแต่ละหน่วยหุ้น`,
      interpretation_en: `Diluted EPS stands at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, reflecting real earning power per share of equity ownership.`,
      pros_th: ['เป็นตัวขับเคลื่อนมูลค่าพื้นฐานของราคาหุ้นในระยะยาว'],
      pros_en: ['The definitive long-term driver of intrinsic share value appreciation'],
      benchmark_th: 'เกณฑ์ปกติ: EPS เติบโตต่อเนื่อง > 15% ต่อปี ถือเป็นหุ้นกลุ่ม High Quality Compounder',
      benchmark_en: 'Rule of Thumb: Consistent double-digit EPS compounding commands premium market valuation.',
      watchouts_th: 'ตรวจสอบผลกระทบจากการออกหุ้นเพิ่มทุนหรือหุ้นแปลงสภาพ (Dilution) ต่อกำไรต่อหุ้น',
      watchouts_en: 'Verify that equity dilution does not erode per-share earnings growth relative to net income.'
    };
  }

  // ==========================================
  // SECTION B: KEY FINANCIAL INDICATORS / RATIOS
  // ==========================================

  // 8. Gross Margin (%)
  if (key === 'gross_margin') {
    const isThin = numVal !== null && numVal < 15;
    const isHigh = numVal !== null && numVal >= 50;
    const isSolid = numVal !== null && numVal >= 25 && numVal < 50;

    return {
      key,
      name: 'Gross Margin',
      name_th: 'อัตรากำไรขั้นต้น (Gross Margin %)',
      category: 'profitability',
      status: isThin ? 'warning' : isHigh ? 'excellent' : 'good',
      status_label_th: isThin
        ? 'มาร์จิ้นขั้นต้นบาง (< 15%)'
        : isHigh
        ? 'แข็งแกร่งมาก (High Pricing Power)'
        : 'สุขภาพดีตามเกณฑ์มาตรฐาน',
      status_label_en: isThin ? 'Thin Gross Margin' : isHigh ? 'Elite Gross Margin' : 'Healthy Gross Margin',
      what_is_it_th: 'สัดส่วนกำไรเบื้องต้นหลังหักต้นทุนขายและบริการโดยตรง (COGS) เทียบกับยอดขายรวม',
      what_is_it_en: 'The proportion of revenue remaining after deducting direct Cost of Goods Sold (COGS).',
      interpretation_th: `ที่ระดับ **${valStr}** สะท้อนความสามารถในการทำกำไรเหนือต้นทุนการผลิตโดยตรง บริษัทมีส่วนต่างกำไรเพื่อนำไปจัดสรรเป็นงบวิจัยพัฒนาและค่าใช้จ่ายดำเนินงาน`,
      interpretation_en: `At **${valStr}**, this reflects the pricing spread above production and delivery costs.`,
      pros_th: [
        'สะท้อนอำนาจในการตั้งราคา (Pricing Power) และความได้เปรียบด้านต้นทุนต่อหน่วย',
        'สร้างกระแสเงินสดเบื้องต้นเพื่อนำไปต่อยอดพัฒนาธุรกิจ'
      ],
      pros_en: [
        'Demonstrates pricing power and low marginal delivery costs',
        'Funds strategic R&D and aggressive market expansion'
      ],
      benchmark_th: 'เกณฑ์ปกติ: > 50% ยอดเยี่ยมสำหรับ Tech/SaaS | 20–40% มาตรฐานกลุ่มอุตสาหกรรมการผลิต/ยานยนต์',
      benchmark_en: 'Rule of Thumb: > 50% SaaS/Tech | 20-40% Healthy Industrial & Automotive',
      watchouts_th: 'จับตาทิศทาง Gross Margin ว่าหดตัวลงจากสงครามราคาหรือต้นทุนชิ้นส่วนที่สูงขึ้นหรือไม่',
      watchouts_en: 'Watch for gross margin compression stemming from competitive discounts or input cost inflation.'
    };
  }

  // 9. Operating Margin (%)
  if (key === 'operating_margin' || key === 'ebit_margin') {
    const isLoss = numVal !== null && numVal < 0;
    const isThin = numVal !== null && numVal >= 0 && numVal < 5;
    const isElite = numVal !== null && numVal >= 20;

    return {
      key,
      name: 'Operating Margin',
      name_th: 'อัตรากำไรจากการดำเนินงาน (Operating / EBIT Margin %)',
      category: 'profitability',
      status: isLoss || isThin ? 'warning' : isElite ? 'excellent' : 'good',
      status_label_th: isLoss
        ? 'มาร์จิ้นติดลบ (Operating Loss)'
        : isThin
        ? 'มาร์จิ้นบางมาก (< 5%) เปราะบาง'
        : isElite
        ? 'ยอดเยี่ยม (High Margin Moat)'
        : 'แข็งแกร่งตามเกณฑ์มาตรฐาน',
      status_label_en: isLoss ? 'Negative Operating Margin' : isThin ? 'Thin Operating Margin' : isElite ? 'Elite Operating Margin' : 'Healthy Operating Margin',
      what_is_it_th: 'สัดส่วนกำไรจากการดำเนินงาน (EBIT) เทียบกับยอดขายรวม สะท้อนประสิทธิภาพในการบริหารค่าใช้จ่ายสำนักงานและทีมขาย',
      what_is_it_en: 'Operating income divided by total revenue, measuring core operational efficiency.',
      interpretation_th: isLoss
        ? `ที่ระดับ **${valStr}** บริษัทมีผลขาดทุนจากการดำเนินงาน สะท้อนว่าโครงสร้างต้นทุนและค่าใช้จ่ายดำเนินงานยังสูงกว่ารายได้รวม`
        : `ที่ระดับ **${valStr}** แสดงความสามารถในการเปลี่ยนยอดขายเป็นกำไรจากการดำเนินงาน หลังหักทั้งต้นทุนขายและค่าใช้จ่ายขายและบริหาร (SG&A) แล้ว`,
      interpretation_en: `At **${valStr}**, this metric indicates how effectively the company translates revenue into operational profit after overhead.`,
      pros_th: [
        'สะท้อนความสามารถในการทำกำไรของธุรกิจหลักเพียวๆ โดยปราศจากการบิดเบือนโครงสร้างภาษีหรือดอกเบี้ย',
        'ประสิทธิภาพในการบริหารค่าใช้จ่ายส่วนกลาง'
      ],
      pros_en: [
        'Reflects pure operational strength unclouded by debt or tax structures',
        'Highlights overhead discipline and operating leverage potential'
      ],
      benchmark_th: 'เกณฑ์ปกติ: > 20% ดีเยี่ยม | 10–20% สุขภาพดี | 5–10% ปานกลาง | < 5% มาร์จิ้นบางเสี่ยงผันผวน',
      benchmark_en: 'Rule of Thumb: > 20% Elite | 10-20% Healthy | 5-10% Moderate | < 5% Vulnerable',
      watchouts_th: 'ระวังค่าใช้จ่ายพนักงาน ค่าการตลาด หรือผลตอบแทนหุ้น (SBC) ที่บวมโตจนกัดกิน EBIT Margin',
      watchouts_en: 'Monitor SG&A overhead inflation and stock-based compensation diluting operating margins.'
    };
  }

  // 10. EBITDA Margin (%)
  if (key === 'ebitda_margin') {
    return {
      key,
      name: 'EBITDA Margin',
      name_th: 'อัตรากำไรก่อนดอกเบี้ย ภาษี ค่าเสื่อม & ตัดจำหน่าย (EBITDA Margin %)',
      category: 'profitability',
      status: (numVal !== null && numVal < 10) ? 'warning' : (numVal !== null && numVal >= 25) ? 'excellent' : 'good',
      status_label_th: (numVal !== null && numVal >= 25) ? 'กระแสกำไรสดระดับสูง' : 'ระดับมาตรฐานสุขภาพดี',
      status_label_en: 'Operational Cash Proxy',
      what_is_it_th: 'ตัวแทนสะท้อนกระแสเงินสดจากการดำเนินงานเบื้องต้น ก่อนหักค่าเสื่อมราคาทางบัญชี (D&A) ภาระหนี้ และภาษี',
      what_is_it_en: 'Core cash profitability proxy before non-cash depreciation, interest, and taxes.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกถึงความสามารถในการสร้างกระแสกำไรสดหมุนเวียนเพื่อรองรับการจ่ายคืนหนี้สินและค่าใช้จ่ายฝ่ายทุน (CapEx)`,
      interpretation_en: `At **${valStr}**, the enterprise generates operational cash buffers to service debt and capital reinvestment.`,
      pros_th: ['ช่วยเปรียบเทียบความสามารถในการทำกำไรระหว่างบริษัทที่มีโครงสร้างสินทรัพย์ถาวรต่างกันได้ดี'],
      pros_en: ['Allows clean cross-company comparison regardless of depreciation policies'],
      benchmark_th: 'เกณฑ์ปกติ: > 25% แข็งแกร่งมาก | 15–25% สุขภาพดี | < 10% เสี่ยงมีภาระหนี้กดดัน',
      benchmark_en: 'Rule of Thumb: > 25% Very Strong | 15-25% Solid | < 10% Weak',
      watchouts_th: 'EBITDA ไม่ได้สะท้อนเงินสดที่ต้องจ่ายจริงเพื่อซื้อเครื่องจักร/เซิร์ฟเวอร์ทดแทน (CapEx)',
      watchouts_en: 'EBITDA excludes essential capital expenditures needed to maintain ongoing capacity.'
    };
  }

  // 11. Net Margin (%)
  if (key === 'net_margin') {
    const isLoss = numVal !== null && numVal < 0;
    const isThin = numVal !== null && numVal >= 0 && numVal < 5;
    const isElite = numVal !== null && numVal >= 15;

    return {
      key,
      name: 'Net Margin',
      name_th: 'อัตรากำไรสุทธิ (Net Margin %)',
      category: 'profitability',
      status: isLoss || isThin ? 'warning' : isElite ? 'excellent' : 'good',
      status_label_th: isLoss
        ? 'มาร์จิ้นสุทธิติดลบ (Net Loss)'
        : isThin
        ? 'มาร์จิ้นบาง (< 5%) เสี่ยงผันผวน'
        : isElite
        ? 'แข็งแกร่งมาก (High Quality)'
        : 'สุขภาพดีตามเกณฑ์มาตรฐาน',
      status_label_en: isLoss ? 'Negative Net Margin' : isThin ? 'Thin Net Margin' : isElite ? 'Elite Net Margin' : 'Healthy Net Margin',
      what_is_it_th: 'สัดส่วนกำไรสุทธิบรรทัดสุดท้ายที่เหลือเข้าสู่บริษัทอย่างแท้จริง หลังจากหักต้นทุนขาย ค่าใช้จ่ายดำเนินงาน ดอกเบี้ย และภาษีทั้งหมดแล้ว',
      what_is_it_en: 'The percentage of revenue left as net profit after deducting all costs, operating expenses, interest, and taxes.',
      interpretation_th: `ที่ระดับ **${valStr}** ทุกๆ รายได้ 100 ดอลลาร์ บริษัทสามารถเปลี่ยนเป็นกำไรสุทธิเข้ากระเป๋าได้ ${valStr} สะท้อนอำนาจการตั้งราคาและการประหยัดจากขนาด`,
      interpretation_en: `At **${valStr}**, this indicates how much bottom-line profit is retained from every dollar of revenue.`,
      pros_th: [
        'มีเบาะรองรับความผันผวน (Margin of Safety) หากต้นทุนหรือค่าใช้จ่ายสูงขึ้น',
        'สร้างผลตอบแทนส่วนของผู้ถือหุ้นได้อย่างมั่นคง'
      ],
      pros_en: [
        'Provides a margin of safety against economic downturns',
        'Drives high and sustainable return on equity'
      ],
      benchmark_th: 'เกณฑ์ปกติ: > 15% ยอดเยี่ยม | 8–15% ดีตามเกณฑ์มาตรฐาน | < 5% มาร์จิ้นบางเสี่ยงผันผวน',
      benchmark_en: 'Rule of Thumb: > 15% Elite | 8-15% Good | < 5% Thin & Vulnerable',
      watchouts_th: 'ควรตรวจสอบว่ากำไรสุทธิโตจากรายได้หลักที่แท้จริง หรือมีกำไรพิเศษทางบัญชี (Non-operating gain) เข้ามาปน',
      watchouts_en: 'Verify whether profit growth is driven by core operations or one-off non-operating items.'
    };
  }

  // 12. R&D Expense Ratio (%)
  if (key === 'rd_expense_ratio') {
    return {
      key,
      name: 'R&D Expense Ratio',
      name_th: 'สัดส่วนค่าใช้จ่ายวิจัยและพัฒนา (R&D Expense Ratio %)',
      category: 'profitability',
      status: 'good',
      status_label_th: 'ลงทุนนวัตกรรมสม่ำเสมอ (Tech Moat)',
      status_label_en: 'Innovation Reinvestment',
      what_is_it_th: 'สัดส่วนเงินลงทุนที่นำไปใช้ในการคิดค้นนวัตกรรม พัฒนาสิทธิบัตร และเทคโนโลยีใหม่เทียบกับยอดขาย',
      what_is_it_en: 'The proportion of revenue reinvested into developing new products and proprietary technologies.',
      interpretation_th: `ที่ระดับ **${valStr}** แสดงให้เห็นว่าบริษัทจัดสรรรายได้กลับไปลงทุนด้านการวิจัยพัฒนาเพื่อรักษาความเป็นผู้นำทางเทคโนโลยี`,
      interpretation_en: `At **${valStr}**, the company actively reinvests into technological leadership and product differentiation.`,
      pros_th: ['สร้างสิทธิบัตร ฟีเจอร์นวัตกรรม และผลิตภัณฑ์ใหม่ที่คู่แข่งตามทันได้ยาก'],
      pros_en: ['Builds durable intellectual property and next-generation product moats'],
      benchmark_th: 'เกณฑ์ปกติสำหรับหุ้น Tech/AI/Auto: 5–15% ถือว่าเหมาะสมในการสร้างการเติบโตระยะยาว',
      benchmark_en: 'Rule of Thumb: 5-15% is the sweet spot for sustainable technological edge.',
      watchouts_th: 'ต้องติดตามว่าเม็ดเงิน R&D สามารถเปลี่ยนเป็นผลิตภัณฑ์ที่ทำรายได้จริง (Monetization) หรือไม่',
      watchouts_en: 'Ensure R&D outlays translate into commercial products and high return on investment.'
    };
  }

  // 13. Current Ratio & Quick Ratio
  if (key === 'current_ratio' || key === 'quick_ratio') {
    const isQuick = key === 'quick_ratio';
    const isTight = (numVal !== null && numVal < (isQuick ? 0.8 : 1.0));
    const isStrong = (numVal !== null && numVal >= (isQuick ? 1.2 : 1.5));

    return {
      key,
      name: isQuick ? 'Quick Ratio' : 'Current Ratio',
      name_th: isQuick ? 'อัตราส่วนสภาพคล่องหมุนเวียนเร็ว (Quick Ratio)' : 'อัตราส่วนสภาพคล่องหมุนเวียน (Current Ratio)',
      category: 'solvency',
      status: isTight ? 'warning' : isStrong ? 'excellent' : 'good',
      status_label_th: isTight
        ? `สภาพคล่องตึงตัว (< ${isQuick ? '0.8x' : '1.0x'})`
        : isStrong
        ? 'สภาพคล่องสูงและปลอดภัย'
        : 'สภาพคล่องเพียงพอ',
      status_label_en: isTight ? 'Tight Liquidity' : isStrong ? 'Robust Liquidity' : 'Adequate Liquidity',
      what_is_it_th: 'ความสามารถในการชำระหนี้สินระยะสั้นที่จะถึงกำหนดภายใน 1 ปี ด้วยสินทรัพย์หมุนเวียนที่มีสภาพคล่อง',
      what_is_it_en: 'Measures the company’s ability to cover short-term liabilities with short-term liquid assets.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกถึงฐานะสภาพคล่องระยะสั้น ${isTight ? 'ที่ต้องบริหารจัดการเงินสดอย่างใกล้ชิด' : 'ที่มีความปลอดภัยและไม่มีปัญหาเงินตึงตัว'}`,
      interpretation_en: `At **${valStr}**, short-term liquidity profile indicates ${isTight ? 'tight working capital management' : 'ample buffers against liquidity shocks'}.`,
      pros_th: ['ลดความเสี่ยงเรื่องการผิดนัดชำระหนี้ระยะสั้น', 'เพิ่มความยืดหยุ่นทางการเงิน'],
      pros_en: ['Minimizes short-term default risk', 'Ensures financial agility in capital deployment'],
      benchmark_th: isQuick ? 'เกณฑ์ปกติ Quick Ratio: > 1.0x ดีเยี่ยม | 0.8–1.0x ปลอดภัย | < 0.8x ตึงตัว' : 'เกณฑ์ปกติ Current Ratio: > 1.5x ดีมาก | 1.0–1.5x ปลอดภัย | < 1.0x ตึงตัว',
      benchmark_en: isQuick ? 'Quick Ratio: > 1.0x Strong | 0.8-1.0x Adequate | < 0.8x Tight' : 'Current Ratio: > 1.5x Strong | 1.0-1.5x Healthy | < 1.0x Tight',
      watchouts_th: 'บริษัทที่มีวงจรเงินสด (CCC) สั้นหรือติดลบสามารถดำเนินงานที่ระดับ Current Ratio ใกล้ 1.0x ได้อย่างปลอดภัย',
      watchouts_en: 'Firms with negative working capital cycles can safely operate around 1.0x.'
    };
  }

  // 14. Leverage & Debt Ratios
  if (key === 'lt_debt_to_equity' || key === 'debt_to_asset' || key === 'total_assets_to_equity') {
    const isHighDebt = (key === 'lt_debt_to_equity' && numVal !== null && numVal > 2.0)
      || (key === 'debt_to_asset' && numVal !== null && numVal > 60);

    return {
      key,
      name: 'Debt & Leverage Ratio',
      name_th: 'อัตราส่วนหนี้สินและภาระผูกพัน (Debt & Leverage)',
      category: 'solvency',
      status: isHighDebt ? 'warning' : 'good',
      status_label_th: isHighDebt ? 'ภาระหนี้สินค่อนข้างสูง (High Leverage)' : 'งบดุลแข็งแกร่ง (Fortress Balance Sheet)',
      status_label_en: isHighDebt ? 'Elevated Debt Leverage' : 'Conservative Balance Sheet',
      what_is_it_th: 'สัดส่วนภาระหนี้สินที่มีดอกเบี้ยเมื่อเทียบกับส่วนของผู้ถือหุ้นและสินทรัพย์รวม',
      what_is_it_en: 'Financial leverage metrics assessing debt burden relative to shareholder equity and total assets.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่าโครงสร้างเงินทุนของบริษัท ${isHighDebt ? 'มีภาระหนี้สินที่ต้องติดตามการชำระดอกเบี้ย' : 'มีความปลอดภัยสูง ดอกเบี้ยจ่ายไม่เป็นภาระกดดันผลประกอบการ'}`,
      interpretation_en: `At **${valStr}**, leverage metrics indicate a ${isHighDebt ? 'higher reliance on debt financing' : 'conservative balance sheet with manageable interest expenses'}.`,
      pros_th: ['ความเสี่ยงการล้มละลายต่ำ', 'ต้นทุนการกู้ยืมต่ำหากต้องการระดมทุนขยายโครงการใหม่'],
      pros_en: ['Low bankruptcy risk', 'Low cost of debt financing for future growth'],
      benchmark_th: 'เกณฑ์ปกติ: D/E < 1.0x ปลอดภัยมาก | 1.0–2.0x ปานกลาง | > 2.0x หนี้สินสูง',
      benchmark_en: 'Rule of Thumb: D/E < 1.0x Conservative | 1.0-2.0x Moderate | > 2.0x High Risk',
      watchouts_th: 'ติดตามตารางการครบกำหนดชำระหนี้ (Debt Maturity Profile) ในระยะ 1-2 ปีข้างหน้า',
      watchouts_en: 'Check near-term debt maturities and refinancing schedules.'
    };
  }

  // 15. Cash Conversion Cycle (CCC)
  if (key === 'ccc') {
    const isNegativeCCC = numVal !== null && numVal < 0;
    const isLongCCC = numVal !== null && numVal > 90;

    return {
      key,
      name: 'Cash Conversion Cycle (CCC)',
      name_th: 'วงจรเงินสด (Cash Conversion Cycle - CCC)',
      category: 'operating',
      status: isNegativeCCC ? 'excellent' : isLongCCC ? 'warning' : 'good',
      status_label_th: isNegativeCCC
        ? 'ยอดเยี่ยมระดับโลก (Negative Working Capital)'
        : isLongCCC
        ? 'วงจรเงินสดยาวนาน (> 90 วัน)'
        : 'วงจรเงินสดสุขภาพดี',
      status_label_en: isNegativeCCC ? 'Elite Negative CCC' : isLongCCC ? 'Tied-up Working Capital' : 'Healthy Working Capital',
      what_is_it_th: 'ระยะเวลาเฉลี่ย (จำนวนวัน) ตั้งแต่บริษัทจ่ายเงินสดซื้อสินค้า/วัตถุดิบ จนกระทั่งได้รับเงินสดคืนจากการขายสินค้าให้ลูกค้า',
      what_is_it_en: 'Days required to convert operational resource inputs into cash inflows from sales.',
      interpretation_th: isNegativeCCC
        ? `ที่ระดับ **${valStr}** CCC ติดลบหมายถึงบริษัทได้รับเงินสดจากลูกค้าก่อนที่จะต้องจ่ายเงินให้เจ้าหนี้การค้า สามารถนำเงินสดหมุนเวียนมาใช้ขยายธุรกิจได้ฟรีโดยไม่ต้องกู้เงิน`
        : `ที่ระดับ **${valStr}** สะท้อนระยะเวลาที่เงินสดถูกหมุนเวียนในสต็อกสินค้าและลูกหนี้การค้า`,
      interpretation_en: `At **${valStr}**, this metric reflects the efficiency of cash collection cycles across the operating chain.`,
      pros_th: [
        'ธุรกิจสร้างเงินสดหมุนเวียนได้เอง ไม่ต้องสำรองเงินทุนก้อนใหญ่',
        'อำนาจต่อรองเหนือ Supplier และลูกค้าสูง'
      ],
      pros_en: [
        'Self-funding operational model requiring minimal external short-term borrowing',
        'High commercial bargaining power across supply chain'
      ],
      benchmark_th: 'เกณฑ์ปกติ: < 0 วัน = ยอดเยี่ยมที่สุด | 0–30 วัน = ดีมาก | > 90 วัน = เงินจมในสต็อกและลูกหนี้',
      benchmark_en: 'Rule of Thumb: < 0 Days = World Class | 0-30 Days = Healthy | > 90 Days = Tied Up Cash',
      watchouts_th: 'ควรดูแลความสัมพันธ์กับคู่ค้า ไม่ควรยืดหนี้จนส่งผลกระทบต่อความมั่นคงของห่วงโซ่อุปทาน',
      watchouts_en: 'Maintain vendor relations so extended payment terms do not jeopardize supply stability.'
    };
  }

  // 16. Returns on Capital: ROE / ROIC / ROA
  if (key === 'roe' || key === 'roic' || key === 'roa') {
    const isRoic = key === 'roic';
    const isLoss = numVal !== null && numVal < 0;
    const isSubWacc = numVal !== null && numVal >= 0 && numVal < 8;
    const isElite = numVal !== null && numVal >= 20;

    return {
      key,
      name: isRoic ? 'ROIC' : key.toUpperCase(),
      name_th: isRoic ? 'ผลตอบแทนจากเงินลงทุนรวม (ROIC %)' : key === 'roe' ? 'ผลตอบแทนต่อส่วนของผู้ถือหุ้น (ROE %)' : 'ผลตอบแทนต่อสินทรัพย์รวม (ROA %)',
      category: 'operating',
      status: isLoss ? 'warning' : isSubWacc ? 'neutral' : isElite ? 'excellent' : 'good',
      status_label_th: isLoss
        ? 'ผลตอบแทนติดลบ (Loss on Capital)'
        : isSubWacc
        ? 'ต่ำกว่าต้นทุนเงินทุน (Sub-WACC)'
        : isElite
        ? 'ยอดเยี่ยม (Super Compounder)'
        : 'ผลตอบแทนสุขภาพดี',
      status_label_en: isLoss ? 'Negative Return' : isSubWacc ? 'Sub-WACC Return' : isElite ? 'Elite Compounder' : 'Solid Capital Return',
      what_is_it_th: isRoic
        ? 'ผลตอบแทนสุทธิที่บริษัทสร้างได้จริงจากเงินลงทุนทั้งหมด (ทั้งส่วนของผู้ถือหุ้นและหนี้สินกู้ยืม)'
        : 'ผลตอบแทนกำไรสุทธิเทียบกับฐานเงินทุนของผู้ถือหุ้นหรือสินทรัพย์รวม',
      what_is_it_en: 'Measures how efficiently the company allocates invested capital to generate economic profits.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกประสิทธิภาพของผู้บริหารในการนำเงินทุนไปสร้างผลกำไร ${isElite ? 'สร้างผลตอบแทนสูงกว่าต้นทุนเงินทุน (WACC) อย่างมีนัยสำคัญ' : ''}`,
      interpretation_en: `At **${valStr}**, this metric reflects management's capital allocation efficiency relative to invested equity.`,
      pros_th: [
        'เป็นเกณฑ์สำคัญในการประเมินความสามารถในการแข่งขัน (Economic Moat) ของบริษัท',
        'การลงทุนซ้ำ (Reinvestment) ในธุรกิจเดิมสร้างกำไรใหม่ในอัตราที่สูง'
      ],
      pros_en: [
        'Litmus test of durable competitive advantages and economic moat',
        'Reinvested retained earnings compound at superior rates of return'
      ],
      benchmark_th: 'เกณฑ์ปกติ: ROIC/ROE > 15-20% = คุณภาพยอดเยี่ยม | 10–15% = สุขภาพดี | < 8% = อาจต่ำกว่า WACC',
      benchmark_en: 'Rule of Thumb: > 15-20% Elite | 10-15% Good | < 8% Risk of value destruction below WACC',
      watchouts_th: 'สำหรับ ROE ควรระวังว่าสูงขึ้นเพราะกำไรโต หรือสูงขึ้นเพราะบริษัทกู้หนี้มาเพิ่ม (Financial Leverage)',
      watchouts_en: 'Verify that elevated ROE stems from operating profitability rather than excessive debt leverage.'
    };
  }

  // 17. Free Cash Flow (Currency)
  if (key === 'free_cash_flow') {
    if (isNegative) {
      return {
        key,
        name: 'Free Cash Flow',
        name_th: 'กระแสเงินสดอิสระ (Free Cash Flow - FCF)',
        category: 'cashflow',
        status: 'warning',
        status_label_th: 'กระแสเงินสดอิสระติดลบ (Cash Burn)',
        status_label_en: 'Negative FCF / Cash Burn',
        what_is_it_th: 'กระแสเงินสดจากการดำเนินงานที่เหลืออยู่หลังจากหักเงินลงทุนในสินทรัพย์ถาวร (CapEx) แล้ว',
        what_is_it_en: 'Operating cash flow remaining after capital expenditures (CapEx).',
        interpretation_th: `กระแสเงินสดอิสระติดลบอยู่ที่ **${valStr}** แสดงว่าเงินสดที่ได้จากการขายสินค้ายังไม่ครอบคลุมเม็ดเงินที่ต้องลงทุนซื้อเครื่องจักร/โรงงาน/เซิร์ฟเวอร์ (CapEx) บริษัทต้องดึงเงินสดสำรองหรือพึ่งพาการระดมทุน`,
        interpretation_en: `Free cash flow is negative at **${valStr}**, indicating that operating cash flow was insufficient to fund capital expenditure requirements.`,
        pros_th: ['หากเกิดจากการเร่งสร้างโรงงานหรือศูนย์ข้อมูล AI เพื่อรองรับการเติบโตในอนาคต อาจสร้างกระแสเงินสดก้อนใหญ่ตามมา'],
        pros_en: ['Aggressive strategic CapEx cycles can expand long-term production runway'],
        benchmark_th: 'เกณฑ์ปกติ: บริษัทที่ผ่านช่วงขยายตัวควรมี FCF เป็นบวกและเติบโตสม่ำเสมอ',
        benchmark_en: 'Rule of Thumb: Mature enterprises should consistently generate positive, growing free cash flow.',
        watchouts_th: 'จับตาระดับเงินสดสำรองคงเหลือ (Cash Runway) และผลตอบแทนจากการลงทุน CapEx',
        watchouts_en: 'Monitor cash burn runway and ROI on heavy capital projects.'
      };
    }

    return {
      key,
      name: 'Free Cash Flow',
      name_th: 'กระแสเงินสดอิสระ (Free Cash Flow - FCF)',
      category: 'cashflow',
      status: isSevereDrop ? 'neutral' : isHighGrowth ? 'excellent' : 'good',
      status_label_th: isSevereDrop
        ? `FCF ชะลอตัว (${yoyText})`
        : isHighGrowth
        ? `FCF เติบโตสูง (${yoyText})`
        : yoyText ? `กระแสเงินสดอิสระเป็นบวก (${yoyText})` : 'ผลิตเงินสดอิสระสม่ำเสมอ',
      status_label_en: isHighGrowth ? 'Strong FCF Generation' : 'Positive Free Cash Flow',
      what_is_it_th: 'กระแสเงินสดจากการดำเนินงานที่เหลืออยู่จริงหลังจากหักค่าใช้จ่ายลงทุน CapEx แล้ว พร้อมนำไปจ่ายปันผล ซื้อหุ้นคืน หรือชำระหนี้',
      what_is_it_en: 'Cash generated by core business operations minus capital expenditures (CapEx).',
      interpretation_th: `กระแสเงินสดอิสระอยู่ที่ **${valStr}** ${yoyText ? `(${yoyText})` : ''} บ่งบอกถึงความสามารถในการสร้างเงินสดแท้จริงที่ไม่ถูกผูกมัด`,
      interpretation_en: `Free cash flow stands at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, confirming organic cash generation surplus.`,
      pros_th: [
        'มีอิสระในการจัดสรรเงินทุนเพื่อซื้อหุ้นคืน จ่ายปันผล หรือเข้าซื้อกิจการ',
        'สะท้อนคุณภาพกำไรที่เป็นเงินสดแท้จริง ไม่ใช่แค่กำไรทางบัญชี'
      ],
      pros_en: [
        'Financial flexibility for accretive share buybacks and dividend growth',
        'Confirms high-quality cash-backed earnings'
      ],
      benchmark_th: 'เกณฑ์ปกติ: FCF ควรเป็นบวกและเติบโตสอดคล้องกับกำไรสุทธิ',
      benchmark_en: 'Rule of Thumb: Free cash flow should consistently track net income.',
      watchouts_th: 'ติดตามความผันผวนของรอบการลงทุน CapEx ในแต่ละปี',
      watchouts_en: 'Watch for cyclical CapEx surges temporarily compressing FCF.'
    };
  }

  // 18. FCF Conversion Ratios (%)
  if (key === 'fcf_to_sales' || key === 'fcf_to_net_income') {
    return {
      key,
      name: 'FCF Conversion Ratio',
      name_th: 'คุณภาพกำไรและอัตราแปลงเงินสด (FCF Conversion %)',
      category: 'cashflow',
      status: (numVal !== null && numVal < 50) ? 'neutral' : 'excellent',
      status_label_th: (numVal !== null && numVal >= 80) ? 'คุณภาพกำไรเงินสดเกรด A+' : 'คุณภาพกำไรระดับมาตรฐาน',
      status_label_en: 'Cash Conversion Quality',
      what_is_it_th: 'สัดส่วนกระแสเงินสดอิสระที่สร้างได้จริงเทียบกับยอดขายหรือกำไรสุทธิทางบัญชี',
      what_is_it_en: 'Conversion efficiency of accounting revenue or net profit into actual free cash flow.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่ากำไรที่รายงานในงบการเงินสามารถเปลี่ยนเป็นกระแสเงินสดอิสระได้อย่างมีประสิทธิภาพ`,
      interpretation_en: `At **${valStr}**, net earnings convert cleanly into tangible cash flow buffers.`,
      pros_th: ['ยืนยันว่าไม่มีปัญหาสินค้าค้างสต็อกหรือหนี้สูญจากการขายเชื่อ'],
      pros_en: ['Confirms absence of excessive inventory accumulation or bad debt write-offs'],
      benchmark_th: 'เกณฑ์ปกติ: FCF/Net Income > 80% = คุณภาพดีเยี่ยม | < 50% = กำไรอาจยังไม่เป็นเงินสด',
      benchmark_en: 'Rule of Thumb: FCF/Net Income > 80% Excellent | < 50% Paper profits alert',
      watchouts_th: 'ตรวจสอบรอบการลงทุนศูนย์ข้อมูลหรือเครื่องจักรขนาดใหญ่ที่อาจกดดันตัวเลขอัตราส่วน',
      watchouts_en: 'Heavy CapEx reinvestment cycles may temporarily lower conversion ratios.'
    };
  }

  // 19. Operating Cash Flow (OCF - Currency)
  if (key === 'ocf' || key === 'operating_cash_flow') {
    return {
      key,
      name: 'Operating Cash Flow',
      name_th: 'กระแสเงินสดจากการดำเนินงาน (Operating Cash Flow - OCF)',
      category: 'cashflow',
      status: isNegative ? 'warning' : isSevereDrop ? 'neutral' : 'excellent',
      status_label_th: isNegative
        ? 'เงินสดจากการดำเนินงานติดลบ (OCF Burn)'
        : isSevereDrop
        ? `OCF ชะลอตัว (${yoyText})`
        : yoyText ? `กระแสเงินสดแข็งแกร่ง (${yoyText})` : 'ผลิตกระแสเงินสดสม่ำเสมอ',
      status_label_en: isNegative ? 'Operating Cash Burn' : 'Strong Cash Generation',
      what_is_it_th: 'เงินสดสุทธิที่เกิดจากกิจกรรมการค้าและบริการหลักอย่างแท้จริง ไม่รวมการกู้ยืมหรือการซื้อขายสินทรัพย์',
      what_is_it_en: 'Net cash generated from regular business operating activities.',
      interpretation_th: `กระแสเงินสดจากการดำเนินงานอยู่ที่ **${valStr}** ${yoyText ? `(${yoyText})` : ''} สะท้อนสภาพคล่องเงินสดหมุนเวียนที่เกิดจากธุรกิจหลัก`,
      interpretation_en: `Operating cash flow stands at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, reflecting internal cash flow generation.`,
      pros_th: ['หล่อเลี้ยงการดำเนินธุรกิจได้ด้วยตนเองโดยไม่ต้องพึ่งพาเงินกู้ภายนอก'],
      pros_en: ['Provides internal funding independence without relying on external debt'],
      benchmark_th: 'เกณฑ์ปกติ: OCF ควรเป็นบวกและมากกว่ากำไรสุทธิทางบัญชี',
      benchmark_en: 'Rule of Thumb: OCF should consistently remain positive and exceed net income.',
      watchouts_th: 'ตรวจเช็คการเปลี่ยนแปลงในเงินทุนหมุนเวียน (Working Capital) ว่ามีเงินจมในลูกหนี้หรือสต็อกหรือไม่',
      watchouts_en: 'Monitor working capital swings for inventory pileups or collection delays.'
    };
  }

  // 20. Net Cash Flow from Continuing Investing Activities (ICF)
  if (key === 'icf') {
    const isHeavyOutflow = (numVal !== null && Math.abs(numVal) >= 3000) || (latestYoY !== null && latestYoY <= -15);
    return {
      key,
      name: 'Net Cash Flow from Continuing Investing Activities',
      name_th: 'กระแสเงินสดสุทธิจากกิจกรรมลงทุน (Investing Cash Flow - ICF)',
      category: 'cashflow',
      status: isHeavyOutflow ? 'warning' : 'good',
      status_label_th: isHeavyOutflow
        ? `เงินสดไหลออกลงทุนหนัก (${yoyText || 'ระดับสูง'}) — กดดัน FCF`
        : 'เม็ดเงินลงทุนอยู่ในกรอบสมดุล',
      status_label_en: isHeavyOutflow ? 'Heavy Investing Outflow (FCF Pressure)' : 'Balanced Capital Reinvestment',
      what_is_it_th: 'กระแสเงินสดสุทธิที่ใช้ไปในกิจกรรมการลงทุนทั้งหมด ทั้งการซื้อสินทรัพย์ถาวร (CapEx) การซื้อกิจการ และการลงทุนในหลักทรัพย์',
      what_is_it_en: 'Net cash outflow deployed into capital assets (CapEx), business acquisitions, and investment securities.',
      interpretation_th: `กระแสเงินสดสุทธิจากกิจกรรมลงทุน (ICF) อยู่ที่ **${valStr}** ${yoyText ? `(${yoyText})` : ''} สะท้อนเม็ดเงินลงทุนก้อนใหญ่ที่ไหลออกจากบริษัท โดยส่วนใหญ่เป็นรายจ่ายฝ่ายทุน (CapEx) เพื่อสร้างโรงงานและโครงสร้างพื้นฐาน ซึ่งการที่เม็ดเงินไหลออกในกิจกรรมลงทุนสูงกว่ากระแสเงินสดจากการดำเนินงาน ได้ส่งผลกดดันให้กระแสเงินสดอิสระ (FCF) ในไตรมาสล่าสุดชะลอตัวลงหรือพลิกเป็นลบ`,
      interpretation_en: `Net cash used in investing activities stands at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, driven heavily by capital expenditures (CapEx) that outpaced operational cash flow, putting pressure on Free Cash Flow.`,
      pros_th: [
        'สะท้อนการขยายโครงสร้างพื้นฐานและสินทรัพย์การผลิตเพื่อสร้างความได้เปรียบเชิงแข่งขันระยะยาว',
        'บริษัทมีฐานกำลังการผลิตและเทคโนโลยีที่ใหญ่ขึ้นเพื่อรองรับผลิตภัณฑ์รุ่นถัดไป'
      ],
      pros_en: [
        'Aggressive capital deployment expands long-term manufacturing and technology capacity',
        'Enhances physical and computational asset foundation for next-generation products'
      ],
      benchmark_th: 'เกณฑ์ปกติ: เงินสดกิจกรรมลงทุนควรสมดุลกับกระแสเงินสดจากการดำเนินงาน (OCF) เพื่อรักษา FCF ให้เป็นบวก',
      benchmark_en: 'Rule of Thumb: Investing cash outflow should generally not consistently exceed OCF unless backed by large cash reserves.',
      watchouts_th: 'กระแสเงินสดกิจกรรมลงทุนที่ไหลออกสูงกว่าเงินสดดำเนินงาน (OCF) จะส่งผลให้เกิดสภาวะ Cash Burn และทำให้กระแสเงินสดอิสระ (FCF) ติดลบ',
      watchouts_en: 'Investing outflows exceeding operating cash generation will trigger cash burn and drain liquid reserves.'
    };
  }

  // 20.1 Capital Expenditures (CapEx)
  if (key === 'capex') {
    const isSevereCapEx = (numVal !== null && Math.abs(numVal) >= 3000) || (latestYoY !== null && latestYoY <= -25);
    return {
      key,
      name: 'Capital Expenditures (CapEx)',
      name_th: 'รายจ่ายฝ่ายทุน ซื้อ/ขายสินทรัพย์ถาวร (CapEx)',
      category: 'cashflow',
      status: isSevereCapEx ? 'warning' : 'good',
      status_label_th: isSevereCapEx
        ? `CapEx เร่งตัวขึ้นมาก (${yoyText || 'เม็ดเงินไหลออกสูง'}) — ฉุด FCF ติดลบ`
        : 'งบลงทุน CapEx อยู่ในกรอบที่เหมาะสม',
      status_label_en: isSevereCapEx ? 'CapEx Surge Drives FCF Negative' : 'Disciplined CapEx Outlay',
      what_is_it_th: 'เม็ดเงินสดที่บริษัทจ่ายจริงเพื่อจัดซื้อ ก่อสร้าง หรือปรับปรุงสินทรัพย์ถาวร เช่น เครื่องจักร อาคารโรงงาน และซูเปอร์คอมพิวเตอร์ AI',
      what_is_it_en: 'Cash deployed to purchase, construct, or upgrade physical capital assets, production plants, and computational infrastructure.',
      interpretation_th: `รายจ่ายฝ่ายทุน (CapEx) พุ่งสูงขึ้นแตะ **${valStr}** ${yoyText ? `(${yoyText})` : ''} สะท้อนการเร่งตัดงบลงทุนสร้างโครงสร้างพื้นฐานขนาดใหญ่ (เช่น AI Data Center / ซูเปอร์คอมพิวเตอร์ / โรงงาน) แต่เม็ดเงินลงทุนที่เพิ่มขึ้นอย่างก้าวกระโดดนี้ ได้กลบกระแสเงินสดจากการดำเนินงาน (OCF) จนส่งผลให้กระแสเงินสดอิสระ (FCF) พลิกกลับมาติดลบในไตรมาสล่าสุด`,
      interpretation_en: `Capital expenditures surged to **${valStr}** ${yoyText ? `(${yoyText})` : ''}, highlighting heavy investments into AI clusters and factory tooling. This massive outflow outstripped operational cash flows, forcing Free Cash Flow into negative territory.`,
      pros_th: [
        'การทุ่มงบลงทุนเชิงรุกช่วยสร้าง Moat ทางเทคโนโลยีและกำลังการผลิตที่คู่แข่งตามทันได้ยาก',
        'ขยายขีดความสามารถการประมวลผลและการผลิตเพื่อรองรับการเติบโตรอบใหม่'
      ],
      pros_en: [
        'Aggressive capital reinvestment solidifies technology and compute moats',
        'Expands capacity runway to support multi-year commercial scaling'
      ],
      benchmark_th: 'เกณฑ์ปกติ: CapEx/Revenue อยู่ในเกณฑ์ 5-15% หากพุ่งเกิน 20% มักเป็นรอบลงทุนขนาดใหญ่ (Megaproject)',
      benchmark_en: 'Rule of Thumb: CapEx intensity typically ranges between 5-15% of revenue; exceeding 20% signals an intensive megaproject cycle.',
      watchouts_th: 'CapEx ที่เร่งตัวเกินกว่าเงินสดจากการดำเนินงานทำให้เกิดสภาวะ Cash Burn และเพิ่มภาระค่าเสื่อมราคา (D&A) ทางบัญชีกดดันกำไรสุทธิในอนาคต',
      watchouts_en: 'CapEx exceeding operating cash flow causes cash burn and inflates future non-cash depreciation drag on net income.'
    };
  }

  // 20.2 Investment Purchase & Sale
  if (key === 'investment_purchase') {
    return {
      key,
      name: 'Net Investment Purchase and Sale',
      name_th: 'เงินสดสุทธิซื้อ/ขายเงินลงทุน (Investment Purchase & Sale)',
      category: 'cashflow',
      status: 'good',
      status_label_th: 'การบริหารพอร์ตสภาพคล่อง',
      status_label_en: 'Liquidity Portfolio Management',
      what_is_it_th: 'กระแสเงินสดจากการซื้อหรือขายเงินลงทุน พันธบัตรระยะสั้น และตราสารทางการเงินเพื่อบริหารผลตอบแทนจากเงินสดส่วนเกิน',
      what_is_it_en: 'Net cash flows from purchasing or liquidating short-term marketable securities and yield-bearing financial instruments.',
      interpretation_th: `เงินสดสุทธิในรายการนี้อยู่ที่ **${valStr}** สะท้อนการจัดสรรเงินสดสำรองไปพักไว้ในตราสารหนี้หรือไถ่ถอนกลับมาใช้หมุนเวียนธุรกิจ`,
      interpretation_en: `Net investment purchase/sale stands at **${valStr}**, representing active treasury management of liquid yield-bearing reserves.`,
      pros_th: ['ช่วยสร้างผลตอบแทนดอกเบี้ยจากเงินสดสำรองของบริษัท', 'มีสภาพคล่องสูงพร้อมแปลงกลับเป็นเงินสดได้รวดเร็ว'],
      pros_en: ['Generates interest income on idle cash buffers', 'High liquidity profile for rapid deployment'],
      benchmark_th: 'เกณฑ์ปกติ: เปลี่ยนแปลงตามนโยบายการบริหารเงินสดคงคลัง (Treasury Management)',
      benchmark_en: 'Rule of Thumb: Reflects corporate treasury policy and yield optimization.',
      watchouts_th: 'ตรวจเช็คอันดับความน่าเชื่อถือของตราสารที่บริษัทนำเงินสดไปลงทุน',
      watchouts_en: 'Ensure corporate cash is parked in high-grade, low-duration instruments.'
    };
  }

  // 21. Financing Cash Flow
  if (key === 'fcf_financing') {
    const isOutflow = numVal !== null && numVal < 0;
    return {
      key,
      name: 'Financing Cash Flow',
      name_th: 'กระแสเงินสดจากกิจกรรมจัดหาเงิน (Financing Cash Flow)',
      category: 'cashflow',
      status: isOutflow ? 'good' : 'neutral',
      status_label_th: isOutflow ? 'ชำระคืนหนี้ / คืนทุนผู้ถือหุ้น' : 'มีการจัดหาเงินทุนเพิ่มเติม',
      status_label_en: isOutflow ? 'Capital Return / Debt Service' : 'Capital Inflow / Financing',
      what_is_it_th: 'กระแสเงินสดที่เกี่ยวข้องกับการกู้ยืม ชำระหนี้สิน การเพิ่มทุน การซื้อหุ้นคืน และการจ่ายเงินปันผล',
      what_is_it_en: 'Cash flow from equity capital raising, share repurchases, debt issuance/repayments, and dividends.',
      interpretation_th: `กระแสเงินสดกิจกรรมจัดหาเงินอยู่ที่ **${valStr}** ${isOutflow ? 'สะท้อนการจ่ายคืนหนี้สินหรือการคืนทุนให้แก่ผู้ถือหุ้น' : 'สะท้อนการระดมทุนผ่านการออกตราสารหนี้หรือหุ้นเพิ่มทุน'}`,
      interpretation_en: `Financing cash flow stands at **${valStr}**, reflecting debt service, equity changes, or shareholder distributions.`,
      pros_th: ['การลดภาระหนี้ช่วยลดค่าใช้จ่ายดอกเบี้ยและเสริมความแข็งแกร่งของงบดุล'],
      pros_en: ['Prudent debt paydowns decrease ongoing interest expense and strengthen balance sheet'],
      benchmark_th: 'เกณฑ์ปกติ: บริษัทที่มีกำไรอิ่มตัวมักมี Financing Cash Flow ติดลบจากการคืนเงินแก่ผู้ถือหุ้น',
      benchmark_en: 'Rule of Thumb: Mature enterprises typically show negative financing cash flow from returning capital.',
      watchouts_th: 'หากมีเม็ดเงินไหลเข้าจากการกู้ยืมจำนวนมาก ควรตรวจสอบภาระดอกเบี้ยจ่ายและเงื่อนไขทางการเงิน (Covenants)',
      watchouts_en: 'Monitor debt covenants and interest servicing costs if financing inflows spike.'
    };
  }

  // 21.1 Stock Issuance & Buybacks
  if (key === 'stock_issuance_repurchase') {
    const isBuyback = numVal !== null && numVal < 0;
    return {
      key,
      name: 'Net Common Stock Issuance (Buybacks)',
      name_th: 'การออกหุ้น / ซื้อหุ้นคืน (Stock Issuance & Buybacks)',
      category: 'cashflow',
      status: isBuyback ? 'excellent' : 'warning',
      status_label_th: isBuyback ? 'ซื้อหุ้นคืนต่อเนื่อง (Share Buybacks)' : 'ออกหุ้นเพิ่มทุน (Potential Dilution)',
      status_label_en: isBuyback ? 'Accretive Share Buybacks' : 'Share Issuance Dilution',
      what_is_it_th: 'เม็ดเงินสดสุทธิที่บริษัทใช้ไปในการซื้อหุ้นของตนเองคืนจากตลาด หรือได้รับจากการออกหุ้นเพิ่มทุน',
      what_is_it_en: 'Net cash spent repurchasing company shares or received from issuing new equity capital.',
      interpretation_th: isBuyback
        ? `บริษัทใช้เงินสด **${valStr}** ในการซื้อหุ้นคืน ช่วยลดจำนวนหุ้นหมุนเวียนในตลาดและเร่งการเติบโตของกำไรต่อหุ้น (EPS)`
        : `บริษัทมีเงินสดรับ **${valStr}** จากการออกหุ้นเพิ่มทุน ซึ่งอาจส่งผลให้เกิดการเจือจางของกำไรต่อหุ้น (Dilution Effect)`,
      interpretation_en: `Net stock transaction stands at **${valStr}**, ${isBuyback ? 'reducing total share count to boost per-share value' : 'issuing new shares which may dilute existing shareholders'}.`,
      pros_th: [isBuyback ? 'เพิ่มกำไรต่อหุ้น (EPS) และมูลค่าที่แท้จริงของผู้ถือหุ้นเดิม' : 'เพิ่มฐานเงินทุนโดยไม่ต้องมีภาระหนี้และดอกเบี้ย'],
      pros_en: [isBuyback ? 'Compounds intrinsic EPS and return on equity' : 'Strengthens equity cushion without leverage'],
      benchmark_th: 'เกณฑ์ปกติ: ควรซื้อหุ้นคืนเมื่อราคาหุ้นต่ำกว่ามูลค่าที่แท้จริง (Undervalued)',
      benchmark_en: 'Rule of Thumb: Share buybacks create maximum value when executed below intrinsic value.',
      watchouts_th: 'ไม่ควรซื้อหุ้นคืนด้วยเงินกู้ยืมในอัตราดอกเบี้ยสูง ควรใช้กระแสเงินสดอิสระ (FCF) แท้จริง',
      watchouts_en: 'Ensure buybacks are funded via organic free cash flow rather than expensive debt.'
    };
  }

  // 21.2 Dividends Paid
  if (key === 'dividends_paid') {
    return {
      key,
      name: 'Cash Dividends Paid',
      name_th: 'เงินปันผลจ่าย (Cash Dividends Paid)',
      category: 'cashflow',
      status: 'good',
      status_label_th: 'จ่ายเงินปันผลตอบแทนผู้ถือหุ้น',
      status_label_en: 'Shareholder Dividend Payout',
      what_is_it_th: 'เงินสดที่บริษัทจ่ายตอบแทนให้แก่ผู้ถือหุ้นจากกำไรสะสม',
      what_is_it_en: 'Cash distributions paid directly to shareholders out of accumulated profits.',
      interpretation_th: `เงินปันผลจ่ายอยู่ที่ **${valStr}** สะท้อนนโยบายการจ่ายเงินปันผลเพื่อสร้างผลตอบแทนสม่ำเสมอให้แก่ผู้ถือหุ้น`,
      interpretation_en: `Cash dividends paid stand at **${valStr}**, providing direct income yield to equity investors.`,
      pros_th: ['สร้างกระแสเงินสดรับสม่ำเสมอให้แก่นักลงทุน', 'สะท้อนเสถียรภาพทางการเงินของกิจการ'],
      pros_en: ['Delivers tangible cash income yield to shareholders', 'Signals management confidence in earnings visibility'],
      benchmark_th: 'เกณฑ์ปกติ: Dividend Payout Ratio ควรอยู่ในระดับ 30-60% ของกำไรสุทธิ',
      benchmark_en: 'Rule of Thumb: Payout ratio of 30-60% provides balanced reinvestment and income yield.',
      watchouts_th: 'ตรวจสอบว่าเงินปันผลจ่ายมาจากกระแสเงินสดอิสระแท้จริง ไม่ใช่การกู้เงินมาจ่าย',
      watchouts_en: 'Ensure dividends are covered by organic free cash flow.'
    };
  }

  // 21.3 Ending Cash Balance
  if (key === 'ending_cash') {
    return {
      key,
      name: 'Ending Cash Balance',
      name_th: 'เงินสดและรายการเทียบเท่าปลายงวด (Ending Cash Balance)',
      category: 'cashflow',
      status: 'excellent',
      status_label_th: 'เงินสดสำรองสภาพคล่องสูง',
      status_label_en: 'Robust Cash Reserves',
      what_is_it_th: 'เงินสดและรายการเทียบเท่าเงินสดคงเหลือสุทธิ ณ วันสิ้นสุดรอบระยะเวลาบัญชี',
      what_is_it_en: 'Net liquid cash and cash equivalents remaining on balance sheet at period end.',
      interpretation_th: `เงินสดคงเหลือปลายงวดอยู่ที่ **${valStr}** เป็นกันชนสภาพคล่องที่สำคัญในการรองรับความไม่แน่นอนและสนับสนุนแผนการลงทุน`,
      interpretation_en: `Ending cash balance stands at **${valStr}**, providing essential liquidity cushioning and capital firepower.`,
      pros_th: ['มีความพร้อมรับมือวิกฤตเศรษฐกิจโดยไม่ต้องพึ่งพาเงินกู้ฉุกเฉิน', 'สนับสนุนงบลงทุน CapEx ขนาดใหญ่'],
      pros_en: ['Insulates operations from economic credit contractions', 'Provides internal dry powder for strategic growth'],
      benchmark_th: 'เกณฑ์ปกติ: ควรมีเงินสดครอบคลุมค่าใช้จ่ายดำเนินงานอย่างน้อย 6-12 เดือน',
      benchmark_en: 'Rule of Thumb: Maintain 6-12 months of operational overhead in liquid reserves.',
      watchouts_th: 'ตรวจเช็คว่าเงินสดคงเหลือมีแนวโน้มลดลงต่อเนื่องจากการเกิด Cash Burn หรือไม่',
      watchouts_en: 'Monitor whether cash reserves are trending downward due to ongoing operational burn.'
    };
  }

  // ==========================================
  // SECTION C: BALANCE SHEET ITEMS
  // ==========================================

  // 22. Total Assets
  if (key === 'total_assets') {
    return {
      key,
      name: 'Total Assets',
      name_th: 'สินทรัพย์รวม (Total Assets)',
      category: 'balance',
      status: 'good',
      status_label_th: 'ฐานะสินทรัพย์มั่นคง',
      status_label_en: 'Solid Asset Base',
      what_is_it_th: 'มูลค่ารวมของทรัพยากรทั้งหมดที่บริษัทถือครอง ทั้งสินทรัพย์หมุนเวียนและสินทรัพย์ถาวร',
      what_is_it_en: 'Total economic resources owned and controlled by the enterprise.',
      interpretation_th: `สินทรัพย์รวมอยู่ที่ **${valStr}** ${yoyText ? `(${yoyText})` : ''} สะท้อนขนาดฐานทรัพยากรที่ใช้ในการดำเนินธุรกิจ`,
      interpretation_en: `Total assets stand at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, providing foundational capacity for operations.`,
      pros_th: ['สร้างความน่าเชื่อถือสูงต่อคู่ค้าและสถาบันการเงิน'],
      pros_en: ['Enhances institutional credibility and borrowing capacity'],
      benchmark_th: 'เกณฑ์ปกติ: ควรขยายตัวสอดคล้องกับยอดขายและผลตอบแทน ROA',
      benchmark_en: 'Rule of Thumb: Asset growth should track revenue expansion and sustain sound ROA.',
      watchouts_th: 'ระวังสินทรัพย์ที่ไม่มีผลตอบแทนหรือค่าความนิยม (Goodwill) ที่มากเกินไป',
      watchouts_en: 'Watch for unproductive or impaired assets diluting asset turnover.'
    };
  }

  // 23. Cash & Liquid Investments
  if (key === 'current_assets' || key === 'cash_and_investments' || key === 'cash' || key === 'short_term_investments') {
    return {
      key,
      name: 'Cash & Liquid Assets',
      name_th: 'เงินสด & สินทรัพย์สภาพคล่อง (Cash & Liquid Assets)',
      category: 'balance',
      status: 'excellent',
      status_label_th: 'สภาพคล่องแข็งแกร่ง (Fortress Balance Sheet)',
      status_label_en: 'Fortress Liquidity Reserve',
      what_is_it_th: 'เงินสดและสินทรัพย์สภาพคล่องสูงที่พร้อมนำไปใช้จ่ายหรือชำระหนี้ได้ทันที',
      what_is_it_en: 'Cash and near-cash marketable securities convertible within days.',
      interpretation_th: `เงินสดและสินทรัพย์สภาพคล่องอยู่ที่ **${valStr}** เป็นกันชนรองรับความไม่แน่นอนทางเศรษฐกิจและเป็นกระสุนสำหรับฉวยโอกาสลงทุน`,
      interpretation_en: `Cash reserves stand at **${valStr}**, insulating the firm from downturns and providing strategic dry powder.`,
      pros_th: [
        'พร้อมรับมือวิกฤตเศรษฐกิจโดยไม่ต้องกู้เงินในอัตราดอกเบี้ยสูง',
        'มีความพร้อมในการซื้อกิจการ (M&A) ในช่วงที่ราคาเหมาะสม'
      ],
      pros_en: [
        'Insulates company from high borrowing rates during credit crunches',
        'Provides opportunistic M&A firepower during market dislocations'
      ],
      benchmark_th: 'เกณฑ์ปกติ: ควรมีเงินสดครอบคลุมภาระหนี้สินระยะสั้นและค่าใช้จ่ายดำเนินงานอย่างน้อย 6-12 เดือน',
      benchmark_en: 'Rule of Thumb: Maintain 6-12 months of operating expenses in liquid reserves.',
      watchouts_th: 'การถือเงินสดมากเกินไปโดยไม่นำไปลงทุนอาจทำให้ผลตอบแทนส่วนของผู้ถือหุ้น (ROE) ลดลง',
      watchouts_en: 'Excess idle cash drag can dilute overall ROE if not deployed productively.'
    };
  }

  // 24. Total Liabilities & Debt
  if (key === 'total_liabilities' || key === 'current_liabilities' || key === 'long_term_debt' || key === 'short_term_debt') {
    return {
      key,
      name: 'Total Liabilities & Debt',
      name_th: 'หนี้สินรวม & ภาระผูกพัน (Total Liabilities)',
      category: 'balance',
      status: 'good',
      status_label_th: 'ภาระหนี้สินอยู่ในเกณฑ์ควบคุมได้',
      status_label_en: 'Manageable Liabilities',
      what_is_it_th: 'ภาระผูกพันทางการเงินทั้งหมดที่บริษัทต้องชำระคืน ทั้งหนี้สินหมุนเวียนและหนี้สินระยะยาว',
      what_is_it_en: 'Aggregate financial obligations owed to external lenders, suppliers, and institutions.',
      interpretation_th: `หนี้สินและภาระผูกพันอยู่ที่ **${valStr}** สอดคล้องกับขนาดของธุรกิจและโครงสร้างการดำเนินงาน`,
      interpretation_en: `Liabilities stand at **${valStr}**, matching operational scale and capital financing needs.`,
      pros_th: ['การใช้หนี้สินในสัดส่วนที่เหมาะสมช่วยลดต้นทุนทางการเงินเฉลี่ย (WACC)'],
      pros_en: ['Prudent leverage optimizes weighted average cost of capital (WACC)'],
      benchmark_th: 'เกณฑ์ปกติ: D/E < 1.0x–1.5x ถือว่าปลอดภัย',
      benchmark_en: 'Rule of Thumb: D/E under 1.5x represents low financial risk.',
      watchouts_th: 'ติดตามตารางการครบกำหนดชำระหนี้และอัตราดอกเบี้ยจ่าย',
      watchouts_en: 'Monitor debt maturity schedules and refinancing terms.'
    };
  }

  // 25. Stockholders' Equity
  if (key === 'total_equity' || key === 'retained_earnings' || key === 'capital_stock') {
    return {
      key,
      name: 'Stockholders\' Equity',
      name_th: 'ส่วนของผู้ถือหุ้น & กำไรสะสม (Equity & Retained Earnings)',
      category: 'balance',
      status: isSevereDrop ? 'warning' : 'good',
      status_label_th: isSevereDrop ? `ส่วนของทุนลดลง (${yoyText})` : 'ส่วนของทุนมีความมั่นคง',
      status_label_en: isSevereDrop ? 'Declining Equity' : 'Solid Equity Base',
      what_is_it_th: 'มูลค่าทางบัญชีสุทธิที่เป็นของเจ้าของ (ผู้ถือหุ้น) หลังจากหักหนี้สินทั้งหมดออกจากสินทรัพย์แล้ว',
      what_is_it_en: 'Net book value attributable to equity holders after all liabilities are settled.',
      interpretation_th: `ส่วนของผู้ถือหุ้นอยู่ที่ **${valStr}** ${yoyText ? `(${yoyText})` : ''} สะท้อนฐานทุนสะสมและการเติบโตของมูลค่าทางบัญชี`,
      interpretation_en: `Stockholders' equity stands at **${valStr}** ${yoyText ? `(${yoyText})` : ''}, reflecting accumulated net worth and book value.`,
      pros_th: ['เพิ่มมูลค่าทางบัญชีต่อหุ้น (Book Value Per Share) อย่างยั่งยืน'],
      pros_en: ['Steadily builds tangible book value per share over long horizons'],
      benchmark_th: 'เกณฑ์ปกติ: กำไรสะสมควรมีแนวโน้มเพิ่มขึ้นทุกปี บ่งบอกว่าบริษัทมีกำไรต่อเนื่อง',
      benchmark_en: 'Rule of Thumb: Retained earnings should trend upward year-over-year.',
      watchouts_th: 'การซื้อหุ้นคืนจำนวนมากอาจทำให้ตัวเลข Equity ทางบัญชีลดลง แต่ช่วยเพิ่มกำไรต่อหุ้น (EPS)',
      watchouts_en: 'Aggressive buybacks reduce accounting equity while enhancing per-share value.'
    };
  }

  // ==========================================
  // SECTION D: DYNAMIC FALLBACK
  // ==========================================
  const fallbackTitle = rowTitle || key.replace(/_/g, ' ').toUpperCase();
  const dynamicStatus: 'excellent' | 'good' | 'neutral' | 'warning' = isNegative
    ? 'warning'
    : isSevereDrop
    ? 'warning'
    : isModerateDrop
    ? 'neutral'
    : isHighGrowth
    ? 'excellent'
    : 'good';

  const dynamicLabelTh = isNegative
    ? 'มีค่าติดลบ'
    : isSevereDrop
    ? `หดตัว (${yoyText || 'ลดลง'})`
    : isModerateDrop
    ? `ชะลอตัว (${yoyText || 'ลดลงเล็กน้อย'})`
    : isHighGrowth
    ? `เติบโตสูง (${yoyText || 'ขยายตัว'})`
    : yoyText
    ? `ขยายตัว (${yoyText})`
    : 'สถานะปกติ';

  const dynamicLabelEn = isNegative
    ? 'Negative Value'
    : isSevereDrop
    ? `Contracting (${yoyText || 'Declining'})`
    : isModerateDrop
    ? `Moderating (${yoyText || 'Slight decline'})`
    : isHighGrowth
    ? `Expanding (${yoyText || 'Rapid growth'})`
    : 'Normal Status';

  return {
    key,
    name: fallbackTitle,
    name_th: `รายการ ${fallbackTitle}`,
    category: 'operating',
    status: dynamicStatus,
    status_label_th: dynamicLabelTh,
    status_label_en: dynamicLabelEn,
    what_is_it_th: `ตัวเลขทางการเงินแสดงมูลค่าหรืออัตราส่วนของ ${fallbackTitle} ตามงบการเงินมาตรฐานสากล`,
    what_is_it_en: `Financial metric representing ${fallbackTitle} under standard accounting conventions.`,
    interpretation_th: `ที่ระดับ **${valStr}** ${yoyText ? `(${yoyText})` : ''} สะท้อนสถานะผลการดำเนินงานและโครงสร้างทางการเงินของบริษัทในรอบระยะเวลางวดล่าสุด`,
    interpretation_en: `At **${valStr}** ${yoyText ? `(${yoyText})` : ''}, this metric reflects performance consistent with reporting standards.`,
    pros_th: ['ให้ข้อมูลโปร่งใสในการวิเคราะห์แนวโน้มผลประกอบการของกิจการ'],
    pros_en: ['Provides transparent insight into underlying financial trajectory'],
    benchmark_th: 'เปรียบเทียบกับแนวโน้มย้อนหลัง 3-5 ไตรมาส และค่าเฉลี่ยของบริษัทคู่แข่งในอุตสาหกรรมเดียวกัน',
    benchmark_en: 'Compare against historical trends and direct peer group benchmarks.',
    watchouts_th: 'ติดตามความต่อเนื่องในแต่ละไตรมาสเพื่อสังเกตจุดเปลี่ยนของผลประกอบการ',
    watchouts_en: 'Monitor quarterly consistency to identify business inflection points.'
  };
}
