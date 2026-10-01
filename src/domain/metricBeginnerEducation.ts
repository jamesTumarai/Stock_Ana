import type { MetricInterpretationContext } from './financialMetricContext';
import type { MetricMeaning } from './financialMetricMeaning';

type Bilingual = { th: string; en: string };
export interface MetricEducation {
  definition: Bilingual;
  measures: Bilingual;
  interpretation: Bilingual;
  companions: { th: string[]; en: string[] };
}
export function formatMetricEducation(education: MetricEducation, language: 'th' | 'en'): string {
  const labels = language === 'th' ? ['ความหมาย', 'วัดอะไร', 'โดยทั่วไป', 'ควรดูคู่กับ'] : ['Meaning', 'What it measures', 'In general', 'View alongside'];
  return [education.definition[language], `${labels[1]}: ${education.measures[language]}`,
    `${labels[2]}: ${education.interpretation[language]}`, `${labels[3]}: ${education.companions[language].join(', ')}`].join('\n\n');
}
export function beginnerMeaningHasTeachingStructure(text: string, language: 'th' | 'en', anchors: string[]): boolean {
  const labels = language === 'th' ? ['วัดอะไร:', 'โดยทั่วไป:', 'ควรดูคู่กับ:'] : ['What it measures:', 'In general:', 'View alongside:'];
  const positions = labels.map(label => text.toLowerCase().indexOf(label.toLowerCase()));
  if (positions.some(position => position < 0) || positions.some((position, i) => i > 0 && position <= positions[i - 1])) return false;
  const parts = [text.slice(0, positions[0]), ...positions.map((position, i) => text.slice(position + labels[i].length, positions[i + 1] ?? text.length))].map(part => part.trim());
  if (parts.some((part, i) => part.length < (i === 3 ? 3 : 20))) return false;
  const definition = anchors.reduce((value, anchor) => value.split(anchor).join(''), parts[0].toLowerCase()).replace(/[\s:,.!?()]/g, '');
  if (definition.length < 15) return false; // A repeated title is not a definition.
  // Teaching contains no company figures, even figures allowed in synthesis.
  if (/(?<![A-Za-z0-9])[-+]?\d/.test(text) || /งวดล่าสุด|ไตรมาสล่าสุด|บริษัทนี้|บริษัทแห่งนี้|this company|latest quarter|current yoy|current quarter/i.test(text)) return false;
  if (/ยิ่งสูงยิ่งดี|สูงกว่าเสมอแล้วดีกว่า|higher is always better|always better when higher/i.test(text)) return false;
  if (language === 'th' && /^(?:ความหมาย:\s*)?(?:top.line acceleration|operating leverage|earnings quality|cash conversion|NOPAT|HQLA)\b/i.test(parts[0])) return false;
  return true;
}
/** Teaching metadata only: no values, formula replacements, eligibility or
 * arithmetic. Adding semantics for an unsupported metric does not register it
 * as a verified/AI-selectable observation. */
