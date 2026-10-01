import type { ReportData } from '../../types';
import { resolveBusinessArchetype, type BusinessArchetype } from '../financialMetricContext';
import { calculateDDMModel } from '../../utils/valuation/ddmCalculator';
import { discoverPeers, calculateDeterministicMedian, resolvePeerMetricCoverage } from './peerDiscoveryEngine';
import type { CanonicalFinancialDataset } from '../financialValue';
import { resolveCurrentBalanceSheetSnapshot } from '../currentBalanceSheetSnapshot';
import { resolveFundamentalMetrics } from './metricRegistry';
import { reconcileCanonicalTtmFlow } from '../canonicalTtmFlow';
import { calculateStrictDCFValue } from '../../utils/valuation/dcfMathEngine';
import { getFiscalQuarterOrdinal } from './canonicalQuarterWindow';
import { resolveIssuerNonGaapTtm } from '../issuerNonGaapTtm';
import { resolveValuationPriceMetrics } from './valuationPriceMetrics';
import { verifiedCurrentShares } from './verifiedCurrentShares';

export type PrimaryValuationMethod =
  | 'FCFF_DCF' | 'RESIDUAL_INCOME' | 'DIVIDEND_DISCOUNT' | 'SOTP'
  | 'AFFO_MULTIPLE' | 'PEER_EV_SALES' | 'CYCLICAL_NORMALIZED_DCF'
  | 'UNAVAILABLE';

export interface CanonicalValuationRun {
  valuationRunId: string;
  financialSnapshotId: string;
  inputHash: string;
  assumptionHash: string;
  modelVersion: 'adaptive-valuation-v2';
  archetype: BusinessArchetype;
  primaryMethod: PrimaryValuationMethod;
  secondaryMethods: PrimaryValuationMethod[];
  status: 'AVAILABLE' | 'INSUFFICIENT_VERIFIED_DATA' | 'NON_DETERMINISTIC';
  currentPrice: number | null;
  bearFairValue: number | null;
  baseFairValue: number | null;
  bullFairValue: number | null;
  marginOfSafetyPct: number | null;
  missingInputs: string[];
  requestedPrimaryMethod: PrimaryValuationMethod;
  fallbackReason: string | null;
  inputSnapshot: Record<string, unknown>;
  assumptionSnapshot: Record<string, unknown>;
  modelConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNAVAILABLE';
  methodEligibility?: Array<{method:PrimaryValuationMethod;role:'PRIMARY'|'SECONDARY'|'NOT_APPLICABLE';status:'ELIGIBLE'|'INSUFFICIENT_VERIFIED_DATA'|'NOT_APPLICABLE';reason:string}>;
  inputCoverage?: {available:number;required:number;missing:string[]};
  /** Historical inputs and model assumptions have different provenance. */
  provenance: {
    financialInputs: 'SEC_OR_ISSUER_VERIFIED' | 'UNVERIFIED';
    marketInputs: 'PROVIDER' | 'UNAVAILABLE';
    assumptions: 'MODEL_ASSUMPTIONS';
  };
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Stable, synchronous fingerprint: IDs are comparison tokens, not signatures. */
export function valuationFingerprint(value: unknown): string {
  const stable = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(stable);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]));
    }
    return input === undefined ? null : input;
  };
  const source = JSON.stringify(stable(value));
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(source)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}

const METHOD_POLICY: Partial<Record<BusinessArchetype, PrimaryValuationMethod[]>> = {
  bank: ['RESIDUAL_INCOME', 'DIVIDEND_DISCOUNT'],
  lender: ['RESIDUAL_INCOME', 'SOTP'],
  fintech: ['SOTP', 'RESIDUAL_INCOME'],
  broker_exchange: ['SOTP', 'RESIDUAL_INCOME', 'DIVIDEND_DISCOUNT'],
  insurer: ['RESIDUAL_INCOME', 'DIVIDEND_DISCOUNT'],
  asset_manager: ['RESIDUAL_INCOME', 'DIVIDEND_DISCOUNT'],
  reit: ['AFFO_MULTIPLE'],
  conglomerate: ['SOTP'],
  early_stage: ['PEER_EV_SALES'],
  biotech: ['PEER_EV_SALES'],
  energy_commodity: ['CYCLICAL_NORMALIZED_DCF'],
};

export function valuationMethodPolicy(archetype: BusinessArchetype): PrimaryValuationMethod[] {
  return METHOD_POLICY[archetype] ?? ['FCFF_DCF'];
}

