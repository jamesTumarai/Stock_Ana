import type { ReportData } from '../../types';
import { periodsMatch } from '../metricLineage';
import {
  DataGapState,
  type VerifiedFact,
} from './types';
import { buildDataGapInventory } from './gapInventory';

/**
 * Merges verified facts into ReportData without overwriting existing higher-authority data.
 * Preserves source authority and exact provenance.
 */
export function mergeVerifiedFactsIntoReport(
  report: ReportData,
  facts: VerifiedFact[],
  archetype?: string
): ReportData {
  const result = structuredClone(report);
  const fs = result.financial_statements;
  const periods = fs?.periods ||
    (fs?.income_statement as any)?.periods ||
    (fs?.balance_sheet as any)?.periods ||
    (fs?.cash_flow as any)?.periods ||
    [];

  const allVerifiedFacts: VerifiedFact[] = [...(result.data_completeness?.verifiedFacts || [])];

  if (facts && facts.length > 0) {
    for (const fact of facts) {
      if (fact.value === null || fact.value === undefined) continue;

      // Find matching period index if periods exist
      let periodIdx = -1;
      if (periods.length > 0) {
        periodIdx = periods.findIndex((p) => periodsMatch(p, fact.fiscalPeriod));
      } else {
        periodIdx = 0;
      }

      if (periodIdx === -1 && periods.length > 0) {
        // Period not present in report's period window — fail closed
        continue;
      }

      const numVal = typeof fact.value === 'number' ? fact.value : parseFloat(String(fact.value));
      if (!Number.isFinite(numVal)) continue;

      allVerifiedFacts.push(fact);

      if (fs) {
        // 1. Merge into Income Statement
        if (fs.income_statement) {
          const inc = fs.income_statement as any;
          if (fact.metricKey in inc) {
            const field = inc[fact.metricKey];
            if (Array.isArray(field)) {
              if (field[periodIdx] === null || field[periodIdx] === undefined) {
                field[periodIdx] = numVal;
              }
            } else if (field === null || field === undefined) {
              inc[fact.metricKey] = numVal;
            }
          } else {
            // Sector-specific extension line
            inc[fact.metricKey] = Array.isArray(inc.revenue)
              ? inc.revenue.map((_: any, idx: number) => (idx === periodIdx ? numVal : null))
              : [numVal];
          }
        }

        // 2. Merge into Balance Sheet
        if (fs.balance_sheet) {
          const bs = fs.balance_sheet as any;
          if (fact.metricKey in bs) {
            const field = bs[fact.metricKey];
            if (Array.isArray(field)) {
              if (field[periodIdx] === null || field[periodIdx] === undefined) {
                field[periodIdx] = numVal;
              }
            } else if (field === null || field === undefined) {
              bs[fact.metricKey] = numVal;
            }
          } else if (fact.metricKey === 'deposits' || fact.metricKey === 'loans_held_for_investment' || fact.metricKey === 'loss_reserve') {
            bs[fact.metricKey] = Array.isArray(bs.total_assets)
              ? bs.total_assets.map((_: any, idx: number) => (idx === periodIdx ? numVal : null))
              : [numVal];
          }
        }

        // 3. Merge into Cash Flow
        if (fs.cash_flow) {
          const cf = fs.cash_flow as any;
          if (fact.metricKey in cf) {
            const field = cf[fact.metricKey];
            if (Array.isArray(field)) {
              if (field[periodIdx] === null || field[periodIdx] === undefined) {
                field[periodIdx] = numVal;
              }
            } else if (field === null || field === undefined) {
              cf[fact.metricKey] = numVal;
            }
          }
        }
      }

      // 4. Merge into Key Indicators
      if (!result.key_indicators) {
        result.key_indicators = {};
      }
      const ki = result.key_indicators as any;
      if (fact.metricKey === 'net_interest_margin_pct' || fact.metricKey === 'combined_ratio_pct') {
        if (!ki.profitability) ki.profitability = {};
        if (ki.profitability[fact.metricKey] === null || ki.profitability[fact.metricKey] === undefined) {
          ki.profitability[fact.metricKey] = numVal;
        }
      } else if (fact.metricKey === 'tier1_capital_ratio' || fact.metricKey === 'cash_runway_months') {
        if (!ki.financial_health) ki.financial_health = {};
        if (ki.financial_health[fact.metricKey] === null || ki.financial_health[fact.metricKey] === undefined) {
          ki.financial_health[fact.metricKey] = numVal;
        }
      }
    }
  }

  // 5. Deterministic derivation of dependent metrics where both inputs exist
  const inc = fs?.income_statement;
  const cf = fs?.cash_flow;

  if (inc?.revenue && inc?.gross_profit) {
    const revArr = Array.isArray(inc.revenue) ? inc.revenue : [inc.revenue];
    const gpArr = Array.isArray(inc.gross_profit) ? inc.gross_profit : [inc.gross_profit];

    for (let i = 0; i < revArr.length; i++) {
      const rev = revArr[i];
      const gp = gpArr[i];
      if (typeof rev === 'number' && rev > 0 && typeof gp === 'number') {
        const gmVal = Math.round((gp / rev) * 10000) / 100;
        if (inc.gross_margin_pct && Array.isArray(inc.gross_margin_pct)) {
          if (inc.gross_margin_pct[i] === null || inc.gross_margin_pct[i] === undefined) {
            inc.gross_margin_pct[i] = gmVal;
          }
        }
        allVerifiedFacts.push({
          metricKey: 'gross_margin_pct',
          value: gmVal,
          unit: 'percent',
          fiscalPeriod: periods[i] || 'Latest',
          periodType: 'DERIVED_RATIO',
          sourceType: 'LUMINA_CANONICAL',
          sourceDocument: 'Derived from verified Revenue and Gross Profit',
          reportedOrDerived: 'DERIVED',
          extractionMethod: 'DETERMINISTIC_FORMULA',
          formula: '(Gross Profit / Revenue) * 100',
          verificationStatus: DataGapState.VERIFIED_DERIVED,
          confidence: 1.0,
          issuerIdentity: (result as any).symbol || result.ticker || 'UNKNOWN',
        });
      }
    }
  }

  if (cf?.operating_cash_flow && cf?.capex && cf?.free_cash_flow) {
    const ocfArr = Array.isArray(cf.operating_cash_flow) ? cf.operating_cash_flow : [cf.operating_cash_flow];
    const capexArr = Array.isArray(cf.capex) ? cf.capex : [cf.capex];

    for (let i = 0; i < ocfArr.length; i++) {
      const ocf = ocfArr[i];
      const capex = capexArr[i];
      if (typeof ocf === 'number' && typeof capex === 'number') {
        if (cf.free_cash_flow[i] === null || cf.free_cash_flow[i] === undefined) {
          cf.free_cash_flow[i] = Math.round((ocf - Math.abs(capex)) * 100) / 100;
        }
      }
    }
  }

  // 6. Build completeness summary and attach to report
  const inventory = buildDataGapInventory(result, archetype);
  result.data_completeness = {
    ...inventory.summary,
    verifiedFacts: allVerifiedFacts,
  };

  return result;
}