export function attachBeginnerEducation(registry: Record<string, MetricMeaning>): void {
  const pair = ([th, en]: readonly [string, string]): Bilingual => ({ th, en });
  const teach = (keys: string, name: string, definition: readonly [string, string], measures: readonly [string, string], interpretation: readonly [string, string], companions: readonly [string, string]) => {
    const education: MetricEducation = { definition: pair(definition), measures: pair(measures), interpretation: pair(interpretation),
      companions: { th: companions[0].split(' | '), en: companions[1].split(' | ') } };
    for (const key of keys.split('|')) registry[key] = { name, education, th: formatMetricEducation(education, 'th'), en: formatMetricEducation(education, 'en') };
  };
  teach('other_income', 'Other Income (Expense), Net',
    ['รายได้ (ค่าใช้จ่าย) อื่นสุทธิคือผลสุทธิของรายการอื่นตามขอบเขตที่งบระบุ ไม่ใช่รายได้ที่ไม่ใช่การดำเนินงานทั้งหมด และไม่รวมดอกเบี้ยที่แยกแสดงอีกแถวโดยอัตโนมัติ', 'Other Income (Expense), Net is the net result of other items within the reported line. It is not the entire non-operating total and does not automatically include separately disclosed interest.'],
    ['บอกผลบวกหรือลบต่อกำไรจากรายการอื่นที่รวมไว้ในบรรทัดนี้ ไม่ใช่ยอดขายหรือเงินสดที่เก็บได้', 'It measures the earnings contribution of the other items included in this line, not sales or collected cash.'],
    ['ค่าบวกช่วยกำไรในงวด ค่าลดหรือติดลบกดดันกำไร แต่ต้องดูส่วนประกอบและความต่อเนื่อง ไม่ถือเป็นความแข็งแรงของธุรกิจหลักทันที', 'A positive amount contributes to period earnings, but composition and recurrence determine its significance for core business quality.'],
    ['กำไรดำเนินงาน | รายได้ดอกเบี้ย | ค่าใช้จ่ายดอกเบี้ย | หมายเหตุรายการอื่น', 'Operating Income | Interest Income | Interest Expense | Other-item Notes']);
  teach('aoci', 'Accumulated Other Comprehensive Income (AOCI)',
    ['กำไร/ขาดทุนเบ็ดเสร็จอื่นสะสมคือยอดสะสมของรายการที่รับรู้ในส่วนของผู้ถือหุ้นนอกกำไรสุทธิ เช่น ผลแปลงค่าเงินหรือผลปรับมูลค่าตามขอบเขตบัญชี ไม่ใช่กำไรสะสม', 'Accumulated Other Comprehensive Income is cumulative equity recognized outside net income, such as translation or valuation effects under the reporting scope. It is not retained earnings.'],
    ['บอกผลสะสมของรายการเบ็ดเสร็จอื่นต่อฐานทุน ไม่ใช่เงินสดพร้อมใช้หรือกำไรจากการขาย', 'It measures accumulated other comprehensive effects on equity, not available cash or sales earnings.'],
    ['การเพิ่มหรือลดต้องดูองค์ประกอบและวิธีบัญชี ไม่ตัดสินว่าธุรกิจดีขึ้นจากเครื่องหมายของยอดนี้', 'An increase or decrease requires component and accounting context; its sign alone does not establish business improvement.'],
    ['ส่วนของผู้ถือหุ้น | กำไรสะสม | กำไรเบ็ดเสร็จอื่น | หมายเหตุทุน', 'Total Equity | Retained Earnings | Other Comprehensive Income | Equity Notes']);
  teach('equity_compensation_and_option_proceeds', 'Stock Option Exercises & Other Stock Issuance Proceeds',
    ['เงินรับจากการใช้สิทธิหุ้นและการออกหุ้นอื่นคือเงินสดจัดหาเงินที่งบรวมไว้ในบรรทัดเดียว ไม่ใช่ค่าใช้จ่ายค่าตอบแทนที่ใช้หุ้น และไม่ใช่เงินจากการใช้สิทธิเพียงอย่างเดียวเมื่อแหล่งข้อมูลรวมหลายรายการ', 'Stock Option Exercises & Other Stock Issuance Proceeds are the combined financing cash receipts reported in this line. They are not stock-based compensation expense or option proceeds alone when other issuance is included.'],
    ['บอกเงินที่กิจการได้รับจากกิจกรรมหุ้นตามขอบเขตที่รายงาน ไม่ใช่กำไรหรือเงินสดดำเนินงาน', 'It measures reported equity-financing cash inflows, not profit or operating cash flow.'],
    ['เงินรับเพิ่มอาจช่วยสภาพคล่องแต่ต้องดูผลเพิ่มจำนวนหุ้นและสิทธิของผู้ถือหุ้น ไม่แยกยอดรวมเป็นองค์ประกอบโดยไม่มีข้อมูล', 'More receipts can support liquidity but must be considered with dilution; a combined line cannot be decomposed without disclosure.'],
    ['จำนวนหุ้น | กำไรต่อหุ้น | ค่าตอบแทนที่ใช้หุ้น | หมายเหตุการออกหุ้น', 'Share Count | EPS | Stock-Based Compensation | Equity-issuance Notes']);
  teach('revenue', 'Revenue',
    ['รายได้คือยอดขายสินค้าและบริการที่นับเป็นรายได้ในงบ ก่อนหักต้นทุนและค่าใช้จ่าย', 'Revenue is recognized sales of goods and services before costs and expenses.'],
    ['บอกขนาดของกิจการและว่าขายได้มากขึ้นหรือน้อยลง แต่ยังไม่บอกว่าเหลือกำไรหรือเก็บเงินได้เท่าไร', 'It measures business scale and sales activity, not the profit retained or cash collected.'],
    ['รายได้โตมักเป็นสัญญาณบวกด้านยอดขาย แต่จะดีต่อผู้ถือหุ้นแค่ไหนต้องดูว่ากำไรและเงินสดโตตามหรือไม่ ตัวเลขนี้อย่างเดียวบอกไม่ได้ว่าโตจากราคา ปริมาณ หรือสินค้าแบบไหน', 'Growing sales can be encouraging, but growth quality depends on margins and operating cash generation. Revenue alone does not identify pricing, volume or mix as its cause.'],
    ['อัตรากำไรขั้นต้น (Gross Margin) | อัตรากำไรดำเนินงาน (Operating Margin) | กระแสเงินสดอิสระ (FCF)', 'Gross Margin | Operating Margin | Free Cash Flow']);
  teach('gross_profit', 'Gross Profit',
    ['กำไรขั้นต้นคือรายได้ที่เหลือหลังหักต้นทุนขายสินค้าและบริการ', 'Gross Profit is revenue remaining after cost of sales.'],
    ['บอกว่าเงินจากการขายเหลือเท่าไรเพื่อจ่ายค่าใช้จ่ายดำเนินงาน ดอกเบี้ย และภาษีต่อไป', 'It measures what sales leave to cover operating expenses, financing and tax.'],
    ['กำไรขั้นต้นเพิ่มมักช่วยให้กิจการรับภาระค่าใช้จ่ายได้ดีขึ้น แต่หากยอดขายโตเร็วกว่ากำไรขั้นต้น อาจเหลือกำไรต่อยอดขายน้อยลง จึงไม่ดูยอดกำไรลำพัง', 'Higher gross profit can help cover other costs, but slower growth than revenue can mean less profit per unit of sales.'],
    ['รายได้ | ต้นทุนขาย | อัตรากำไรขั้นต้น | ค่าใช้จ่ายดำเนินงาน', 'Revenue | Cost of Revenue | Gross Margin | Operating Expenses']);
  teach('gross_margin', 'Gross Margin',
    ['อัตรากำไรขั้นต้นคือส่วนของรายได้ที่เหลือหลังหักต้นทุนขาย ก่อนจ่ายค่าใช้จ่ายดำเนินงาน', 'Gross Margin is gross profit relative to revenue, before operating expenses.'],
    ['บอกว่าสินค้าและบริการที่ขายเหลือกำไรขั้นต้นมากน้อยแค่ไหน เมื่อเทียบกับยอดขาย', 'It measures product or service profit retained per unit of sales.'],
    ['ค่าสูงขึ้นมักหมายถึงเหลือกำไรจากยอดขายมากขึ้น แต่ยังบอกไม่ได้ว่าเกิดจากราคา ต้นทุน หรือส่วนผสมสินค้า และต้องดูว่าค่าใช้จ่ายอื่นเพิ่มตามหรือไม่', 'A higher margin generally leaves more gross profit from sales, but does not establish pricing power or explain the cause of the change.'],
    ['รายได้ | ต้นทุนขาย | อัตรากำไรดำเนินงาน', 'Revenue | Cost of Revenue | Operating Margin']);
  teach('operating_income', 'Operating Income',
    ['กำไรดำเนินงานคือรายได้ที่เหลือหลังต้นทุนขายและค่าใช้จ่ายของธุรกิจหลัก ก่อนดอกเบี้ยและภาษี', 'Operating Income is profit after direct costs and operating expenses, before financing and tax.'],
    ['บอกว่าธุรกิจหลักเหลือกำไรเท่าไร โดยยังไม่ใช่เงินสดที่เก็บได้จริงทั้งหมด', 'It measures core business profit, not operating cash collected.'],
    ['กำไรที่เป็นบวกและเพิ่มอย่างต่อเนื่องมักดีขึ้น แต่ควรดูว่ากำไรโตทันยอดขายหรือไม่ และต้องใช้รายการกับงวดที่เทียบกันได้', 'Positive, persistent growth can be encouraging, but compare it with sales growth and compatible reporting periods.'],
    ['รายได้ | ค่าใช้จ่ายดำเนินงาน | อัตรากำไรดำเนินงาน | เงินสดดำเนินงาน', 'Revenue | Operating Expenses | Operating Margin | Operating Cash Flow']);
  teach('operating_expenses|opex', 'Operating Expenses',
    ['ค่าใช้จ่ายดำเนินงานคือค่าใช้จ่ายในการบริหารและพัฒนาธุรกิจที่ไม่ใช่ต้นทุนขายโดยตรง เช่น วิจัยพัฒนา ค่าใช้จ่ายขายและบริหาร ต้องอ่านขอบเขตที่งบระบุ', 'Operating Expenses are costs to run and develop the business beyond direct product costs, such as research, selling and administration, within the reported scope.'],
    ['บอกว่ากิจการใช้ทรัพยากรในการดำเนินงานมากน้อยเพียงใด เพื่อรองรับยอดขายและความสามารถในอนาคต', 'It measures spending to support ongoing operations and future capabilities.'],
    ['ค่าใช้จ่ายเพิ่มอาจรองรับการเติบโตหรือกดดันกำไรก็ได้ ต้องเทียบว่ารายได้โตทันหรือไม่และเหลืออัตรากำไรเท่าไร ไม่ถือว่าค่าใช้จ่ายน้อยลงดีกว่าเสมอ', 'Higher spending may support growth or pressure profit; compare sales growth and operating margin rather than assuming lower costs are always better.'],
    ['รายได้ | อัตรากำไรดำเนินงาน | วิจัยพัฒนา | ค่าใช้จ่ายขายและบริหาร', 'Revenue | Operating Margin | Research and Development | Selling, General and Administrative Expenses']);
  for (const [key,name,accountTh] of [['change_receivables','Change in Receivables','ลูกหนี้'],['change_inventory','Change in Inventory','สินค้าคงเหลือ'],['change_payables','Change in Payables','เจ้าหนี้']]) {
    teach(key,name,
      [`ผลต่อเงินสดจาก${accountTh}คือรายการปรับกระแสเงินสดดำเนินงานจากการเปลี่ยนแปลง${accountTh} ไม่ใช่ผลต่างยอดบัญชีในงบดุล`, `${name} is the signed operating cash-flow adjustment for the account, not its balance-sheet movement.`],
      [`บอกว่ารายการ${accountTh}ช่วยเพิ่มเงินสดหรือใช้เงินสดในช่วงเวลาที่งบรายงาน โดยเก็บขอบเขตและเครื่องหมายของกระแสเงินสด`, 'It measures whether the reported adjustment contributes or consumes operating cash under the accepted cash-flow scope.'],
      ['ค่าบวกช่วยเพิ่มเงินสด ค่าลบใช้เงินสด แต่ไม่ยืนยันว่าบริหารได้ดีหรือแย่ ต้องดูจังหวะรับจ่าย ยอดขาย และรายการบัญชีที่เกี่ยวข้อง ไม่กลับเครื่องหมายซ้ำ', 'Positive contributes cash and negative consumes cash; neither is automatically good or bad. Assess timing and business context without a second sign inversion.'],
      ['เงินสดดำเนินงาน | รายได้ | ยอดบัญชีที่เกี่ยวข้อง | กำไรสุทธิ', 'Operating Cash Flow | Revenue | Related Account Balance | Net Income']);
  }
  teach('operating_margin|ebit_margin', 'Operating Margin',
    ['อัตรากำไรดำเนินงานคือกำไรจากการดำเนินงานเทียบกับรายได้ หลังหักต้นทุนขายและค่าใช้จ่ายของธุรกิจหลัก', 'Operating Margin is operating income relative to revenue, before financing and tax effects.'],
    ['บอกว่าบริษัทเปลี่ยนยอดขายให้เหลือกำไรจากธุรกิจหลักได้ดีแค่ไหน ไม่ใช่กำไรสุทธิหรือเงินสดที่เก็บได้', 'It measures how efficiently the core business turns sales into operating profit, not net income or cash.'],
    ['ค่าสูงขึ้นและค่อนข้างสม่ำเสมอมักหมายถึงเหลือกำไรต่อยอดขายมากขึ้น แต่ต้องเทียบกับลักษณะธุรกิจและค่าใช้จ่าย การเพิ่มเพียงครั้งเดียวไม่ยืนยันว่าจะรักษาไว้ได้', 'A higher, stable margin generally retains more profit from sales, but sustainability depends on business type and operating expenses.'],
    ['การเติบโตของรายได้ | อัตรากำไรขั้นต้น | ค่าใช้จ่ายดำเนินงาน', 'Revenue Growth | Gross Margin | Operating Expenses']);
  teach('net_income|net_income_cont|net_income_parent|net_income_common', 'Net Income',
    ['กำไรสุทธิคือกำไรที่เหลือหลังต้นทุน ค่าใช้จ่าย ดอกเบี้ย และภาษี โดยรายการของผู้ถือหุ้นแต่ละประเภทต้องแยกให้ตรงชื่อในงบ', 'Net Income is accounting profit after major costs, financing and tax, retaining the selected shareholder-attribution scope.'],
    ['บอกว่าสุดท้ายกิจการหรือผู้ถือหุ้นตามรายการที่เลือกเหลือกำไรเท่าไร แต่กำไรในงบไม่เท่ากับเงินสดที่ได้รับทั้งหมด', 'It measures bottom-line profit, which is not the same as collected cash.'],
    ['กำไรเป็นบวกและโตต่อเนื่องมักเป็นสัญญาณที่ดี แต่ต้องดูว่ามาจากธุรกิจหลักหรือรายการพิเศษ และเปลี่ยนเป็นเงินสดได้หรือไม่', 'Positive, persistent earnings can be encouraging, but assess recurring operations, one-off items and cash generation.'],
    ['กำไรดำเนินงาน | เงินสดดำเนินงาน | กระแสเงินสดอิสระ', 'Operating Income | Operating Cash Flow | Free Cash Flow']);
  teach('eps|eps_diluted', 'Diluted EPS',
    ['กำไรต่อหุ้นปรับลดคือกำไรของหุ้นสามัญที่แบ่งตามจำนวนหุ้นเฉลี่ย โดยคำนึงถึงสิทธิที่อาจทำให้มีหุ้นเพิ่ม', 'Diluted EPS is common earnings per diluted weighted-average share under the reported methodology.'],
    ['บอกกำไรต่อสิทธิความเป็นเจ้าของหนึ่งหุ้น ไม่ใช่เงินสดที่ผู้ถือหุ้นได้รับ', 'It measures earnings per ownership unit, not cash received by shareholders.'],
    ['ค่าสูงขึ้นมักดีต่อกำไรต่อหุ้น แต่เกิดจากกำไรโตหรือจำนวนหุ้นลดก็ได้ จึงต้องแยกผลของธุรกิจออกจากการซื้อหุ้นคืนและการเพิ่มหุ้น', 'Higher EPS can be encouraging, but can reflect either earnings growth or a lower share count.'],
    ['กำไรสุทธิของหุ้นสามัญ | จำนวนหุ้นเฉลี่ย | ค่าตอบแทนที่ใช้หุ้น | การซื้อหุ้นคืน', 'Common Net Income | Weighted-Average Shares | Stock-Based Compensation | Share Repurchases']);
  teach('ocf|operating_cash_flow', 'Operating Cash Flow',
    ['กระแสเงินสดจากการดำเนินงานคือเงินสดสุทธิจากกิจกรรมดำเนินงานตามที่งบรายงาน', 'Operating Cash Flow is net cash from operating activities over the selected period.'],
    ['บอกว่ากิจการเปลี่ยนยอดขายและกำไรในงบเป็นเงินสดได้ดีแค่ไหน หลังผลจากเงินที่ค้างอยู่กับลูกค้า สินค้า และคู่ค้า', 'It measures cash generation after non-cash and working-capital adjustments.'],
    ['เงินสดเป็นบวกและเพิ่มต่อเนื่องมักช่วยรองรับการลงทุนและชำระหนี้ แต่จังหวะรับจ่ายอาจทำให้ผันผวน สำหรับธนาคารต้องแยกผลของสินเชื่อและเงินฝากก่อนตีความ', 'Positive, persistent cash generation can support reinvestment and obligations, but working-capital timing and financial-sector lending/deposit flows require care.'],
    ['กำไรสุทธิ | รายจ่ายฝ่ายทุน (CapEx) | กระแสเงินสดอิสระ (FCF)', 'Net Income | Capital Expenditure | Free Cash Flow']);
  teach('capex', 'Capital Expenditure',
    ['รายจ่ายฝ่ายทุนคือเงินสดที่จ่ายซื้อหรือปรับปรุงสินทรัพย์ถาวรตามขอบเขตที่งบกำหนด', 'Capital Expenditure is cash spent on capital assets under the accepted line scope.'],
    ['บอกว่ากิจการใช้เงินลงทุนกับทรัพยากรที่ช่วยดำเนินธุรกิจมากน้อยแค่ไหน', 'It measures cash committed to maintaining or expanding operating resources.'],
    ['ลงทุนมากขึ้นอาจช่วยให้ธุรกิจเติบโตหรือแค่รักษากำลังผลิตเดิมก็ได้ แต่ทำให้เงินสดที่เหลือลดลง จึงไม่ถือว่าจ่ายมากหรือน้อยดีกว่าเสมอ และต้องอ่านเครื่องหมายเงินจ่ายตามงบ', 'More spending may support growth or maintenance but uses cash; neither higher nor lower spending is inherently better, and the reported outflow sign must be respected.'],
    ['เงินสดดำเนินงาน | สินทรัพย์ถาวร | กระแสเงินสดอิสระ', 'Operating Cash Flow | Property and Equipment | Free Cash Flow']);
  teach('fcf|free_cash_flow', 'Free Cash Flow',
    ['กระแสเงินสดอิสระตามวิธีนี้คือเงินสดดำเนินงานที่เหลือหลังหักเงินสดจ่ายลงทุนในสินทรัพย์ถาวร', 'Free Cash Flow is operating cash flow less the capital expenditure outflow under this methodology.'],
    ['บอกว่าหลังการลงทุน กิจการยังเหลือเงินสดมากน้อยแค่ไหน แต่ไม่ใช่เงินที่แจกจ่ายให้เจ้าของได้ทั้งหมด', 'It measures cash remaining after capital reinvestment, not fully distributable cash.'],
    ['เงินสดเหลือเป็นบวกและสม่ำเสมอมักช่วยลดการพึ่งเงินทุนใหม่ แต่ค่าติดลบอาจมาจากการลงทุนหรือปัญหาเงินสด ต้องดูองค์ประกอบ และไม่ใช้ FCF ทั่วไปเป็นฐานประเมินธนาคาร', 'Positive, steady FCF can reduce external funding needs; negative FCF needs context and is not a generic primary bank valuation measure.'],
    ['เงินสดดำเนินงาน | รายจ่ายฝ่ายทุน | ภาระหนี้', 'Operating Cash Flow | Capital Expenditure | Debt']);
  teach('cash|cash_and_equivalents', 'Cash and Cash Equivalents',
    ['เงินสดและรายการเทียบเท่าเงินสดคือเงินสดและเงินลงทุนที่เข้าเกณฑ์ใกล้เคียงเงินสดตามชื่อรายการในงบ', 'Cash and Cash Equivalents is cash and qualifying near-cash holdings at the balance-sheet date.'],
    ['บอกทรัพยากรเงินสดที่กิจการมีอยู่ ไม่ใช่เงินสดสุทธิหลังหักหนี้ และไม่ได้รวมเงินลงทุนระยะสั้นทุกชนิด', 'It measures cash resources, not net cash after debt or all short-term investments.'],
    ['มีมากขึ้นมักช่วยรับมือรายจ่าย แต่ต้องดูว่าใช้ได้จริงหรือมีข้อจำกัด และเงินสดที่มากเพราะเพิ่งกู้เพิ่มไม่ได้ยืนยันว่าธุรกิจแข็งแรงขึ้น', 'More accessible cash can support payments, but restrictions and debt-funded cash must be considered.'],
    ['หนี้ | เงินสดดำเนินงาน | เงินลงทุนระยะสั้น | รายจ่ายฝ่ายทุน', 'Debt | Operating Cash Flow | Short-Term Investments | Capital Expenditure']);
  teach('short_term_investments', 'Short-Term Investments',
    ['เงินลงทุนระยะสั้นคือเงินที่ลงในสินทรัพย์การเงินตามประเภทและอายุที่ระบุในงบ', 'Short-Term Investments is the reported short-term financial investment balance.'],
    ['บอกเงินที่จัดไว้รับผลตอบแทนและอาจเปลี่ยนเป็นเงินสดได้ แต่ไม่ใช่เงินสดเทียบเท่าทุกรายการ', 'It measures invested liquidity, not automatically cash equivalents.'],
    ['ยอดมากขึ้นอาจเพิ่มเงินสำรองที่นำมาใช้ได้ แต่ต้องดูว่าจะขายหรือถอนทันเมื่อจำเป็นหรือไม่ และมีความเสี่ยงราคาหรือข้อจำกัดอะไร', 'A larger balance may add potential liquidity, subject to market risk, withdrawal timing and restrictions.'],
    ['เงินสด | หนี้ที่ใกล้ครบกำหนด | กระแสเงินสด', 'Cash | Near-Term Debt | Cash Flows']);
  teach('receivables|accounts_receivable', 'Accounts Receivable',
    ['ลูกหนี้การค้าคือเงินที่ลูกค้ายังต้องจ่ายให้กิจการตามมูลค่าที่บันทึกในงบ', 'Accounts Receivable is the reported carrying value of money owed by customers.'],
    ['บอกส่วนของยอดขายที่ยังรอเปลี่ยนเป็นเงินสด จึงเกี่ยวกับความสามารถเก็บเงิน', 'It measures sales awaiting cash collection.'],
    ['ยอดเพิ่มอาจมาจากขายมากขึ้นหรือเก็บเงินช้าลง ต้องเทียบกับยอดขายและระยะเก็บเงิน ไม่ถือว่าลูกหนี้มากเป็นสัญญาณที่ดีเสมอ', 'An increase can reflect more sales or slower collection; compare revenue and collection timing rather than assuming higher is better.'],
    ['รายได้ | ระยะเก็บลูกหนี้ (DSO) | ค่าเผื่อหนี้เสีย | เงินสดดำเนินงาน', 'Revenue | DSO | Credit Loss Allowance | Operating Cash Flow']);
  teach('inventory', 'Inventory',
    ['สินค้าคงเหลือคือวัตถุดิบ งานระหว่างผลิต และสินค้าที่เตรียมขายตามมูลค่าในงบ', 'Inventory is the carrying value of materials, work in progress and goods held for sale.'],
    ['บอกเงินทุนที่ยังผูกไว้กับสินค้าและการผลิต แทนที่จะอยู่ในรูปเงินสด', 'It measures working capital tied up in production and sales.'],
    ['ยอดมากขึ้นอาจรองรับยอดขายหรือเป็นสินค้าที่ขายช้าก็ได้ ต้องดูรายได้และอายุสินค้า โดยเฉพาะธุรกิจผลิตหรือค้าปลีก สำหรับธนาคารมักไม่ใช่ตัวชี้วัดหลัก', 'A higher balance can support sales or reflect slow-moving goods; assess demand evidence and aging rather than treating an increase as good or bad.'],
    ['รายได้ | ต้นทุนขาย | อัตราหมุนเวียนสินค้า | ระยะถือสินค้า (DIO)', 'Revenue | Cost of Sales | Inventory Turnover | DIO']);
  teach('total_assets', 'Total Assets',
    ['สินทรัพย์รวมคือมูลค่าในงบของทรัพยากรทั้งหมดที่กิจการควบคุม ณ วันงบการเงิน', 'Total Assets is the carrying value of controlled resources at the balance-sheet date, not market value.'],
    ['บอกฐานทรัพยากรที่ใช้ดำเนินธุรกิจ เช่น เงินสด สินค้า และทรัพย์สิน ไม่ใช่เงินสดที่ใช้ได้ทั้งหมด', 'It measures the business resource base, not immediately available cash.'],
    ['สินทรัพย์เพิ่มอาจช่วยสร้างยอดขาย แต่ก็อาจมาจากกู้เงินหรือซื้อกิจการ ต้องดูว่าทรัพยากรนั้นสร้างกำไรและเงินสดได้ดีขึ้นหรือไม่', 'More assets may support activity but do not establish better returns; assess how they are funded and used.'],
    ['หนี้สินรวม | ส่วนของผู้ถือหุ้น | รายได้ | ผลตอบแทนสินทรัพย์ (ROA)', 'Total Liabilities | Equity | Revenue | ROA']);
  teach('total_debt|short_term_debt|long_term_debt|long_term_debt_and_finance_leases|current_debt_and_finance_leases|noncurrent_debt_and_finance_leases', 'Debt',
    ['หนี้ในรายการนี้คือเงินกู้และภาระที่นิยามหนี้ของระบบรวมไว้ โดยต้องแยกส่วนระยะสั้น ระยะยาว และสัญญาเช่าให้ตรงชื่อ', 'The selected Debt line retains the accepted interest-bearing debt, finance-lease and maturity scope.'],
    ['บอกภาระจัดหาเงินทุนที่กิจการต้องรับผิดชอบ ไม่ใช่หนี้สินทางบัญชีทุกประเภท', 'It measures funding obligations, not every accounting liability.'],
    ['หนี้มากขึ้นมักเพิ่มภาระดอกเบี้ยและการชำระ แต่จะเสี่ยงแค่ไหนขึ้นกับเงินสด รายได้ และวันครบกำหนด การลดหนี้ก็ต้องดูว่าเหลือเงินพอดำเนินธุรกิจหรือไม่', 'More debt generally adds funding obligations; risk depends on cash generation, interest and repayment timing.'],
    ['เงินสด | ดอกเบี้ย | เงินสดดำเนินงาน | กำหนดชำระหนี้', 'Cash | Interest Expense | Operating Cash Flow | Debt Maturities']);
  teach('total_equity|stockholders_equity|common_equity|preferred_equity|noncontrolling_interest|redeemable_noncontrolling_interest', 'Equity',
    ['ส่วนทุนคือสิทธิในสินทรัพย์สุทธิที่จัดให้เจ้าของตามประเภทที่ระบุในงบ ต้องแยกทุนสามัญ บุริมสิทธิ และส่วนของเจ้าของอื่น', 'The selected Equity line is the book interest allocated to its reported ownership class.'],
    ['บอกฐานทุนทางบัญชีที่รองรับกิจการ ไม่ใช่ราคาหุ้นหรือเงินสดที่เจ้าของถอนออกได้ทันที', 'It measures accounting capital, not market value or withdrawable cash.'],
    ['ฐานทุนมากขึ้นอาจรองรับความเสียหายได้มากขึ้น แต่ต้องดูว่าเพิ่มจากกำไรหรือการออกหุ้น และกิจการใช้ทุนสร้างผลตอบแทนได้ดีหรือไม่', 'More equity may support loss absorption, but compare its source and the earnings generated from that capital.'],
    ['สินทรัพย์ | หนี้สิน | กำไรที่จัดสรร | ผลตอบแทนทุน (ROE)', 'Assets | Liabilities | Attributed Earnings | ROE']);
  teach('current_ratio', 'Current Ratio',
    ['อัตราส่วนสภาพคล่องหมุนเวียนคือสินทรัพย์หมุนเวียนหารด้วยหนี้สินหมุนเวียน ณ วันเดียวกัน', 'Current Ratio divides current assets by current liabilities at the same balance-sheet date.'],
    ['บอกว่าทรัพยากรระยะสั้นมีมากน้อยแค่ไหนเมื่อเทียบกับภาระที่ต้องจ่ายในระยะสั้น', 'It measures short-term resources against near-term obligations.'],
    ['ค่าสูงขึ้นอาจมีทรัพยากรรองรับมากขึ้น แต่สูงมากไม่ได้ดีกว่าเสมอ เพราะอาจเป็นสินค้าที่ขายช้าหรือลูกหนี้ที่เก็บยาก ธนาคารต้องใช้เกณฑ์สภาพคล่องเฉพาะธุรกิจ', 'A higher ratio may add coverage, but is not automatically superior if assets are hard to convert to cash; financial institutions require sector-specific liquidity assessment.'],
    ['เงินสด | ลูกหนี้ | สินค้าคงเหลือ | กระแสเงินสดและจังหวะชำระหนี้', 'Cash | Receivables | Inventory | Operating Cash Flow and Payment Timing']);
  teach('quick_ratio', 'Quick Ratio',
    ['อัตราส่วนสภาพคล่องเร็วตามวิธีนี้ใช้เงินสด เงินลงทุนระยะสั้น และลูกหนี้การค้าเทียบกับหนี้สินหมุนเวียน', 'Quick Ratio compares cash, short-term investments and trade receivables with current liabilities under this methodology.'],
    ['บอกทรัพยากรที่อาจใช้จ่ายภาระใกล้ถึงกำหนดได้ โดยไม่ต้องขายสินค้าคงเหลือก่อน', 'It measures near-term coverage without relying on inventory sales.'],
    ['ค่าสูงขึ้นมักมีทรัพยากรรองรับมากขึ้น แต่ต้องเก็บลูกหนี้และใช้เงินสดได้จริง ไม่ใช้เกณฑ์นี้เป็นตัวหลักของธนาคาร', 'Higher coverage can help if cash is accessible and receivables collectible; it is not a primary bank liquidity measure.'],
    ['เงินสด | เงินลงทุนระยะสั้น | ลูกหนี้ | หนี้สินหมุนเวียน', 'Cash | Short-Term Investments | Receivables | Current Liabilities']);
  teach('debt_to_equity', 'Debt to Equity',
    ['อัตราหนี้ต่อทุนคือหนี้ตามนิยามที่กำหนดเทียบกับส่วนของผู้ถือหุ้น', 'Debt to Equity compares canonical debt with the accepted equity base.'],
    ['บอกว่ากิจการพึ่งเงินกู้มากน้อยแค่ไหนเมื่อเทียบกับทุนเจ้าของ', 'It measures borrowing relative to owner capital.'],
    ['ค่าสูงขึ้นมักพึ่งหนี้มากขึ้น แต่ทุนที่เล็กหรือติดลบอาจทำให้อัตราอ่านได้ยาก ไม่ใช้ค่าตัวเดียวตัดสินความสามารถชำระหนี้', 'A higher ratio usually signals more leverage; a small or negative equity base limits interpretation.'],
    ['ขอบเขตหนี้ | ส่วนของผู้ถือหุ้น | เงินสด | ดอกเบี้ย', 'Debt Scope | Equity | Cash | Interest Expense']);
  teach('roe', 'ROE',
    ['ROE คือกำไรของหุ้นสามัญเทียบกับส่วนของผู้ถือหุ้นสามัญเฉลี่ยตามวิธีคำนวณ', 'ROE compares accepted common earnings with average common equity.'],
    ['บอกว่าทุนของผู้ถือหุ้นสร้างกำไรได้มากน้อยแค่ไหน', 'It measures earnings generated from common shareholder capital.'],
    ['ค่าสูงขึ้นมักใช้ทุนทำกำไรได้ดีขึ้น แต่หนี้เพิ่มหรือฐานทุนลดก็ทำให้ค่าสูงได้ ต้องเทียบวิธีคำนวณและธุรกิจที่ใกล้เคียงกัน', 'Higher ROE may indicate stronger returns, but leverage or a shrinking denominator can raise it without better operating performance.'],
    ['กำไรหุ้นสามัญ | ส่วนผู้ถือหุ้นเฉลี่ย | หนี้ | จำนวนหุ้น', 'Common Net Income | Average Common Equity | Debt | Share Count']);
  teach('roa', 'ROA',
    ['ROA คือกำไรเทียบกับสินทรัพย์เฉลี่ยบนฐานงวดที่เข้ากันได้', 'ROA compares accepted earnings with a compatible average asset base.'],
    ['บอกว่าสินทรัพย์ที่กิจการถืออยู่สร้างกำไรได้ดีแค่ไหน', 'It measures profit generated from the business resource base.'],
    ['ค่าสูงขึ้นมักสร้างกำไรจากฐานสินทรัพย์ได้มากขึ้น แต่ธุรกิจที่ใช้เครื่องจักรมากกับธุรกิจบริการเทียบตรง ๆ ไม่ได้ และต้องดูฐานสินทรัพย์ที่เปลี่ยนด้วย', 'A higher return can be encouraging, but asset composition and capital intensity limit cross-sector comparisons.'],
    ['กำไรสุทธิ | สินทรัพย์เฉลี่ย | อัตรากำไร | อัตราหมุนเวียนสินทรัพย์', 'Net Income | Average Assets | Profit Margin | Asset Turnover']);
  teach('roic', 'ROIC',
    ['ROIC คือกำไรจากธุรกิจหลักหลังภาษีเทียบกับเงินลงทุนเฉลี่ยตามวิธีที่ตรวจสอบได้', 'ROIC compares after-tax operating profit with average invested capital under the accepted methodology.'],
    ['บอกว่ากิจการใช้เงินทุนที่ลงไว้สร้างกำไรจากธุรกิจหลักได้ดีแค่ไหน', 'It measures the efficiency of capital deployed in core operations.'],
    ['ค่าสูงขึ้นมักใช้เงินทุนได้มีประสิทธิภาพขึ้นเมื่อคำนวณแบบเดียวกัน แต่ต้องดูฐานทุนและภาษี หากไม่มีต้นทุนเงินทุนที่ตรวจสอบได้ ยังสรุปไม่ได้ว่าสร้างมูลค่าเหนือทุนหรือไม่', 'Higher consistent ROIC generally improves capital efficiency; without verified cost-of-capital evidence, it does not prove value creation above funding costs.'],
    ['กำไรดำเนินงานหลังภาษี | ฐานเงินลงทุน | รายได้ | ต้นทุนเงินทุนเมื่อมีข้อมูล', 'After-Tax Operating Profit | Invested Capital | Revenue | Verified Cost of Capital']);
  teach('asset_turnover', 'Asset Turnover',
    ['อัตราหมุนเวียนสินทรัพย์คือรายได้เทียบกับสินทรัพย์เฉลี่ยตามวิธีคำนวณ', 'Asset Turnover compares revenue with average assets.'],
    ['บอกว่าทรัพยากรที่กิจการมีสร้างยอดขายได้มากน้อยแค่ไหน', 'It measures sales generated from the asset base.'],
    ['ค่าสูงขึ้นมักสร้างยอดขายจากสินทรัพย์ได้มากขึ้น แต่ไม่ได้แปลว่าเหลือกำไรมากขึ้น และธุรกิจใช้สินทรัพย์ต่างกันจึงไม่เทียบข้ามอุตสาหกรรมลำพัง', 'Higher turnover usually generates more sales per asset, but says nothing by itself about profit retained or cross-sector quality.'],
    ['รายได้ | สินทรัพย์เฉลี่ย | อัตรากำไร | ROA', 'Revenue | Average Assets | Profit Margin | ROA']);
  teach('inventory_turnover', 'Inventory Turnover',
    ['อัตราหมุนเวียนสินค้าคือต้นทุนขายเทียบกับสินค้าคงเหลือเฉลี่ยตามฐานที่กำหนด', 'Inventory Turnover compares cost of sales with average inventory.'],
    ['บอกว่าสินค้าเคลื่อนผ่านกิจการเร็วหรือช้าเพียงใด เป็นจำนวนรอบ ไม่ใช่จำนวนวัน', 'It measures inventory cycling in turns, not days.'],
    ['ค่าสูงขึ้นมักมีสินค้าใช้เวลาค้างน้อยลง แต่สูงมากอาจมีสินค้าไม่พอขาย ต้องดูการส่งมอบและอายุสินค้าด้วย', 'Higher turnover can reduce stock tied up, but excessive turnover may accompany inadequate inventory availability.'],
    ['ต้นทุนขาย | สินค้าคงเหลือเฉลี่ย | DIO | รายได้', 'Cost of Sales | Average Inventory | DIO | Revenue']);
  teach('dso', 'DSO',
    ['DSO คือระยะเวลาเก็บเงินจากลูกหนี้การค้าโดยประมาณ ตามฐานลูกหนี้และรายได้ที่ใช้ในวิธีคำนวณ', 'DSO estimates the collection period for trade receivables using the accepted revenue and receivables basis.'],
    ['บอกว่าเงินจากการขายค้างอยู่กับลูกค้านานแค่ไหน ก่อนกลับมาเป็นเงินสด', 'It measures collection efficiency and capital waiting with customers.'],
    ['จำนวนวันลดลงมักเก็บเงินได้เร็วขึ้น แต่เงื่อนไขเครดิตและฤดูกาลขายอาจทำให้ต่างกัน หากเพิ่มต้องดูว่าเป็นเงื่อนไขปกติหรือเก็บเงินยากขึ้น', 'Fewer days generally indicates faster collection, subject to credit terms, seasonality and comparable period bases.'],
    ['ลูกหนี้การค้า | รายได้ | ค่าเผื่อหนี้เสีย | เงินสดดำเนินงาน', 'Accounts Receivable | Revenue | Credit Loss Allowance | Operating Cash Flow']);
  teach('dio', 'DIO',
    ['DIO คือระยะเวลาที่เงินทุนอยู่ในสินค้าคงเหลือโดยประมาณ ตามสินค้าคงเหลือและต้นทุนขายที่ใช้ในสูตร', 'DIO estimates inventory holding time using accepted inventory and cost-of-sales inputs.'],
    ['บอกว่าสินค้าใช้เวลาค้างอยู่ในกิจการนานแค่ไหน', 'It measures how long working capital is tied up in stock.'],
    ['วันลดลงมักมีเงินผูกกับสินค้าน้อยลง แต่สินค้าอาจไม่พอขาย ส่วนวันเพิ่มอาจเตรียมขายหรือขายช้าก็ได้ ต้องดูหลักฐานความต้องการและอายุสินค้า', 'Fewer days may free capital but can also reduce availability; more days needs demand and aging context.'],
    ['สินค้าคงเหลือ | ต้นทุนขาย | อัตราหมุนเวียนสินค้า | รายได้', 'Inventory | Cost of Sales | Inventory Turnover | Revenue']);
  teach('dpo', 'DPO',
    ['DPO คือระยะเวลาชำระเจ้าหนี้การค้าโดยประมาณ ตามฐานเจ้าหนี้และต้นทุนที่สูตรกำหนด', 'DPO estimates the trade-payable payment period on the accepted payable and cost basis.'],
    ['บอกว่ากิจการใช้เครดิตจากผู้ขายได้นานแค่ไหน ก่อนจ่ายเงินออกไป', 'It measures supplier-credit and payment timing.'],
    ['วันมากขึ้นอาจเก็บเงินสดไว้ได้นานขึ้น แต่ก็อาจเป็นการจ่ายช้าหรือกระทบคู่ค้า ไม่ถือว่าสูงกว่าแล้วดีกว่าเสมอ ต้องดูเงื่อนไขที่ตกลงกัน', 'More days can retain cash longer, but may reflect delayed payments or strain supplier relationships; higher is not always better.'],
    ['เจ้าหนี้การค้า | ต้นทุนขาย | เงื่อนไขคู่ค้า | เงินสดดำเนินงาน', 'Accounts Payable | Cost of Sales | Supplier Terms | Operating Cash Flow']);
  teach('ccc', 'Cash Conversion Cycle',
    ['วงจรเงินสดคือระยะถือสินค้าบวกระยะเก็บลูกหนี้ แล้วหักระยะจ่ายเจ้าหนี้ตามวิธีคำนวณเดียวกัน', 'Cash Conversion Cycle combines inventory and receivable days less payable days.'],
    ['บอกระยะเวลาที่กิจการต้องใช้ทุนรองรับการซื้อและขาย ก่อนเงินกลับเข้ามา', 'It measures the working-capital funding gap across purchase, sale and collection.'],
    ['วงจรสั้นลงมักมีเงินค้างในกิจการน้อยลง แต่ต้องดูว่าเกิดจากเก็บเงินเร็วขึ้น ขายสินค้าเร็วขึ้น หรือแค่จ่ายคู่ค้าช้าลง', 'A shorter cycle can reduce capital tied up, but distinguish faster collection or inventory movement from merely slower supplier payments.'],
    ['DSO | DIO | DPO | เงินสดดำเนินงาน', 'DSO | DIO | DPO | Operating Cash Flow']);
  teach('nim|net_interest_margin_pct', 'Net Interest Margin',
    ['ส่วนต่างดอกเบี้ยสุทธิคือรายได้ดอกเบี้ยหลังต้นทุนแหล่งเงิน เทียบกับสินทรัพย์ที่ก่อรายได้เฉลี่ยตามฐานที่กำหนด', 'Net Interest Margin compares net interest income with average earning assets on the accepted period basis.'],
    ['บอกว่าธนาคารหรือผู้ให้กู้เหลือรายได้ดอกเบี้ยจากการนำเงินทุนไปใช้มากน้อยแค่ไหน', 'It measures bank or lender interest returns after funding costs.'],
    ['ค่าสูงขึ้นมักเหลือรายได้ดอกเบี้ยมากขึ้น แต่ยังไม่หักความเสียหายเครดิตและค่าใช้จ่ายอื่น สินเชื่อเสี่ยงสูงอาจให้ดอกเบี้ยมากแต่ไม่ดีต่อกำไรสุทธิ', 'Higher NIM can improve interest returns, but excludes the full cost of credit risk and operating expenses.'],
    ['รายได้ดอกเบี้ยสุทธิ | ต้นทุนเงินฝาก | คุณภาพสินเชื่อ | สำรองเครดิต', 'Net Interest Income | Deposit Costs | Credit Quality | Credit Loss Provision']);
  teach('cet1_ratio|cet1', 'CET1 Ratio',
    ['CET1 คืออัตราทุนหุ้นสามัญชั้นหลักตามเกณฑ์ผู้กำกับ เทียบกับสินทรัพย์เสี่ยง ไม่ใช่เงินสดในมือ', 'CET1 Ratio compares regulatory common equity tier-one capital with risk-weighted assets.'],
    ['บอกฐานทุนหลักที่ธนาคารใช้รองรับความเสียหายเมื่อความเสี่ยงเกิดขึ้น', 'It measures core capital available to absorb losses.'],
    ['ค่าสูงขึ้นมักมีทุนรองรับมากขึ้น แต่ต้องดูว่าทุนเพิ่มหรือสินทรัพย์เสี่ยงลด และอ่านข้อกำกับของธนาคารนั้น ไม่ใช้เกณฑ์ตัวเลขเดียวกับทุกแห่ง', 'Higher coverage can add a capital buffer, but distinguish capital growth from reduced risk-weighted assets and apply the relevant regulation.'],
    ['ฐานทุน CET1 | สินทรัพย์เสี่ยง | คุณภาพสินเชื่อ | ข้อกำกับที่เกี่ยวข้อง', 'CET1 Capital | Risk-Weighted Assets | Credit Quality | Applicable Regulation']);
  teach('loan_deposit_ratio|loan_to_deposit', 'Loan to Deposit Ratio',
    ['อัตราสินเชื่อต่อเงินฝากคือเงินให้กู้เทียบกับเงินฝากตามขอบเขตที่กำหนด', 'Loan to Deposit Ratio compares accepted loans with deposits.'],
    ['บอกว่าธนาคารนำฐานเงินฝากไปสนับสนุนสินเชื่อมากน้อยแค่ไหน', 'It measures deposit funding deployed into lending.'],
    ['ค่าสูงขึ้นอาจใช้แหล่งเงินฝากปล่อยสินเชื่อมากขึ้น แต่มีเงินรองรับการถอนต่างไป ต้องดูแหล่งทุนอื่นและสภาพคล่อง ไม่ถือว่าสูงหรือดีเสมอ', 'A higher ratio deploys more deposit funding into loans but can change withdrawal coverage; assess alternative funding and liquidity.'],
    ['เงินฝาก | สินเชื่อ | สภาพคล่อง | แหล่งทุนอื่น', 'Deposits | Loans | Liquidity | Alternative Funding']);
  teach('combined_ratio_pct|combined_ratio', 'Combined Ratio',
    ['Combined Ratio คือภาระสินไหมและค่าใช้จ่ายรับประกันเทียบกับเบี้ยประกันตามสูตรที่กำหนด', 'Combined Ratio compares underwriting losses and expenses with the accepted premium basis.'],
    ['บอกว่าธุรกิจประกันใช้รายได้จากเบี้ยไปกับสินไหมและค่าใช้จ่ายมากน้อยแค่ไหน ก่อนผลจากเงินลงทุน', 'It measures underwriting cost relative to premium income, before investment results.'],
    ['ค่าลดลงมักเหลือผลตอบแทนจากการรับประกันมากขึ้น แต่ต้องดูภัยพิบัติ รายการพิเศษ และการปรับสำรอง ไม่เทียบคนละนิยามตรง ๆ', 'Lower costs relative to premiums generally improve underwriting results, subject to catastrophes, exceptional items and reserve changes.'],
    ['เบี้ยประกันรับรู้ | สินไหม | ค่าใช้จ่าย | การพัฒนาสำรอง', 'Earned Premiums | Claims | Expenses | Reserve Development']);
  teach('ffo', 'FFO',
    ['FFO คือกำไรของธุรกิจอสังหาริมทรัพย์ที่ปรับรายการตามนิยามที่ยอมรับ เช่น ค่าเสื่อมอสังหาฯ และผลขายทรัพย์สิน', 'FFO is real-estate earnings adjusted under the accepted FFO definition.'],
    ['ช่วยดูผลประกอบการ REIT โดยลดผลบัญชีบางรายการ แต่ไม่ใช่เงินสดหลังจ่ายค่ารักษาทรัพย์สินทั้งหมด', 'It measures REIT operating performance beyond selected accounting effects, not fully distributable cash.'],
    ['FFO โตอาจมีผลประกอบการดีขึ้น แต่ต้องดูผลต่อหุ้น การออกหุ้น หนี้ และรายจ่ายรักษาทรัพย์สิน ไม่ถือว่ายอดรวมสูงแล้วดีเสมอ', 'Growth can be encouraging, but assess per-share performance, debt and maintenance needs rather than aggregate size alone.'],
    ['NOI | AFFO เมื่อมีข้อมูล | จำนวนหุ้น | หนี้', 'NOI | Accepted AFFO | Share Count | Debt']);
  teach('affo', 'AFFO',
    ['AFFO คือ FFO ที่ปรับรายการเพิ่มเติมตามวิธีที่เปิดเผย เช่น รายจ่ายรักษาทรัพย์สินและผลต่างค่าเช่าตามบัญชี', 'AFFO adjusts FFO further under a disclosed methodology, including applicable maintenance and rent-accounting adjustments.'],
    ['ช่วยดูผลตอบแทนของ REIT หลังรายการที่เกี่ยวกับเงินสดและการรักษาทรัพย์สินมากขึ้น แต่แต่ละบริษัทอาจนิยามต่างกัน', 'It assesses REIT performance after additional cash and property-maintenance adjustments, with company-specific definitions.'],
    ['ค่าที่เติบโตต่อหุ้นอย่างสม่ำเสมออาจดีขึ้น แต่ต้องตรวจรายการปรับก่อนเทียบ ไม่ใช้ AFFO ที่นิยามต่างกันเป็นตัวเดียวกันหรือถือว่าแจกจ่ายได้ทั้งหมด', 'Consistent per-share growth can be encouraging, but definitions must reconcile before comparison and do not prove fully distributable cash.'],
    ['FFO | รายจ่ายรักษาทรัพย์สิน | เงินปันผล | จำนวนหุ้น', 'FFO | Maintenance Expenditure | Dividends | Share Count']);
  teach('noi', 'NOI',
    ['NOI คือรายได้ระดับทรัพย์สินที่เหลือหลังค่าใช้จ่ายดำเนินงานทรัพย์สินตามขอบเขตที่กำหนด', 'NOI is property-level income after accepted property operating expenses.'],
    ['บอกว่าอสังหาฯ สร้างผลตอบแทนจากการดำเนินงานได้มากน้อยแค่ไหน ก่อนภาระระดับกิจการบางชนิด', 'It measures property operating economics, not net shareholder profit.'],
    ['ค่าเพิ่มอาจได้รายได้ค่าเช่าหรือคุมต้นทุนดีขึ้น แต่หากซื้อทรัพย์สินเพิ่มก็ทำให้ยอดรวมโตได้ ต้องเทียบขอบเขตทรัพย์สินเดียวกัน', 'Higher NOI can reflect stronger property results, but acquisitions can increase totals without better same-property performance.'],
    ['รายได้ค่าเช่า | อัตราเช่า | ค่าใช้จ่ายทรัพย์สิน | หนี้', 'Rental Revenue | Occupancy | Property Costs | Debt']);
  teach('occupancy|occupancy_rate_pct', 'Occupancy',
    ['อัตราเช่าคือพื้นที่หรือหน่วยที่มีผู้เช่าเทียบกับฐานพื้นที่หรือหน่วยให้เช่าตามนิยามที่เปิดเผย', 'Occupancy compares occupied space or units with the accepted rentable base.'],
    ['บอกว่าทรัพย์สินถูกใช้สร้างรายได้มากน้อยแค่ไหน โดยต้องแยกพื้นที่ที่มีสัญญาออกจากพื้นที่ที่เก็บค่าเช่าได้จริงเมื่อรายงานต่างกัน', 'It measures property utilization, retaining the distinction between leased space and income-producing occupancy where reported.'],
    ['ค่าสูงขึ้นมักมีพื้นที่ว่างน้อยลง แต่หากลดค่าเช่าหรือให้สิทธิพิเศษมาก รายได้และกำไรอาจไม่ดีขึ้นตาม', 'Higher utilization can help, but concessions or lower rents may limit revenue and profit benefits.'],
    ['รายได้ค่าเช่า | ค่าเช่าต่อหน่วย | NOI | อายุสัญญาเช่า', 'Rental Revenue | Rent per Unit | NOI | Lease Expirations']);
  teach('cash_burn|cash_burn_annual_b|burn_rate', 'Cash Burn',
    ['อัตราใช้เงินสดคือเงินสดที่กิจการใช้สุทธิในช่วงเวลาตามนิยามที่กำหนด ต้องอ่านว่ารวมการลงทุนหรือเฉพาะการดำเนินงาน', 'Cash Burn measures net cash usage over the specified period under a disclosed operating or broader cash-flow scope.'],
    ['บอกความเร็วที่กิจการใช้เงินที่มีอยู่ระหว่างยังสร้างเงินสดไม่พอรายจ่าย', 'It measures the pace at which cash resources are consumed.'],
    ['หากใช้เงินเร็วขึ้นมักเหลือเวลาหาทุนน้อยลง แต่ต้องดูว่าเป็นค่าใช้จ่ายต่อเนื่องหรือการลงทุนครั้งเดียว ไม่ผสมหน่วยรายเดือนกับรายปี', 'Faster burn generally shortens funding time, but distinguish recurring costs from one-off investment and use consistent time units.'],
    ['เงินสดที่ใช้ได้ | เงินสดดำเนินงาน | รายจ่ายฝ่ายทุน | Runway', 'Accessible Cash | Operating Cash Flow | Capital Expenditure | Runway']);
  teach('runway|cash_runway|cash_runway_months', 'Cash Runway',
    ['ระยะเวลาที่เงินสดพอใช้คือเวลาประมาณที่เงินสดที่ใช้ได้จะรองรับการใช้เงินสด ตามสมมติฐานอัตราใช้เงินที่เปิดเผย', 'Cash Runway estimates how long accessible cash can fund usage under a disclosed burn-rate assumption.'],
    ['บอกเวลาที่กิจการอาจมีเพื่อปรับธุรกิจหรือหาเงินทุน ไม่ใช่กำหนดวันที่เงินจะหมดแน่นอน', 'It measures estimated funding time, not a guaranteed cash-exhaustion date.'],
    ['เวลามากขึ้นมักมีพื้นที่รับมือมากขึ้น แต่เป็นค่าที่ขึ้นกับการใช้เงินในอนาคต หนี้ที่ครบกำหนด และเงินสดที่มีข้อจำกัด ต้องไม่ถือว่าอัตราใช้เงินจะคงเดิมเสมอ', 'A longer estimate may add flexibility, but depends on future spending, debt maturities and cash restrictions rather than a constant burn guarantee.'],
    ['เงินสดที่ใช้ได้ | Cash Burn | หนี้ใกล้ครบกำหนด | ภาระลงทุน', 'Accessible Cash | Cash Burn | Near-Term Debt | Investment Commitments']);

  // Existing accounting-line definitions stay authoritative. Split their
  // definition and business role, then add an explicit conditional direction.
  for (const [key, meaning] of Object.entries(registry)) {
    if (meaning.education) continue;
    const thParts = meaning.th.split(' นักลงทุนควรพิจารณาร่วมกับ');
    const enParts = meaning.en.split(' Investors compare ');
    const thSentences = thParts[0].split(/\.\s*/).filter(Boolean);
    const enSentences = enParts[0].match(/[^.]+\.?/g)?.map(text => text.trim()) || [enParts[0]];
    const companionsTh = thParts[1]?.split(' เพื่อประเมิน')[0] || 'รายการที่เกี่ยวข้องในงบและกระแสเงินสด';
    const companionsEn = enParts[1]?.split(' to assess')[0] || 'Related statement items and cash flows';
    const education: MetricEducation = {
      definition: { th: thSentences[0], en: enSentences[0] },
      measures: { th: thSentences.slice(1).join('. ') || 'ช่วยอธิบายส่วนที่รายการนี้มีต่อทรัพยากร ภาระ หรือผลประกอบการตามขอบเขตในงบ', en: enSentences.slice(1).join(' ') || 'It describes this reported line’s role in resources, obligations or performance.' },
      interpretation: directionForAccountingLine(key),
      companions: { th: [companionsTh], en: [companionsEn] },
    };
    meaning.education = education;
    meaning.th = formatMetricEducation(education, 'th'); meaning.en = formatMetricEducation(education, 'en');
  }
}

