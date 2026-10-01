import type { ReportData } from '../../types';
import { resolveCurrentBalanceSheetSnapshot } from '../currentBalanceSheetSnapshot';
import { sameShareClassTicker } from '../tickerIdentity';

/** Current common-share denominator shared by every valuation consumer.
 * Weighted-average shares, profile estimates and old class counts cannot replace it. */
export function verifiedCurrentShares(report: Partial<ReportData>): number | null {
  const envelope = report.sec_verification;
  const inputs = envelope?.dcf_financial_inputs;
  const shares = sameShareClassTicker(envelope?.ticker || '', report.ticker || '')
    && inputs?.generated_by === 'sec-verified-financial-inputs-v1'
    && sameShareClassTicker(inputs.ticker, report.ticker || '')
    && inputs.share_as_of && Number.isFinite(Date.parse(inputs.share_as_of))
    ? inputs.current_shares_outstanding_m : null;
  const end = resolveCurrentBalanceSheetSnapshot(report).periodEnd;
  if (!end || !inputs?.share_as_of) return null;
  const lag = Date.parse(inputs.share_as_of) - Date.parse(end);
  if (!Number.isFinite(lag) || lag < -100 * 86_400_000 || lag > 120 * 86_400_000) return null;
  return typeof shares === 'number' && Number.isFinite(shares) && shares > 0 ? shares : null;
}
