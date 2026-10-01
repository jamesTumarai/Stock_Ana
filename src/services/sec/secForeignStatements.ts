import type { CanonicalFinancialDataset, CanonicalFinancialValue, FinancialStatementSection } from '../../domain/financialValue';
import { STATEMENT_MAPPING_VERSION, STATEMENT_NORMALIZATION_VERSION } from '../../domain/verifiedFinancialStatements';
import type { SecCompanyBundleLike } from './secFinancialMapper';
import type { SecCompanyFact } from './secClient';

const definitions: Array<[FinancialStatementSection,string,string[],boolean]> = [
  ['income_statement','revenue',['Revenue'],false],['income_statement','gross_profit',['GrossProfit'],false],
  ['income_statement','cogs',['CostOfSales'],false],['income_statement','operating_income',['ProfitLossFromOperatingActivities'],false],
  ['income_statement','net_income',['ProfitLoss'],false],['income_statement','net_income_parent',['ProfitLossAttributableToOwnersOfParent'],false],
  ['income_statement','income_before_tax',['ProfitLossBeforeTax'],false],['income_statement','income_tax_expense',['IncomeTaxExpenseContinuingOperations'],false],
  ['income_statement','eps_diluted',['DilutedEarningsLossPerShare'],false],
  ['balance_sheet','total_assets',['Assets'],true],['balance_sheet','total_liabilities',['Liabilities'],true],
  ['balance_sheet','total_equity',['Equity'],true],['balance_sheet','stockholders_equity',['EquityAttributableToOwnersOfParent'],true],
  ['balance_sheet','cash_and_equivalents',['CashAndCashEquivalents'],true],['balance_sheet','net_ppe',['PropertyPlantAndEquipment'],true],
  ['balance_sheet','total_current_assets',['CurrentAssets'],true],['balance_sheet','total_current_liabilities',['CurrentLiabilities'],true],
  ['balance_sheet','inventory',['Inventories'],true],['balance_sheet','accounts_receivable',['CurrentTradeReceivables'],true],
  ['cash_flow','operating_cash_flow',['CashFlowsFromUsedInOperatingActivities'],false],
  ['cash_flow','investing_cash_flow',['CashFlowsFromUsedInInvestingActivities'],false],['cash_flow','financing_cash_flow',['CashFlowsFromUsedInFinancingActivities'],false],
  ['cash_flow','capex',['PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities'],false],
  ['cash_flow','depreciation',['DepreciationAndAmortisationExpense'],false],
];
/** Annual IFRS facts remain annual, in their explicitly reported currency. No synthetic foreign quarters or FX. */
export function mapVerifiedForeignAnnualStatements(bundle:SecCompanyBundleLike):CanonicalFinancialDataset|null {
  const taxonomy=bundle.companyFacts.facts?.['ifrs-full']; if(!taxonomy) return null;
  const revenue=taxonomy.Revenue?.units||{};
  const candidates=Object.entries(revenue).filter(([unit,facts])=>/^[A-Z]{3}$/.test(unit)&&facts.some(f=>f.start&&f.end));
  if(!candidates.length) return null;
  const counts=candidates.map(([unit,facts])=>({unit,count:facts.length})).sort((a,b)=>b.count-a.count);
  // When convenience translations exist, the wider original-currency history takes precedence.
  // Equal non-USD candidates are ambiguous and require an explicit presentation-currency source.
  if(counts.length>1&&counts[0].count===counts[1].count) return null;
  const currency=counts[0].unit;
  const anchorFacts=revenue[currency].filter(f=>f.start&&f.end&&typeof f.val==='number'&&['20-F','20-F/A','40-F','40-F/A'].includes(f.form||'')&&
    (Date.parse(f.end)-Date.parse(f.start))/86400000>=300&&(Date.parse(f.end)-Date.parse(f.start))/86400000<=400);
  const anchors=new Map<string,SecCompanyFact>();
  for(const f of anchorFacts) if(!anchors.has(f.end!)||String(f.filed||'')>String(anchors.get(f.end!)?.filed||'')) anchors.set(f.end!,f);
  const ends=[...anchors.keys()].sort().slice(-6); if(!ends.length) return null;
  const periods=ends.map(end=>`FY${end.slice(0,4)}`),values:Record<string,CanonicalFinancialValue[]>={};
  const recent=bundle.submissions.filings?.recent;
  for(const [section,metric,names,instant] of definitions) {
    const series=ends.map((end,i):CanonicalFinancialValue=>{
      const anchor=anchors.get(end)!;
      const unit=metric==='eps_diluted'?`${currency}/shares`:currency;
      let fact:SecCompanyFact|undefined,concept='';
      for(const name of names) {
        const facts=taxonomy[name]?.units?.[unit]?.filter(f=>f.end===end&&f.accn&&typeof f.val==='number'&&(instant?!f.start:f.start===anchor.start)&&['20-F','20-F/A','40-F','40-F/A'].includes(f.form||''))||[];
        // Use the same annual filing cohort for instant accounting identity.
        const compatible=instant?facts.filter(f=>f.accn===anchor.accn):facts;
        fact=compatible.sort((a,b)=>String(b.filed||'').localeCompare(String(a.filed||'')))[0];if(fact){concept=`ifrs-full:${name}`;break;}
      }
      const accession=fact?.accn,idx=recent?.accessionNumber?.indexOf(accession)??-1;
      const document=idx>=0?recent?.primaryDocument?.[idx]:null;
      const source=accession?{provider:'SEC EDGAR IFRS XBRL',documentUrl:`https://www.sec.gov/Archives/edgar/data/${Number(bundle.identity.cik)}/${accession.replace(/-/g,'')}/${document||`${accession}-index.html`}`,
        documentType:fact?.form,filingDate:fact?.filed,periodEnd:end,accessionNumber:accession,retrievedAt:bundle.retrievedAt,accountingStandard:'IFRS' as const,authorityTier:1 as const}:undefined;
      return {metric,statement:section,period:periods[i],periodStart:instant?undefined:anchor.start,periodEnd:end,fiscalYear:Number(end.slice(0,4)),fiscalQuarter:4,
        periodType:instant?'instant':'annual',unit:metric==='eps_diluted'?'per_share':currency==='USD'?'USD_M':'CURRENCY_M',currency,
        value:fact?metric==='eps_diluted'?fact.val!:fact.val!/1e6:null,type:'reported',verification:fact?'verified':'unverified',accession,concept,source,form:fact?.form,
        derivation:fact?'Reported IFRS annual duration or exact year-end instant; no quarterly disaggregation or currency conversion.':'Compatible IFRS annual observation unavailable.'};
    });
    if(series.some(v=>v.value!==null)) values[`${section}.${metric}`]=series;
  }
  const all=Object.values(values).flat(),count=all.filter(v=>v.value!==null).length;
  return {schemaVersion:2,generatedBy:'lumina+sec-xbrl-ifrs-annual-v3',mappingVersion:STATEMENT_MAPPING_VERSION,normalizationVersion:STATEMENT_NORMALIZATION_VERSION,
    ticker:bundle.identity.ticker,currency,periods,values,provenanceStatus:'partially_source_linked',sourceCoverage:{nonNullValues:count,verifiedValues:count,sourceLinkedValues:count,totalValues:all.length,missingValues:all.length-count},
    provenanceWarnings:[{code:'IFRS_ANNUAL_ONLY',severity:'info',message:`Annual IFRS observations are denominated in reported ${currency}. Quarterly data and USD valuation are not synthesized.`}]};
}