function directionForAccountingLine(key: string): Bilingual {
  if (/expense|cogs|cost|tax/.test(key)) return { th: 'ยอดมากขึ้นมักมีภาระตามรายการนี้มากขึ้น แต่ต้องเทียบกับรายได้และขอบเขตค่าใช้จ่าย การจ่ายน้อยลงไม่จำเป็นต้องดีหากกระทบธุรกิจ', en: 'A larger amount can add the reported cost burden; compare revenue and cost scope rather than treating lower spending as always better.' };
  if (/cash|investments/.test(key)) return { th: 'ยอดเพิ่มหรือลดต้องอ่านว่าเป็นเงินคงเหลือ เงินรับ หรือเงินจ่ายก่อน เงินมากขึ้นอาจช่วยรองรับรายจ่าย แต่ต้องดูข้อจำกัดและแหล่งที่มาด้วย', en: 'Read whether the line is a balance, inflow or outflow before interpreting direction; liquidity benefits depend on restrictions and funding sources.' };
  if (/liabilit|payable|debt|lease/.test(key)) return { th: 'ภาระที่มากขึ้นอาจต้องใช้เงินจ่ายมากขึ้น แต่ต้องแยกยอดคงเหลือออกจากเงินรับจ่าย และดูวันครบกำหนด ไม่ตัดสินจากยอดเดียว', en: 'Larger obligations may require more funding, but distinguish balances from payments and assess maturity timing.' };
  if (/equity|stock|capital|earnings|aoci|interest/.test(key)) return { th: 'ยอดที่มากขึ้นต้องดูว่าเกิดจากกำไร การเพิ่มทุน หรือรายการปรับมูลค่า ไม่ใช่เงินสดที่ใช้ได้เพิ่มเสมอ และต้องแยกประเภทเจ้าของให้ตรงกับรายการ', en: 'An increase must be traced to earnings, funding or value adjustments; it is not automatically more available cash, and ownership scope matters.' };
  if (/depreciation|amortization|non_cash|change_/.test(key)) return { th: 'ยอดมากขึ้นสะท้อนผลตามรายการปรับงบ ไม่ใช่เงินสดรับหรือจ่ายทุกกรณี ต้องอ่านเครื่องหมายและดูรายการต้นทางก่อนสรุปว่าดีขึ้นหรือแย่ลง', en: 'A larger adjustment is not automatically a cash receipt or payment; assess signs and the underlying reported items before judging direction.' };
  return { th: 'ค่าที่เพิ่มหรือลดไม่ใช่ข้อสรุปว่าธุรกิจดีหรือแย่โดยตัวมันเอง ต้องเทียบงวดและขอบเขตเดียวกัน แล้วดูรายการที่เกี่ยวข้องว่าช่วยสร้างกำไรหรือเงินสดได้หรือไม่', en: 'An increase or decrease alone does not establish improvement; use compatible periods and line scope, then assess the related earnings or cash effects.' };
}

