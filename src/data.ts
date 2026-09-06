import { AnalysisReport, RawAnalysisReport } from './types';

export function transformReport(raw: RawAnalysisReport): AnalysisReport {
  return {
    generated_at: raw.generated_at || new Date().toISOString(),
    ticker: raw.ticker || 'UNKNOWN',
    summary: raw.summary || (raw.verdict?.summary || ''),
    as_of_date: raw.as_of_date || new Date().toISOString().split('T')[0],
    analysis_type: raw.analysis_type || 'combined',
    verdict: raw.verdict,
    comprehensive_analysis: raw.comprehensive_analysis,
    technical_analysis: raw.technical_analysis,
    financial_statements: raw.financial_statements,
    valuation_ratios: raw.valuation_ratios,
    valuation_percentile_chart: raw.valuation_percentile_chart,
    valuation_dashboard: raw.valuation_dashboard,
    intrinsic_value: raw.intrinsic_value,
    earnings_analysis: raw.earnings_analysis,
    forecast_dashboard: raw.forecast_dashboard,
    peer_comparison: raw.peer_comparison,
    catalysts_and_events: raw.catalysts_and_events,
    insider_activity: raw.insider_activity,
    smart_money: raw.smart_money,
    corporate_actions: raw.corporate_actions,
    company_profile: raw.company_profile,
    business_analysis: raw.business_analysis,
    five_pillars: raw.five_pillars,
    deep_insights: raw.deep_insights,
    findings: raw.findings,
    financial_charts: raw.financial_charts,
    final_report: raw.final_report,
    chartImage: raw.chartImage,
  };
}

