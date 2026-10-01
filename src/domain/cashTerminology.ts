import type { CurrentBalanceSheetSnapshot } from './currentBalanceSheetSnapshot';

type CashTerm = 'cash' | 'cash_and_investments' | 'net_cash' | 'net_debt';
const labels: Record<CashTerm, { en: string; th: string }> = {
  cash: { en: 'Cash & Cash Equivalents', th: 'เงินสดและรายการเทียบเท่าเงินสด' },
  cash_and_investments: { en: 'Cash + Short-Term Investments', th: 'เงินสดรวมเงินลงทุนระยะสั้น' },
  net_cash: { en: 'Net Cash', th: 'สถานะเงินสดสุทธิ' },
  net_debt: { en: 'Net Debt', th: 'หนี้สินสุทธิ' },
};

export const netCashPositionLabel = (signedNetCash: number, isThai = false): string =>
  labels[signedNetCash >= 0 ? 'net_cash' : 'net_debt'][isThai ? 'th' : 'en'];

const combined = '(?:cash\\s*(?:and|\\+|&)\\s*(?:(?:cash\\s*)?equivalents\\s*(?:and|\\+|&)\\s*)?(?:short[ -]term\\s+)?investments|เงินสด(?:และรายการเทียบเท่าเงินสด)?\\s*(?:และ|รวม|\\+)\\s*เงินลงทุนระยะสั้น)';
const cash = '(?:cash\\s*(?:and|&)\\s*(?:cash\\s*)?equivalents|เงินสดและรายการเทียบเท่า(?:เงินสด)?)';
const net = '(?:net\\s+cash(?!\\s+flow)|net\\s+debt|(?:สถานะ)?เงินสดสุทธิ|(?:ภาระ)?หนี้สินสุทธิ)';
const formula = `(?:${combined}\\s*(?:[-−]|less|minus|หัก)\\s*(?:canonical\\s+|total\\s+)?debt|เงินสด(?:รวม|และ)เงินลงทุนระยะสั้น\\s*หัก\\s*หนี้สิน(?:ทางการเงิน)?(?:รวม)?)`;
const term = `(?:${formula}|${combined}|${cash}|${net})`;
const amountPattern = '[-+]?\\s*\\$?\\s*[-+]?\\s*\\d[\\d,]*(?:\\.\\d+)?';
const unitPattern = '(?:billion|million|bn|B|M|พันล้าน|ล้าน|USD|dollars?|ดอลลาร์(?:สหรัฐ)?)(?![a-z])';
const claim = new RegExp(`(${term})(?:\\s*\\(${term}\\))?([\\s*:]*?(?:(?:of|is|was|at|equals?|อยู่ที่|จำนวน|เท่ากับ|คือ|สูงถึง)\\s*)?(?:(?:approximately|about|roughly|ประมาณ)\\s*)?)(${amountPattern})(\\s*)(${unitPattern})`, 'gi');
const amountFirstClaim = new RegExp(`(${amountPattern}\\s*${unitPattern})(\\s+(?:in|of)\\s+)(${term})(?![a-z])`, 'gi');

const termKind = (label: string): CashTerm => {
  if (/net\s+debt|หนี้สินสุทธิ/i.test(label)) return 'net_debt';
  if (/net\s+cash|เงินสดสุทธิ/i.test(label)) return 'net_cash';
  if (/investments|เงินลงทุนระยะสั้น/i.test(label)) return 'cash_and_investments';
  return 'cash';
};

/**
 * Changes labels only. A numeric match must be unique among the four canonical
 * concepts; equal cash/net-cash values (e.g. zero debt) are not evidence of a mislabel.
 * Unknown/stale values stay with the existing value-reconciliation policy.
 */
export function reconcileCashTerminology(text: string, snapshot: CurrentBalanceSheetSnapshot): string {
  if (!text) return text;
  const reconcileLabel = (label: string, amount: string, unit: string): string => {
    const isThai = /[ก-๙]/.test(label);
    const numeric = Number(amount.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(numeric)) return label;
    const scale = /^(?:billion|bn|b|พันล้าน)$/i.test(unit) ? 1000
      : /^(?:USD|dollars?|ดอลลาร์(?:สหรัฐ)?)$/i.test(unit) ? 1 / 1_000_000 : 1;
    const stated = numeric * scale;
    const decimals = amount.match(/\.(\d+)/)?.[1].length ?? 0;
    const tolerance = Math.max(0.000001, scale * 0.5 * 10 ** -decimals);
    const netTerm: CashTerm = snapshot.netCash !== null && snapshot.netCash < 0 && stated >= 0 ? 'net_debt' : 'net_cash';
    const candidates: Array<[CashTerm, number | null]> = [
      ['cash', snapshot.cashAndEquivalents],
      ['cash_and_investments', snapshot.cashPlusShortTermInvestments],
      [netTerm, snapshot.netCash === null ? null : netTerm === 'net_debt' ? Math.abs(snapshot.netCash) : snapshot.netCash],
    ];
    const matching = candidates.filter(([, value]) => value !== null && Math.abs(stated - value) <= tolerance).map(([kind]) => kind);
    const existing = termKind(label);
    const isFormula = /(?:[-−]|less|minus|หัก)\s*(?:canonical\s+|total\s+)?(?:debt|หนี้สิน)/i.test(label);
    const selected = isFormula ? 'net_cash' : matching.includes(existing) ? existing : matching.length === 1 ? matching[0] : existing;
    // Keep correct cash/combined labels verbatim, including their separate figures.
    if (selected === existing && !isFormula && existing !== 'net_cash' && existing !== 'net_debt') return label;
    return labels[selected][isThai ? 'th' : 'en'];
  };
  const labeled = text.replace(claim, (full, label: string, connector: string, amount: string, gap: string, unit: string) => {
    const next = reconcileLabel(label, amount, unit);
    return next === label ? full : `${next}${connector}${amount}${gap}${unit}`;
  });
  return labeled.replace(amountFirstClaim, (full, figure: string, connector: string, label: string) => {
    const parts = figure.match(new RegExp(`^(${amountPattern})\\s*(${unitPattern})$`, 'i'));
    if (!parts) return full;
    return `${figure}${connector}${reconcileLabel(label, parts[1], parts[2])}`;
  });
}