interface Candidate {
  method: PrimaryValuationMethod;
  bear: number | null;
  base: number;
  bull: number | null;
  inputs: Record<string, unknown>;
  assumptions: Record<string, unknown>;
}

const verifiedMetricInput = (report: Partial<ReportData>, metric: string, basis: 'TTM' | 'INSTANT' = 'TTM') => {
  const dataset = report.canonical_financials;
  if (!dataset || dataset.ticker?.toUpperCase() !== report.ticker?.toUpperCase()) return null;
  if (basis === 'TTM') {
    const result = reconcileCanonicalTtmFlow(dataset, metric as Parameters<typeof reconcileCanonicalTtmFlow>[1]);
    return finite(result.canonicalValue) ? { value: result.canonicalValue, unit: 'USD_M',
      period: result.periodsUsed.join('–'), source: result.source } : null;
  }
  const period = dataset.periods.at(-1);
  const matches = dataset.values[metric]?.filter(f => f.period === period && f.periodType === 'instant'
    && f.unit === 'USD_M' && f.verification === 'verified' && finite(f.value) && f.source?.documentUrl) ?? [];
  return matches.length === 1 ? { value: matches[0].value!, unit: matches[0].unit,
    period, source: matches[0].source!.documentUrl } : null;
};

const verifiedIssuerAnnualMetric = (report: Partial<ReportData>, metric: string, unit: string) => {
  const dataset = report.canonical_financials;
  const currentEnd = resolveCurrentBalanceSheetSnapshot(report).periodEnd;
  const facts = dataset?.issuerReportedNonGaap?.filter(f => f.metric === metric && f.unit === unit
    && f.verification === 'ISSUER_REPORTED_NON_GAAP' && f.periodEnd === currentEnd
    && /^(?:FY\s*\d{4}|TTM)/.test(f.period) && f.source.documentUrl && f.source.filingDate) ?? [];
  const values = new Set(facts.map(f => f.value));
  return values.size === 1 && finite(facts[0]?.value) ? {
    value: facts[0].value, unit, period: facts[0].period, source: facts[0].source.documentUrl,
  } : null;
};

const residualIncome = (report: Partial<ReportData>): Candidate | null => {
  const source = report.intrinsic_value?.ddm_model;
  const snapshot = resolveCurrentBalanceSheetSnapshot(report);
  const facts = snapshot.facts;
  // Total/parent equity does not establish common equity: undisclosed preferred
  // or minority interests are not zero. The source resolver may derive common
  // equity from an explicit complete bridge; this consumer cannot guess it.
  const equity = facts.common_equity?.value;
  const sharesM = verifiedCurrentShares(report);
  const book = positive(equity) && positive(sharesM) ? equity / sharesM : null;
  const roeMetric = resolveFundamentalMetrics(report, report.ticker).roe;
  const roe = ['CALCULATED', 'REPORTED'].includes(roeMetric.status) ? roeMetric.value : null;
  if (positive(roeMetric.inputsUsed?.endingEquity) && positive(equity)
    && Math.abs(roeMetric.inputsUsed.endingEquity - equity) > Math.max(0.01, equity * 0.01)) return null;
  const cost = source?.assumptions?.cost_of_equity_pct ?? report.intrinsic_value?.cost_of_capital?.cost_of_equity_pct;
  const growth = source?.assumptions?.terminal_growth_pct;
  if (!positive(book) || !finite(roe) || !positive(cost) || !finite(growth)
    || growth < 0 || growth >= cost) return null;
  const value = (r: number, g: number) => {
    if (!positive(r) || !finite(g) || g < 0 || g >= r) return null;
    const result = money(book + book * ((roe - r) / (r - g)));
    return positive(result) ? result : null;
  };
  const base = value(cost, growth);
  if (!positive(base)) return null;
  const bearSource = source?.scenarios?.bear;
  const bullSource = source?.scenarios?.bull;
  return {
    method: 'RESIDUAL_INCOME', base,
    bear: positive(bearSource?.cost_of_equity_pct) && finite(bearSource?.terminal_growth_pct)
      ? value(bearSource.cost_of_equity_pct, bearSource.terminal_growth_pct) : null,
    bull: positive(bullSource?.cost_of_equity_pct) && finite(bullSource?.terminal_growth_pct)
      ? value(bullSource.cost_of_equity_pct, bullSource.terminal_growth_pct) : null,
    inputs: { bookValuePerShare: book, roePct: roe, equityM: equity,
      verifiedCurrentSharesM: sharesM, roePeriod: roeMetric.period,
      roeSource: roeMetric.source },
    assumptions: { costOfEquityPct: cost, terminalGrowthPct: growth,
      bearCostOfEquityPct: bearSource?.cost_of_equity_pct,
      bearGrowthPct: bearSource?.terminal_growth_pct,
      bullCostOfEquityPct: bullSource?.cost_of_equity_pct,
      bullGrowthPct: bullSource?.terminal_growth_pct },
  };
};

