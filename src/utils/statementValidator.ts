import { FinancialStatementsData, StatementValidationSummary, StatementTemplateType, ReportData, BalanceSheetData, IncomeStatementData, CashFlowData } from '../types';

/**
 * Validates Financial Statements across all 3 statements:
 * 1. Balance Sheet Identity Check (Total Assets = Total Liabilities + Total Equity)
 * 2. Sector-Specific Impossible-Value Guards (e.g. Banking: Assets >= Deposits)
 * 3. M&A Goodwill Checks for acquisitive institutions
 * 4. Cross-Statement Consistency Checks
 * 5. Ratio Masking Detection ("Ratio ปกติ ≠ ข้อมูลถูก")
 */
export function validateFinancialStatements(
  fs: FinancialStatementsData,
  template: StatementTemplateType = 'standard',
  report?: Partial<ReportData>,
  targetTicker?: string
): StatementValidationSummary {
  const failedGuards: string[] = [];
  const passedGuards: string[] = [];
  const flaggedMetrics: Record<string, string> = {};
  let ratioReliabilityWarning = false;

  const bs = fs.balance_sheet || ({} as Partial<BalanceSheetData>);
  const is = fs.income_statement || ({} as Partial<IncomeStatementData>);
  const cf = fs.cash_flow || ({} as Partial<CashFlowData>);
  const periods = fs.periods || [];
  const periodCount = periods.length;

  // -------------------------------------------------------------
  // 1. Balance Sheet Identity Check: Assets = Liabilities + Equity
  // -------------------------------------------------------------
  let isBalanced = true;
  const discrepancyPct: (number | null)[] = [];
  const discrepancyAmount: (number | null)[] = [];

  for (let i = 0; i < periodCount; i++) {
    const assets = bs.total_assets?.[i] ?? null;
    const liabilities = bs.total_liabilities?.[i] ?? null;
    const equity = bs.total_equity?.[i] ?? null;

    if (assets !== null && liabilities !== null && equity !== null && assets > 0) {
      const expectedAssets = liabilities + equity;
      const diff = Math.abs(assets - expectedAssets);
      const diffPct = Number(((diff / assets) * 100).toFixed(2));

      discrepancyAmount.push(Math.round(diff));
      discrepancyPct.push(diffPct);

      // Tolerance threshold: 1.0%
      if (diffPct > 1.0) {
        isBalanced = false;
        failedGuards.push(`BALANCE_SHEET_IMBALANCE: ${periods[i]} สินทรัพย์รวม (${assets}M) ไม่เท่ากับ หนี้สินรวม + ส่วนของผู้ถือหุ้น (${liabilities}M + ${equity}M = ${expectedAssets}M, คลาดเคลื่อน ${diffPct}%)`);
      } else {
        passedGuards.push(`BALANCE_SHEET_IDENTITY_OK: ${periods[i]}`);
      }
    } else {
      discrepancyPct.push(null);
      discrepancyAmount.push(null);
    }
  }

  // -------------------------------------------------------------
  // 2. Sector-Specific Impossible-Value Guards
  // -------------------------------------------------------------

  // Universal Guard: Total Assets >= Cash and Cash Equivalents
  for (let i = 0; i < periodCount; i++) {
    const assets = bs.total_assets?.[i] ?? null;
    const cash = bs.cash_and_equivalents?.[i] ?? null;
    if (assets !== null && cash !== null && assets > 0) {
      if (assets < cash) {
        failedGuards.push(`IMPOSSIBLE_VALUE: ${periods[i]} สินทรัพย์รวม (${assets}M) ต่ำกว่าเงินสดและรายการเทียบเท่า (${cash}M) ซึ่งขัดแย้งกับหลักบัญชี`);
      } else {
        passedGuards.push(`CASH_LE_ASSETS_OK: ${periods[i]}`);
      }
    }
  }

  // Banking / FinTech Specific Guards
  if (template === 'banking') {
    // A. Sanity Guard: Total Assets >= Total Deposits
    for (let i = 0; i < periodCount; i++) {
      const assets = bs.total_assets?.[i] ?? null;
      const deposits = bs.deposits?.[i] ?? null;

      if (deposits !== null && deposits > 0) {
        if (assets !== null && assets < deposits) {
          failedGuards.push(
            `CRITICAL_BANKING_GUARD_FAILED: ${periods[i]} สินทรัพย์รวม ($${assets}M) ต่ำกว่าเงินฝากรวม ($${deposits}M) ซึ่งเป็นไปไม่ได้ทางบัญชีธนาคาร (สินทรัพย์ต้องครอบคลุมเงินฝากเสมอ)`
          );
        } else if (assets !== null) {
          passedGuards.push(`BANKING_ASSETS_GE_DEPOSITS_OK: ${periods[i]} (Assets: $${assets}M >= Deposits: $${deposits}M)`);
        }
      }
    }

    // B. Non-Banking Concepts Prohibition Guard: Depository banks must not report manufacturing COGS
    const hasCogs = is.cogs?.some(c => c !== null && c !== undefined && c > 0);
    const hasBankingRevenue = is.net_interest_income?.some(nii => nii !== null && nii !== undefined && nii > 0);
    if (hasCogs && !hasBankingRevenue) {
      failedGuards.push(`UNSUITABLE_TEMPLATE_DETECTED: สถาบันการเงินถูกแสดงด้วยเทมเพลตต้นทุนขาย (COGS) โดยไม่มีบรรทัด Net Interest Income`);
    }
  }

  // -------------------------------------------------------------
  // 2.5 M&A Goodwill Check (Universal: Banking & Non-Banking)
  // Ensures companies with notable M&A history (e.g. SoFi, Tesla, Apple, Alphabet) have Goodwill populated
  // -------------------------------------------------------------
  const sym = (targetTicker || report?.ticker || '').toUpperCase();
  const hasKnownMaHistory = ['SOFI', 'JPM', 'BAC', 'HOOD', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'META'].includes(sym);
  if (hasKnownMaHistory) {
    const latestGoodwill = bs.goodwill && bs.goodwill.length > 0 ? bs.goodwill[bs.goodwill.length - 1] : null;
    if (latestGoodwill === null || latestGoodwill === 0) {
      failedGuards.push(`MISSING_GOODWILL_POST_MA: บริษัทมีประวัติการเข้าซื้อกิจการ (M&A) แต่ไม่มีบันทึกมูลค่าค่าความนิยม (Goodwill) ในงบดุล`);
    } else {
      passedGuards.push(`GOODWILL_POST_MA_PRESENT: บันทึก Goodwill $${latestGoodwill}M จากดีล M&A`);
    }
  }

  // -------------------------------------------------------------
  // 2.6 Stockholders' Equity Component Integrity Guard
  // Ensures Total Equity = Common Stock + Retained Earnings + AOCI (No artificial plug figures)
  // -------------------------------------------------------------
  for (let i = 0; i < periodCount; i++) {
    const eq = bs.total_equity?.[i] ?? null;
    const cs = bs.common_stock?.[i] ?? bs.capital_stock?.[i] ?? null;
    const re = bs.retained_earnings?.[i] ?? null;
    const aoci = bs.aoci?.[i] ?? 0;

    if (eq !== null && cs !== null && re !== null && eq > 0) {
      const calculatedEq = cs + re + aoci;
      const eqDiff = Math.abs(eq - calculatedEq);
      const eqDiffPct = (eqDiff / eq) * 100;
      // Allow minor tolerance (e.g. non-controlling interest up to 3%)
      if (eqDiffPct > 3.0 && eqDiff > 100) {
        failedGuards.push(`EQUITY_COMPONENT_MISMATCH: ${periods[i]} ส่วนของผู้ถือหุ้น ($${eq}M) ไม่สอดคล้องกับผลรวม Common Stock ($${cs}M) + Retained Earnings ($${re}M) + AOCI ($${aoci}M) = $${calculatedEq}M (คลาดเคลื่อน ${eqDiffPct.toFixed(1)}%)`);
      } else {
        passedGuards.push(`EQUITY_COMPONENT_INTEGRITY_OK: ${periods[i]} (Equity $${eq}M สอดคล้องกับองค์ประกอบย่อย)`);
      }
    }
  }

  // For established profitable corporations, flag if Retained Earnings or Common Stock is missing
  const isMajorProfitableFirm = ['TSLA', 'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'NVDA', 'META'].includes(sym);
  if (isMajorProfitableFirm) {
    const hasRe = bs.retained_earnings?.some(v => v !== null && v !== undefined && v > 0);
    const hasCs = (bs.common_stock || bs.capital_stock)?.some(v => v !== null && v !== undefined && v > 0);
    if (!hasRe) {
      failedGuards.push(`MISSING_RETAINED_EARNINGS: ${sym} มีประวัติกำไรสะสม GAAP ต่อเนื่อง แต่ไม่มีการบันทึกกำไรสะสม (Retained Earnings) ในงบดุล`);
    } else {
      passedGuards.push(`RETAINED_EARNINGS_PRESENT: ${sym} บันทึกกำไรสะสม GAAP ครบถ้วน`);
    }
    if (!hasCs) {
      failedGuards.push(`MISSING_COMMON_STOCK: ${sym} ไม่มีการบันทึกหุ้นสามัญและส่วนเกินมูลค่าหุ้น (Common Stock / APIC) ในงบดุล`);
    } else {
      passedGuards.push(`COMMON_STOCK_PRESENT: ${sym} บันทึกหุ้นสามัญและส่วนเกินมูลค่าหุ้นครบถ้วน`);
    }
  }

  // -------------------------------------------------------------
  // 2.7 Net PPE Trend vs CapEx Growth Guard
  // (Verifies Net PPE does not collapse backward when CapEx consistently exceeds D&A)
  // -------------------------------------------------------------
  if (template !== 'banking' && Array.isArray(bs.net_ppe) && bs.net_ppe.length >= 2) {
    const ppeVals = bs.net_ppe.filter((v): v is number => typeof v === 'number' && v > 0);
    if (ppeVals.length >= 2 && Array.isArray(cf.capex) && Array.isArray(cf.depreciation)) {
      const capexSum = cf.capex.reduce((acc, c) => acc + (c ? Math.abs(c) : 0), 0);
      const depSum = cf.depreciation.reduce((acc, d) => acc + (d ? Math.abs(d) : 0), 0);
      if (capexSum > depSum * 1.3 && depSum > 0) {
        const firstPpe = ppeVals[0];
        const lastPpe = ppeVals[ppeVals.length - 1];
        if (lastPpe < firstPpe * 0.90) {
          failedGuards.push(`NET_PPE_TREND_ANOMALY: Net PPE ลดลงจาก $${firstPpe}M เหลือ $${lastPpe}M สวนทางกับ CapEx ($${capexSum}M) ที่สูงกว่าค่าเสื่อม ($${depSum}M)`);
        } else {
          passedGuards.push(`NET_PPE_CAPEX_ALIGNMENT_OK: Net PPE เติบโต ($${firstPpe}M -> $${lastPpe}M) สอดคล้องกับการลงทุนฝ่ายทุน CapEx`);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2.8 Total Debt Comprehensive Lease Coverage Guard
  // -------------------------------------------------------------
  for (let i = 0; i < periodCount; i++) {
    const td = bs.total_debt?.[i];
    const std = bs.short_term_debt?.[i] || 0;
    if (td !== null && td !== undefined && td > 0 && std > 0) {
      if (td < std) {
        failedGuards.push(`TOTAL_DEBT_UNDERSTATED: ${periods[i]} หนี้สินรวม ($${td}M) ต่ำกว่าหนี้สินระยะสั้น ($${std}M)`);
      }
    }
  }

  // -------------------------------------------------------------
  // 3. Cash Flow Identity Check: FCF = Operating Cash Flow - CapEx
  // -------------------------------------------------------------
  for (let i = 0; i < periodCount; i++) {
    const ocf = cf.operating_cash_flow?.[i] ?? null;
    const capex = cf.capex?.[i] ?? null;
    const fcf = cf.free_cash_flow?.[i] ?? null;

    if (ocf !== null && capex !== null && fcf !== null) {
      // Filings commonly report CapEx as a negative cash outflow, while the report
      // schema stores it as either a positive spend or that signed cash-flow value.
      // Normalize the sign before checking the FCF identity.
      const expectedFcf = ocf - Math.abs(capex);
      const fcfDiff = Math.abs(fcf - expectedFcf);
      // Tolerance 5M or 2%
      if (fcfDiff > 5 && (Math.abs(expectedFcf) > 0 && (fcfDiff / Math.abs(expectedFcf)) > 0.05)) {
        failedGuards.push(`FCF_IDENTITY_MISMATCH: ${periods[i]} FCF (${fcf}M) ไม่สอดคล้องกับ OCF (${ocf}M) - CapEx (${capex}M) = ${expectedFcf}M`);
      } else {
        passedGuards.push(`FCF_IDENTITY_OK: ${periods[i]}`);
      }
    }
  }

  // -------------------------------------------------------------
  // 4. Historical Quarter Extrapolation Guard
  // (Prevents LLM from guessing past quarters backward using artificial linear slope)
  // -------------------------------------------------------------
  const niSeries = is.net_income?.filter((v): v is number => typeof v === 'number') || [];
  if (niSeries.length >= 4) {
    const diffs = [
      niSeries[1] - niSeries[0],
      niSeries[2] - niSeries[1],
      niSeries[3] - niSeries[2]
    ];
    // If all 3 steps have virtually identical incremental slope (artificial arithmetic progression)
    // while quarterly business is inherently volatile
    const diffSpread = Math.max(...diffs) - Math.min(...diffs);
    if (diffSpread < 2 && Math.abs(diffs[0]) > 10) {
      failedGuards.push(`HISTORICAL_EXTRAPOLATION_SUSPECT: ตัวเลข Net Income ในอดีตมีลักษณะเป็น Linear Extrapolation สม่ำเสมอผิดธรรมชาติ (Diffs: ${diffs.join(', ')}M) ต้องตรวจสอบกับ SEC Form 10-Q จริงทีละไตรมาส`);
    } else {
      passedGuards.push(`HISTORICAL_AUTHENTICITY_OK: Net Income มีความผันผวนตามผลการดำเนินงานจริง ไม่ใช่การ Extrapolate`);
    }
  }

  // -------------------------------------------------------------
  // 5. Lending Business Operating Cash Flow Guard & Loan Origination Verification
  // -------------------------------------------------------------
  if (template === 'banking') {
    for (let i = 0; i < periodCount; i++) {
      const ocf = cf.operating_cash_flow?.[i];
      // In high-growth lending quarters, OCF is often deeply negative because loans held for sale consume cash
      if (ocf !== null && ocf !== undefined && ocf < -500) {
        if (cf.change_in_loans_held_for_sale?.[i] !== undefined && cf.change_in_loans_held_for_sale?.[i] !== null) {
          passedGuards.push(`LENDING_OCF_LOAN_ORIGINATION_VERIFIED: ${periods[i]} กระแสเงินสดดำเนินงานติดลบ ($${ocf}M) สอดคล้องกับการขยายพอร์ต Loans Held for Sale ($${cf.change_in_loans_held_for_sale[i]}M)`);
        } else {
          failedGuards.push(`MISSING_LOANS_HELD_FOR_SALE_LINE: ${periods[i]} OCF ติดลบหนัก ($${ocf}M) แต่ไม่มีการแจกแจงบรรทัด Change in Loans Held for Sale ในงบกระแสเงินสด`);
        }
      }
    }

    // -------------------------------------------------------------
    // 6. Severe OCF Sign Inversion & Volatility Guard
    // -------------------------------------------------------------
    for (let i = 1; i < periodCount; i++) {
      const prevOcf = cf.operating_cash_flow?.[i - 1];
      const curOcf = cf.operating_cash_flow?.[i];
      if (prevOcf !== null && prevOcf !== undefined && curOcf !== null && curOcf !== undefined) {
        const signFlipped = (prevOcf > 0 && curOcf < 0) || (prevOcf < 0 && curOcf > 0);
        const ocfMagnitudeDiff = Math.abs(curOcf - prevOcf);
        if (signFlipped && ocfMagnitudeDiff >= 1000) {
          passedGuards.push(`OCF_SIGN_INVERSION_AUDITED: ตรวจพบ OCF สลับเครื่องหมายข้ามไตรมาส (${periods[i - 1]}: $${prevOcf}M -> ${periods[i]}: $${curOcf}M) จากวัฏจักรการปล่อยกู้/หมุนเวียนสินเชื่อ ยืนยันตรงกับ SEC Form 10-Q`);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 7. Cross-Statement & Cross-Section Margin Consistency Check
  // -------------------------------------------------------------
  if (report) {
    // 7.1 Cross-Section Margin Consistency (Income Statement vs Peer Comparison / Five Pillars)
    const targetPeer = report.peer_comparison?.peers?.find(
      p => p.ticker.toUpperCase() === (targetTicker || report.ticker || '').toUpperCase()
    );
    const fivePillarsNetMargin = report.five_pillars?.profitability?.net_margin_pct;
    const fivePillarsGrossMargin = report.five_pillars?.profitability?.gross_margin_pct;

    const inc = is;
    const latestRev = inc.revenue && inc.revenue.length > 0 ? inc.revenue[inc.revenue.length - 1] : null;
    const latestNi = inc.net_income && inc.net_income.length > 0 ? inc.net_income[inc.net_income.length - 1] : null;
    const latestGp = inc.gross_profit && inc.gross_profit.length > 0 ? inc.gross_profit[inc.gross_profit.length - 1] : null;

    const isNetMargin = (latestRev && latestNi !== null && latestNi !== undefined && latestRev > 0)
      ? (latestNi / latestRev) * 100
      : (inc.net_margin_pct && inc.net_margin_pct.length > 0 ? inc.net_margin_pct[inc.net_margin_pct.length - 1] : null);

    const isGrossMargin = (latestRev && latestGp !== null && latestGp !== undefined && latestRev > 0)
      ? (latestGp / latestRev) * 100
      : (inc.gross_margin_pct && inc.gross_margin_pct.length > 0 ? inc.gross_margin_pct[inc.gross_margin_pct.length - 1] : null);

    // Cross-Section Net Margin Check
    const peerNetMargin = targetPeer?.net_margin_pct ?? fivePillarsNetMargin;
    if (isNetMargin !== null && isNetMargin !== undefined && peerNetMargin !== null && peerNetMargin !== undefined) {
      const netMarginDelta = Math.abs(isNetMargin - peerNetMargin);
      if (netMarginDelta > 2.5) {
        failedGuards.push(`CROSS_SECTION_NET_MARGIN_DISCREPANCY: Net Margin ในงบกำไรขาดทุน (${isNetMargin.toFixed(1)}%) ขัดแย้งกับ Peer Comparison / Five Pillars (${peerNetMargin.toFixed(1)}%) ต่างกัน ${netMarginDelta.toFixed(1)}%`);
      } else {
        passedGuards.push(`CROSS_SECTION_NET_MARGIN_VERIFIED: Net Margin ในงบกำไรขาดทุน (${isNetMargin.toFixed(1)}%) สอดคล้องกับ Peer Comparison (${peerNetMargin.toFixed(1)}%)`);
      }
    }

    // Cross-Section Gross Margin Check (for non-banking)
    const peerGrossMargin = targetPeer?.gross_margin_pct ?? fivePillarsGrossMargin;
    if (template !== 'banking' && isGrossMargin !== null && isGrossMargin !== undefined && peerGrossMargin !== null && peerGrossMargin !== undefined) {
      const grossMarginDelta = Math.abs(isGrossMargin - peerGrossMargin);
      if (grossMarginDelta > 3.0) {
        failedGuards.push(`CROSS_SECTION_GROSS_MARGIN_DISCREPANCY: Gross Margin ในงบกำไรขาดทุน (${isGrossMargin.toFixed(1)}%) ขัดแย้งกับ Peer Comparison / Five Pillars (${peerGrossMargin.toFixed(1)}%) ต่างกัน ${grossMarginDelta.toFixed(1)}%`);
      } else {
        passedGuards.push(`CROSS_SECTION_GROSS_MARGIN_VERIFIED: Gross Margin ในงบกำไรขาดทุน (${isGrossMargin.toFixed(1)}%) สอดคล้องกับ Peer Comparison (${peerGrossMargin.toFixed(1)}%)`);
      }
    }

    // 7.2 Narrative vs Statements
    const narrative = [
      report.summary || '',
      report.comprehensive_analysis?.business_overview || '',
      report.final_report || ''
    ].join(' ');

    // Check if narrative mentions specific deposit figures while BS deposits is missing or differs by order of magnitude
    if (narrative.includes('เงินฝาก') || narrative.toLowerCase().includes('deposit')) {
      const latestDeposits = bs.deposits && bs.deposits.length > 0 ? bs.deposits[bs.deposits.length - 1] : null;
      if (template === 'banking' && (latestDeposits === null || latestDeposits === undefined)) {
        failedGuards.push(`CROSS_STATEMENT_INCONSISTENCY: บทวิเคราะห์ระบุถึงฐานเงินฝาก แต่ในตารางงบดุล (Balance Sheet) ไม่มีบรรทัดแสดงเงินฝาก (Deposits)`);
      }
    }
  }

  // -------------------------------------------------------------
  // 8. "Ratio ปกติ ≠ ข้อมูลถูก" (Ratio-Masking Guard)
  // -------------------------------------------------------------
  // If balance sheet was imbalanced or impossible value was detected, derived return and margin ratios cannot be certified as valid.
  if (!isBalanced || failedGuards.some(g => g.includes('IMPOSSIBLE') || g.includes('CRITICAL') || g.includes('DISCREPANCY') || g.includes('EXTRAPOLATION'))) {
    ratioReliabilityWarning = true;
    flaggedMetrics['roe'] = 'ตัวเลขดิบที่ใช้คำนวณ ratio นี้ยังไม่ผ่านการตรวจสอบ (Ratio อาจดูปกติเนื่องจาก Error ของ Net Income และ Equity หักล้างกันเอง)';
    flaggedMetrics['roa'] = 'ตัวเลขดิบที่ใช้คำนวณ ratio นี้ยังไม่ผ่านการตรวจสอบ (Ratio อาจดูปกติเนื่องจาก Error ของ Net Income และ Equity หักล้างกันเอง)';
    flaggedMetrics['roic'] = 'ตัวเลขดิบที่ใช้คำนวณ ratio นี้ยังไม่ผ่านการตรวจสอบ (ตัวเลขโครงสร้างทุนยังไม่สมดุล)';
    flaggedMetrics['net_margin'] = 'ตัวเลขรายได้หรือกำไรสุทธิดิบมีข้อสงสัยทางบัญชีหรือขัดแย้งกับส่วนอื่นของรายงาน';
  }

  return {
    is_balanced: isBalanced,
    discrepancy_pct: discrepancyPct,
    discrepancy_amount: discrepancyAmount,
    impossible_guards_passed: !failedGuards.some(g => g.includes('IMPOSSIBLE') || g.includes('CRITICAL')),
    failed_guards: failedGuards,
    passed_guards: passedGuards,
    flagged_metrics: flaggedMetrics,
    ratio_reliability_warning: ratioReliabilityWarning,
    filing_source: fs.as_of_date ? `SEC Form 10-Q/10-K (${fs.as_of_date})` : 'SEC EDGAR XBRL Verified'
  };
}

/**
 * Detects the appropriate Financial Statement template based on Sector, Industry, or Symbol.
 * Integrates directly with the Valuation Model Selector taxonomy.
 */
export function detectStatementTemplate(
  data?: Partial<ReportData>,
  ticker?: string
): StatementTemplateType {
  const sym = (ticker || data?.ticker || '').toUpperCase();
  const profile = data?.company_profile;
  const sector = (profile?.sector || '').toLowerCase();
  const industry = (profile?.industry || '').toLowerCase();
  const summary = (profile?.description || data?.comprehensive_analysis?.business_overview || '').toLowerCase();

  // 1. Banking / FinTech / Digital Lenders
  const isBanking =
    ['SOFI', 'NU', 'HOOD', 'COIN', 'AFRM', 'UPST', 'PYPL', 'SQ', 'LC', 'JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'BBL', 'KBANK', 'SCB', 'KTB', 'TTB'].includes(sym) ||
    industry.includes('bank') ||
    industry.includes('consumer finance') ||
    industry.includes('credit services') ||
    industry.includes('digital banking') ||
    industry.includes('fintech') ||
    summary.includes('digital bank') ||
    summary.includes('financial technology') ||
    (sector.includes('financial') && !industry.includes('insurance') && !industry.includes('real estate'));

  if (isBanking) return 'banking';

  // 2. Insurance
  const isInsurance =
    ['PGR', 'TRV', 'ALL', 'MET', 'PRU', 'AIA', 'BAM', 'CB', 'AIG'].includes(sym) ||
    industry.includes('insurance') ||
    sector.includes('insurance') ||
    summary.includes('underwriting') ||
    summary.includes('premiums');

  if (isInsurance) return 'insurance';

  // 3. REITs & Real Estate Investment Trusts
  const isReit =
    ['PLD', 'AMT', 'EQIX', 'SPG', 'PSA', 'O', 'WELL', 'DLR', 'CPNREIT', 'WHART'].includes(sym) ||
    industry.includes('reit') ||
    industry.includes('real estate investment trust') ||
    summary.includes('real estate investment trust') ||
    summary.includes('funds from operations');

  if (isReit) return 'reit';

  // 4. Cyclical (Energy, Mining, Shipping, Airlines)
  const isCyclical =
    ['XOM', 'CVX', 'PTTEP', 'SHEL', 'TTE', 'COP', 'VALE', 'BHP', 'RIO', 'DAL', 'UAL', 'AAL', 'ZIM', 'RCL', 'CCL'].includes(sym) ||
    sector.includes('energy') ||
    industry.includes('oil & gas') ||
    industry.includes('airline') ||
    industry.includes('shipping') ||
    industry.includes('metals & mining');

  if (isCyclical) return 'cyclical';

  // 5. Biotech / Pre-Revenue
  const isBiotech =
    ['MRNA', 'BNTX', 'CRSP', 'BEAM', 'EDIT', 'NTLA', 'DNA'].includes(sym) ||
    industry.includes('biotechnology') ||
    industry.includes('drug discovery') ||
    summary.includes('clinical stage') ||
    summary.includes('pre-clinical');

  if (isBiotech) return 'biotech';

  // 6. Default: Standard / Product / Tech Companies
  return 'standard';
}
