import type { InsiderTransaction } from '../types';
export type InsiderEventType='PLAN_ADOPTION'|'PLAN_TERMINATION'|'EXECUTED_SALE'|'PURCHASE'|'GIFT'|'RSU_VESTING'|'TAX_WITHHOLDING'|'OTHER';
export function classifyInsiderEvent(tx:InsiderTransaction):InsiderEventType {
  const label=tx.transaction_type?.toLowerCase()??'';
  if(/plan.*terminat|terminat.*plan/.test(label))return 'PLAN_TERMINATION';
  if(/plan|10b5.?1/.test(label))return 'PLAN_ADOPTION';
  if(/gift|donat/.test(label))return 'GIFT';
  if(/tax|withhold/.test(label))return 'TAX_WITHHOLDING';
  if(/vest|rsu/.test(label))return 'RSU_VESTING';
  if(typeof tx.shares_count!=='number'||!Number.isFinite(tx.shares_count)||tx.shares_count<=0)return 'OTHER';
  if(/^(?:sell|sale|executed_sale|open.market sale|disposition)$/.test(label))return 'EXECUTED_SALE';
  if(/^(?:buy|purchase|open.market purchase)$/.test(label))return 'PURCHASE';
  return 'OTHER';
}
export function summarizeInsiderExecutions(transactions:InsiderTransaction[]) {
  const categories=transactions.map(classifyInsiderEvent);
  return {purchases:categories.filter(type=>type==='PURCHASE').length,sales:categories.filter(type=>type==='EXECUTED_SALE').length,
    plans:categories.filter(type=>type==='PLAN_ADOPTION'||type==='PLAN_TERMINATION').length,
    other:categories.filter(type=>!['PURCHASE','EXECUTED_SALE','PLAN_ADOPTION','PLAN_TERMINATION'].includes(type)).length};
}