const sotp = (report: Partial<ReportData>): Candidate | null => {
  const model = report.sotp_model ?? report.intrinsic_value?.sotp_model;
  const shares = verifiedCurrentShares(report);
  if (!model?.components?.length || !positive(shares)) return null;
  // Source names attached by an LLM are not financial evidence. Each part must
  // bind to an accepted historical metric and an explicit valuation assumption.
  const parts = model.components.map(part => {
    if (!part.name?.trim() || !part.segmentId || !part.financialMetric || !positive(part.valuationMultiple)
      || !['EQUITY', 'ENTERPRISE'].includes(part.valuationBasis ?? '')) return null;
    const segment = report.canonical_financials?.operatingSegments?.find(s => s.id === part.segmentId);
    if (!segment) return null;
    const scoped = {...report,canonical_financials:{...report.canonical_financials!,values:segment.values}};
    const fact = verifiedMetricInput(scoped, part.financialMetric, part.inputBasis);
    return fact && positive(fact.value) ? { name: segment.name, segmentId:segment.id, axis:segment.axis,
      financialMetric: part.financialMetric,
      input: fact.value, source: fact.source, period: fact.period,
      multiple: part.valuationMultiple, basis: part.valuationBasis,
      value: fact.value * part.valuationMultiple } : null;
  });
  if (parts.some(part => part === null)) return null;
  if (new Set(parts.map(part => part!.segmentId)).size !== parts.length
    || new Set(parts.map(part => part!.axis)).size !== 1) return null;
  // Disclosed operating parts must cover one consistent segment taxonomy. A
  // missing part or elimination cannot become an invented zero adjustment.
  if (new Set(parts.map(part => part!.financialMetric)).size !== 1) return null;
  if (new Set(parts.map(part => part!.basis)).size !== 1
    || new Set(model.components.map(part => part.inputBasis ?? 'TTM')).size !== 1) return null;
  const metric = parts[0]!.financialMetric;
  const total = verifiedMetricInput(report, metric, model.components[0].inputBasis);
  const sum = parts.reduce((n,part)=>n+part!.input,0);
  if (!total || Math.abs(total.value-sum)>Math.max(0.01,Math.abs(total.value)*0.01)) return null;
  if ((model.corporateAdjustments !== undefined && !finite(model.corporateAdjustments))
    || (model.netDebtOrCash !== undefined && !finite(model.netDebtOrCash))) return null;
  // Enterprise parts require one verified consolidated bridge. An all-equity
  // SOTP must explicitly disclose corporate adjustments; unknown is not zero.
  if (!finite(model.corporateAdjustments)) return null;
  const hasEnterprise = parts.some(part => part?.basis === 'ENTERPRISE');
  const bridge = hasEnterprise ? resolveCurrentBalanceSheetSnapshot(report).netCash : 0;
  if (!finite(bridge)) return null;
  const equity = parts.reduce((sum, part) => sum + part!.value, 0) + model.corporateAdjustments + bridge;
  const base = money(equity / shares);
  // Model-supplied output fields are never inputs to the deterministic run.
  if (!positive(base)) return null;
  const scenario=(key:'bearValuationMultiple'|'bullValuationMultiple')=>{
    if(!model.components.every(part=>positive(part[key])))return null;
    const value=money((parts.reduce((sum,part,i)=>sum+part!.input*model.components[i][key]!,0)+model.corporateAdjustments!+bridge)/shares);
    return positive(value)?value:null;
  };
  return {
    method: 'SOTP', bear: scenario('bearValuationMultiple'), base, bull: scenario('bullValuationMultiple'),
    inputs: { components: parts.map(part => ({ name: part!.name, financialMetric: part!.financialMetric,
      input: part!.input, source: part!.source, period: part!.period })), shares, bridge },
    assumptions: { corporateAdjustments: model.corporateAdjustments,
      componentMultiples: parts.map((part,i) => ({ name: part!.name, multiple: part!.multiple, basis: part!.basis,
        bearMultiple:model.components[i].bearValuationMultiple,bullMultiple:model.components[i].bullValuationMultiple })) },
  };
};