export const samplePltrReport: AnalysisReport = {
  generated_at: '2026-09-01T08:30:00Z',
  ticker: 'PLTR',
  summary: 'Palantir Technologies Inc. แสดงการเติบโตของรายได้ระดับสูง (+93% YoY) ขับเคลื่อนด้วยแพลตฟอร์ม AIP ควบคู่กับอัตรากำไรขยายตัวอย่างโดดเด่นและงบดุลไร้หนี้สิน อย่างไรก็ตาม Valuation อยู่ในระดับพรีเมียมสูงมาก',
  as_of_date: '2026-09-01',
  analysis_type: 'combined',
  verdict: {
    summary: 'Palantir Technologies Inc. แสดงการเติบโตของรายได้ระดับสูง (+93% YoY) ขับเคลื่อนด้วยแพลตฟอร์ม AIP ควบคู่กับอัตรากำไรขยายตัวอย่างโดดเด่นและงบดุลไร้หนี้สิน อย่างไรก็ตาม Valuation อยู่ในระดับพรีเมียมสูงมาก',
    conviction_score: 85,
    key_takeaways: [
      '**การเติบโตของ US Commercial:** เติบโตก้าวกระโดดกว่า 93% YoY จากความต้องการนำ AI Agent ไปใช้งานจริงในระดับองค์กร',
      '**งบดุลแข็งแกร่งระดับ Fortress:** มีเงินสดและเงินลงทุนระยะสั้นกว่า 5 พันล้านดอลลาร์ โดยไม่มีหนี้สินที่มีภาระดอกเบี้ยเลย',
      '**Rule of 40 โดดเด่น:** ผลรวมของอัตราการเติบโตรายได้และ FCF Margin สูงถึง 145% บ่งชี้ประสิทธิภาพการทำกำไรสูงสุดในกลุ่มซอฟต์แวร์',
      '**Valuation อยู่ในโซนพรีเมียม:** P/E Trailing สูงกว่า 135x ทำให้นักลงทุนต้องระมัดระวังจังหวะการเข้าซื้อและควรใช้กลยุทธ์ Dollar-Cost Averaging (DCA)'
    ]
  },
  financial_statements: {
    currency: 'USD',
    fiscal_period_type: 'quarterly',
    as_of_date: '2026-09-01',
    periods: ['Q3 2025', 'Q4 2025', 'Q1 2026', 'Q2 2026'],
    income_statement: {
      revenue: [726, 828, 884, 1004],
      cogs: [146, 164, 150, 160],
      gross_profit: [580, 664, 734, 844],
      gross_margin_pct: [79.9, 80.2, 83.0, 84.1],
      operating_expenses: [385, 382, 345, 371],
      operating_income: [195, 282, 389, 473],
      operating_margin_pct: [26.8, 34.0, 44.0, 47.1],
      net_income: [143, 79, 214, 326],
      net_margin_pct: [19.7, 9.5, 24.2, 32.5],
      eps_diluted: [0.06, 0.03, 0.08, 0.13],
      yoy_revenue_growth_pct: [63, 70, 85, 93],
      commentary: 'รายได้เติบโตเร่งตัวขึ้นในทุกไตรมาส ขณะที่ Gross Margin ขยายตัวแตะ 84.1% สะท้อนอำนาจต่อรองราคาและประสิทธิภาพของแพลตฟอร์ม AIP โดย Operating Margin เพิ่มขึ้นแตะ 47.1% จากความประหยัดต่อขนาด (Operating Leverage)'
    },
    balance_sheet: {
      cash_and_equivalents: [2150, 2320, 2550, 2800],
      short_term_investments: [2450, 2580, 2850, 3200],
      total_current_assets: [5150, 5520, 6050, 6750],
      accounts_receivable: [390, 410, 435, 460],
      receivables: [390, 410, 435, 460],
      inventory: [0, 0, 0, 0],
      net_ppe: [280, 310, 335, 360],
      total_assets: [5820, 6240, 6780, 7490],
      total_current_liabilities: [680, 720, 780, 850],
      accounts_payable: [180, 195, 210, 230],
      payables: [180, 195, 210, 230],
      tax_payable: [45, 50, 55, 60],
      short_term_debt: [0, 0, 0, 0],
      current_deferred_liabilities: [320, 340, 365, 390],
      total_debt: [0, 0, 0, 0],
      total_liabilities: [920, 980, 1050, 1150],
      total_equity: [4900, 5260, 5730, 6340],
      capital_stock: [3800, 3950, 4100, 4250],
      common_stock: [3800, 3950, 4100, 4250],
      retained_earnings: [1100, 1310, 1630, 2090],
      current_ratio: [7.57, 7.67, 7.76, 7.94],
      quick_ratio: [7.57, 7.67, 7.76, 7.94],
      debt_to_equity: [0, 0, 0, 0],
      debt_to_ebitda: [0, 0, 0, 0],
      commentary: 'งบดุลมีความมั่นคงสูงมากระดับไร้หนี้สิน (Zero Debt) พร้อมกระแสเงินสดและสินทรัพย์สภาพคล่องสูงถึง 6 พันล้านดอลลาร์ ทำให้บริษัทมีความยืดหยุ่นในการลงทุน R&D และขยายโครงสร้างพื้นฐาน AIP'
    },
    cash_flow: {
      operating_cash_flow: [420, 480, 510, 620],
      depreciation: [22, 24, 25, 26],
      non_cash_items: [140, 150, 155, 160],
      change_working_capital: [114, 127, 116, 108],
      change_receivables: [-20, -20, -25, -25],
      change_payables: [15, 15, 15, 20],
      capex: [5, 6, 7, 8],
      free_cash_flow: [415, 474, 503, 612],
      investing_cash_flow: [-180, -210, -240, -280],
      investment_purchase: [-175, -204, -233, -272],
      financing_cash_flow: [-45, -50, -55, -60],
      stock_issuance_repurchase: [-45, -50, -55, -60],
      beginning_cash: [1955, 2150, 2320, 2550],
      net_change_cash: [195, 170, 230, 250],
      ending_cash: [2150, 2320, 2550, 2800],
      fcf_margin_pct: [57.2, 57.2, 56.9, 61.0],
      fcf_vs_net_income_ratio: [2.88, 2.65, 2.35, 1.88],
      commentary: 'คุณภาพกำไรอยู่ในระดับยอดเยี่ยม (High Quality of Earnings) อัตราแปลงกำไรสุทธิเป็น Free Cash Flow สูงกว่า 1.8x โดย FCF Margin ทะลุ 61% ในไตรมาสล่าสุด'
    },
    red_flags: [
      'ค่าใช้จ่ายจ่ายหุ้นให้พนักงาน (Stock-Based Compensation - SBC) แม้จะลดลงเทียบสัดส่วนรายได้ แต่ยังคงเป็นส่วนสำคัญในการคำนวณกำไรตาม GAAP',
      'การกระจุกตัวของรายได้ภาครัฐบางส่วนยังคงขึ้นกับงบประมาณและรอบการจัดซื้อของรัฐบาลสหรัฐฯ'
    ]
  },
  valuation_ratios: [
    {
      name: 'P/E (Trailing)',
      formula: 'ราคาหุ้นปัจจุบัน / EPS ย้อนหลัง 12 เดือน',
      value: 158.83,
      unit: 'x',
      peer_avg: 32.4,
      own_5yr_percentile: 85,
      interpretation: 'ซื้อขายที่พรีเมียมสูงกว่าค่าเฉลี่ยอุตสาหกรรมซอฟต์แวร์อย่างมีนัยสำคัญ (P/E 158.83x) ตลาดให้มูลค่าล่วงหน้าต่อการเติบโตของ AIP',
      verdict: 'expensive'
    },
    {
      name: 'PEG Ratio',
      formula: 'P/E ÷ อัตราการเติบโตกำไรคาดการณ์ (%)',
      value: 2.15,
      unit: 'x',
      peer_avg: 1.85,
      own_5yr_percentile: 74,
      interpretation: 'ระดับ PEG Ratio อยู่ที่ 2.15x ซึ่งสูงกว่าเกณฑ์ 2.0x สะท้อนราคาที่ซื้อขายในโซนพรีเมียมเมื่อเทียบกับอัตราการเติบโตของกำไร',
      verdict: 'expensive'
    },
    {
      name: 'EV/EBITDA',
      formula: 'Enterprise Value / EBITDA (TTM)',
      value: 96.4,
      unit: 'x',
      peer_avg: 26.5,
      own_5yr_percentile: 82,
      interpretation: 'ตัวคูณระดับสูง สะท้อนโครงสร้างธุรกิจที่ไม่มีหนี้และอัตรากำไร EBITDA ขยายตัวเร็ว',
      verdict: 'expensive'
    },
    {
      name: 'EV/Sales',
      formula: 'Enterprise Value / Revenue (TTM)',
      value: 41.2,
      unit: 'x',
      peer_avg: 11.8,
      own_5yr_percentile: 88,
      interpretation: 'อยู่ในช่วงท็อป 12% ของประวัติศาสตร์บริษัท',
      verdict: 'expensive'
    },
    {
      name: 'P/FCF',
      formula: 'Market Cap / Free Cash Flow (TTM)',
      value: 74.5,
      unit: 'x',
      peer_avg: 29.0,
      own_5yr_percentile: 72,
      interpretation: 'กระแสเงินสดอิสระที่ขยายตัวช่วยรองรับมูลค่าส่วนนี้ได้ดีกว่า P/E',
      verdict: 'fair'
    },
    {
      name: 'P/B',
      formula: 'ราคาหุ้น / มูลค่าทางบัญชีต่อหุ้น',
      value: 28.6,
      unit: 'x',
      peer_avg: 8.2,
      own_5yr_percentile: 78,
      interpretation: 'สะท้อนมูลค่าสินทรัพย์ไม่มีตัวตนและ IP ด้านเทคโนโลยี AI',
      verdict: 'expensive'
    }
  ],
  valuation_percentile_chart: {
    description: 'ตำแหน่ง Trailing P/E ปัจจุบัน (158.83x) เทียบกับช่วง 5 ปีย้อนหลัง (45.2x - 210.8x)',
    min_5yr: 45.2,
    max_5yr: 210.8,
    current: 158.83,
    median_5yr: 95.0
  },
  valuation_dashboard: {
    as_of_date: '2026-09-01',
    updated_at: 'Updated: Sep 1, 2026 12:16',
    pe_ratio: {
      current_value: 158.83,
      forward_value: 78.20,
      percentile_5y: 92,
      historical_avg: 95.0,
      reasonable_range_low: 75.0,
      reasonable_range_high: 125.0,
      industry_avg: 48.5,
      industry_ranking: '12 / 14',
      market_ranking: '2840 / 2976',
      market_avg: 24.5,
      market_median: 19.8,
      band_chart_data: [
        { date: '2021/Q4', ratio_value: 110.2, historical_avg: 95.0, band_lower: 75.0, band_upper: 125.0, industry_avg: 45.2, benchmark_index: 28.5 },
        { date: '2022/Q2', ratio_value: 68.5, historical_avg: 95.0, band_lower: 75.0, band_upper: 125.0, industry_avg: 38.0, benchmark_index: 22.1 },
        { date: '2023/Q1', ratio_value: 74.0, historical_avg: 95.0, band_lower: 75.0, band_upper: 125.0, industry_avg: 39.5, benchmark_index: 23.4 },
        { date: '2024/Q1', ratio_value: 98.4, historical_avg: 95.0, band_lower: 75.0, band_upper: 125.0, industry_avg: 44.0, benchmark_index: 26.8 },
        { date: '2025/Q1', ratio_value: 135.0, historical_avg: 95.0, band_lower: 75.0, band_upper: 125.0, industry_avg: 46.2, benchmark_index: 27.9 },
        { date: 'Current', ratio_value: 158.83, historical_avg: 95.0, band_lower: 75.0, band_upper: 125.0, industry_avg: 48.5, benchmark_index: 29.2 }
      ],
      industry_distribution: [
        { symbol: 'PLTR', name: 'Palantir Technologies', ratio_value: 158.83, market_cap_b: 420.5, forward_ratio: 78.2, percentile_5y: 92, is_target: true },
        { symbol: 'SNOW', name: 'Snowflake Inc.', ratio_value: 142.5, market_cap_b: 62.8, forward_ratio: 65.0, percentile_5y: 74, is_target: false },
        { symbol: 'MDB', name: 'MongoDB Inc.', ratio_value: 88.4, market_cap_b: 24.2, forward_ratio: 54.2, percentile_5y: 60, is_target: false },
        { symbol: 'DDOG', name: 'Datadog Inc.', ratio_value: 72.1, market_cap_b: 41.5, forward_ratio: 49.0, percentile_5y: 52, is_target: false },
        { symbol: 'CRM', name: 'Salesforce Inc.', ratio_value: 38.6, market_cap_b: 285.0, forward_ratio: 26.5, percentile_5y: 44, is_target: false },
        { symbol: 'MSFT', name: 'Microsoft Corp.', ratio_value: 34.2, market_cap_b: 3420.0, forward_ratio: 31.0, percentile_5y: 68, is_target: false },
        { symbol: 'AI', name: 'C3.ai Inc.', ratio_value: 'Loss', market_cap_b: 3.2, forward_ratio: 'Loss', percentile_5y: 15, is_target: false }
      ],
      market_distribution: [
        { range_label: '0~10', count: 2075, ratio_pct: 13.63 },
        { range_label: '10~30', count: 4603, ratio_pct: 30.23 },
        { range_label: '30~50', count: 1038, ratio_pct: 6.82 },
        { range_label: 'Over 50', count: 986, ratio_pct: 6.47 },
        { range_label: 'Loss-Making (ขาดทุน)', count: 6526, ratio_pct: 42.86 }
      ],
      peer_comparison_list: [
        { symbol: 'PLTR', name: 'Palantir Technologies', ratio_value: 158.83, market_cap_b: 420.5, forward_ratio: 78.2, percentile_5y: 92, is_target: true },
        { symbol: 'SNOW', name: 'Snowflake Inc.', ratio_value: 142.5, market_cap_b: 62.8, forward_ratio: 65.0, percentile_5y: 74, is_target: false },
        { symbol: 'DDOG', name: 'Datadog Inc.', ratio_value: 72.1, market_cap_b: 41.5, forward_ratio: 49.0, percentile_5y: 52, is_target: false },
        { symbol: 'MDB', name: 'MongoDB Inc.', ratio_value: 88.4, market_cap_b: 24.2, forward_ratio: 54.2, percentile_5y: 60, is_target: false },
        { symbol: 'CRM', name: 'Salesforce Inc.', ratio_value: 38.6, market_cap_b: 285.0, forward_ratio: 26.5, percentile_5y: 44, is_target: false },
        { symbol: 'MSFT', name: 'Microsoft Corp.', ratio_value: 34.2, market_cap_b: 3420.0, forward_ratio: 31.0, percentile_5y: 68, is_target: false },
        { symbol: 'AI', name: 'C3.ai Inc.', ratio_value: 'Loss', market_cap_b: 3.2, forward_ratio: 'Loss', percentile_5y: 15, is_target: false }
      ]
    },
    pb_ratio: {
      current_value: 28.60,
      forward_value: 24.10,
      percentile_5y: 78,
      historical_avg: 18.50,
      reasonable_range_low: 12.0,
      reasonable_range_high: 22.0,
      industry_avg: 11.20,
      industry_ranking: '11 / 14',
      market_ranking: '4950 / 5309',
      market_avg: 3.98,
      market_median: 1.85,
      band_chart_data: [
        { date: '2021/Q4', ratio_value: 24.0, historical_avg: 18.5, band_lower: 12.0, band_upper: 22.0, industry_avg: 10.5, benchmark_index: 4.8 },
        { date: '2022/Q2', ratio_value: 9.8, historical_avg: 18.5, band_lower: 12.0, band_upper: 22.0, industry_avg: 7.2, benchmark_index: 3.9 },
        { date: '2023/Q1', ratio_value: 12.4, historical_avg: 18.5, band_lower: 12.0, band_upper: 22.0, industry_avg: 8.4, benchmark_index: 4.1 },
        { date: '2024/Q1', ratio_value: 19.5, historical_avg: 18.5, band_lower: 12.0, band_upper: 22.0, industry_avg: 9.8, benchmark_index: 4.5 },
        { date: '2025/Q1', ratio_value: 25.2, historical_avg: 18.5, band_lower: 12.0, band_upper: 22.0, industry_avg: 10.6, benchmark_index: 4.7 },
        { date: 'Current', ratio_value: 28.60, historical_avg: 18.5, band_lower: 12.0, band_upper: 22.0, industry_avg: 11.2, benchmark_index: 4.9 }
      ],
      industry_distribution: [
        { symbol: 'PLTR', name: 'Palantir Technologies', ratio_value: 28.60, market_cap_b: 420.5, percentile_5y: 78, is_target: true },
        { symbol: 'SNOW', name: 'Snowflake Inc.', ratio_value: 18.4, market_cap_b: 62.8, percentile_5y: 65, is_target: false },
        { symbol: 'DDOG', name: 'Datadog Inc.', ratio_value: 15.2, market_cap_b: 41.5, percentile_5y: 58, is_target: false },
        { symbol: 'MSFT', name: 'Microsoft Corp.', ratio_value: 12.8, market_cap_b: 3420.0, percentile_5y: 70, is_target: false },
        { symbol: 'CRM', name: 'Salesforce Inc.', ratio_value: 4.8, market_cap_b: 285.0, percentile_5y: 42, is_target: false }
      ],
      market_distribution: [
        { range_label: '0~1', count: 3963, ratio_pct: 25.56 },
        { range_label: '1~2', count: 3822, ratio_pct: 24.65 },
        { range_label: '2~5', count: 3390, ratio_pct: 21.86 },
        { range_label: 'Over 5', count: 2363, ratio_pct: 15.24 },
        { range_label: 'Loss-Making (ส่วนทุนติดลบ)', count: 1968, ratio_pct: 12.69 }
      ],
      peer_comparison_list: [
        { symbol: 'PLTR', name: 'Palantir Technologies', ratio_value: 28.60, market_cap_b: 420.5, percentile_5y: 78, is_target: true },
        { symbol: 'SNOW', name: 'Snowflake Inc.', ratio_value: 18.4, market_cap_b: 62.8, percentile_5y: 65, is_target: false },
        { symbol: 'DDOG', name: 'Datadog Inc.', ratio_value: 15.2, market_cap_b: 41.5, percentile_5y: 58, is_target: false },
        { symbol: 'MSFT', name: 'Microsoft Corp.', ratio_value: 12.8, market_cap_b: 3420.0, percentile_5y: 70, is_target: false },
        { symbol: 'CRM', name: 'Salesforce Inc.', ratio_value: 4.8, market_cap_b: 285.0, percentile_5y: 42, is_target: false }
      ]
    },
    ps_ratio: {
      current_value: 48.50,
      forward_value: 36.20,
      percentile_5y: 89,
      historical_avg: 26.50,
      reasonable_range_low: 18.0,
      reasonable_range_high: 34.0,
      industry_avg: 12.80,
      industry_ranking: '13 / 14',
      market_ranking: '2910 / 2976',
      market_avg: 4.50,
      market_median: 2.30,
      band_chart_data: [
        { date: '2021/Q4', ratio_value: 36.0, historical_avg: 26.5, band_lower: 18.0, band_upper: 34.0, industry_avg: 14.5, benchmark_index: 3.1 },
        { date: '2022/Q2', ratio_value: 12.5, historical_avg: 26.5, band_lower: 18.0, band_upper: 34.0, industry_avg: 8.2, benchmark_index: 2.3 },
        { date: '2023/Q1', ratio_value: 15.8, historical_avg: 26.5, band_lower: 18.0, band_upper: 34.0, industry_avg: 9.4, benchmark_index: 2.5 },
        { date: '2024/Q1', ratio_value: 28.4, historical_avg: 26.5, band_lower: 18.0, band_upper: 34.0, industry_avg: 11.5, benchmark_index: 2.8 },
        { date: '2025/Q1', ratio_value: 42.0, historical_avg: 26.5, band_lower: 18.0, band_upper: 34.0, industry_avg: 12.2, benchmark_index: 2.9 },
        { date: 'Current', ratio_value: 48.50, historical_avg: 26.5, band_lower: 18.0, band_upper: 34.0, industry_avg: 12.8, benchmark_index: 3.0 }
      ],
      industry_distribution: [
        { symbol: 'PLTR', name: 'Palantir Technologies', ratio_value: 48.50, market_cap_b: 420.5, percentile_5y: 89, is_target: true },
        { symbol: 'SNOW', name: 'Snowflake Inc.', ratio_value: 16.5, market_cap_b: 62.8, percentile_5y: 62, is_target: false },
        { symbol: 'DDOG', name: 'Datadog Inc.', ratio_value: 14.2, market_cap_b: 41.5, percentile_5y: 55, is_target: false },
        { symbol: 'MSFT', name: 'Microsoft Corp.', ratio_value: 13.5, market_cap_b: 3420.0, percentile_5y: 72, is_target: false },
        { symbol: 'CRM', name: 'Salesforce Inc.', ratio_value: 7.2, market_cap_b: 285.0, percentile_5y: 46, is_target: false }
      ],
      market_distribution: [
        { range_label: '0~2', count: 3200, ratio_pct: 35.0 },
        { range_label: '2~5', count: 2800, ratio_pct: 30.6 },
        { range_label: '5~10', count: 1850, ratio_pct: 20.2 },
        { range_label: 'Over 10', count: 1300, ratio_pct: 14.2 }
      ],
      peer_comparison_list: [
        { symbol: 'PLTR', name: 'Palantir Technologies', ratio_value: 48.50, market_cap_b: 420.5, percentile_5y: 89, is_target: true },
        { symbol: 'SNOW', name: 'Snowflake Inc.', ratio_value: 16.5, market_cap_b: 62.8, percentile_5y: 62, is_target: false },
        { symbol: 'DDOG', name: 'Datadog Inc.', ratio_value: 14.2, market_cap_b: 41.5, percentile_5y: 55, is_target: false },
        { symbol: 'MSFT', name: 'Microsoft Corp.', ratio_value: 13.5, market_cap_b: 3420.0, percentile_5y: 72, is_target: false },
        { symbol: 'CRM', name: 'Salesforce Inc.', ratio_value: 7.2, market_cap_b: 285.0, percentile_5y: 46, is_target: false }
      ]
    },
    earnings_growth: {
      net_income_5y_growth: '+2.10x',
      market_cap_5y_growth: '+4.35x',
      insight_note: 'การเติบโตของมูลค่าตลาด 5 ปี (+4.35x) เร็วกว่าการเติบโตของกำไรสุทธิ (+2.10x) อย่างมีนัยสำคัญ สะท้อนถึง Multiple Expansion จากกระแส AIP และความคาดหวังในฐานะผู้นำ Enterprise AI',
      chart_data: [
        { period: '2021/Q4', net_income_multiple: 0.65, market_cap_multiple: 0.82 },
        { period: '2022/Q4', net_income_multiple: 0.80, market_cap_multiple: 0.55 },
        { period: '2023/Q4', net_income_multiple: 1.15, market_cap_multiple: 1.25 },
        { period: '2024/Q4', net_income_multiple: 1.55, market_cap_multiple: 2.10 },
        { period: '2025/Q4', net_income_multiple: 1.85, market_cap_multiple: 3.45 },
        { period: 'Current', net_income_multiple: 2.10, market_cap_multiple: 4.35 }
      ]
    },
    revenue_growth: {
      revenue_5y_growth: '+2.85x',
      market_cap_5y_growth: '+4.35x',
      insight_note: 'การเติบโตของมูลค่าตลาด 5 ปี (+4.35x) เติบโตเร็วกว่าการเติบโตของรายได้ (+2.85x) สะท้อนถึง Multiple Expansion จากความต้องการใช้งานแพลตฟอร์ม AIP เชิงพาณิชย์',
      chart_data: [
        { period: '2021/Q4', revenue_multiple: 0.55, market_cap_multiple: 0.82 },
        { period: '2022/Q4', revenue_multiple: 0.72, market_cap_multiple: 0.55 },
        { period: '2023/Q4', revenue_multiple: 1.05, market_cap_multiple: 1.25 },
        { period: '2024/Q4', revenue_multiple: 1.60, market_cap_multiple: 2.10 },
        { period: '2025/Q4', revenue_multiple: 2.30, market_cap_multiple: 3.45 },
        { period: 'Current', revenue_multiple: 2.85, market_cap_multiple: 4.35 }
      ]
    }
  },
  intrinsic_value: {
    current_price: 186.38,
    as_of_date: '2026-09-01',
    dcf_model: {
      assumptions: {
        wacc_pct: 9.5,
        terminal_growth_pct: 3.0,
        projection_years: 5
      },
      scenarios: {
        bear: {
          revenue_cagr_pct: 25,
          terminal_margin_pct: 30,
          fair_value_per_share: 105.0,
          key_assumption_note: 'การขยายตัวของภาคพาณิชย์ชะลอตัวลง งบประมาณภาครัฐเติบโตต่ำ และการแข่งขันจาก Big Tech ทวีความรุนแรง'
        },
        base: {
          revenue_cagr_pct: 42,
          terminal_margin_pct: 40,
          fair_value_per_share: 172.0,
          key_assumption_note: 'AIP เติบโตตามแผน Consensus รายได้ภาคพาณิชย์สหรัฐฯ ขยายตัว 50%+ YoY อัตรากำไรคงตัวระดับสูง'
        },
        bull: {
          revenue_cagr_pct: 58,
          terminal_margin_pct: 46,
          fair_value_per_share: 265.0,
          key_assumption_note: 'Palantir กลายเป็น AI Operating System มาตรฐานขององค์กรทั่วโลก รายได้ภาคเอกชนเติบโต 80%+ ต่อปี'
        }
      }
    },
    relative_valuation: {
      method: 'EV/EBITDA multiple ของกลุ่ม Enterprise AI',
      peer_multiple_used: 48.0,
      metric_applied: 'Forward EBITDA (FY2026)',
      fair_value_per_share: 178.5
    },
    summary: {
      fair_value_range_low: 105.0,
      fair_value_range_high: 265.0,
      base_case_fair_value: 172.0,
      current_price_position_pct: 54,
      margin_of_safety_pct: -7.7,
      verdict_text: 'ราคาตลาดปัจจุบัน ($186.38) ซื้อขายสูงกว่ากรณีฐาน (Base Case: $172.0) เล็กน้อยประมาณ 7.7% แต่มี Upside สู่กรณี Bull Case ($265.0) ถึง +42% จึงเหมาะกับการทยอยสะสมเมื่อราคาย่อตัว'
    },
    disclaimer: 'แบบจำลองมูลค่าแท้จริงนี้สร้างขึ้นจากสมมติฐานกระแสเงินสดคิดลด (DCF) ไม่ถือเป็นคำแนะนำในการซื้อขายหลักทรัพย์'
  },
  five_pillars: {
    as_of_date: '2026-09-01',
    growth: {
      revenue_growth_yoy_pct: 93.0,
      revenue_cagr_3yr_pct: 42.5,
      revenue_cagr_5yr_pct: 35.8,
      eps_growth_yoy_pct: 125.0,
      eps_cagr_3yr_pct: 88.0,
      fcf_growth_yoy_pct: 142.0,
      peg_ratio: 0.95,
      peg_interpretation: 'PEG Ratio 0.95x (< 1.0x) สะท้อนสภาวะ GARP (Growth at a Reasonable Price) แม้ P/E จะสูง แต่การเติบโตของกำไรและกระแสเงินสดระดับ 100%+ ทำให้มูลค่าสมเหตุสมผล'
    },
    profitability: {
      roic_pct: 28.4,
      roe_pct: 32.6,
      gross_margin_pct: 84.1,
      operating_margin_pct: 39.8,
      net_margin_pct: 34.2,
      fcf_margin_pct: 46.5,
      capital_efficiency_verdict: 'ROIC ระดับ 28.4% สูงกว่าต้นทุนทางการเงิน (WACC 9.5%) ถึง 3 เท่า สะท้อนพลังการทบต้นของเงินทุน (Capital Compounding) สูงสุดในกลุ่ม AI Platform'
    },
    balance_sheet: {
      total_cash_and_investments_b: 5.40,
      total_debt_b: 0.00,
      net_cash_or_debt_b: 5.40,
      is_net_cash: true,
      debt_to_equity: 0.00,
      net_debt_to_ebitda: -5.20,
      interest_coverage: 999.0,
      solvency_score_label: 'Fortress Balance Sheet: หนี้สินที่มีภาระดอกเบี้ยเป็น 0 (Net Cash $5.4B) ไร้ความเสี่ยงด้านสภาพคล่องโดยสิ้นเชิง'
    },
    yields: {
      pe_multiple: 85.0,
      earnings_yield_pct: 1.18,
      pfcf_multiple: 38.5,
      fcf_yield_pct: 2.60,
      dividend_yield_pct: 0.00,
      treasury_10yr_yield_pct: 4.25,
      yield_spread_vs_treasury: -1.65,
      yield_interpretation: 'FCF Yield อยู่ที่ 2.60% โดยกำไรและกระแสเงินสดทั้งหมดถูก Reinvest 100% กลับเข้าสู่แพลตฟอร์ม AIP เพื่อขับเคลื่อนการเติบโตก้าวกระโดด'
    },
    peer_matrix: [
      { metric_name: 'P/E (TTM)', metric_name_th: 'ค่า P/E ย้อนหลัง', target_value: '85.0x', sector_median: '32.4x', direct_peer_value: '68.5x', status: 'premium', status_label_th: 'พรีเมียมตามการเติบโต' },
      { metric_name: 'Forward P/E', metric_name_th: 'ค่า Forward P/E', target_value: '45.2x', sector_median: '26.8x', direct_peer_value: '52.0x', status: 'better', status_label_th: 'ปรับลดเร็วตามกำไรที่เร่งตัว' },
      { metric_name: 'PEG Ratio', metric_name_th: 'ค่า PEG Ratio', target_value: '0.95x', sector_median: '1.65x', direct_peer_value: '1.45x', status: 'better', status_label_th: 'ต่ำกว่า 1.0x (GARP คุ้มค่า)' },
      { metric_name: 'EV / EBITDA', metric_name_th: 'ค่า EV / EBITDA', target_value: '38.0x', sector_median: '22.5x', direct_peer_value: '45.0x', status: 'neutral', status_label_th: 'ตามมาตรฐานผู้นำกลุ่ม AI' },
      { metric_name: 'FCF Yield (%)', metric_name_th: 'อัตราผลตอบแทนกระแสเงินสด', target_value: '2.60%', sector_median: '1.80%', direct_peer_value: '1.40%', status: 'better', status_label_th: 'FCF Yield สูงกว่าคู่แข่ง' },
      { metric_name: 'ROIC (%)', metric_name_th: 'ผลตอบแทนเงินลงทุน (ROIC)', target_value: '28.4%', sector_median: '11.5%', direct_peer_value: '12.8%', status: 'better', status_label_th: 'ประสิทธิภาพเงินทุนระดับท็อป' },
      { metric_name: 'Revenue Growth YoY (%)', metric_name_th: 'รายได้เติบโต YoY', target_value: '+93.0%', sector_median: '+18.2%', direct_peer_value: '+31.5%', status: 'better', status_label_th: 'เติบโตเร็วกว่า Sector 5 เท่า' },
      { metric_name: 'Gross Margin (%)', metric_name_th: 'อัตรากำไรขั้นต้น', target_value: '84.1%', sector_median: '68.5%', direct_peer_value: '72.4%', status: 'better', status_label_th: 'อำนาจตั้งราคาสูงมาก' },
      { metric_name: 'Net Debt / EBITDA', metric_name_th: 'หนี้สินสุทธิต่อ EBITDA', target_value: '-5.2x (Net Cash)', sector_median: '+1.5x', direct_peer_value: '-1.8x', status: 'better', status_label_th: 'งบดุลเงินสดล้วน ไร้หนี้' }
    ],
    analyst_takeaway: 'แม้ P/E ของ PLTR จะดูพรีเมียม แต่เมื่อมองครบทั้ง 5 มิติ (PEG 0.95x, รายได้เติบโต 93% YoY, ROIC 28.4% และเงินสดสุทธิ $5.4B ไร้หนี้) ชี้ชัดว่าหุ้นนี้ขับเคลื่อนด้วยพลังของ Fundamental และ Capital Compounding ที่แข็งแกร่งอย่างแท้จริง'
  },
  earnings_analysis: {
    as_of_date: '2026-09-01',
    next_earnings_date: '2026-11-03',
    next_earnings_date_confirmed: false,
    days_until_next_earnings: 63,
    past_earnings_history: [
      {
        period: 'Q3 2025',
        report_date: '2025-11-04',
        eps_estimate: 0.05,
        eps_actual: 0.06,
        eps_surprise_pct: 20.0,
        revenue_estimate_musd: 701,
        revenue_actual_musd: 726,
        revenue_surprise_pct: 3.6,
        stock_reaction_1d_pct: 12.2,
        guidance_change: 'raised',
        beat_or_miss: 'beat_both'
      },
      {
        period: 'Q4 2025',
        report_date: '2026-02-05',
        eps_estimate: 0.03,
        eps_actual: 0.03,
        eps_surprise_pct: 0.0,
        revenue_estimate_musd: 775,
        revenue_actual_musd: 828,
        revenue_surprise_pct: 6.8,
        stock_reaction_1d_pct: 19.5,
        guidance_change: 'raised',
        beat_or_miss: 'beat_revenue'
      },
      {
        period: 'Q1 2026',
        report_date: '2026-05-06',
        eps_estimate: 0.07,
        eps_actual: 0.08,
        eps_surprise_pct: 14.3,
        revenue_estimate_musd: 850,
        revenue_actual_musd: 884,
        revenue_surprise_pct: 4.0,
        stock_reaction_1d_pct: -8.2,
        guidance_change: 'maintained',
        beat_or_miss: 'beat_both'
      },
      {
        period: 'Q2 2026',
        report_date: '2026-08-04',
        eps_estimate: 0.11,
        eps_actual: 0.13,
        eps_surprise_pct: 18.2,
        revenue_estimate_musd: 940,
        revenue_actual_musd: 1004,
        revenue_surprise_pct: 6.8,
        stock_reaction_1d_pct: 11.4,
        guidance_change: 'raised',
        beat_or_miss: 'beat_both'
      }
    ],
    beat_streak: {
      eps_beat_streak_quarters: 12,
      revenue_beat_streak_quarters: 10,
      commentary: 'Palantir สามารถทำผลงานชนะประมาณการทั้งรายได้และกำไรต่อหุ้นอย่างสม่ำเสมอ โดยมีการปรับขึ้นเป้า Guidance ทั้งปีแทบทุกไตรมาส'
    },
    average_earnings_day_move_pct: 12.8,
    current_quarter_setup: {
      period: 'Q3 2026',
      company_guidance_revenue_musd: [1085, 1095],
      consensus_estimate_revenue_musd: 1090,
      consensus_estimate_eps: 0.14,
      whisper_vs_consensus: 'ความคาดหวังในตลาด (Whisper Number) อยู่สูงกว่า Consensus เล็กน้อยที่ $1.11B',
      key_things_to_watch: [
        'อัตราการเติบโตของ US Commercial Customer Count (ไตรมาสก่อนหน้าโต 83% YoY)',
        'การขยายสัญญาขนาดใหญ่ (Deals > $10M) และ Bootcamps conversion rate',
        'แนวโน้มการนำ AIP Agent ไปบูรณาการร่วมกับระบบคลาวด์องค์กร'
      ]
    },
    estimate_revisions_trend: {
      description: 'ทิศทางการปรับประมาณการของนักวิเคราะห์ในช่วง 90 วันที่ผ่านมา',
      eps_estimate_90d_ago: 0.12,
      eps_estimate_current: 0.14,
      direction: 'upward',
      num_analysts_raised: 19,
      num_analysts_lowered: 1,
      commentary: 'นักวิเคราะห์ 19 รายปรับเพิ่มประมาณการ EPS ในช่วง 90 วัน สะท้อนความเชื่อมั่นต่อโมเมนตัมธุรกิจ'
    },
    full_year_guidance: {
      fiscal_year: 2026,
      company_guidance_revenue_musd: [4150, 4175],
      implied_growth_pct: 48,
      consensus_vs_guidance: 'เป้าหมายผู้บริหารสูงกว่าตัวเลข Consensus เดิมของตลาดประมาณ 3%'
    },
    analyst_consensus: {
      consensus_rating: 'Moderate Buy',
      total_analysts: 24,
      ratings_breakdown: {
        buy_count: 14,
        hold_count: 8,
        sell_count: 2
      },
      price_target: {
        mean: 215.5,
        high: 260.0,
        low: 140.0,
        median: 210.0,
        implied_upside_pct: 15.6
      },
      as_of_date: '2026-09-01',
      commentary: 'นักวิเคราะห์ส่วนใหญ่ให้คำแนะนำเชิงบวกโดยมีเป้าหมายเฉลี่ยที่ $215.5 สะท้อน Upside +15.6% จากราคาปัจจุบัน'
    },
    summary_verdict: 'โมเมนตัมผลประกอบการแข็งแกร่งมาก มีสถิติ Beat Streak ต่อเนื่อง อย่างไรก็ดี เนื่องจากความผันผวนวันประกาศงบเฉลี่ยสูงถึง ±12.8% นักลงทุนควรบริหารความเสี่ยงขนาดสัญญาในการเทรด'
  },
  forecast_dashboard: {
    as_of_date: '2026-09-01',
    updated_at: 'Updated: Sep 1, 2026 12:28 (Based on 25 analysts)',
    total_analysts: 25,
    consensus_rating: 'Buy',
    ratings_breakdown: {
      buy_count: 15,
      buy_pct: 60.00,
      hold_count: 6,
      hold_pct: 24.00,
      sell_count: 4,
      sell_pct: 16.00
    },
    price_target: {
      high: 260.00,
      mean: 215.50,
      low: 140.00,
      current_price: 186.38,
      implied_upside_pct: 15.62
    },
    target_price_chart_data: [
      { date: 'Sep 2025', price: 120.50 },
      { date: 'Nov 2025', price: 135.20 },
      { date: 'Jan 2026', price: 148.60 },
      { date: 'Mar 2026', price: 162.40 },
      { date: 'May 2026', price: 174.00 },
      { date: 'Jul 2026', price: 182.50 },
      { date: 'Current', price: 186.38, high_target: 186.38, avg_target: 186.38, low_target: 186.38 },
      { date: 'Q4 2026', high_target: 205.00, avg_target: 194.00, low_target: 172.00 },
      { date: 'Q1 2027', high_target: 224.00, avg_target: 201.00, low_target: 160.00 },
      { date: 'Q2 2027', high_target: 242.00, avg_target: 208.50, low_target: 150.00 },
      { date: '12M Target', high_target: 260.00, avg_target: 215.50, low_target: 140.00 }
    ],
    institutions: [
      { name: 'J.P. Morgan', rating: 'Overweight', target_price_prev: 190, target_price_current: 230, price_display: '190→230', change_type: 'Upgrade', date: 'Aug 31, 2026' },
      { name: 'Bernstein', rating: 'Outperform', target_price_prev: 210, target_price_current: 240, price_display: '210→240', change_type: 'Upgrade', date: 'Aug 31, 2026' },
      { name: 'Jefferies', rating: 'Hold', target_price_prev: 175, target_price_current: 175, price_display: '175→175', change_type: 'Maintained', date: 'Aug 31, 2026' },
      { name: 'BofA Securities', rating: 'Buy', target_price_prev: 220, target_price_current: 245, price_display: '220→245', change_type: 'Maintained', date: 'Aug 20, 2026' },
      { name: 'Rothschild & Co Redburn', rating: 'Buy', target_price_prev: 180, target_price_current: 250, price_display: '180→250', change_type: 'Upgrade', date: 'Aug 17, 2026' },
      { name: 'Wedbush', rating: 'Outperform', target_price_prev: 225, target_price_current: 260, price_display: '225→260', change_type: 'Upgrade', date: 'Aug 12, 2026' },
      { name: 'Morgan Stanley', rating: 'Equal-weight', target_price_prev: 165, target_price_current: 170, price_display: '165→170', change_type: 'Maintained', date: 'Aug 05, 2026' },
      { name: 'Goldman Sachs', rating: 'Neutral', target_price_prev: 155, target_price_current: 165, price_display: '155→165', change_type: 'Maintained', date: 'Jul 28, 2026' },
      { name: 'Mizuho Securities', rating: 'Buy', target_price_prev: 195, target_price_current: 225, price_display: '195→225', change_type: 'Upgrade', date: 'Jul 20, 2026' },
      { name: 'Barclays', rating: 'Underweight', target_price_prev: 130, target_price_current: 140, price_display: '130→140', change_type: 'Maintained', date: 'Jul 15, 2026' }
    ],
    analysts: [
      { name: 'Dan Ives', star_rating: 5, firm_name: 'Wedbush', rating: 'Outperform', target_price_prev: 225, target_price_current: 260, price_display: '225→260', change_type: 'Upgrade', date: 'Aug 31, 2026', has_report: true },
      { name: 'Mariana Perez Mora', star_rating: 5, firm_name: 'BofA Securities', rating: 'Buy', target_price_prev: 220, target_price_current: 245, price_display: '220→245', change_type: 'Maintained', date: 'Aug 20, 2026', has_report: true },
      { name: 'Brent Thill', star_rating: 5, firm_name: 'Jefferies', rating: 'Hold', target_price_prev: 175, target_price_current: 175, price_display: '175→175', change_type: 'Maintained', date: 'Aug 31, 2026', has_report: true },
      { name: 'Mark Cash', star_rating: 4, firm_name: 'Morningstar', rating: 'Hold', target_price_prev: 160, target_price_current: 165, price_display: '160→165', change_type: 'Maintained', date: 'Aug 18, 2026', has_report: true },
      { name: 'Gregg Moskowitz', star_rating: 5, firm_name: 'Mizuho', rating: 'Buy', target_price_prev: 195, target_price_current: 225, price_display: '195→225', change_type: 'Upgrade', date: 'Jul 20, 2026', has_report: true },
      { name: 'Keith Weiss', star_rating: 5, firm_name: 'Morgan Stanley', rating: 'Equal-weight', target_price_prev: 165, target_price_current: 170, price_display: '165→170', change_type: 'Maintained', date: 'Aug 05, 2026', has_report: true },
      { name: 'Kash Rangan', star_rating: 4, firm_name: 'Goldman Sachs', rating: 'Neutral', target_price_prev: 155, target_price_current: 165, price_display: '155→165', change_type: 'Maintained', date: 'Jul 28, 2026', has_report: true }
    ],
    disclaimer: 'เป้าหมายราคาและฉันทามตินักวิเคราะห์รวบรวมจากสถาบันการเงินชั้นนำของ Wall Street ในรอบ 90 วันล่าสุด โดยไม่ถือเป็นคำแนะนำการลงทุนโดยตรง'
  },
  peer_comparison: {
    as_of_date: '2026-09-01',
    industry_name: 'Enterprise Software & AI Infrastructure',
    peers: [
      {
        ticker: 'PLTR',
        company_name: 'Palantir Technologies',
        market_cap: '$447.8B',
        pe_trailing: 158.83,
        pe_forward: 82.4,
        revenue_growth_yoy_pct: 93.0,
        gross_margin_pct: 84.1,
        net_margin_pct: 32.5,
        ev_ebitda: 96.4
      },
      {
        ticker: 'SNOW',
        company_name: 'Snowflake Inc.',
        market_cap: '$48B',
        pe_trailing: null,
        pe_forward: 55.2,
        revenue_growth_yoy_pct: 29.0,
        gross_margin_pct: 67.5,
        net_margin_pct: -15.4,
        ev_ebitda: 62.0
      },
      {
        ticker: 'MSFT',
        company_name: 'Microsoft Corp.',
        market_cap: '$3,150B',
        pe_trailing: 34.2,
        pe_forward: 28.5,
        revenue_growth_yoy_pct: 16.0,
        gross_margin_pct: 69.8,
        net_margin_pct: 35.8,
        ev_ebitda: 22.4
      },
      {
        ticker: 'DDOG',
        company_name: 'Datadog Inc.',
        market_cap: '$42B',
        pe_trailing: 82.0,
        pe_forward: 48.0,
        revenue_growth_yoy_pct: 26.0,
        gross_margin_pct: 81.2,
        net_margin_pct: 12.0,
        ev_ebitda: 45.5
      }
    ],
    key_takeaway: 'Palantir มีอัตราการเติบโตของรายได้ (93% YoY) และอัตรากำไรขั้นต้น (84.1%) สูงที่สุดในกลุ่มเทียบเคียง ส่งผลให้ได้รับ Premium Multiple สูงกว่าคู่แข่งอย่างชัดเจน'
  },
  catalysts_and_events: {
    as_of_date: '2026-09-01',
    items: [
      {
        title: 'AIPCon & Developer Day',
        date: '2026-09-24',
        expected_impact: 'high',
        description: 'การเปิดตัวฟีเจอร์ AI Agentic Workflows ใหม่และการสาธิต Use Cases จริงจากลูกค้าระดับ Fortune 500',
        category: 'product_launch'
      },
      {
        title: 'Q3 2026 Earnings Release',
        date: '2026-11-03',
        expected_impact: 'high',
        description: 'การรายงานผลประกอบการไตรมาส 3/2026 และอัปเดต Guidance รายได้ภาคพาณิชย์สหรัฐฯ',
        category: 'earnings'
      },
      {
        title: 'US DoD Project Maven Contract Renewal',
        date: '2026-12-15',
        expected_impact: 'medium',
        description: 'การต่อสัญญาและขยายขอบเขตการใช้งานระบบวิเคราะห์ข่าวกรองกับกระทรวงกลาโหมสหรัฐฯ',
        category: 'regulatory'
      }
    ]
  },
  insider_activity: {
    as_of_date: '2026-09-01',
    insider_ownership_pct: 8.4,
    institutional_ownership_pct: 46.8,
    institutional_qoq_change_pct: 3.2,
    recent_transactions: [
      {
        date: '2026-08-18',
        insider_name: 'Alexander Karp',
        title: 'CEO',
        transaction_type: 'sell',
        shares_count: 75000,
        price_per_share: 182.5,
        total_value_usd: 13687500
      },
      {
        date: '2026-08-12',
        insider_name: 'Shyam Sankar',
        title: 'CTO',
        transaction_type: 'sell',
        shares_count: 25000,
        price_per_share: 179.0,
        total_value_usd: 4475000
      }
    ],
    commentary: 'การขายหุ้นของผู้บริหารเป็นการปฏิบัติตามแผนการซื้อขายล่วงหน้า (Rule 10b5-1 Trading Plan) เพื่อการบริหารภาษี ขณะที่สัดส่วนการถือครองของนักลงทุนสถาบันเพิ่มขึ้น 3.2% QoQ'
  },
  smart_money: {
    as_of_date: '2026-09-01',
    institution_overview: {
      total_institutions_count: 2840,
      institutions_count_change_qoq: 48,
      total_shares_held: '1.28B',
      shares_held_change_qoq: '+42.5M',
      pct_owned: 56.73,
      pct_owned_change_qoq: 2.40
    },
    major_holders: [
      {
        name: 'The Vanguard Group, Inc.',
        shares_held: '215.4M',
        pct_owned: 9.54,
        change_shares: '+4.85M',
        change_pct: 0.21,
        holder_type: 'Mutual Fund / Index',
        filing_date: '2026-06-30',
        disclosure: '13F'
      },
      {
        name: 'BlackRock, Inc.',
        shares_held: '198.2M',
        pct_owned: 8.78,
        change_shares: '+6.12M',
        change_pct: 0.27,
        holder_type: 'Mutual Fund / Index',
        filing_date: '2026-06-30',
        disclosure: '13F'
      },
      {
        name: 'State Street Global Advisors',
        shares_held: '89.6M',
        pct_owned: 3.97,
        change_shares: '+1.94M',
        change_pct: 0.08,
        holder_type: 'Mutual Fund / ETF',
        filing_date: '2026-06-30',
        disclosure: '13F'
      },
      {
        name: 'Geode Capital Management, LLC',
        shares_held: '48.3M',
        pct_owned: 2.14,
        change_shares: '+1.05M',
        change_pct: 0.04,
        holder_type: 'Mutual Fund',
        filing_date: '2026-06-30',
        disclosure: '13F'
      },
      {
        name: 'FMR LLC (Fidelity Management)',
        shares_held: '42.1M',
        pct_owned: 1.86,
        change_shares: '+3.40M',
        change_pct: 0.15,
        holder_type: 'Mutual Fund / Active',
        filing_date: '2026-06-30',
        disclosure: '13F'
      },
      {
        name: 'Morgan Stanley Investment Management',
        shares_held: '31.5M',
        pct_owned: 1.39,
        change_shares: '-1.20M',
        change_pct: -0.05,
        holder_type: 'Investment Bank',
        filing_date: '2026-06-30',
        disclosure: '13F'
      },
      {
        name: 'Renaissance Technologies LLC',
        shares_held: '22.8M',
        pct_owned: 1.01,
        change_shares: '+4.50M',
        change_pct: 0.20,
        holder_type: 'Hedge Fund (Quant)',
        filing_date: '2026-06-30',
        disclosure: '13F'
      }
    ],
    shareholder_activity: [
      {
        holder_name: 'Renaissance Technologies LLC',
        change_type: 'increase',
        change_shares: '+4.50M',
        change_amount_usd: '+$810M',
        total_pct_held: 1.01,
        holder_type: 'Hedge Fund',
        date: '2026-06-30'
      },
      {
        holder_name: 'BlackRock, Inc.',
        change_type: 'increase',
        change_shares: '+6.12M',
        change_amount_usd: '+$1.10B',
        total_pct_held: 8.78,
        holder_type: 'Mutual Fund',
        date: '2026-06-30'
      },
      {
        holder_name: 'The Vanguard Group, Inc.',
        change_type: 'increase',
        change_shares: '+4.85M',
        change_amount_usd: '+$873M',
        total_pct_held: 9.54,
        holder_type: 'Mutual Fund',
        date: '2026-06-30'
      },
      {
        holder_name: 'Morgan Stanley Investment Management',
        change_type: 'decrease',
        change_shares: '-1.20M',
        change_amount_usd: '-$216M',
        total_pct_held: 1.39,
        holder_type: 'Investment Bank',
        date: '2026-06-30'
      },
      {
        holder_name: 'Citadel Advisors LLC',
        change_type: 'increase',
        change_shares: '+1.85M',
        change_amount_usd: '+$333M',
        total_pct_held: 0.65,
        holder_type: 'Hedge Fund',
        date: '2026-06-30'
      }
    ],
    insiders_overview: {
      insider_ownership_pct: 7.42,
      bullish_insiders_count: 4,
      bearish_insiders_count: 6,
      key_insiders: [
        {
          name: 'Peter A. Thiel',
          title: 'Co-Founder & Chairman',
          shares_held: '112.5M',
          pct_owned: 4.98
        },
        {
          name: 'Dr. Alexander C. Karp',
          title: 'Co-Founder & CEO',
          shares_held: '48.2M',
          pct_owned: 2.13
        },
        {
          name: 'Stephen Cohen',
          title: 'Co-Founder & President',
          shares_held: '12.4M',
          pct_owned: 0.55
        },
        {
          name: 'Shyam Sankar',
          title: 'CTO & EVP',
          shares_held: '4.8M',
          pct_owned: 0.21
        }
      ]
    },
    holder_type_breakdown: [
      { type: 'Mutual Fund (กองทุนรวม)', pct: 45.2 },
      { type: 'Index / ETF (กองทุนดัชนี)', pct: 28.6 },
      { type: 'Hedge Fund (เฮดจ์ฟันด์)', pct: 11.4 },
      { type: 'Sovereign Wealth (กองทุนความมั่งคั่งแห่งรัฐ)', pct: 8.5 },
      { type: 'Pension Fund (กองทุนบำเหน็จบำนาญ)', pct: 6.3 }
    ],
    quarterly_history: [
      { date: '2025/Q1', no_of_institutions: 2420, shares_held: '1.14B', pct_owned: 51.2, change_shares: '+35.2M', stock_price: 112.5 },
      { date: '2025/Q2', no_of_institutions: 2510, shares_held: '1.18B', pct_owned: 52.8, change_shares: '+40.1M', stock_price: 128.0 },
      { date: '2025/Q3', no_of_institutions: 2630, shares_held: '1.21B', pct_owned: 54.1, change_shares: '+30.5M', stock_price: 145.2 },
      { date: '2025/Q4', no_of_institutions: 2715, shares_held: '1.24B', pct_owned: 55.3, change_shares: '+28.4M', stock_price: 158.4 },
      { date: '2026/Q1', no_of_institutions: 2792, shares_held: '1.26B', pct_owned: 55.9, change_shares: '+22.0M', stock_price: 172.1 },
      { date: 'Latest', no_of_institutions: 2840, shares_held: '1.28B', pct_owned: 56.73, change_shares: '+42.5M', stock_price: 186.38 }
    ],
    recent_transactions: [
      {
        date: '2026-08-15',
        insider_name: 'Dr. Alexander Karp',
        title: 'CEO & Director',
        transaction_type: 'sell (Rule 10b5-1)',
        shares_count: 50000,
        price_per_share: 182.5,
        total_value_usd: 9125000,
        security_type: 'Common Stock'
      },
      {
        date: '2026-08-01',
        insider_name: 'David Glazer',
        title: 'CFO & Treasurer',
        transaction_type: 'sell (Rule 10b5-1)',
        shares_count: 15000,
        price_per_share: 178.0,
        total_value_usd: 2670000,
        security_type: 'Common Stock'
      },
      {
        date: '2026-07-20',
        insider_name: 'Shyam Sankar',
        title: 'CTO & EVP',
        transaction_type: 'sell (Rule 10b5-1)',
        shares_count: 25000,
        price_per_share: 179.0,
        total_value_usd: 4475000,
        security_type: 'Common Stock'
      },
      {
        date: '2026-06-30',
        insider_name: 'Stephen Cohen',
        title: 'President & Co-Founder',
        transaction_type: 'RSU Vesting / Acquisition',
        shares_count: 65000,
        price_per_share: 0,
        total_value_usd: 0,
        security_type: 'Restricted Stock (RSU)'
      },
      {
        date: '2026-06-15',
        insider_name: 'Peter A. Thiel',
        title: 'Chairman of the Board',
        transaction_type: 'Option Exercise & Hold',
        shares_count: 120000,
        price_per_share: 11.5,
        total_value_usd: 1380000,
        security_type: 'Derivative / Stock Option'
      }
    ],
    commentary: 'สถาบันการเงินและกองทุนดัชนีชั้นนำ (Vanguard, BlackRock, Renaissance) มีการเพิ่มสัดส่วนการถือครองอย่างต่อเนื่องในไตรมาสล่าสุด ขณะที่การทำรายการขายของผู้บริหารเป็นไปตามแผน Rule 10b5-1 ล่วงหน้าอย่างเคร่งครัด'
  },
  corporate_actions: {
    as_of_date: '2026-09-01',
    dividends: {
      summary: {
        has_dividend: false,
        dividend_yield_pct: 0.0,
        annual_payout_usd: 0.0,
        payout_ratio_pct: 0.0,
        frequency: 'ไม่มีการจ่ายเงินปันผล',
        policy_note: 'Palantir ไม่มีนโยบายจ่ายเงินปันผลในปัจจุบัน เนื่องจากบริษัทอยู่ในช่วงเร่งขยายการเติบโต (High-Growth Phase) และมุ่งเน้นนำกระแสเงินสดอิสระ (FCF) ทั้งหมดไปลงทุนต่อยอดในแพลตฟอร์ม AIP, การวิจัย AI Infrastructure และการขยายฐานลูกค้าเชิงพาณิชย์'
      },
      history: []
    },
    stock_splits: [
      {
        effective_date: '2020-09-30',
        split_type: 'Direct Listing',
        ratio: '1:1 (Direct Listing เข้าจดทะเบียนในตลาด NYSE)'
      }
    ],
    buybacks: {
      authorized_amount_musd: 1000,
      remaining_amount_musd: 850,
      shares_repurchased_last_12m: 1500000,
      net_share_reduction_pct: 0.8,
      commentary: 'คณะกรรมการบริษัทได้อนุมัติโครงการซื้อหุ้นคืน (Share Repurchase Program) วงเงิน 1,000 ล้านดอลลาร์สหรัฐ เพื่อลดผลกระทบ Dilution ที่เกิดจากค่าตอบแทนหุ้นพนักงาน (SBC) โดยยังมีวงเงินคงเหลืออีกกว่า 850 ล้านดอลลาร์'
    }
  },
  company_profile: {
    as_of_date: '2026-09-01',
    overview: {
      company_name: 'Palantir Technologies Inc.',
      symbol: 'PLTR',
      listing_date: '2020-09-30',
      issue_price: 10.0,
      isin: 'US69608A1088',
      founded_year: 2003,
      ceo: 'Dr. Alexander C. Karp',
      exchange: 'NASDAQ',
      employees_count: 3850,
      fiscal_year_end: '12-31',
      address: '1200 17th Street, Floor 15',
      city: 'Denver',
      province_state: 'Colorado',
      country: 'United States of America',
      zip_code: '80202',
      phone: '1-720-358-3679',
      website_url: 'https://www.palantir.com',
      description: 'Palantir Technologies Inc. สร้างและปรับใช้แพลตฟอร์มซอฟต์แวร์สำหรับการบูรณาการข้อมูลและการดำเนินงานขนาดใหญ่เพื่อช่วยองค์กรในการตัดสินใจเชิงยุทธศาสตร์ โดยมีแพลตฟอร์มหลัก 4 ระบบได้แก่ Palantir Gotham สำหรับงานความมั่นคงและการทหาร, Palantir Foundry สำหรับระบบปฏิบัติการข้อมูลขององค์กรเอกชน, Palantir AIP สำหรับเชื่อมโยง Large Language Models เข้ากับ Ontology ขององค์กรเพื่อสั่งการระบบอัตโนมัติ และ Palantir Apollo สำหรับการส่งมอบซอฟต์แวร์อย่างต่อเนื่อง'
    },
    executives: [
      {
        name: 'Dr. Alexander C. Karp',
        title: 'Co-Founder, Chief Executive Officer & Director',
        salary_usd: 5430000,
        age: 58,
        gender: 'male',
        bio: 'Dr. Alexander Karp เป็นผู้ร่วมก่อตั้งและดำรงตำแหน่งประธานเจ้าหน้าที่บริหารของ Palantir มาตั้งแต่ปี 2004 จบการศึกษาระดับปริญญาเอกจากมหาวิทยาลัยเกอเธ่แห่งแฟรงก์เฟิร์ต และปริญญาเอกด้านกฎหมายจากมหาวิทยาลัยสแตนฟอร์ด เป็นผู้นำวิสัยทัศน์ด้าน AI Sovereignty และการขยายตลาดภาคพาณิชย์',
        updated_date: '2026-06-03'
      },
      {
        name: 'Peter A. Thiel',
        title: 'Co-Founder & Chairman of the Board',
        salary_usd: 0,
        age: 58,
        gender: 'male',
        bio: 'Peter Thiel เป็นผู้ร่วมก่อตั้งและประธานกรรมการของ Palantir ตั้งแต่ปี 2003 เป็นผู้ร่วมก่อตั้ง PayPal และเป็นหนึ่งในนักลงทุน Venture Capital ชั้นนำระดับโลกที่ลงทุนในเทคโนโลยีเปลี่ยนโลก',
        updated_date: '2026-06-03'
      },
      {
        name: 'Shyam Sankar',
        title: 'Chief Technology Officer & Executive Vice President',
        salary_usd: 2850000,
        age: 48,
        gender: 'male',
        bio: 'Shyam Sankar ดำรงตำแหน่ง CTO ของ Palantir โดยรับผิดชอบการพัฒนาสถาปัตยกรรม AIP, Ontology และการขยายโซลูชัน Edge AI สำหรับงานกลาโหมและอุตสาหกรรมขนาดใหญ่',
        updated_date: '2026-06-03'
      },
      {
        name: 'David Glazer',
        title: 'Chief Financial Officer & Treasurer',
        salary_usd: 2150000,
        age: 44,
        gender: 'male',
        bio: 'David Glazer ดำรงตำแหน่ง CFO ดูแลการบริหารงบดุล การขยายตัวของอัตรากำไร Operating Margin และการสร้าง Free Cash Flow ที่แข็งแกร่งของบริษัทตั้งแต่ปี 2013',
        updated_date: '2026-06-03'
      },
      {
        name: 'Stephen Cohen',
        title: 'Co-Founder, President & Secretary',
        salary_usd: 1950000,
        age: 43,
        gender: 'male',
        bio: 'Stephen Cohen เป็นผู้ร่วมก่อตั้งที่ดูแลการพัฒนาซอฟต์แวร์รุ่นแรกของ Palantir และเป็นผู้นำทีมวิศวกรซอฟต์แวร์ในการขยายแพลตฟอร์ม Foundry',
        updated_date: '2026-06-03'
      }
    ]
  },
  business_analysis: {
    as_of_date: '2026-09-01',
    revenue_breakdown: {
      period: '2026/Q2',
      by_business: [
        { name: 'US Commercial (AIP / Foundry)', revenue_usd: '$520M', ratio_pct: 52.0, growth_yoy_pct: 55.4 },
        { name: 'US Government (Gotham Defense)', revenue_usd: '$340M', ratio_pct: 34.0, growth_yoy_pct: 28.2 },
        { name: 'International Government', revenue_usd: '$85M', ratio_pct: 8.5, growth_yoy_pct: 12.0 },
        { name: 'International Commercial', revenue_usd: '$55M', ratio_pct: 5.5, growth_yoy_pct: 18.5 }
      ],
      by_region: [
        { name: 'United States (สหรัฐอเมริกา)', revenue_usd: '$860M', ratio_pct: 86.0, growth_yoy_pct: 44.0 },
        { name: 'United Kingdom & Europe', revenue_usd: '$95M', ratio_pct: 9.5, growth_yoy_pct: 15.2 },
        { name: 'Asia Pacific & Middle East', revenue_usd: '$45M', ratio_pct: 4.5, growth_yoy_pct: 32.0 }
      ]
    },
    operational_efficiency: [
      { period: '2021/FY', headcount: 2920, headcount_yoy_pct: 19.5, revenue_per_employee_k_usd: 527.4, revenue_per_employee_yoy_pct: 17.5, operating_profit_per_employee_k_usd: -140.2, op_profit_per_employee_yoy_pct: -35.2, net_income_per_employee_k_usd: -178.1, net_income_per_employee_yoy_pct: -52.0 },
      { period: '2022/FY', headcount: 3838, headcount_yoy_pct: 31.4, revenue_per_employee_k_usd: 496.6, revenue_per_employee_yoy_pct: -5.8, operating_profit_per_employee_k_usd: -42.0, op_profit_per_employee_yoy_pct: 70.0, net_income_per_employee_k_usd: -96.7, net_income_per_employee_yoy_pct: 45.7 },
      { period: '2023/FY', headcount: 3800, headcount_yoy_pct: -1.0, revenue_per_employee_k_usd: 585.5, revenue_per_employee_yoy_pct: 17.9, operating_profit_per_employee_k_usd: 31.6, op_profit_per_employee_yoy_pct: 175.2, net_income_per_employee_k_usd: 57.1, net_income_per_employee_yoy_pct: 159.0 },
      { period: '2024/FY', headcount: 3650, headcount_yoy_pct: -3.9, revenue_per_employee_k_usd: 780.8, revenue_per_employee_yoy_pct: 33.4, operating_profit_per_employee_k_usd: 145.2, op_profit_per_employee_yoy_pct: 359.5, net_income_per_employee_k_usd: 122.4, net_income_per_employee_yoy_pct: 114.4 },
      { period: '2025/FY', headcount: 3750, headcount_yoy_pct: 2.7, revenue_per_employee_k_usd: 945.0, revenue_per_employee_yoy_pct: 21.0, operating_profit_per_employee_k_usd: 215.0, op_profit_per_employee_yoy_pct: 48.1, net_income_per_employee_k_usd: 165.0, net_income_per_employee_yoy_pct: 34.8 },
      { period: '2026/LTM', headcount: 3850, headcount_yoy_pct: 2.7, revenue_per_employee_k_usd: 1050.4, revenue_per_employee_yoy_pct: 11.2, operating_profit_per_employee_k_usd: 260.5, op_profit_per_employee_yoy_pct: 21.2, net_income_per_employee_k_usd: 185.2, net_income_per_employee_yoy_pct: 12.2 }
    ],
    key_takeaways: 'รายได้ส่วนใหญ่ขับเคลื่อนด้วยตลาดสหรัฐฯ (86%) และกลุ่ม Commercial AIP เติบโตรวดเร็วกว่า 55% YoY ผลิตภาพต่อพนักงานเพิ่มขึ้นเป็น $1.05M ต่อคน สะท้อนถึง Operating Leverage ที่ทรงพลัง'
  },
  financial_charts: {
    stock_price_history: [
      { date: 'Jun W1', price: 142.5 },
      { date: 'Jun W2', price: 148.0 },
      { date: 'Jun W3', price: 155.2 },
      { date: 'Jun W4', price: 152.0 },
      { date: 'Jul W1', price: 160.4 },
      { date: 'Jul W2', price: 168.9 },
      { date: 'Jul W3', price: 164.2 },
      { date: 'Jul W4', price: 171.0 },
      { date: 'Aug W1', price: 180.5 },
      { date: 'Aug W2', price: 188.2 },
      { date: 'Aug W3', price: 182.0 },
      { date: 'Aug W4', price: 186.38 }
    ],
    financial_performance_4q: [
      { quarter: 'Q3 2025', revenue: 0.73, net_income: 0.14 },
      { quarter: 'Q4 2025', revenue: 0.83, net_income: 0.08 },
      { quarter: 'Q1 2026', revenue: 0.88, net_income: 0.21 },
      { quarter: 'Q2 2026', revenue: 1.00, net_income: 0.33 }
    ]
  }
};

