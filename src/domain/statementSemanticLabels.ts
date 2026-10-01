import type { FinancialStatementsData } from '../types';
export const STATEMENT_SEMANTIC_LABELS: Record<string,{en:string;th:string}> = {
  other_income:{en:'Other Income (Expense), Net',th:'รายได้ (ค่าใช้จ่าย) อื่นสุทธิ'},
  aoci:{en:'Accumulated Other Comprehensive Income (AOCI)',th:'กำไร/ขาดทุนเบ็ดเสร็จอื่นสะสม (AOCI)'},
  equity_compensation_and_option_proceeds:{en:'Stock Option Exercises & Other Stock Issuance Proceeds',th:'เงินรับจากการใช้สิทธิหุ้นและการออกหุ้นอื่น'},
  icf:{en:'Net Cash from Investing Activities',th:'กระแสเงินสดสุทธิจากกิจกรรมลงทุน'},
  investing_cash_flow:{en:'Net Cash from Investing Activities',th:'กระแสเงินสดสุทธิจากกิจกรรมลงทุน'},
  change_receivables:{en:'Change in Receivables',th:'ผลกระทบต่อกระแสเงินสดจากการเปลี่ยนแปลงลูกหนี้'},
  change_inventory:{en:'Change in Inventory',th:'ผลกระทบต่อกระแสเงินสดจากการเปลี่ยนแปลงสินค้าคงเหลือ'},
  change_payables:{en:'Change in Payables',th:'ผลกระทบต่อกระแสเงินสดจากการเปลี่ยนแปลงเจ้าหนี้'},
};
/** Identical amounts are insufficient: require shared source concept and
 * exact period/accession, or an explicit parent-to-common derivation. */
export function commonParentIncomeAlias(data: FinancialStatementsData, periods: string[]): boolean {
  let observations = 0;
  for (const period of periods) {
    const snapshot = data.period_snapshots?.find(item => item.label === period);
    const common = snapshot?.observations['income_statement.net_income_common'];
    const parent = snapshot?.observations['income_statement.net_income_parent'];
    if (!common && !parent) continue;
    if (!common || !parent || common.value !== parent.value || common.unit !== parent.unit || common.periodStart !== parent.periodStart || common.periodEnd !== parent.periodEnd) return false;
    const derivedParent = common.sourceComponents?.find(item => item.metric === 'net_income_parent');
    const source = derivedParent || common;
    if (source.concept !== parent.concept || source.accession !== parent.accession || !source.concept || !source.accession) return false;
    observations++;
  }
  return observations > 0;
}