const affo = (report: Partial<ReportData>): Candidate | null => {
  const model = report.intrinsic_value?.reit_model;
  const shares = verifiedCurrentShares(report);
  const historical = verifiedMetricInput(report, 'income_statement.affo', 'TTM')
    ?? resolveIssuerNonGaapTtm(report.canonical_financials, 'AFFO')
    ?? verifiedIssuerAnnualMetric(report, 'affo_per_share', 'per_share');
  const affoPerShare = historical?.unit === 'per_share' ? historical.value
    : historical && positive(shares) ? historical.value / shares : null;
  const peers = discoverPeers(report, report.ticker, { disableFixtureFallback: true }).peers.flatMap(peer => {
    const fact = peer.metrics.p_affo_multiple;
    return fact?.status === 'VERIFIED' && positive(fact.value) && fact.source && fact.period
      ? [{ ticker: peer.ticker, value: fact.value, source: fact.source, period: fact.period }] : [];
  });
  const multiple = resolvePeerMetricCoverage(peers.length).canPublishMedian
    ? calculateDeterministicMedian(peers.map(peer => peer.value), true) : null;
  if (!positive(affoPerShare) || !positive(multiple)) return null;
  const bearMultiple = model?.scenarios?.bear?.affo_multiple;
  const bullMultiple = model?.scenarios?.bull?.affo_multiple;
  return {
    method: 'AFFO_MULTIPLE', base: money(affoPerShare * multiple),
    bear: positive(bearMultiple) ? money(affoPerShare * bearMultiple) : null,
    bull: positive(bullMultiple) ? money(affoPerShare * bullMultiple) : null,
    inputs: { affoPerShare, shares, source: historical?.source, period: historical?.period, peers }, assumptions: { peerMedianAffoMultiple: multiple,
      bearMultiple, bullMultiple },
  };
};

const peerEvSales = (report: Partial<ReportData>): Candidate | null => {
  const revenue = verifiedMetricInput(report, 'income_statement.revenue', 'TTM');
  const sharesM = verifiedCurrentShares(report), netCashM = resolveCurrentBalanceSheetSnapshot(report).netCash;
  const discovery = discoverPeers(report, report.ticker, { disableFixtureFallback: true });
  const peers = discovery.peers.flatMap(peer => {
    const fact = peer.metrics.ev_sales;
    return fact?.status === 'VERIFIED' && positive(fact.value) && fact.source && fact.period
      ? [{ticker:peer.ticker,multiple:fact.value,source:fact.source,period:fact.period}] : [];
  });
  if (!revenue || !positive(revenue.value) || !positive(sharesM) || !finite(netCashM)
    || !resolvePeerMetricCoverage(peers.length).canPublishMedian) return null;
  const multiple = calculateDeterministicMedian(peers.map(peer=>peer.multiple),true);
  if (!positive(multiple)) return null;
  const base = money((revenue.value * multiple + netCashM) / sharesM);
  if (!positive(base)) return null;
  return { method:'PEER_EV_SALES',bear:null,base,bull:null,
    inputs:{revenueM:revenue.value,sharesM,netCashM,periods:revenue.period,peers},
    assumptions:{peerMedianMultiple:multiple,method:'Observed comparable EV/Sales median'} };
};

