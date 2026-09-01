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
}

export function getFinancialAiInsight(
  key: string,
  latestValue: number | string | null | undefined,
  unit: string = '',
  isThai: boolean = true
): FinancialAiInsight {
  const valStr = latestValue !== null && latestValue !== undefined ? `${latestValue}${unit}` : '-';

  // 1. Profitability Metrics
  if (key === 'net_margin') {
    return {
      key,
      name: 'Net Margin',
      name_th: 'อัตรากำไรสุทธิ (Net Margin)',
      category: 'profitability',
      status: 'excellent',
      status_label_th: 'แข็งแกร่งมาก (ยอดเยี่ยม)',
      status_label_en: 'Excellent / High Quality',
      what_is_it_th: 'สัดส่วนกำไรสุทธิบรรทัดสุดท้ายที่เหลือเข้าสู่บริษัทอย่างแท้จริง หลังจากหักต้นทุนขาย ค่าใช้จ่ายดำเนินงาน ดอกเบี้ยจ่าย และภาษีทั้งหมดแล้ว',
      what_is_it_en: 'The percentage of revenue left as net profit after deducting all costs, operating expenses, interest, and taxes.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีความสามารถในการทำกำไรขั้นสูงมาก (High Quality Earnings)** ทุกๆ รายได้ 100 บาท สามารถเปลี่ยนเป็นกำไรสุทธิเข้ากระเป๋าได้ถึง ${valStr} สะท้อนอำนาจการตั้งราคา (Pricing Power) และการประหยัดจากขนาด (Economies of Scale) ที่คู่แข่งลอกเลียนแบบได้ยาก`,
      interpretation_en: `At **${valStr}**, this indicates superior pricing power and exceptional cost control, converting a large fraction of revenue straight into bottom-line profit.`,
      pros_th: [
        'มีเบาะรองรับความผันผวน (Margin of Safety) สูง หากต้นทุนวัตถุดิบหรือค่าใช้จ่ายสูงขึ้น',
        'อำนาจต่อรองราคาในตลาดสูง ลูกค้ายินดีจ่ายพรีเมียม',
        'สร้างกระแสผลตอบแทนส่วนของผู้ถือหุ้นได้อย่างมั่นคง'
      ],
      pros_en: [
        'High margin of safety against economic downturns',
        'Strong pricing power and low customer price sensitivity',
        'Drives high and sustainable return on equity'
      ],
      benchmark_th: 'เกณฑ์ปกติ: > 20% ยอดเยี่ยมมาก | 10–20% ดีตามเกณฑ์มาตรฐาน | 5–10% ปานกลาง | < 5% มาร์จิ้นบางเสี่ยงผันผวน',
      benchmark_en: 'Rule of Thumb: > 20% Excellent | 10-20% Good | 5-10% Fair | < 5% Thin & Vulnerable',
      watchouts_th: 'ควรตรวจสอบว่ากำไรสุทธิโตจากรายได้หลักที่แท้จริง หรือมีกำไรพิเศษทางบัญชี (Non-operating gain) ครั้งเดียวเข้ามาปน',
      watchouts_en: 'Verify whether profit growth is driven by core operations or one-off accounting gains.'
    };
  }

  if (key === 'gross_margin' || key === 'gross_profit') {
    return {
      key,
      name: 'Gross Margin',
      name_th: 'อัตรากำไรขั้นต้น (Gross Margin)',
      category: 'profitability',
      status: 'excellent',
      status_label_th: 'แข็งแกร่งมาก (ยอดเยี่ยม)',
      status_label_en: 'Outstanding Gross Margin',
      what_is_it_th: 'สัดส่วนกำไรเบื้องต้นหลังหักต้นทุนขายและบริการโดยตรง (COGS) เทียบกับยอดขายรวม สะท้อนความได้เปรียบเชิงแข่งขันของตัวสินค้า/บริการ',
      what_is_it_en: 'The proportion of revenue remaining after deducting direct Cost of Goods Sold (COGS).',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **ตัวสินค้า/แพลตฟอร์มมีคูป้องปราการ (Moat) แข็งแกร่ง** มีต้นทุนแปรผันต่อหน่วยที่ต่ำมาก ทำให้บริษัทมีเงินเหลือก้อนโตไปใช้ในการวิจัย (R&D) และการตลาด (Marketing)`,
      interpretation_en: `At **${valStr}**, this proves strong economic moat and high gross pricing power over production costs.`,
      pros_th: [
        'ต้นทุนผลิตต่อหน่วยต่ำ มีความยืดหยุ่นในการจัดโปรโมชั่นหรือแข่งขันด้านราคา',
        'สร้างกระแสเงินสดเบื้องต้นหนาแน่นเพื่อนำไปลงทุนพัฒนาผลิตภัณฑ์ใหม่',
        'มีความสามารถในการส่งผ่านต้นทุนเงินเฟ้อไปยังผู้บริโภคได้ดี'
      ],
      pros_en: [
        'Low marginal unit costs give immense pricing flexibility',
        'Funds heavy R&D and aggressive market expansion',
        'Ability to pass inflationary cost pressures to customers'
      ],
      benchmark_th: 'เกณฑ์ปกติ: > 50% ยอดเยี่ยมสำหรับหุ้นเทคโนโลยี/ซอฟต์แวร์ | 25–40% มาตรฐานค้าปลีกและบริการ',
      benchmark_en: 'Rule of Thumb: > 50% Top Tier Tech/SaaS | 25-40% Healthy Retail/Services',
      watchouts_th: 'จับตาทิศทาง Gross Margin ว่ามีการหดตัวลงจากสงครามราคาหรือต้นทุนคลาวด์/เซิร์ฟเวอร์ที่พุ่งสูงขึ้นหรือไม่',
      watchouts_en: 'Watch for margin erosion caused by competitive price wars or rising infrastructure costs.'
    };
  }

  if (key === 'operating_margin' || key === 'operating_income' || key === 'ebit_margin') {
    return {
      key,
      name: 'Operating Margin',
      name_th: 'อัตรากำไรจากการดำเนินงาน (Operating / EBIT Margin)',
      category: 'profitability',
      status: 'excellent',
      status_label_th: 'ยอดเยี่ยม (Operating Leverage สูง)',
      status_label_en: 'High Operating Leverage',
      what_is_it_th: 'ความสามารถในการสร้างกำไรจากกิจกรรมการค้าหลักของบริษัท ก่อนคิดภาระดอกเบี้ยเงินกู้และภาษี (EBIT)',
      what_is_it_en: 'Profitability generated from core operations before interest expenses and corporate taxes.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมี Operating Leverage ที่ยอดเยี่ยม** ค่าใช้จ่ายในการขายและบริหาร (SG&A) ถูกควบคุมได้อย่างมีประสิทธิภาพ ยิ่งรายได้ขยายตัว กำไรจากการดำเนินงานยิ่งโตในอัตราเร่ง`,
      interpretation_en: `At **${valStr}**, this highlights operational efficiency and strong scalability as revenue grows.`,
      pros_th: [
        'ประสิทธิภาพการบริหารค่าใช้จ่ายสำนักงานและทีมขายเป็นเลิศ',
        'สะท้อนความสามารถในการทำกำไรของธุรกิจหลักเพียวๆ โดยปราศจากการบิดเบือนโครงสร้างภาษี'
      ],
      pros_en: [
        'Superior overhead cost control and sales efficiency',
        'Reflects pure operational strength unclouded by debt or tax structures'
      ],
      benchmark_th: 'เกณฑ์ปกติ: > 25% ดีเยี่ยม | 15–25% ดีมาก | 5–15% ปานกลาง | < 5% คุมค่าใช้จ่ายได้ไม่ดี',
      benchmark_en: 'Rule of Thumb: > 25% Elite | 15-25% Good | 5-15% Moderate | < 5% Inefficient',
      watchouts_th: 'ระวังค่าใช้จ่ายพนักงานหรือค่าตอบแทนด้วยหุ้น (Stock-Based Compensation) ที่บวมโตจนกัดกิน EBIT',
      watchouts_en: 'Keep an eye on excessive Stock-Based Compensation diluting operating profitability.'
    };
  }

  if (key === 'ebitda_margin') {
    return {
      key,
      name: 'EBITDA Margin',
      name_th: 'อัตรากำไรก่อนดอกเบี้ย ภาษี ค่าเสื่อมราคา & ตัดจำหน่าย (EBITDA Margin)',
      category: 'profitability',
      status: 'excellent',
      status_label_th: 'สภาพคล่องกำไรระดับสูง',
      status_label_en: 'Robust Operating Cash Proxy',
      what_is_it_th: 'ตัวแทนสะท้อนกระแสเงินสดจากการดำเนินงานเบื้องต้น ก่อนหักค่าเสื่อมราคาทางบัญชี (D&A) ภาระหนี้ และภาษี',
      what_is_it_en: 'Core cash profitability proxy before non-cash depreciation, interest, and taxes.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีกระแสกำไรสดหมุนเวียนสูงมาก** มีศักยภาพในการจ่ายคืนหนี้สินและรองรับค่าใช้จ่ายฝ่ายทุน (CapEx) ได้อย่างเต็มที่`,
      interpretation_en: `At **${valStr}**, the enterprise generates heavy operational cash buffers.`,
      pros_th: ['ช่วยเปรียบเทียบความสามารถในการทำกำไรระหว่างบริษัทที่มีโครงสร้างสินทรัพย์ถาวรต่างกันได้ดี'],
      pros_en: ['Allows clean cross-company comparison regardless of depreciation policies'],
      benchmark_th: 'เกณฑ์ปกติ: > 30% แข็งแกร่งมาก | 15–30% สุขภาพดี | < 10% เสี่ยงมีภาระหนี้กดดัน',
      benchmark_en: 'Rule of Thumb: > 30% Very Strong | 15-30% Solid | < 10% Weak',
      watchouts_th: 'EBITDA ไม่ได้สะท้อนเงินสดที่ต้องจ่ายจริงเพื่อซื้อเครื่องจักร/เซิร์ฟเวอร์ทดแทน (CapEx)',
      watchouts_en: 'EBITDA excludes essential capital expenditures needed to maintain ongoing capacity.'
    };
  }

  if (key === 'rd_expense_ratio') {
    return {
      key,
      name: 'R&D Expense Ratio',
      name_th: 'สัดส่วนค่าใช้จ่ายวิจัยและพัฒนา (R&D Expense Ratio)',
      category: 'profitability',
      status: 'good',
      status_label_th: 'ลงทุนนวัตกรรมสม่ำเสมอ (Good Moat)',
      status_label_en: 'Strong Innovation Investment',
      what_is_it_th: 'สัดส่วนเงินลงทุนที่นำไปใช้ในการคิดค้นนวัตกรรม พัฒนาสิทธิบัตร และซอฟต์แวร์เวอร์ชันใหม่เทียบกับยอดขาย',
      what_is_it_en: 'The proportion of revenue reinvested into developing new products and proprietary technologies.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทให้ความสำคัญกับการสร้างคูป้องปราการนวัตกรรม (Tech Moat)** เพื่อทิ้งห่างคู่แข่งและรักษาตำแหน่งผู้นำตลาดในอนาคต`,
      interpretation_en: `At **${valStr}**, the company actively reinvests into its technological leadership.`,
      pros_th: ['สร้างสิทธิบัตร ฟีเจอร์ AI และแพลตฟอร์มใหม่ที่คู่แข่งตามทันได้ยาก'],
      pros_en: ['Builds durable intellectual property and next-gen product moats'],
      benchmark_th: 'เกณฑ์ปกติสำหรับหุ้น Tech/AI: 8–15% ถือว่าเหมาะสมในการสร้างการเติบโตระยะยาว',
      benchmark_en: 'Tech/AI Benchmark: 8-15% is the sweet spot for sustainable technological lead',
      watchouts_th: 'ต้องติดตามว่าเม็ดเงิน R&D สามารถเปลี่ยนเป็นรายได้และผลิตภัณฑ์ที่ทำเงินได้จริง (Monetization) หรือไม่',
      watchouts_en: 'Ensure R&D outlays translate into commercial products and high ROI.'
    };
  }

  // 2. Solvency & Balance Sheet Metrics
  if (key === 'current_ratio' || key === 'quick_ratio') {
    const isQuick = key === 'quick_ratio';
    return {
      key,
      name: isQuick ? 'Quick Ratio' : 'Current Ratio',
      name_th: isQuick ? 'อัตราส่วนสภาพคล่องหมุนเวียนเร็ว (Quick Ratio)' : 'อัตราส่วนสภาพคล่องหมุนเวียน (Current Ratio)',
      category: 'solvency',
      status: 'good',
      status_label_th: 'สภาพคล่องปลอดภัย (Solvent)',
      status_label_en: 'Safe Liquidity Profile',
      what_is_it_th: 'ความสามารถในการชำระหนี้สินระยะสั้นที่จะถึงกำหนดภายใน 1 ปี ด้วยสินทรัพย์หมุนเวียนที่มีสภาพคล่องสูง',
      what_is_it_en: 'Measures the company’s ability to cover short-term liabilities with short-term liquid assets.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **ฐานะสภาพคล่องมีความปลอดภัย** มีสินทรัพย์พร้อมแปลงเป็นเงินสดเพียงพอชำระหนี้สินหมุนเวียนได้ครบถ้วนโดยไม่มีปัญหาเงินตึงตัว`,
      interpretation_en: `At **${valStr}**, short-term liquidity is secure with ample buffers against unexpected liquidity shocks.`,
      pros_th: [
        'ไม่มีความเสี่ยงเรื่องการผิดนัดชำระหนี้ระยะสั้น',
        'มีความคล่องตัวในการจัดสรรเงินทุนเพื่อขยายธุรกิจ'
      ],
      pros_en: [
        'Near-zero risk of short-term default or cash crunches',
        'High financial agility to seize growth opportunities'
      ],
      benchmark_th: isQuick ? 'เกณฑ์ปกติ Quick Ratio: > 1.0x ดีเยี่ยม | 0.8–1.0x ปลอดภัย | < 0.5x เสี่ยงเงินตึงตัว' : 'เกณฑ์ปกติ Current Ratio: > 1.5x ดีมาก | 1.0–1.5x ปลอดภัย | < 1.0x ต้องบริหารเงินหมุนเวียนใกล้ชิด',
      benchmark_en: isQuick ? 'Quick Ratio Benchmark: > 1.0x Strong | 0.8-1.0x Adequate | < 0.5x Tight' : 'Current Ratio Benchmark: > 1.5x Strong | 1.0-1.5x Healthy | < 1.0x Tight',
      watchouts_th: 'บริษัทที่มีวงจรเงินสด (CCC) ติดลบ เช่น กลุ่ม Big Tech อาจรักษาระดับ Current Ratio ใกล้ 1.0x ได้อย่างปลอดภัย',
      watchouts_en: 'Firms with negative working capital cycles can safely operate around 1.0x.'
    };
  }

  if (key === 'lt_debt_to_equity' || key === 'debt_to_asset' || key === 'total_assets_to_equity') {
    return {
      key,
      name: 'Debt & Leverage Ratio',
      name_th: 'อัตราส่วนหนี้สินและภาระผูกพัน (Debt & Leverage)',
      category: 'solvency',
      status: 'good',
      status_label_th: 'งบดุลแข็งแกร่ง (Fortress Balance Sheet)',
      status_label_en: 'Low Financial Risk',
      what_is_it_th: 'สัดส่วนภาระหนี้สินที่มีดอกเบี้ยเมื่อเทียบกับส่วนของผู้ถือหุ้นและสินทรัพย์รวม',
      what_is_it_en: 'Financial leverage metrics assessing the balance of borrowed funds versus shareholder equity.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **โครงสร้างเงินทุนของบริษัทมีความปลอดภัยสูงมาก** บริษัทไม่ได้ก่อหนี้เกินตัว ดอกเบี้ยจ่ายไม่เป็นภาระกดดันผลประกอบการ`,
      interpretation_en: `At **${valStr}**, leverage is conservative, insulating earnings from interest rate volatility.`,
      pros_th: ['ความเสี่ยงการล้มละลายต่ำมาก', 'ได้รับการประเมินอันดับเครดิต (Credit Rating) สูง ทำให้ต้นทุนการกู้ยืมต่ำหากต้องการขยายงาน'],
      pros_en: ['Extremely low bankruptcy risk', 'Prime creditworthiness lowers future cost of capital'],
      benchmark_th: 'เกณฑ์ปกติ: D/E < 1.0x ปลอดภัยมาก | 1.0–2.0x ปานกลาง | > 2.5x หนี้สินสูงมีความเสี่ยง',
      benchmark_en: 'Rule of Thumb: D/E < 1.0x Conservative | 1.0-2.0x Moderate | > 2.5x High Risk',
      watchouts_th: 'สำหรับบริษัทที่ทำ Share Buybacks ต่อเนื่อง ส่วนของผู้ถือหุ้นทางบัญชีอาจลดลง ส่งผลให้ D/E ทางบัญชีดูสูงขึ้นกว่าความเป็นจริง',
      watchouts_en: 'Aggressive share repurchases can shrink accounting equity, artificially inflating optical D/E.'
    };
  }

  // 3. Operating Capacity & Returns
  if (key === 'ccc') {
    return {
      key,
      name: 'Cash Conversion Cycle (CCC)',
      name_th: 'วงจรเงินสด (Cash Conversion Cycle - CCC)',
      category: 'operating',
      status: 'excellent',
      status_label_th: 'ยอดเยี่ยมระดับโลก (Negative Working Capital)',
      status_label_en: 'Elite Working Capital Power',
      what_is_it_th: 'ระยะเวลาเฉลี่ย (จำนวนวัน) ตั้งแต่บริษัทจ่ายเงินสดซื้อสินค้า/วัตถุดิบ จนกระทั่งได้รับเงินสดคืนจากการขายสินค้าให้ลูกค้า',
      what_is_it_en: 'Days required to convert resource inputs into cash flows from sales.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีอำนาจต่อรองทางการค้าสูงสุดในอุตสาหกรรม** ค่า CCC ติดลบหมายถึงบริษัทได้รับเงินสดจากลูกค้าก่อนที่จะต้องจ่ายเงินให้เจ้าหนี้การค้า สามารถนำเงินสดของคู่ค้ามาหมุนเวียนสร้างผลตอบแทนได้ฟรีโดยไม่ต้องกู้เงิน`,
      interpretation_en: `At **${valStr}**, negative CCC signifies the company collects cash from customers before paying suppliers, using other people's money to grow.`,
      pros_th: [
        'ธุรกิจสร้างเงินสดหมุนเวียนได้เอง ไม่ต้องสำรองเงินทุนหมุนเวียนก้อนใหญ่',
        'อำนาจต่อรองเหนือ Supplier และลูกค้าสูงมาก (คล้ายกับโมเดล Apple, Dell, Amazon)'
      ],
      pros_en: [
        'Self-funding business model requiring zero external working capital financing',
        'Exceptional bargaining leverage across the entire value chain'
      ],
      benchmark_th: 'เกณฑ์ปกติ: < 0 วัน = ยอดเยี่ยมที่สุด | 0–30 วัน = ดีมาก | > 90 วัน = เงินจมในสต็อกและลูกหนี้',
      benchmark_en: 'Rule of Thumb: < 0 Days = World Class | 0-30 Days = Healthy | > 90 Days = Tied Up Cash',
      watchouts_th: 'ควรดูแลความสัมพันธ์กับคู่ค้า ไม่ควรยืดหนี้จนส่งผลกระทบต่อความมั่นคงของห่วงโซ่อุปทาน',
      watchouts_en: 'Maintain healthy vendor relations so extended terms do not harm supplier stability.'
    };
  }

  if (key === 'roe' || key === 'roic' || key === 'roa') {
    const isRoic = key === 'roic';
    return {
      key,
      name: isRoic ? 'ROIC' : key.toUpperCase(),
      name_th: isRoic ? 'ผลตอบแทนจากเงินลงทุนรวม (ROIC)' : key === 'roe' ? 'ผลตอบแทนต่อส่วนของผู้ถือหุ้น (ROE)' : 'ผลตอบแทนต่อสินทรัพย์รวม (ROA)',
      category: 'operating',
      status: 'excellent',
      status_label_th: 'Super Compounder (ผลตอบแทนเงินลงทุนสูงลิ่ว)',
      status_label_en: 'High-Moat Super Compounder',
      what_is_it_th: isRoic
        ? 'ผลตอบแทนสุทธิที่บริษัทสร้างได้จริงจากเงินลงทุนทั้งหมด (ทั้งเงินทุนของเจ้าของและเงินกู้ยืม)'
        : 'ผลตอบแทนกำไรสุทธิเทียบกับฐานเงินทุนของผู้ถือหุ้น',
      what_is_it_en: 'Measures how efficiently the company allocates capital to generate profitable returns.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **ผู้บริหารมีความเชี่ยวชาญในการจัดสรรเงินทุน (Capital Allocation) ขั้นสูงสุด** สร้างผลตอบแทนจากการลงทุนได้สูงกว่าต้นทุนเงินทุน (WACC) อย่างมหาศาล ทำให้บริษัทสามารถทบต้นมูลค่ากิจการ (Compound) ได้อย่างต่อเนื่อง`,
      interpretation_en: `At **${valStr}**, returns on invested capital far outstrip cost of capital (WACC), driving relentless economic value creation.`,
      pros_th: [
        'เป็นเกณฑ์สำคัญที่สุดที่นักลงทุนระดับโลก (เช่น Warren Buffett) ใช้คัดกรองหุ้นคุณภาพยอดเยี่ยม',
        'การลงทุนซ้ำ (Reinvestment) ในธุรกิจเดิมจะสร้างกำไรใหม่ได้ในอัตราที่สูงมาก'
      ],
      pros_en: [
        'The definitive litmus test of business quality and competitive moat',
        'Reinvestment delivers compounding returns far above industry averages'
      ],
      benchmark_th: 'เกณฑ์ปกติ: ROIC > 20% = หุ้นคุณภาพชั้นยอด (Super Compounder) | 12–20% = ดี | < 8% = ไม่สามารถสร้างมูลค่าเพิ่มเหนือ WACC',
      benchmark_en: 'Rule of Thumb: ROIC > 20% = Elite Compounder | 12-20% = Good | < 8% = Value Destructive',
      watchouts_th: 'สำหรับ ROE ต้องระวังว่าสูงขึ้นเพราะกำไรโต หรือสูงขึ้นเพราะบริษัทกู้หนี้มาเพิ่ม (Financial Leverage)',
      watchouts_en: 'Ensure high ROE is generated by high profit margins rather than excessive debt leverage.'
    };
  }

  if (key === 'fcf_to_sales' || key === 'fcf_to_net_income' || key === 'free_cash_flow') {
    return {
      key,
      name: 'Free Cash Flow Metrics',
      name_th: 'กระแสเงินสดอิสระ & คุณภาพกำไร (Free Cash Flow)',
      category: 'cashflow',
      status: 'excellent',
      status_label_th: 'คุณภาพกำไรเกรด A+ (High Cash Conversion)',
      status_label_en: 'Grade A+ Earnings Quality',
      what_is_it_th: 'สัดส่วนกระแสเงินสดอิสระที่สร้างได้จริงหลังหักค่าใช้จ่ายลงทุน CapEx แล้ว เทียบกับยอดขายและกำไรสุทธิทางบัญชี',
      what_is_it_en: 'Cash conversion efficiency showing actual free cash generated per dollar of revenue or net income.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **กำไรที่รายงานในงบเป็นเงินสดแท้จริง (High Quality Cash)** ไม่ใช่แค่กำไรบนแผ่นกระดาษ บริษัทมีเงินสดส่วนเกินพร้อมนำไปจ่ายเงินปันผล ซื้อหุ้นคืน หรือเข้าซื้อกิจการเพื่อสร้างการเติบโต`,
      interpretation_en: `At **${valStr}**, net income converts cleanly into hard cash, proving robust accounting integrity and capital discipline.`,
      pros_th: [
        'FCF Conversion สูง (> 90-100%) แปลว่าไม่มีปัญหาหนี้สูญหรือสินค้าค้างสต็อก',
        'มีอิสระในการจัดสรรเงินทุนเพื่อสร้างมูลค่าสูงสุดให้แก่ผู้ถือหุ้น'
      ],
      pros_en: [
        'High FCF conversion confirms real earnings backed by liquid cash',
        'Enables sustained dividend growth and accretive share buybacks'
      ],
      benchmark_th: 'เกณฑ์ปกติ: FCF/Net Income > 90% = คุณภาพดีเยี่ยม | 70–90% = ปกติ | < 50% = กำไรทางบัญชีอาจไม่เป็นเงินสด',
      benchmark_en: 'Rule of Thumb: FCF Conversion > 90% = Pristine | 70-90% = Normal | < 50% = Paper Profits Alert',
      watchouts_th: 'ติดตามความผันผวนของ CapEx หากมีรอบการลงทุนศูนย์ข้อมูลขนาดใหญ่ (AI Data Center) อาจทำให้ FCF ชะลอตัวลงชั่วคราว',
      watchouts_en: 'Heavy cyclical CapEx cycles (such as AI data center investments) may temporarily reduce FCF.'
    };
  }

  // 4. Financial Statements Lines (Revenue, COGS, Net Income, etc.)
  if (key === 'revenue') {
    return {
      key,
      name: 'Total Revenue',
      name_th: 'รายได้รวมตามรายงาน (Total Revenue)',
      category: 'income',
      status: 'excellent',
      status_label_th: 'ขยายตัวแข็งแกร่ง (Top-Line Growth)',
      status_label_en: 'Robust Revenue Growth',
      what_is_it_th: 'มูลค่ายอดขายรวมสุทธิจากการส่งมอบสินค้า การให้บริการ และสัญญาลิขสิทธิ์ทั้งหมดของบริษัทในรอบระยะเวลา',
      what_is_it_en: 'Total gross inflow of economic benefits arising in the course of ordinary activities.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกถึง **ความต้องการของตลาด (Market Demand) ที่ยังเติบโตสูง** ลูกค้าเพิ่มขึ้นต่อเนื่องและมีการซื้อซ้ำ (Recurring Revenue) สะท้อนความแข็งแกร่งของส่วนแบ่งทางการตลาด`,
      interpretation_en: `At **${valStr}**, top-line expansion demonstrates sustained demand and market share gains.`,
      pros_th: ['เป็นเครื่องยนต์หลักในการผลักดันการเติบโตของกำไรสุทธิในระยะยาว', 'สะท้อน Product-Market Fit ที่แข็งแกร่ง'],
      pros_en: ['Primary engine powering long-term bottom line expansion', 'Proves robust product-market fit'],
      benchmark_th: 'เกณฑ์ปกติ: โตเร็วกว่าค่าเฉลี่ยอุตสาหกรรมและ GDP อย่างน้อย 2-3 เท่า ถือเป็นหุ้นกลุ่ม High Growth',
      benchmark_en: 'Rule of Thumb: Growing at 2-3x sector average signals dominant industry leadership',
      watchouts_th: 'ควรวิเคราะห์ควบคู่กับรายได้ที่เกิดซ้ำ (Recurring Revenue) และการกระจายตัวของฐานลูกค้า',
      watchouts_en: 'Check recurring revenue percentage and customer concentration risk.'
    };
  }

  if (key === 'cogs') {
    return {
      key,
      name: 'Cost of Revenue',
      name_th: 'ต้นทุนขายและบริการ (COGS)',
      category: 'income',
      status: 'good',
      status_label_th: 'ควบคุมต้นทุนได้ดี',
      status_label_en: 'Well-Controlled Production Cost',
      what_is_it_th: 'ต้นทุนทางตรงที่เกิดขึ้นเพื่อผลิตสินค้าหรือให้บริการ เช่น ค่าเซิร์ฟเวอร์ ค่าลิขสิทธิ์ข้อมูล ค่าแรงทางตรง',
      what_is_it_en: 'Direct costs attributable to the production of the goods and services sold.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทสามารถควบคุมต้นทุนทางตรงได้ตามแผน** สัดส่วนต้นทุนไม่ขยายตัวเร็วกว่ารายได้ ช่วยรักษากำไรขั้นต้นให้คงที่และขยายตัว`,
      interpretation_en: `At **${valStr}**, direct cost structures remain disciplined and scalable.`,
      pros_th: ['การประหยัดจากขนาดทำให้ต้นทุนต่อหน่วยลดลงเมื่อยอดขายเพิ่มขึ้น'],
      pros_en: ['Economies of scale push unit delivery costs down'],
      benchmark_th: 'เกณฑ์ปกติ: COGS/Revenue ต่ำกว่า 50% สำหรับธุรกิจซอฟต์แวร์และแพลตฟอร์มข้อมูล',
      benchmark_en: 'Benchmark: COGS under 50% of revenue is standard for scalable software platforms',
      watchouts_th: 'จับตาเงินเฟ้อด้านค่าจ้างวิศวกรและต้นทุนค่าบริการคลาวด์/ฮาร์ดแวร์ AI',
      watchouts_en: 'Monitor GPU/Cloud hosting inflation and talent compensation costs.'
    };
  }

  if (key === 'opex') {
    return {
      key,
      name: 'Operating Expense',
      name_th: 'ค่าใช้จ่ายในการดำเนินงาน (Operating Expense - OPEX)',
      category: 'income',
      status: 'good',
      status_label_th: 'จัดการค่าใช้จ่ายได้สมดุล',
      status_label_en: 'Disciplined Overhead',
      what_is_it_th: 'ค่าใช้จ่ายในการบริหาร การขาย การตลาด (SG&A) และการวิจัยพัฒนา (R&D) เพื่อขับเคลื่อนธุรกิจ',
      what_is_it_en: 'Operational expenditures incurred outside of direct production, covering SG&A and R&D.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีการลงทุนเพื่อการเติบโตอย่างมีวินัย** ควบคุมค่าใช้จ่ายส่วนกลางได้ดีโดยไม่กระทบต่อประสิทธิภาพการขยายตลาด`,
      interpretation_en: `At **${valStr}**, overhead investments are deployed with strong fiscal discipline.`,
      pros_th: ['สัดส่วน OPEX ต่อรายได้ที่ลดลงจะสร้างอัตราเร่งให้กำไรจากการดำเนินงานพุ่งขึ้นเร็วขึ้น'],
      pros_en: ['Declining OPEX/Revenue ratio accelerates EBIT margin expansion'],
      benchmark_th: 'เกณฑ์ปกติ: สัดส่วน OPEX/Revenue ควรมีแนวโน้มลดลงตามขนาดของธุรกิจ (Operating Leverage)',
      benchmark_en: 'Rule of Thumb: OPEX intensity should taper downward as revenue scales',
      watchouts_th: 'ระวังค่าใช้จ่ายด้านการตลาดที่สูงเกินไปโดยไม่ได้ยอดขายกลับมาอย่างคุ้มค่า (Customer Acquisition Cost)',
      watchouts_en: 'Watch for inflated CAC without commensurate long-term Customer Lifetime Value.'
    };
  }

  if (key === 'eps') {
    return {
      key,
      name: 'Diluted EPS',
      name_th: 'กำไรต่อหุ้นปรับลด (Diluted EPS)',
      category: 'income',
      status: 'excellent',
      status_label_th: 'เติบโตต่อเนื่อง (Shareholder Value)',
      status_label_en: 'Accretive Per-Share Growth',
      what_is_it_th: 'กำไรสุทธิต่อหุ้นสามัญ 1 หุ้น โดยคำนึงถึงหุ้นที่อาจเกิดขึ้นจากการแปลงสภาพ (เช่น Stock Options, Warrants) ทั้งหมดแล้ว',
      what_is_it_en: 'Net earnings divided by total diluted shares outstanding.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **ผลตอบแทนต่อหุ้นของผู้ถือหุ้นเติบโตอย่างแท้จริง** การเพิ่มขึ้นของ EPS สะท้อนว่ากำไรเติบโตเร็วกว่าการเพิ่มขึ้นของจำนวนหุ้น`,
      interpretation_en: `At **${valStr}**, per-share earning power continues to expand, directly enhancing equity intrinsic value.`,
      pros_th: ['เป็นตัวขับเคลื่อนราคาหุ้นในระยะยาวตามหลักการพื้นฐานที่แท้จริง'],
      pros_en: ['The primary long-term driver of stock price appreciation'],
      benchmark_th: 'เกณฑ์ปกติ: EPS Growth > 15–20% ต่อปี ถือเป็นหุ้นกลุ่ม High Quality Compounder',
      benchmark_en: 'Rule of Thumb: Sustainable 15-20%+ annual EPS growth commands premium multiples',
      watchouts_th: 'ตรวจสอบการเจือจางของหุ้น (Stock Dilution) จากการแจกหุ้นผู้บริหารว่าไม่ทำให้ EPS โตช้ากว่ากำไรสุทธิรวม',
      watchouts_en: 'Verify that stock-based compensation does not excessively dilute EPS relative to net income.'
    };
  }

  // 5. Balance Sheet Items
  if (key === 'total_assets') {
    return {
      key,
      name: 'Total Assets',
      name_th: 'สินทรัพย์รวม (Total Assets)',
      category: 'balance',
      status: 'excellent',
      status_label_th: 'ฐานะสินทรัพย์มั่นคงแข็งแกร่ง',
      status_label_en: 'Solid Asset Base',
      what_is_it_th: 'มูลค่ารวมของทรัพยากรทั้งหมดที่บริษัทครอบครอง ทั้งสินทรัพย์หมุนเวียน (เงินสด, ลูกหนี้, สต็อก) และสินทรัพย์ไม่หมุนเวียน (อาคาร, อุปกรณ์, ทรัพย์สินทางปัญญา)',
      what_is_it_en: 'Total economic resources owned and controlled by the company.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีขนาดฐานทรัพยากรที่ใหญ่และมั่นคงมาก** พร้อมรองรับการเติบโตและการขยายสาขา/บริการในอนาคต`,
      interpretation_en: `At **${valStr}**, the asset foundation provides extensive capacity for future growth and scale.`,
      pros_th: ['สร้างความน่าเชื่อถือสูงต่อคู่ค้าและสถาบันการเงิน', 'รองรับการขยายตัวและลงทุนโครงการขนาดใหญ่'],
      pros_en: ['Enhances institutional credibility and bankability', 'Supports large-scale investments'],
      benchmark_th: 'ควรเติบโตอย่างสมดุลควบคู่กับยอดขายและผลตอบแทน ROA/ROIC',
      benchmark_en: 'Asset expansion should track revenue growth and sustain high ROA/ROIC',
      watchouts_th: 'ระวังสินทรัพย์ที่ไม่มีผลตอบแทนหรือค่าความนิยม (Goodwill) ที่มากเกินไป',
      watchouts_en: 'Watch for unproductive assets or bloated goodwill allocations.'
    };
  }

  if (key === 'current_assets' || key === 'cash_and_investments' || key === 'cash' || key === 'short_term_investments') {
    return {
      key,
      name: 'Cash & Current Assets',
      name_th: 'เงินสด & สินทรัพย์หมุนเวียน (Cash & Liquid Assets)',
      category: 'balance',
      status: 'excellent',
      status_label_th: 'สภาพคล่องล้นเหลือ (Fortress Balance Sheet)',
      status_label_en: 'Fortress Liquidity',
      what_is_it_th: 'เงินสดและสินทรัพย์สภาพคล่องสูงที่สามารถเปลี่ยนเป็นเงินสดได้ภายใน 1 ปี สำหรับใช้จ่ายและหมุนเวียนธุรกิจ',
      what_is_it_en: 'Liquid resources convertible into cash within one year.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีงบดุลแบบป้อมปราการ (Fortress Balance Sheet)** สภาพคล่องสูงมาก ไม่มีปัญหาเรื่องการชำระหนี้ระยะสั้นแม้เกิดวิกฤตเศรษฐกิจ`,
      interpretation_en: `At **${valStr}**, fortress cash reserves protect against downturns and provide opportunistic firepower.`,
      pros_th: ['พร้อมฉวยโอกาสซื้อกิจการ (M&A) ในช่วงที่ราคาถูก', 'ไม่ต้องพึ่งพาเงินกู้ธนาคารยามดอกเบี้ยแพง'],
      pros_en: ['Provides M&A dry powder during market dips', 'Insulates company from high borrowing rates'],
      benchmark_th: 'Current Ratio > 1.5x - 2.0x ถือว่ามีสภาพคล่องสูงและปลอดภัยมาก',
      benchmark_en: 'Benchmark: Current Ratio > 1.5x - 2.0x ensures robust liquidity coverage',
      watchouts_th: 'การถือเงินสดมากเกินไปโดยไม่นำไปลงทุนอาจทำให้ผลตอบแทนส่วนของผู้ถือหุ้น (ROE) ต่ำลง',
      watchouts_en: 'Excess idle cash drag can dilute overall ROE if not deployed effectively.'
    };
  }

  if (key === 'receivables' || key === 'accounts_receivable') {
    return {
      key,
      name: 'Accounts Receivable',
      name_th: 'ลูกหนี้การค้า (Accounts Receivable)',
      category: 'balance',
      status: 'good',
      status_label_th: 'เก็บเงินได้ตามกำหนด',
      status_label_en: 'Healthy Collection',
      what_is_it_th: 'ยอดเงินที่ลูกค้าติดค้างชำระจากการส่งมอบสินค้าหรือให้บริการไปแล้ว',
      what_is_it_en: 'Money owed to the company by customers for goods/services delivered.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีการขายเชื่ออย่างมีระบบ** สอดคล้องกับขนาดรายได้และการเติบโตของฐานลูกค้า`,
      interpretation_en: `At **${valStr}**, receivables are in line with sales volume and credit collection cycles.`,
      pros_th: ['ช่วยเพิ่มยอดขายด้วยการให้เครดิตเทอมแก่ลูกค้ารายใหญ่ที่มีคุณภาพ'],
      pros_en: ['Facilitates enterprise sales through structured commercial credit terms'],
      benchmark_th: 'ควรโตช้ากว่าหรือใกล้เคียงกับอัตราการเติบโตของยอดขายรวม',
      benchmark_en: 'Receivables growth should not outpace total revenue growth',
      watchouts_th: 'หากลูกหนี้การค้าโตเร็วกว่ายอดขายมากๆ อาจส่งสัญญาณถึงปัญหาการเก็บเงินสดหรือการเร่งยอดขายช่วงปลายไตรมาส',
      watchouts_en: 'Watch if receivables spike faster than revenue, signalling collection delays.'
    };
  }

  if (key === 'total_liabilities' || key === 'current_liabilities' || key === 'long_term_debt' || key === 'short_term_debt') {
    return {
      key,
      name: 'Total Liabilities & Debt',
      name_th: 'หนี้สินรวม & ภาระผูกพัน (Total Liabilities)',
      category: 'balance',
      status: 'good',
      status_label_th: 'หนี้สินอยู่ในระดับปลอดภัย',
      status_label_en: 'Manageable Leverage',
      what_is_it_th: 'ภาระผูกพันทางการเงินทั้งหมดที่บริษัทต้องชำระคืน ทั้งหนี้สินหมุนเวียนและหนี้สินระยะยาว',
      what_is_it_en: 'Aggregate financial obligations owed to external parties and lenders.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **โครงสร้างหนี้สินอยู่ในเกณฑ์ควบคุมได้ดี** ดอกเบี้ยจ่ายไม่เป็นภาระกดดันกระแสเงินสดจากการดำเนินงาน`,
      interpretation_en: `At **${valStr}**, debt obligations remain well within comfortable debt service coverage.`,
      pros_th: ['ไม่มีความเสี่ยงเรื่องการผิดนัดชำระหนี้ (Default Risk)', 'ความคล่องตัวทางการเงินสูง'],
      pros_en: ['Low default risk keeps credit spreads tight', 'High ongoing balance sheet flexibility'],
      benchmark_th: 'D/E Ratio < 1.0x - 1.5x ถือว่ามีความเสี่ยงต่ำและปลอดภัย',
      benchmark_en: 'Rule of thumb: D/E < 1.0x - 1.5x signals conservative balance sheet management',
      watchouts_th: 'ติดตามตารางการครบกำหนดชำระหนี้ (Debt Maturity Profile) ในช่วง 1-2 ปีข้างหน้า',
      watchouts_en: 'Check near-term debt maturity schedules for refinancing requirements.'
    };
  }

  if (key === 'total_equity' || key === 'retained_earnings' || key === 'capital_stock') {
    return {
      key,
      name: 'Stockholders\' Equity',
      name_th: 'ส่วนของผู้ถือหุ้น & กำไรสะสม (Equity & Retained Earnings)',
      category: 'balance',
      status: 'excellent',
      status_label_th: 'ส่วนของทุนเติบโตต่อเนื่อง',
      status_label_en: 'Expanding Equity Base',
      what_is_it_th: 'มูลค่าทางบัญชีสุทธิที่เป็นของเจ้าของ (ผู้ถือหุ้น) หลังจากหักหนี้สินทั้งหมดออกจากสินทรัพย์แล้ว',
      what_is_it_en: 'Net book value attributable to shareholders after all liabilities are settled.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **มูลค่าส่วนของผู้ถือหุ้นสะสมเติบโตอย่างมั่นคง** สะท้อนถึงกำไรสุทธิที่ถูกนำมาทบต้นกลับเข้ามาในกิจการอย่างต่อเนื่อง`,
      interpretation_en: `At **${valStr}**, shareholder equity compounds through retained earnings accumulation.`,
      pros_th: ['เพิ่มมูลค่าทางบัญชีต่อหุ้น (Book Value Per Share) อย่างยั่งยืน'],
      pros_en: ['Steadily enhances tangible book value per share over long horizons'],
      benchmark_th: 'กำไรสะสมควรมีแนวโน้มเพิ่มขึ้นทุกปี บ่งบอกว่าบริษัทมีกำไรต่อเนื่อง',
      benchmark_en: 'Retained earnings should trend upward year-over-year indicating sustained profitability',
      watchouts_th: 'การซื้อหุ้นคืนจำนวนมาก (Buybacks) อาจทำให้ตัวเลข Equity ทางบัญชีลดลง แต่กลับเพิ่มสัดส่วนกำไรต่อหุ้นให้สูงขึ้น',
      watchouts_en: 'Aggressive buybacks may optically lower accounting equity while boosting per-share value.'
    };
  }

  // 6. Cash Flow Items
  if (key === 'ocf' || key === 'operating_cash_flow') {
    return {
      key,
      name: 'Operating Cash Flow',
      name_th: 'กระแสเงินสดจากการดำเนินงาน (Operating Cash Flow - OCF)',
      category: 'cashflow',
      status: 'excellent',
      status_label_th: 'ผลิตเงินสดได้อย่างยอดเยี่ยม (Cash Cow)',
      status_label_en: 'High Cash Generation Power',
      what_is_it_th: 'เงินสดสุทธิที่ไหลเข้าสู่บริษัทจากกิจกรรมการค้าและให้บริการหลักอย่างแท้จริง ไม่รวมการกู้ยืมหรือการซื้อขายสินทรัพย์',
      what_is_it_en: 'Net cash generated from core business operating activities.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **ธุรกิจมีโมเดลสร้างเงินสดที่แข็งแกร่งมาก (Cash Machine)** ลูกค้าจ่ายเงินสดต่อเนื่อง สามารถหล่อเลี้ยงการดำเนินงานได้ด้วยตนเองโดยไม่ต้องพึ่งเงินกู้`,
      interpretation_en: `At **${valStr}**, core operations generate abundant internal cash to self-fund expansion.`,
      pros_th: ['เงินสดจากการดำเนินงานมากกว่ากำไรสุทธิ บ่งบอกถึงคุณภาพกำไรระดับพรีเมียม', 'มีความยืดหยุ่นสูงในการเผชิญวิกฤตเศรษฐกิจ'],
      pros_en: ['OCF exceeding net income confirms premium accounting quality', 'Provides immense resilience during recessions'],
      benchmark_th: 'OCF ควรเป็นบวกและเติบโตสอดคล้องกับกำไรจากการดำเนินงาน',
      benchmark_en: 'OCF should consistently remain positive and track operating income growth',
      watchouts_th: 'ตรวจเช็คเงินทุนหมุนเวียน (Working Capital) ว่ามีเงินจมในลูกหนี้หรือสินค้าคงคลังหรือไม่',
      watchouts_en: 'Inspect working capital changes to verify collections are keeping pace.'
    };
  }

  if (key === 'icf' || key === 'capex' || key === 'investment_purchase') {
    return {
      key,
      name: 'Investing Cash Flow & CapEx',
      name_th: 'กระแสเงินสดจากกิจกรรมลงทุน & CapEx',
      category: 'cashflow',
      status: 'good',
      status_label_th: 'ลงทุนเพื่ออนาคตอย่างต่อเนื่อง',
      status_label_en: 'Strategic Growth Investments',
      what_is_it_th: 'กระแสเงินสดที่ใช้ไปในการซื้อสินทรัพย์ถาวร (CapEx) การลงทุนในโครงการใหม่ และการเข้าซื้อกิจการ',
      what_is_it_en: 'Cash deployed into property, equipment (CapEx), and strategic acquisitions.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทกำลังลงทุนขยายกำลังการผลิตและโครงสร้างพื้นฐานเพื่อสร้างการเติบโตรอบใหม่**`,
      interpretation_en: `At **${valStr}**, capital investments are directed toward expanding infrastructure and technology capacity.`,
      pros_th: ['สร้างความได้เปรียบเชิงแข่งขันและขยายฐานรายได้ในอนาคต'],
      pros_en: ['Strengthens competitive moat and drives multi-year revenue runway'],
      benchmark_th: 'CapEx/Revenue อยู่ในเกณฑ์ที่สมดุล (5–15% สำหรับซอฟต์แวร์/บริการ)',
      benchmark_en: 'CapEx intensity of 5-15% of revenue is standard for software and scalable platforms',
      watchouts_th: 'ติดตามผลตอบแทนจากการลงทุน CapEx ว่าสามารถเปลี่ยนเป็นรายได้และกำไรตามเป้าหรือไม่',
      watchouts_en: 'Verify that CapEx translates into top-line acceleration over subsequent quarters.'
    };
  }

  if (key === 'fcf_financing' || key === 'stock_issuance_repurchase' || key === 'dividends_paid' || key === 'ending_cash') {
    return {
      key,
      name: 'Financing & Capital Return',
      name_th: 'กิจกรรมจัดหาเงิน & การคืนทุนผู้ถือหุ้น (Financing Cash Flow)',
      category: 'cashflow',
      status: 'excellent',
      status_label_th: 'คืนผลตอบแทนสู่ผู้ถือหุ้นต่อเนื่อง',
      status_label_en: 'Active Shareholder Return',
      what_is_it_th: 'กระแสเงินสดที่เกี่ยวข้องกับการเพิ่มทุน/ซื้อหุ้นคืน การชำระหนี้/กู้ยืม และการจ่ายเงินปันผลให้แก่ผู้ถือหุ้น',
      what_is_it_en: 'Cash flow from debt financing, equity issuance, share buybacks, and dividend payouts.',
      interpretation_th: `ที่ระดับ **${valStr}** บ่งบอกว่า **บริษัทมีการบริหารโครงสร้างเงินทุนและคืนผลตอบแทนให้ผู้ถือหุ้นอย่างสม่ำเสมอ** ผ่านการซื้อหุ้นคืนและ/หรือเงินปันผล`,
      interpretation_en: `At **${valStr}**, financing cash flows reflect disciplined capital allocation and shareholder returns.`,
      pros_th: ['การซื้อหุ้นคืนช่วยลดจำนวนหุ้นในตลาดและเร่งการเติบโตของ EPS', 'สะท้อนความมั่นใจของผู้บริหารต่อมูลค่าที่แท้จริงของหุ้น'],
      pros_en: ['Accretive buybacks retire share count, compounding EPS', 'Signals management confidence in intrinsic value'],
      benchmark_th: 'บริษัทที่มีกำไรอิ่มตัวควรมี Financing Cash Flow ติดลบเนื่องจากการจ่ายเงินปันผลและซื้อหุ้นคืน',
      benchmark_en: 'Mature, profitable firms typically show negative financing cash flow due to buybacks and dividends',
      watchouts_th: 'ไม่ควรซื้อหุ้นคืนด้วยเงินกู้ยืมในอัตราดอกเบี้ยสูง ควรใช้กระแสเงินสดอิสระ (FCF) แท้จริงในการซื้อคืน',
      watchouts_en: 'Ensure buybacks are funded from organic FCF rather than expensive debt.'
    };
  }

  // Default Fallback
  return {
    key,
    name: key.replace(/_/g, ' ').toUpperCase(),
    name_th: `รายการ ${key.replace(/_/g, ' ')}`,
    category: 'operating',
    status: 'good',
    status_label_th: 'สถานะปกติ / อยู่ในเกณฑ์ดี',
    status_label_en: 'Normal / Stable',
    what_is_it_th: `ตัวเลขทางการเงินแสดงมูลค่าหรืออัตราส่วนของ ${key.replace(/_/g, ' ')} ตามมาตรฐานบัญชีสากล (US GAAP)`,
    what_is_it_en: `Financial statement metric representing ${key.replace(/_/g, ' ')} under US GAAP standard.`,
    interpretation_th: `ที่ระดับ **${valStr}** สะท้อนถึงการดำเนินงานที่มีเสถียรภาพ ตัวเลขอยู่ในเกณฑ์ที่สอดคล้องกับแผนธุรกิจและโครงสร้างงบการเงินของบริษัท`,
    interpretation_en: `At **${valStr}**, this metric shows stable performance consistent with the company's operating plan.`,
    pros_th: ['ช่วยสะท้อนฐานะการเงินและผลการดำเนินงานที่โปร่งใสและตรวจสอบได้'],
    pros_en: ['Provides verifiable transparency into underlying financial health'],
    benchmark_th: 'เปรียบเทียบกับค่าเฉลี่ยย้อนหลัง 3-5 ปี และค่ากลางของบริษัทคู่แข่งในอุตสาหกรรมเดียวกัน',
    benchmark_en: 'Compare against 3-5 year historical averages and direct industry peer medians',
    watchouts_th: 'ติดตามแนวโน้มความต่อเนื่องในแต่ละไตรมาสเพื่อตรวจจับการเปลี่ยนแปลงอย่างมีนัยสำคัญ',
    watchouts_en: 'Monitor quarterly trends to spot early inflection points.'
  };
}

