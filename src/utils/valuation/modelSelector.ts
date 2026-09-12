import { 
  ValuationModelType, 
  ModelSelectorResult, 
  ReportData 
} from '../../types';

/**
 * Intelligent Model Selector that routes any stock to the most appropriate
 * valuation methodology based on Sector, Industry, FCF health, and Lifecycle.
 */
export function detectValuationModel(data?: Partial<ReportData>, ticker?: string): ModelSelectorResult {
  const symbol = (ticker || data?.ticker || 'STOCK').toUpperCase();
  const profile = data?.company_profile;
  const sector = (profile?.sector || profile?.overview?.country || '').toLowerCase();
  const industry = (profile?.industry || profile?.overview?.description || '').toLowerCase();
  const businessSummary = (profile?.description || profile?.overview?.description || data?.comprehensive_analysis?.business_overview || '').toLowerCase();
  const cf = data?.financial_statements?.cash_flow;

  // 1. Check FinTech & Digital Banking (e.g., SOFI, NU, HOOD, COIN, AFRM, UPST, PYPL, SQ, XYZ)
  const isFintechOrDigitalBank = 
    ['SOFI', 'NU', 'HOOD', 'COIN', 'AFRM', 'UPST', 'PYPL', 'SQ', 'XYZ', 'LC'].includes(symbol) ||
    industry.includes('financial technology') ||
    industry.includes('fintech') ||
    industry.includes('digital bank') ||
    industry.includes('consumer finance') ||
    industry.includes('credit services') ||
    industry.includes('digital brokerage') ||
    businessSummary.includes('fintech') ||
    businessSummary.includes('digital banking') ||
    businessSummary.includes('financial technology') ||
    (sector.includes('financial') && (businessSummary.includes('platform') || businessSummary.includes('technology') || industry.includes('technology')));

  if (isFintechOrDigitalBank) {
    return {
      model_type: 'fintech_pe',
      model_name_th: 'FinTech Platform & Residual Income (Forward P/E & Platform DCF)',
      model_name_en: 'FinTech Platform & Residual Income Model',
      sector_category: 'สถาบันการเงินดิจิทัล / FinTech (Digital Banking & FinTech)',
      reason_th: 'ธนาคารดิจิทัลและ FinTech ระดมเงินฝากและวงเงินเครดิตเพื่อใช้เป็นวัตถุดิบในการปล่อยสินเชื่อ ไม่ใช่ภาระหนี้สินทางการเงิน (Financial Leverage) แบบบริษัททั่วไป การหักหนี้สินเงินฝากออกตรงๆ จะทำให้มูลค่ากิจการต่ำกว่าความเป็นจริงอย่างรุนแรง และเนื่องจากบริษัทอยู่ในช่วงขยายฐานลูกค้าจึงยังไม่จ่ายปันผล (DDM จึงประเมินได้ $0 หรือต่ำเกินไป) โมเดลที่เหมาะสมที่สุดคือ Forward P/E & PEG Multiple ควบคู่กับ Platform Net Margin DCF',
      reason_en: 'Digital banks and FinTech lenders utilize customer deposits and warehouse credit facilities as operating inventory, not corporate leverage. Subtracting deposits as debt severely distorts equity value, while zero dividends render classic DDM ineffective. Forward P/E, PEG, and Platform Residual Income DCF are the industry standards.',
      alternative_models: ['relative_only', 'dcf_multistage'],
      disclaimer_note: 'ประเมินมูลค่าตามส่วนของผู้ถือหุ้น (Cost of Equity) โดยไม่นำเงินฝากและวงเงินเครดิตมาหักลบเป็นหนี้สินทางการเงิน',
      canonical_status: 'sourced_non_canonical'
    };
  }

  // 2. Check Financial Institutions (Commercial Banks, Insurance, Asset Management)
  const isBankOrInsurance = 
    sector.includes('financial') || 
    sector.includes('bank') || 
    sector.includes('insurance') ||
    industry.includes('bank') ||
    industry.includes('insurance') ||
    industry.includes('capital market') ||
    ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BBL', 'KBANK', 'SCB', 'KTB', 'TTB', 'AIA', 'BAM', 'BRK.A', 'BRK.B', 'MET', 'PRU', 'PGR', 'TRV', 'ALL'].includes(symbol);

  if (isBankOrInsurance) {
    return {
      model_type: 'ddm',
      model_name_th: 'Dividend Discount Model (DDM) & Residual Income',
      model_name_en: 'Dividend Discount Model & Residual Income',
      sector_category: 'สถาบันการเงิน / ประกันภัย (Financial Institutions & Insurance)',
      reason_th: 'หนี้สินและเงินฝากเป็นวัตถุดิบในการดำเนินธุรกิจของธนาคารและสถาบันการเงิน (รวมถึงเงินสำรองประกันภัย Float) ไม่ใช่ภาระหนี้ (Leverage) แบบบริษัททั่วไป การนิยาม Free Cash Flow แบบมาตรฐานจึงไม่สะท้อนมูลค่าที่แท้จริง DDM และ Residual Income จึงเป็นวิธีมาตรฐานสากลที่เหมาะสมที่สุด',
      reason_en: 'Debt, deposits, and insurance float serve as raw operating material. Standard Free Cash Flow is non-applicable; DDM and Residual Income are the industry standards.',
      alternative_models: ['relative_only'],
      disclaimer_note: 'ประเมินมูลค่าตามส่วนของผู้ถือหุ้น (Cost of Equity) โดยอิงอัตราเงินปันผลจ่ายและผลตอบแทนส่วนของผู้ถือหุ้น (ROE)',
      canonical_status: 'sourced_non_canonical'
    };
  }

  // 2. Check Real Estate Investment Trusts (REITs) & Real Estate Operating Companies
  const isReit = 
    sector.includes('real estate') || 
    industry.includes('reit') ||
    industry.includes('real estate investment trust') ||
    businessSummary.includes('reit') ||
    ['PLD', 'AMT', 'EQIX', 'SPG', 'O', 'PSA', 'CCI', 'CPNREIT', 'WHART', 'FTREIT', 'TLGF'].includes(symbol);

  if (isReit) {
    return {
      model_type: 'reit_affo',
      model_name_th: 'FFO / AFFO Multiple & Cash Yield Valuation',
      model_name_en: 'FFO / AFFO Multiple Valuation',
      sector_category: 'กองทรัสต์เพื่อการลงทุนในอสังหาริมทรัพย์ (REITs)',
      reason_th: 'อสังหาริมทรัพย์มีค่าเสื่อมราคาทางบัญชี (Depreciation) สูงมาก ทำให้กำไรสุทธิ (Net Income) และ FCF บิดเบือนต่ำกว่าความเป็นจริง จึงต้องใช้ Adjusted Funds From Operations (AFFO) เพื่อสะท้อนกระแสเงินสดที่แท้จริงจากค่าเช่า',
      reason_en: 'High non-cash depreciation distorts Net Income and standard FCF. AFFO reflects true recurring cash generation from real estate assets.',
      alternative_models: ['ddm'],
      disclaimer_note: 'ประเมินตามกลุ่มย่อยของสินทรัพย์ (Sub-Sector Multiple) เช่น Data Center, Industrial, หรือ Retail',
      canonical_status: 'sourced_non_canonical'
    };
  }

  // 3. Check Negative Gross Margin / Negative FCF / Pre-Revenue / Early Stage Growth
  const inc = data?.financial_statements?.income_statement;
  const grossMarginArr = (inc?.gross_margin_pct || []).filter(v => typeof v === 'number');
  const isNegativeGrossMargin = grossMarginArr.length > 0 && grossMarginArr[grossMarginArr.length - 1] < 0;

  const fcfArr = (cf?.free_cash_flow || []).filter(v => v !== null && v !== undefined).map(Number);
  const isConsecutiveNegativeFcf = fcfArr.length >= 2 && fcfArr.every(v => v < 0);
  const isSpaceOrHeavyTechGrowth = 
    ['RKLB', 'ASTS', 'LUNR', 'RDW', 'SPCE', 'PL'].includes(symbol) ||
    (industry.includes('space') && !['LMT', 'BA', 'NOC', 'RTX', 'GD'].includes(symbol));

  const isPreRevenueOrEarlyLoss = 
    isNegativeGrossMargin ||
    isConsecutiveNegativeFcf || 
    isSpaceOrHeavyTechGrowth ||
    ['RIVN', 'LCID', 'PLUG', 'QS', 'JOBY', 'ACHR', 'EOSE'].includes(symbol);

  if (isPreRevenueOrEarlyLoss) {
    const isSpace = isSpaceOrHeavyTechGrowth || symbol === 'RKLB';
    return {
      model_type: 'relative_only',
      model_name_th: isSpace 
        ? 'EV/Sales & Backlog Relative Valuation (กลุ่มอวกาศและเทคโนโลยีขั้นสูง)' 
        : 'Relative Valuation Only (EV/Sales & Comparable Multiples)',
      model_name_en: isSpace 
        ? 'EV/Sales & Backlog Relative Valuation (Space & Advanced Tech)' 
        : 'Relative Valuation Only (EV/Revenue Multiples)',
      sector_category: isSpace 
        ? 'เทคโนโลยีอวกาศระยะลงทุนสูง (Pure-play Space & Orbital Tech)' 
        : 'หุ้นระยะเริ่มต้น / กระแสเงินสดยังติดลบ (Early-Stage / Pre-Cash Flow)',
      reason_th: isSpace
        ? 'บริษัทอยู่ในระยะลงทุนสร้างโครงสร้างพื้นฐานและวิจัยจรวด/ดาวเทียม (เช่น จรวด Neutron) ทำให้กระแสเงินสดอิสระ (FCF) ปัจจุบันยังติดลบ การใช้สูตร DCF 5 ปีทั่วไปจะทำให้ได้มูลค่า $0.01 (ไม่สะท้อนมูลค่าจริง) วอลล์สตรีทและนักวิเคราะห์สถาบันจึงใช้ Relative Valuation อิง EV/Sales Multiple และมูลค่าสัญญา Backlog เป็นวิธีมาตรฐาน'
        : 'บริษัทมีกระแสเงินสดอิสระ (FCF) ติดลบต่อเนื่องหรือยังอยู่ในช่วงลงทุนหนัก ทำให้สมมติฐาน Terminal Value ในโมเดล DCF มีความไม่แน่นอนสูง จึงประเมินด้วยวิธีเปรียบเทียบเชิงสัมพัทธ์ (Relative Valuation) เทียบกับกลุ่มบริษัทในระยะการเติบโตเดียวกัน',
      reason_en: isSpace
        ? 'Company is in heavy CAPEX and R&D phase (e.g. Neutron rocket & satellite constellations) with negative current FCF. Naive DCF collapses to $0.01. Wall Street benchmarks pure-play space tech using EV/Sales multiples and order backlog.'
        : 'Consistent negative FCF breaks Terminal Value reliability in DCF models. Relative Valuation based on EV/Sales is standard for this stage.',
      alternative_models: ['dcf_multistage'],
      disclaimer_note: isSpace
        ? 'ประเมินด้วย Forward EV/Sales Multiple เทียบกับกลุ่ม Aerospace & Space Tech ชั้นนำ และสะท้อนมูลค่าสัญญา Backlog จากภาครัฐและเอกชน'
        : 'คำเตือน: หุ้นนี้ยังไม่มีกระแสเงินสดอิสระที่มั่นคง การประเมินด้วย Relative Valuation มีความผันผวนและความไม่แน่นอนสูงกว่าปกติ',
      canonical_status: 'sourced_non_canonical'
    };
  }

  // 4. Check Cyclical Industries (Energy, Mining, Shipping, Airlines, Commodity Chemicals)
  const isCyclical = 
    sector.includes('energy') || 
    sector.includes('basic materials') ||
    industry.includes('oil') ||
    industry.includes('gas') ||
    industry.includes('mining') ||
    industry.includes('metal') ||
    industry.includes('shipping') ||
    industry.includes('airline') ||
    ['XOM', 'CVX', 'PTT', 'PTTEP', 'VALE', 'BHP', 'RIO', 'DAL', 'UAL', 'ZIM', 'SCGP', 'IVL'].includes(symbol);

  if (isCyclical) {
    return {
      model_type: 'dcf_cyclical',
      model_name_th: 'Through-Cycle Normalized DCF (โมเดลปรับค่าเฉลี่ยวัฏจักร)',
      model_name_en: 'Through-Cycle Normalized DCF',
      sector_category: 'กลุ่มสินค้าโภคภัณฑ์และวัฏจักรเศรษฐกิจ (Cyclical / Commodity)',
      reason_th: 'รายได้และอัตรากำไรของธุรกิจแกว่งตัวรุนแรงตามรอบราคาสินค้าโภคภัณฑ์ การใช้ผลการดำเนินงานไตรมาสล่าสุดตรง ๆ จะประเมินมูลค่าสูงหรือต่ำเกินจริง จึงต้องใช้ Normalized Operating Margin เฉลี่ยย้อนหลังทั้งวัฏจักร (7-10 ปี)',
      reason_en: 'Cash flows fluctuate widely with commodity price cycles. A full-cycle normalized margin (7-10 years) avoids overvaluing at peaks or undervaluing at troughs.',
      alternative_models: ['dcf_standard', 'relative_only'],
      disclaimer_note: 'คำนวณสมมติฐาน Bear/Base/Bull ตามสถานการณ์อุปสงค์และราคาสินค้าโภคภัณฑ์ในแต่ละช่วงวัฏจักร',
      canonical_status: 'sourced_non_canonical'
    };
  }

  // 5. Check Super Growth / Long Runway Tech / Disruptive Platforms
  const revGrowthLatest = data?.financial_statements?.income_statement?.yoy_revenue_growth_pct?.[0];
  const isSuperGrowth = 
    (typeof revGrowthLatest === 'number' && revGrowthLatest >= 25) ||
    ['TSLA', 'NVDA', 'PLTR', 'SNOW', 'CRWD', 'ARM', 'NET', 'DDOG'].includes(symbol);

  if (isSuperGrowth) {
    return {
      model_type: 'dcf_multistage',
      model_name_th: 'Multi-Stage Dynamic DCF (โมเดล 4-Stage สำหรับหุ้น Super Growth)',
      model_name_en: 'Multi-Stage DCF (4-Stage Long Runway)',
      sector_category: 'เทคโนโลยีและการเติบโตสูง (Super Growth / Disruptive Tech)',
      reason_th: 'บริษัทมีอัตราการเติบโตสูงและมีตลาดเป้าหมายขนาดใหญ่ (TAM) เส้นทางการเติบโตจึงแบ่งเป็นหลายระยะ (High Growth -> Transition Phase -> Mature Phase -> Terminal) โมเดล 4-Stage จึงสะท้อนพลวัตการชะลอตัวของอัตราเติบโตได้แม่นยำกว่า',
      reason_en: 'High growth with a long addressable market runway requires a multi-stage fade model to accurately simulate growth deceleration over time.',
      alternative_models: ['dcf_standard', 'relative_only'],
      disclaimer_note: 'ปรับจำลองความอ่อนไหว (Sensitivity) ของอัตราคิดลด WACC และ Terminal Growth ได้อย่างละเอียด',
      canonical_status: 'canonical_dcf'
    };
  }

  // 6. Check Mature / Stable Cash Cow / Regulated Utilities & Telecoms
  const isMatureValue = 
    sector.includes('utilities') || 
    sector.includes('telecommunication') || 
    industry.includes('utility') ||
    industry.includes('electric') ||
    industry.includes('water') ||
    industry.includes('telecom') ||
    ['KO', 'PG', 'SO', 'NEE', 'DUK', 'EGCO', 'RATCH', 'TTW', 'T', 'VZ', 'ADVANC', 'TRUE'].includes(symbol);

  if (isMatureValue) {
    return {
      model_type: 'dcf_gordon',
      model_name_th: '1-2 Stage Gordon Growth DCF (สำหรับหุ้นมั่นคง ปันผลสม่ำเสมอ)',
      model_name_en: 'Gordon Growth / 2-Stage DCF',
      sector_category: 'สาธารณูปโภคและธุรกิจมั่นคง (Mature / Stable Cash Cow)',
      reason_th: 'บริษัทมีกระแสเงินสดและฐานลูกค้าเสถียรมาก อัตราการเติบโตอยู่ในระดับใกล้เคียง GDP การใช้โมเดล Multi-stage ที่ซับซ้อนเกินจำเป็นจะเพิ่ม Noise มากกว่าความแม่นยำ จึงใช้ Gordon Growth / 2-Stage Fade DCF',
      reason_en: 'Stable cash flows growing near GDP pace are best valued with Gordon Growth or 2-Stage DCF, avoiding unnecessary complexity.',
      alternative_models: ['ddm', 'dcf_standard'],
      disclaimer_note: 'เน้นความมั่นคงของกระแสเงินสดและผลตอบแทนเงินปันผล',
      canonical_status: 'canonical_dcf'
    };
  }

  // 7. Standard 3-Stage DCF for General Growth & Broad Market
  return {
    model_type: 'dcf_standard',
    model_name_th: 'Standard 3-Stage DCF (FCFF / FCFE)',
    model_name_en: 'Standard 3-Stage DCF',
    sector_category: 'ธุรกิจเติบโตทั่วไป (General Growth & Commercial)',
    reason_th: 'บริษัทมีกระแสเงินสดอิสระ (FCF) เป็นบวกและมีโครงสร้างธุรกิจที่เติบโตต่อเนื่อง โมเดลมาตรฐาน 3-Stage DCF สามารถสะท้อนมูลค่ากิจการได้อย่างสมดุลและครอบคลุมทั้งช่วงขยายตัวและช่วงเติบโตเต็มที่',
    reason_en: 'Positive and consistent FCF allows standard 3-Stage DCF modeling across high-growth, fade, and terminal steady states.',
    alternative_models: ['relative_only', 'dcf_gordon'],
    disclaimer_note: 'ประเมินมูลค่าด้วยกระแสเงินสดอิสระคิดลดด้วยต้นทุนเงินทุนเฉลี่ยถ่วงน้ำหนัก (WACC)',
    canonical_status: 'canonical_dcf'
  };
}