const fcff = (report: Partial<ReportData>): Candidate | null => {
  const model = report.intrinsic_value?.dcf_model;
  const revenue = verifiedMetricInput(report, 'income_statement.revenue', 'TTM');
  const shares = verifiedCurrentShares(report);
  const netCash = resolveCurrentBalanceSheetSnapshot(report).netCash;
  const historicalFcf = verifiedMetricInput(report, 'cash_flow.free_cash_flow', 'TTM');
  const assumptions = model?.assumptions;
  if (!model?.inputs?.isValid || !revenue || !historicalFcf || !positive(shares) || !finite(netCash)
    || !positive(assumptions?.wacc_pct) || !finite(assumptions?.terminal_growth_pct)
    || assumptions.terminal_growth_pct >= assumptions.wacc_pct
    || !Number.isInteger(assumptions.projection_years) || !positive(assumptions.projection_years)) return null;
  const scenarioValue = (scenario: typeof model.scenarios.base) =>
    finite(scenario?.revenue_cagr_pct) && scenario.revenue_cagr_pct > -100
      && finite(scenario?.terminal_margin_pct) && Math.abs(scenario.terminal_margin_pct) <= 100
      ? calculateStrictDCFValue(revenue.value, shares, netCash, assumptions.wacc_pct!,
        assumptions.terminal_growth_pct!, scenario.revenue_cagr_pct!, scenario.terminal_margin_pct!, assumptions.projection_years!) : null;
  const base = scenarioValue(model.scenarios?.base);
  if (!positive(base)) return null;
  return { method: 'FCFF_DCF', bear: scenarioValue(model.scenarios?.bear), base,
    bull: scenarioValue(model.scenarios?.bull),
    inputs: { revenueM: revenue.value, sharesM: shares, netCashM: netCash, periods: revenue.period },
    assumptions: { ...model.assumptions, scenarioBear: {
      revenueCagrPct: model.scenarios.bear.revenue_cagr_pct,
      terminalMarginPct: model.scenarios.bear.terminal_margin_pct },
      scenarioBase: { revenueCagrPct: model.scenarios.base.revenue_cagr_pct,
        terminalMarginPct: model.scenarios.base.terminal_margin_pct },
      scenarioBull: { revenueCagrPct: model.scenarios.bull.revenue_cagr_pct,
        terminalMarginPct: model.scenarios.bull.terminal_margin_pct } },
  };
};

const ddm = (report: Partial<ReportData>): Candidate | null => {
  const observedDividend = verifiedIssuerAnnualMetric(report, 'dividend_per_share', 'per_share');
  if (!observedDividend || !positive(observedDividend.value) || !report.intrinsic_value?.ddm_model) return null;
  const input = structuredClone(report);
  input.intrinsic_value!.ddm_model!.assumptions.current_dividend_per_share = observedDividend.value;
  const model = calculateDDMModel(input);
  if (!model || !positive(model.scenarios.base.fair_value_per_share)) return null;
  return { method: 'DIVIDEND_DISCOUNT',
    bear: model.scenarios.bear.fair_value_per_share,
    base: model.scenarios.base.fair_value_per_share,
    bull: model.scenarios.bull.fair_value_per_share,
    inputs: { dividendPerShare: observedDividend.value, source: observedDividend.source, period: observedDividend.period,
      dividendProvenance: model.assumptions.dividend_provenance },
    assumptions: { ...model.assumptions,
      bear: { g: model.scenarios.bear.terminal_growth_pct, r: model.scenarios.bear.cost_of_equity_pct },
      bull: { g: model.scenarios.bull.terminal_growth_pct, r: model.scenarios.bull.cost_of_equity_pct } },
  };
};

const cyclical = (report: Partial<ReportData>): Candidate | null => {
  const years = report.intrinsic_value?.cyclical_model?.cycle_length_years;
  const dataset = report.canonical_financials;
  const model = report.intrinsic_value?.dcf_model;
  if (!dataset || !model || !Number.isInteger(years) || !finite(years) || years < 2 || years > 5) return null;
  const periods = dataset.periods.slice(-years * 4);
  if (periods.length !== years * 4) return null;
  if (periods.some((period, index) => index > 0
    && getFiscalQuarterOrdinal(period) !== getFiscalQuarterOrdinal(periods[index - 1])! + 1)) return null;
  // Disjoint, source-verified fiscal-year windows cover the specified cycle.
  // Neither an LLM's historical margin nor one peak quarter supplies the base.
  const windows = [0, ...Array.from({length: years - 1}, (_,i) => (i + 1) * 4)].map(index => {
    const ending = periods[index + 3];
    return { revenue: reconcileCanonicalTtmFlow(dataset, 'income_statement.revenue', undefined, ending),
      fcf: reconcileCanonicalTtmFlow(dataset, 'cash_flow.free_cash_flow', undefined, ending) };
  });
  if (windows.some(window => !positive(window.revenue.canonicalValue) || !finite(window.fcf.canonicalValue))) return null;
  const normalizedMargin = windows.reduce((sum, window) => sum + window.fcf.canonicalValue! / window.revenue.canonicalValue! * 100, 0) / years;
  const revenue = windows.at(-1)!.revenue.canonicalValue!;
  const shares = verifiedCurrentShares(report), netCash = resolveCurrentBalanceSheetSnapshot(report).netCash;
  const a = model.assumptions;
  if (!positive(normalizedMargin) || !positive(shares) || !finite(netCash) || !positive(a?.wacc_pct)
    || !finite(a?.terminal_growth_pct) || a.terminal_growth_pct >= a.wacc_pct
    || !positive(a.projection_years) || !Number.isInteger(a.projection_years)) return null;
  const scenarios = ['bear','base','bull'].map(key => {
    const s = model.scenarios?.[key as 'bear' | 'base' | 'bull'];
    if (!finite(s?.revenue_cagr_pct)) return null;
    // Stress margins are explicit forecast assumptions; base is through-cycle.
    const margin = key === 'base' ? normalizedMargin : s?.terminal_margin_pct;
    return finite(margin) && Math.abs(margin) <= 100 && s.revenue_cagr_pct > -100 ? calculateStrictDCFValue(revenue, shares, netCash, a.wacc_pct!,
      a.terminal_growth_pct!, s.revenue_cagr_pct!, margin, a.projection_years!) : null;
  });
  if (!positive(scenarios[1])) return null;
  return { method:'CYCLICAL_NORMALIZED_DCF', bear:scenarios[0], base:scenarios[1], bull:scenarios[2],
    inputs:{revenueM:revenue,sharesM:shares,netCashM:netCash,normalizedMarginPct:normalizedMargin,
      cycleYears:years,periodsUsed:periods}, assumptions:{waccPct:a.wacc_pct,growthPct:a.terminal_growth_pct,
      projectionYears:a.projection_years, scenarios:Object.fromEntries(['bear','base','bull'].map(key =>
        [key,{revenueGrowth:model.scenarios[key as 'bear'].revenue_cagr_pct,
          margin:key==='base'?normalizedMargin:model.scenarios[key as 'bear'].terminal_margin_pct}]))} };
};