export function beginnerMeaningForContext(context: MetricInterpretationContext, registry: Record<string, MetricMeaning>): Bilingual {
  const meaning = registry[context.metricKey];
  const basic = meaning?.education ? { th: formatMetricEducation(meaning.education, 'th'), en: formatMetricEducation(meaning.education, 'en') } : {
    th: `${context.metricNameTh} ต้องอ่านตามขอบเขตรายการและวิธีคำนวณในงบ\n\nวัดอะไร: บอกข้อมูลเฉพาะส่วนที่รายการนี้กำหนด ยังไม่มีนิยามที่ตรวจสอบได้พอจะอธิบายละเอียด\n\nโดยทั่วไป: ยังไม่สรุปว่าค่าสูงหรือต่ำดีกว่า ควรตรวจวิธีคำนวณก่อน\n\nควรดูคู่กับ: รายการต้นทางและคำอธิบายงบ`,
    en: `${context.metricName} must retain its reported scope and methodology.\n\nWhat it measures: The selected line’s specified scope; verified educational metadata is limited.\n\nIn general: No higher/lower judgment is established without its methodology.\n\nView alongside: Source line items and filing notes.`,
  };
  const financial = ['bank', 'lender', 'insurer', 'asset_manager', 'broker_exchange'].includes(context.businessArchetype);
  const sectorSpecific = /^(nim|net_interest_margin_pct|cet1|tier1|loan_deposit|loan_to_deposit)/.test(context.metricKey) ? ['bank', 'lender']
    : /^(combined_ratio|net_premiums|loss_reserve)/.test(context.metricKey) ? ['insurer']
    : /^(ffo|affo|noi|occupancy)/.test(context.metricKey) ? ['reit'] : undefined;
  const limited = context.isFinancialSectorGuardActive || context.applicability === 'CONTEXT_ONLY' || context.applicability === 'NOT_MEANINGFUL_FOR_PRIMARY_INTERPRETATION'
    || financial && context.metricKey === 'inventory' || sectorSpecific && !sectorSpecific.includes(context.businessArchetype);
  if (limited) return { th: `${basic.th}\n\nบริบทธุรกิจ: สำหรับ${context.archetypeLabelTh} รายการนี้อาจไม่ใช่ตัวชี้วัดหลัก ต้องดูเกณฑ์เฉพาะธุรกิจและวิธีคำนวณ ไม่ใช้ตัดสินลำพัง`,
    en: `${basic.en}\n\nBusiness context: This may not be a primary measure for ${context.archetypeLabelEn}; retain sector-specific methodology and do not assess it alone.` };
  return basic;
}