const candidates: Record<Exclude<PrimaryValuationMethod, 'UNAVAILABLE'>,
  (report: Partial<ReportData>) => Candidate | null> = {
  FCFF_DCF: fcff, RESIDUAL_INCOME: residualIncome, DIVIDEND_DISCOUNT: ddm,
  SOTP: sotp, AFFO_MULTIPLE: affo, PEER_EV_SALES: peerEvSales,
  CYCLICAL_NORMALIZED_DCF: cyclical,
};

/** Coverage counts required model dependencies, not optional disclosure rows.
 * The method calculator is still the final joint eligibility validator. */
function dependencyCoverage(report:Partial<ReportData>,method:PrimaryValuationMethod,selected:Candidate|null) {
  const dcf=report.intrinsic_value?.dcf_model,ddm=report.intrinsic_value?.ddm_model;
  const dependencies:Record<string,boolean>={verifiedCurrentCommonShares:positive(verifiedCurrentShares(report))};
  const test=(key:string,value:unknown)=>{dependencies[key]=finite(value);};
  if(method==='FCFF_DCF'||method==='CYCLICAL_NORMALIZED_DCF'){
    test('canonicalTtmRevenue',verifiedMetricInput(report,'income_statement.revenue')?.value);
    test('canonicalTtmFcf',verifiedMetricInput(report,'cash_flow.free_cash_flow')?.value);
    test('currentNetCash',resolveCurrentBalanceSheetSnapshot(report).netCash);
    test('wacc',dcf?.assumptions?.wacc_pct);test('terminalGrowth',dcf?.assumptions?.terminal_growth_pct);
    test('projectionYears',dcf?.assumptions?.projection_years);test('baseGrowth',dcf?.scenarios?.base?.revenue_cagr_pct);test('baseMargin',dcf?.scenarios?.base?.terminal_margin_pct);
    if(method==='CYCLICAL_NORMALIZED_DCF')dependencies.verifiedFullCycle=selected!==null;
  }else if(method==='RESIDUAL_INCOME'){
    test('currentCommonEquity',resolveCurrentBalanceSheetSnapshot(report).facts.common_equity?.value);
    test('canonicalCommonRoe',resolveFundamentalMetrics(report,report.ticker).roe.value);
    test('costOfEquity',ddm?.assumptions?.cost_of_equity_pct??report.intrinsic_value?.cost_of_capital?.cost_of_equity_pct);
    test('terminalGrowth',ddm?.assumptions?.terminal_growth_pct);
  }else if(method==='SOTP'){
    dependencies.verifiedCompatibleSegmentTaxonomy=selected!==null;
    test('explicitCorporateAdjustment',(report.sotp_model??report.intrinsic_value?.sotp_model)?.corporateAdjustments);
  }else if(method==='AFFO_MULTIPLE'){
    dependencies.verifiedAffo=Boolean(verifiedMetricInput(report,'income_statement.affo')??resolveIssuerNonGaapTtm(report.canonical_financials,'AFFO')??verifiedIssuerAnnualMetric(report,'affo_per_share','per_share'));
    dependencies.compatibleObservedPeerMedian=selected!==null;
  }else if(method==='PEER_EV_SALES'){
    test('canonicalTtmRevenue',verifiedMetricInput(report,'income_statement.revenue')?.value);test('currentNetCash',resolveCurrentBalanceSheetSnapshot(report).netCash);
    dependencies.compatibleObservedPeerMedian=selected!==null;
  }else if(method==='DIVIDEND_DISCOUNT'){
    delete dependencies.verifiedCurrentCommonShares;
    dependencies.verifiedDividendPerShare=Boolean(verifiedIssuerAnnualMetric(report,'dividend_per_share','per_share'));
    test('costOfEquity',ddm?.assumptions?.cost_of_equity_pct);test('terminalGrowth',ddm?.assumptions?.terminal_growth_pct);
  }
  const missing=Object.entries(dependencies).filter(([,available])=>!available).map(([key])=>key);
  if(!selected&&missing.length===0)missing.push('JOINT_METHOD_VALIDATION');
  return {available:Object.values(dependencies).filter(Boolean).length,required:Object.keys(dependencies).length+(missing.includes('JOINT_METHOD_VALIDATION')?1:0),missing};
}

const deterministicOutputs = new Map<string, string>();
export function resetValuationDeterminismRegistryForTest(): void { deterministicOutputs.clear(); }

/**
 * A single method-local fair value run. Unsupported inputs remain unavailable;
 * a valid secondary method never silently replaces the chosen primary method.
 */
export function resolveAdaptiveValuationRun(report: Partial<ReportData>): CanonicalValuationRun {
  const archetype = resolveBusinessArchetype(report, report.ticker);
  const policy = valuationMethodPolicy(archetype);
  const financial = report.canonical_financials as CanonicalFinancialDataset | undefined;
  // Method dependencies validate their own facts. An unrelated incomplete or
  // rejected statement row cannot disable otherwise verified valuation inputs.
  const sourceVerified = (financial?.sourceCoverage?.verifiedValues ?? 0) > 0
    && financial?.ticker?.toUpperCase() === report.ticker?.toUpperCase();
  const results = policy.map(method => sourceVerified
    ? candidates[method as Exclude<PrimaryValuationMethod, 'UNAVAILABLE'>](report) : null);
  const selected = results.find((item): item is Candidate => item !== null) ?? null;
  const method = selected?.method ?? policy[0];
  const inputCoverage=dependencyCoverage(report,method,selected);
  const quote=report.market_snapshot;
  const marketVerified=quote?.dataKind==='market_quote' && quote.ticker?.toUpperCase()===report.ticker?.toUpperCase()
    && Boolean(quote.provider?.trim()) && positive(quote.price);
  const currentPrice = marketVerified?quote!.price:null;
  const financialSnapshotId = valuationFingerprint({
    ticker: report.ticker, currency: financial?.currency, periods: financial?.periods,
    values: Object.fromEntries(Object.entries(financial?.values ?? {}).map(([key, series]) =>
      [key, series.map(fact => ({ value: fact.value, unit: fact.unit,
        period: fact.period, periodStart: fact.periodStart, periodEnd: fact.periodEnd,
        fiscalYear: fact.fiscalYear, fiscalQuarter: fact.fiscalQuarter,
        verification: fact.verification, sourceConcept: fact.sourceConcept,
        accession: fact.accession ?? fact.source?.accessionNumber }))])),
    segments: financial?.operatingSegments?.map(segment => ({id:segment.id,axis:segment.axis,member:segment.member,
      values:Object.fromEntries(Object.entries(segment.values).map(([key,series])=>[key,series.map(fact=>({
        value:fact.value,unit:fact.unit,period:fact.period,periodStart:fact.periodStart,periodEnd:fact.periodEnd,
        verification:fact.verification,sourceConcept:fact.sourceConcept,accession:fact.accession??fact.source?.accessionNumber}))]))})),
    issuerNonGaap: financial?.issuerReportedNonGaap?.map(fact=>({metric:fact.metric,value:fact.value,unit:fact.unit,
      period:fact.period,periodEnd:fact.periodEnd,verification:fact.verification,
      documentUrl:fact.source.documentUrl,accession:fact.source.accessionNumber})),
  });
  // A live quote changes Margin of Safety, not intrinsic value. Keeping it out
  // of the valuation input hash lets History distinguish a price move from a
  // changed financial model or assumption set.
  const inputHash = valuationFingerprint({ financialSnapshotId, method,
    inputs: selected?.inputs ?? null });
  const assumptionHash = valuationFingerprint({ method, assumptions: selected?.assumptions ?? null });
  const modelVersion = 'adaptive-valuation-v2' as const;
  const valuationRunId = valuationFingerprint({ inputHash, assumptionHash, modelVersion });
  const output = selected ? {
    bear: selected.bear, base: selected.base, bull: selected.bull,
  } : null;
  const outputHash = valuationFingerprint(output);
  const comparisonKey = `${inputHash}:${assumptionHash}:${modelVersion}`;
  const previous = deterministicOutputs.get(comparisonKey);
  const saved = report.intrinsic_value?.canonical_run;
  const savedSameRun = saved?.inputHash === inputHash && saved.assumptionHash === assumptionHash && saved.modelVersion === modelVersion;
  const savedOutput = savedSameRun ? valuationFingerprint({bear:saved.bearFairValue,base:saved.baseFairValue,bull:saved.bullFairValue}) : undefined;
  const nonDeterministic = (previous !== undefined && previous !== outputHash)
    || (savedSameRun && saved?.status === 'AVAILABLE' && savedOutput !== outputHash);
  if (!nonDeterministic) {
    if (deterministicOutputs.size >= 256) deterministicOutputs.delete(deterministicOutputs.keys().next().value!);
    deterministicOutputs.set(comparisonKey, outputHash);
  }
  return {
    valuationRunId, financialSnapshotId, inputHash, assumptionHash, modelVersion,
    archetype, primaryMethod: selected?.method ?? 'UNAVAILABLE',
    requestedPrimaryMethod: policy[0],
    fallbackReason: selected && selected.method !== policy[0] ? `${policy[0]}_INPUTS_UNAVAILABLE_USING_${selected.method}` : null,
    inputSnapshot: selected?.inputs ?? {}, assumptionSnapshot: selected?.assumptions ?? {},
    inputCoverage,
    methodEligibility:Object.keys(candidates).map(key=>{const method=key as PrimaryValuationMethod,index=policy.indexOf(method);return {method,role:index<0?'NOT_APPLICABLE':index===0?'PRIMARY':'SECONDARY',status:index<0?'NOT_APPLICABLE':results[index]?'ELIGIBLE':'INSUFFICIENT_VERIFIED_DATA',reason:index<0?'Outside the business-archetype primary policy':results[index]?'All joint method dependencies passed':dependencyCoverage(report,method,null).missing.join(', ')};}),
    modelConfidence: !selected ? 'UNAVAILABLE' : ['SOTP','PEER_EV_SALES','CYCLICAL_NORMALIZED_DCF'].includes(selected.method) ? 'LOW' : 'MEDIUM',
    secondaryMethods: results.filter((item): item is Candidate => item !== null)
      .map(item => item.method).filter(item => item !== selected?.method),
    status: nonDeterministic ? 'NON_DETERMINISTIC'
      : selected ? 'AVAILABLE' : 'INSUFFICIENT_VERIFIED_DATA',
    currentPrice: positive(currentPrice) ? currentPrice : null,
    bearFairValue: !nonDeterministic ? selected?.bear ?? null : null,
    baseFairValue: !nonDeterministic ? selected?.base ?? null : null,
    bullFairValue: !nonDeterministic ? selected?.bull ?? null : null,
    marginOfSafetyPct: !nonDeterministic && selected
      ? resolveValuationPriceMetrics(selected.base,currentPrice).marginOfSafetyPct : null,
    missingInputs: nonDeterministic ? ['VALUATION_NON_DETERMINISTIC_OUTPUT']
      : selected ? [] : !sourceVerified ? ['CANONICAL_FINANCIAL_SOURCE_UNVERIFIED']
        : [`${method}_REQUIRED_INPUTS_UNAVAILABLE`,...inputCoverage.missing],
    provenance: {
      financialInputs: sourceVerified ? 'SEC_OR_ISSUER_VERIFIED' : 'UNVERIFIED',
      marketInputs: marketVerified ? 'PROVIDER' : 'UNAVAILABLE',
      assumptions: 'MODEL_ASSUMPTIONS',
    },
  };
}
