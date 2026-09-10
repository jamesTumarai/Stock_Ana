import type {
  FinancialStatementsData,
  ReportData,
  ReportValidationIssue,
  ReportValidationResult,
  ValidationSeverity,
} from '../types';
import { normalizeReport } from './reportIntegrity';
import { detectStatementTemplate, validateFinancialStatements } from './statementValidator';
import { buildReportProvenanceManifest } from './reportProvenance';
import { buildMarketSnapshot, type MarketQuoteLike } from '../domain/marketSnapshot';

export const CURRENT_REPORT_SCHEMA_VERSION = 2;
export const CURRENT_GENERATED_BY_VERSION = 'lumina-phase3-provenance-v1';

export interface PreparedReportResult {
  report: ReportData | null;
  validation: ReportValidationResult;
  canPersist: boolean;
}

export interface PrepareReportOptions {
  marketQuotes?: Record<string, MarketQuoteLike | undefined>;
  requireMarketSnapshot?: boolean;
}

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const issue = (
  issues: ReportValidationIssue[],
  code: string,
  severity: ValidationSeverity,
  section: string,
  message: string,
  path?: string,
  detail?: string,
) => issues.push({ code, severity, section, message, path, detail });

const statusFromIssues = (issues: ReportValidationIssue[]): ReportValidationResult['status'] => {
  if (issues.some(item => item.severity === 'critical')) return 'invalid';
  if (issues.some(item => item.severity === 'warning')) return 'warning';
  return 'valid';
};

const sanitizeNumberField = (
  root: Record<string, any>,
  path: string[],
  issues: ReportValidationIssue[],
  options: { section: string; minExclusive?: number; minInclusive?: number; maxInclusive?: number; severity?: ValidationSeverity },
) => {
  let parent: Record<string, any> | undefined = root;
  for (let i = 0; i < path.length - 1; i += 1) {
    const next = parent?.[path[i]];
    if (!isRecord(next)) return;
    parent = next;
  }
  if (!parent) return;
  const key = path[path.length - 1];
  const value = parent[key];
  if (value === undefined || value === null) return;
  if (!isFiniteNumber(value)) {
    issue(
      issues,
      'INVALID_NUMERIC_TYPE',
      options.severity ?? 'critical',
      options.section,
      `Expected a finite number or null at ${path.join('.')}.`,
      path.join('.'),
      `Received ${typeof value}.`,
    );
    parent[key] = null;
    return;
  }
  if (options.minExclusive !== undefined && value <= options.minExclusive) {
    issue(issues, 'NUMERIC_VALUE_OUT_OF_RANGE', options.severity ?? 'critical', options.section,
      `${path.join('.')} must be greater than ${options.minExclusive}.`, path.join('.'));
    parent[key] = null;
  } else if (options.minInclusive !== undefined && value < options.minInclusive) {
    issue(issues, 'NUMERIC_VALUE_OUT_OF_RANGE', options.severity ?? 'critical', options.section,
      `${path.join('.')} must be at least ${options.minInclusive}.`, path.join('.'));
    parent[key] = null;
  } else if (options.maxInclusive !== undefined && value > options.maxInclusive) {
    issue(issues, 'NUMERIC_VALUE_OUT_OF_RANGE', options.severity ?? 'critical', options.section,
      `${path.join('.')} must be at most ${options.maxInclusive}.`, path.join('.'));
    parent[key] = null;
  }
};

const sanitizeStatementSection = (
  section: Record<string, any>,
  sectionName: string,
  periods: string[],
  issues: ReportValidationIssue[],
) => {
  for (const [key, raw] of Object.entries(section)) {
    if (key === 'commentary') {
      if (raw !== undefined && raw !== null && typeof raw !== 'string') {
        issue(issues, 'INVALID_TEXT_TYPE', 'warning', 'financial_statements',
          `${sectionName}.${key} must be text when supplied.`, `financial_statements.${sectionName}.${key}`);
        delete section[key];
      }
      continue;
    }

    if (raw === undefined || raw === null) continue;
    if (!Array.isArray(raw)) {
      issue(issues, 'INVALID_STATEMENT_SERIES', 'critical', 'financial_statements',
        `${sectionName}.${key} must be an array of numbers/null aligned to periods.`, `financial_statements.${sectionName}.${key}`);
      delete section[key];
      continue;
    }

    section[key] = raw.map((value, index) => {
      if (value === null) return null;
      if (isFiniteNumber(value)) return value;
      issue(issues, 'INVALID_STATEMENT_NUMBER', 'critical', 'financial_statements',
        `${sectionName}.${key}[${index}] is not a finite number or null.`, `financial_statements.${sectionName}.${key}.${index}`);
      return null;
    });

    if (periods.length > 0 && raw.length !== periods.length) {
      issue(issues, 'STATEMENT_PERIOD_LENGTH_MISMATCH', 'critical', 'financial_statements',
        `${sectionName}.${key} has ${raw.length} observations but periods has ${periods.length}.`,
        `financial_statements.${sectionName}.${key}`);
    }
  }
};

const sanitizeObjectField = (
  report: Record<string, any>,
  key: string,
  issues: ReportValidationIssue[],
  options: { section: string; severity?: ValidationSeverity; required?: boolean },
) => {
  const value = report[key];
  if (value === undefined || value === null) {
    if (options.required) {
      issue(issues, 'MISSING_REQUIRED_SECTION', options.severity ?? 'critical', options.section,
        `${key} is required for this report shape.`, key);
    }
    return;
  }
  if (!isRecord(value)) {
    issue(issues, 'INVALID_SECTION_SHAPE', options.severity ?? 'critical', options.section,
      `${key} must be an object when supplied.`, key, `Received ${Array.isArray(value) ? 'array' : typeof value}.`);
    delete report[key];
  }
};

const normalizeKnownReportShapeDrift = (report: Record<string, any>, issues: ReportValidationIssue[]) => {
  const ratios = report.valuation_ratios;
  if (isRecord(ratios)) {
    const normalizedRatios = Object.entries(ratios).flatMap(([name, value]) => {
      if (value === null || isFiniteNumber(value)) return [{ name, value }];
      return [];
    });
    if (normalizedRatios.length > 0) {
      report.valuation_ratios = normalizedRatios;
      issue(
        issues,
        'VALUATION_RATIOS_SHAPE_NORMALIZED',
        'warning',
        'valuation',
        'Converted scalar valuation-ratio fields into the canonical ratio array without changing values.',
        'valuation_ratios',
      );
    }
  }

  const fs = report.financial_statements;
  if (isRecord(fs) && (!Array.isArray(fs.periods) || fs.periods.length === 0)) {
    delete report.financial_statements;
    issue(
      issues,
      'REPORT_FINANCIAL_STATEMENTS_QUARANTINED',
      'warning',
      'financial_statements',
      'Report financial statements were omitted because explicit fiscal period labels were unavailable; no periods were inferred.',
      'financial_statements.periods',
    );
  }
};

const sanitizeTopLevelShapes = (report: Record<string, any>, issues: ReportValidationIssue[]) => {
  sanitizeObjectField(report, 'verdict', issues, { section: 'schema', severity: 'critical' });
  sanitizeObjectField(report, 'company_profile', issues, { section: 'schema', severity: 'warning' });
  sanitizeObjectField(report, 'intrinsic_value', issues, { section: 'valuation', severity: 'critical' });
  sanitizeObjectField(report, 'five_pillars', issues, { section: 'schema', severity: 'warning' });
  sanitizeObjectField(report, 'comprehensive_analysis', issues, { section: 'schema', severity: 'warning' });
  sanitizeObjectField(report, 'technical_analysis', issues, { section: 'schema', severity: 'warning' });

  for (const key of ['findings', 'deep_insights'] as const) {
    const value = report[key];
    if (value !== undefined && value !== null && !Array.isArray(value)) {
      issue(issues, 'INVALID_ARRAY_SHAPE', 'warning', 'schema', `${key} must be an array when supplied.`, key);
      delete report[key];
    }
  }

  const charts = report.financial_charts;
  if (charts !== undefined && charts !== null) {
    if (!isRecord(charts)) {
      issue(issues, 'INVALID_SECTION_SHAPE', 'warning', 'schema',
        'financial_charts must be an object when supplied.', 'financial_charts');
      delete report.financial_charts;
    } else {
      for (const key of ['stock_price_history', 'financial_performance_4q']) {
        if (charts[key] !== undefined && charts[key] !== null && !Array.isArray(charts[key])) {
          issue(issues, 'INVALID_ARRAY_SHAPE', 'warning', 'schema',
            `financial_charts.${key} must be an array when supplied.`, `financial_charts.${key}`);
          charts[key] = [];
        }
      }
    }
  }
};

const sanitizeFinancialStatements = (report: Record<string, any>, issues: ReportValidationIssue[]) => {
  const fs = report.financial_statements;
  if (fs === undefined || fs === null) return;
  if (!isRecord(fs)) {
    issue(issues, 'INVALID_FINANCIAL_STATEMENTS_SHAPE', 'critical', 'financial_statements',
      'financial_statements must be an object when supplied.', 'financial_statements');
    delete report.financial_statements;
    return;
  }

  if (!Array.isArray(fs.periods) || fs.periods.some((period: unknown) => typeof period !== 'string' || !period.trim())) {
    issue(issues, 'INVALID_FISCAL_PERIODS', 'critical', 'financial_statements',
      'financial_statements.periods must contain non-empty fiscal period labels.', 'financial_statements.periods');
    fs.periods = [];
  }
  const periods = fs.periods as string[];

  for (const name of ['income_statement', 'balance_sheet', 'cash_flow'] as const) {
    if (fs[name] === undefined || fs[name] === null) {
      issue(issues, 'MISSING_STATEMENT_SECTION', 'warning', 'financial_statements',
        `${name} is unavailable. Dependent metrics must remain unavailable.`, `financial_statements.${name}`);
      fs[name] = {};
    } else if (!isRecord(fs[name])) {
      issue(issues, 'INVALID_STATEMENT_SECTION', 'critical', 'financial_statements',
        `${name} must be an object.`, `financial_statements.${name}`);
      fs[name] = {};
    }
    sanitizeStatementSection(fs[name], name, periods, issues);
  }

  const income = fs.income_statement as Record<string, any>;
  for (const required of ['revenue', 'net_income']) {
    if (!Array.isArray(income[required])) {
      issue(issues, 'MISSING_CORE_FINANCIAL_SERIES', 'warning', 'financial_statements',
        `${required} is unavailable. Dependent calculations must fail closed.`, `financial_statements.income_statement.${required}`);
      income[required] = [];
    }
  }

  if (fs.key_indicators?.periods && Array.isArray(fs.key_indicators.periods)) {
    const indicatorPeriods = fs.key_indicators.periods;
    if (indicatorPeriods.length !== periods.length || indicatorPeriods.some((period: unknown, i: number) => period !== periods[i])) {
      issue(issues, 'FISCAL_PERIOD_CONFLICT', 'critical', 'cross_section',
        'Key-indicator periods do not match financial-statement periods.', 'financial_statements.key_indicators.periods');
    }
  }
};

const relativeDifference = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-9);

const parseSharesToMillionsForComparison = (value: unknown): number | null => {
  if (isFiniteNumber(value)) return value > 100_000 ? value / 1_000_000 : value;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  if (/\bB\b/i.test(value)) return parsed * 1_000;
  if (/\bM\b/i.test(value)) return parsed;
  return parsed > 100_000 ? parsed / 1_000_000 : parsed;
};

const addCrossSectionIssues = (
  report: ReportData,
  issues: ReportValidationIssue[],
  hasCanonicalMarketSnapshot = false,
) => {
  const profilePrice = report.company_profile?.stock_price;
  const intrinsicPrice = report.intrinsic_value?.current_price;
  if (isFiniteNumber(profilePrice) && isFiniteNumber(intrinsicPrice) && relativeDifference(profilePrice, intrinsicPrice) > 0.01) {
    if (hasCanonicalMarketSnapshot) {
      issue(issues, 'REPORT_PRICE_OVERRIDDEN_BY_MARKET_SNAPSHOT', 'warning', 'market_data',
        `Conflicting report prices (${profilePrice} vs ${intrinsicPrice}) were replaced by the provider market snapshot.`,
        'company_profile.stock_price / intrinsic_value.current_price');
    } else {
      issue(issues, 'CURRENT_PRICE_CONFLICT', 'critical', 'cross_section',
        `Current price conflicts across report sections (${profilePrice} vs ${intrinsicPrice}).`,
        'company_profile.stock_price / intrinsic_value.current_price');
    }
  }

  const summaryBase = report.intrinsic_value?.summary?.base_case_fair_value;
  const modelBase = report.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share;
  if (isFiniteNumber(summaryBase) && isFiniteNumber(modelBase) && relativeDifference(summaryBase, modelBase) > 0.01) {
    issue(issues, 'DCF_SUMMARY_CONFLICT', 'critical', 'valuation',
      `DCF base fair value conflicts with intrinsic-value summary (${modelBase} vs ${summaryBase}).`,
      'intrinsic_value.summary.base_case_fair_value');
  }

  const fs = report.financial_statements;
  const modelInputs = report.intrinsic_value?.dcf_model?.inputs;
  const periods = fs?.periods ?? [];
  if (fs && modelInputs && periods.length >= 4) {
    const revenues = fs.income_statement?.revenue?.slice(-4) ?? [];
    if (revenues.length === 4 && revenues.every(isFiniteNumber) && isFiniteNumber(modelInputs.startingRevenueM)) {
      const ttmRevenue = revenues.reduce((sum, value) => sum + value, 0);
      if (relativeDifference(ttmRevenue, modelInputs.startingRevenueM) > 0.01) {
        issue(issues, 'DCF_REVENUE_INPUT_CONFLICT', 'critical', 'valuation',
          `DCF starting revenue (${modelInputs.startingRevenueM}M) does not match the disclosed four-quarter revenue sum (${ttmRevenue}M).`,
          'intrinsic_value.dcf_model.inputs.startingRevenueM');
      }
    }

    const profileShares = parseSharesToMillionsForComparison(report.company_profile?.shares_outstanding);
    if (profileShares !== null && isFiniteNumber(modelInputs.sharesOutstandingM)
      && relativeDifference(profileShares, modelInputs.sharesOutstandingM) > 0.02) {
      issue(issues, 'DCF_SHARE_COUNT_CONFLICT', 'critical', 'valuation',
        `DCF share count (${modelInputs.sharesOutstandingM}M) conflicts with company-profile shares (${profileShares}M).`,
        'intrinsic_value.dcf_model.inputs.sharesOutstandingM');
    }
  }

  const fsCurrency = fs?.currency?.toUpperCase();
  const profileCurrency = report.company_profile?.currency?.toUpperCase();
  if (fsCurrency && profileCurrency && fsCurrency !== profileCurrency) {
    issue(issues, 'CURRENCY_CONFLICT', 'warning', 'cross_section',
      `Financial statements use ${fsCurrency} while the company profile uses ${profileCurrency}. Verify conversion before valuation.`,
      'financial_statements.currency / company_profile.currency');
  }
};

const addStatementValidationIssues = (report: ReportData, issues: ReportValidationIssue[]) => {
  const fs = report.financial_statements;
  if (!fs || !Array.isArray(fs.periods)) return;
  const template = fs.statement_template ?? detectStatementTemplate(report, report.ticker);
  const validation = validateFinancialStatements(fs as FinancialStatementsData, template, report, report.ticker);
  fs.statement_template = template;
  fs.validation_summary = validation;

  for (const guard of validation.failed_guards ?? []) {
    const code = guard.split(':')[0]?.trim() || 'STATEMENT_VALIDATION_FAILED';
    const severity: ValidationSeverity = /BALANCE_SHEET_IMBALANCE|IMPOSSIBLE|CRITICAL|FCF_IDENTITY_MISMATCH|EXTRAPOLATION|DISCREPANCY/.test(code)
      ? 'critical'
      : 'warning';
    issue(issues, code, severity, 'financial_statements', guard, 'financial_statements.validation_summary');
  }
};

const sanitizeCriticalScalars = (report: Record<string, any>, issues: ReportValidationIssue[]) => {
  const fields: Array<[string[], Parameters<typeof sanitizeNumberField>[3]]> = [
    [['company_profile', 'stock_price'], { section: 'market_data', minExclusive: 0 }],
    [['intrinsic_value', 'current_price'], { section: 'valuation', minExclusive: 0 }],
    [['intrinsic_value', 'dcf_model', 'assumptions', 'wacc_pct'], { section: 'valuation', minExclusive: 0, maxInclusive: 100 }],
    [['intrinsic_value', 'dcf_model', 'assumptions', 'terminal_growth_pct'], { section: 'valuation', minInclusive: -100, maxInclusive: 100 }],
    [['intrinsic_value', 'dcf_model', 'assumptions', 'projection_years'], { section: 'valuation', minExclusive: 0, maxInclusive: 100 }],
    [['intrinsic_value', 'summary', 'fair_value_range_low'], { section: 'valuation', minExclusive: 0 }],
    [['intrinsic_value', 'summary', 'fair_value_range_high'], { section: 'valuation', minExclusive: 0 }],
    [['intrinsic_value', 'summary', 'base_case_fair_value'], { section: 'valuation', minExclusive: 0 }],
    [['intrinsic_value', 'summary', 'margin_of_safety_pct'], { section: 'valuation', minInclusive: -10000, maxInclusive: 10000 }],
    [['verdict', 'conviction_score'], { section: 'conviction', minInclusive: 0, maxInclusive: 100 }],
  ];
  for (const [path, options] of fields) sanitizeNumberField(report, path, issues, options);

  for (const scenario of ['bear', 'base', 'bull']) {
    sanitizeNumberField(report, ['intrinsic_value', 'dcf_model', 'scenarios', scenario, 'revenue_cagr_pct'], issues,
      { section: 'valuation', minInclusive: -100, maxInclusive: 1000 });
    sanitizeNumberField(report, ['intrinsic_value', 'dcf_model', 'scenarios', scenario, 'terminal_margin_pct'], issues,
      { section: 'valuation', minInclusive: -100, maxInclusive: 100 });
    sanitizeNumberField(report, ['intrinsic_value', 'dcf_model', 'scenarios', scenario, 'fair_value_per_share'], issues,
      { section: 'valuation', minExclusive: 0 });
  }

  const ratios = report.valuation_ratios;
  if (ratios !== undefined && ratios !== null) {
    if (!Array.isArray(ratios)) {
      issue(issues, 'INVALID_VALUATION_RATIOS_SHAPE', 'critical', 'valuation', 'valuation_ratios must be an array.', 'valuation_ratios');
      delete report.valuation_ratios;
    } else {
      ratios.forEach((ratio: any, index: number) => {
        if (!isRecord(ratio)) {
          issue(issues, 'INVALID_VALUATION_RATIO_ITEM', 'warning', 'valuation', `valuation_ratios[${index}] is invalid.`, `valuation_ratios.${index}`);
          return;
        }
        for (const field of ['value', 'peer_avg', 'own_5yr_percentile']) {
          const value = ratio[field];
          if (value !== undefined && value !== null && !isFiniteNumber(value)) {
            issue(issues, 'INVALID_NUMERIC_TYPE', 'warning', 'valuation',
              `valuation_ratios[${index}].${field} must be a finite number or null.`, `valuation_ratios.${index}.${field}`);
            ratio[field] = null;
          }
        }
      });
    }
  }

  const dcf = report.intrinsic_value?.dcf_model;
  const wacc = dcf?.assumptions?.wacc_pct;
  const terminalGrowth = dcf?.assumptions?.terminal_growth_pct;
  if (isFiniteNumber(wacc) && isFiniteNumber(terminalGrowth) && terminalGrowth >= wacc) {
    issue(issues, 'TERMINAL_GROWTH_EXCEEDS_DISCOUNT_RATE', 'critical', 'valuation',
      `Terminal growth (${terminalGrowth}%) must be lower than WACC (${wacc}%).`,
      'intrinsic_value.dcf_model.assumptions');
  }
};

const blockCriticalFinancialOutputs = (report: ReportData, validation: ReportValidationResult): ReportData => {
  const blockedSections = new Set(
    validation.issues
      .filter(item => item.severity === 'critical')
      .map(item => item.section),
  );
  const valuationBlocked = ['financial_statements', 'valuation', 'cross_section', 'market_data'].some(section => blockedSections.has(section));
  const convictionBlocked = validation.status === 'invalid';

  if (convictionBlocked && report.verdict) {
    report.verdict.conviction_score = null;
    report.verdict.conviction_breakdown = undefined;
  }

  if (valuationBlocked && report.intrinsic_value) {
    const intrinsic = report.intrinsic_value;
    intrinsic.summary = {
      ...intrinsic.summary,
      fair_value_range_low: null,
      fair_value_range_high: null,
      base_case_fair_value: null,
      margin_of_safety_pct: null,
      verdict_text: 'Valuation unavailable because critical data-validation checks failed.',
    };
    intrinsic.relative_valuation = undefined;
    intrinsic.relative_only_model = undefined;
    if (intrinsic.dcf_model) {
      intrinsic.dcf_model.inputs = {
        ...(intrinsic.dcf_model.inputs ?? {
          ticker: report.ticker,
          currentPrice: null,
          startingRevenueM: null,
          sharesOutstandingM: null,
          netCashM: null,
          waccPct: null,
          terminalGrowthPct: null,
          projectionYears: null,
        }),
        isValid: false,
        missingFields: Array.from(new Set([
          ...(intrinsic.dcf_model.inputs?.missingFields ?? []),
          'blocked by critical report validation',
        ])),
      };
      for (const scenario of Object.values(intrinsic.dcf_model.scenarios)) {
        scenario.fair_value_per_share = null;
      }
    }
    intrinsic.validation_alerts = [
      ...(intrinsic.validation_alerts ?? []).filter(alert => alert.code !== 'REPORT_VALIDATION_BLOCK'),
      {
        type: 'error',
        code: 'REPORT_VALIDATION_BLOCK',
        message_th: 'ระบบระงับการแสดงมูลค่าหุ้น เพราะพบข้อผิดพลาดร้ายแรงในการตรวจสอบข้อมูล',
        message_en: 'Valuation is blocked because critical report-validation checks failed.',
        detail: validation.issues.filter(item => item.severity === 'critical').map(item => item.code).join(', '),
      },
    ];
  }

  report.validation = validation;
  return report;
};

export function validateAndPrepareReport(
  input: unknown,
  expectedTicker?: string,
  options: PrepareReportOptions = {},
): PreparedReportResult {
  const issues: ReportValidationIssue[] = [];
  const checkedAt = new Date().toISOString();

  if (!isRecord(input)) {
    const validation: ReportValidationResult = {
      status: 'invalid',
      issues: [{
        code: 'INVALID_REPORT_ROOT',
        severity: 'critical',
        section: 'schema',
        message: 'Analysis output is not a JSON object.',
        path: '$',
      }],
      checked_at: checkedAt,
      schema_version: CURRENT_REPORT_SCHEMA_VERSION,
    };
    return { report: null, validation, canPersist: false };
  }

  const report = structuredClone(input) as Record<string, any>;
  const normalizedExpectedTicker = expectedTicker?.trim().toUpperCase();
  const modelTicker = typeof report.ticker === 'string' ? report.ticker.trim().toUpperCase() : '';
  if (normalizedExpectedTicker) {
    if (modelTicker && modelTicker !== normalizedExpectedTicker) {
      issue(issues, 'TICKER_MISMATCH', 'critical', 'schema',
        `Model returned ticker ${modelTicker} while the requested ticker is ${normalizedExpectedTicker}.`, 'ticker');
    }
    report.ticker = normalizedExpectedTicker;
  } else if (!modelTicker) {
    issue(issues, 'MISSING_TICKER', 'critical', 'schema', 'Report ticker is missing.', 'ticker');
  } else {
    report.ticker = modelTicker;
  }

  if (typeof report.generated_at !== 'string' || !report.generated_at.trim()) {
    issue(issues, 'MISSING_GENERATED_AT', 'warning', 'metadata',
      'generated_at was missing; the application timestamp was used.', 'generated_at');
    report.generated_at = checkedAt;
  }

  if (report.summary !== undefined && report.summary !== null && typeof report.summary !== 'string') {
    issue(issues, 'INVALID_SUMMARY_TYPE', 'warning', 'schema', 'summary must be text when supplied.', 'summary');
    report.summary = '';
  }

  report.schema_version = CURRENT_REPORT_SCHEMA_VERSION;
  report.generated_by_version = CURRENT_GENERATED_BY_VERSION;

  normalizeKnownReportShapeDrift(report, issues);
  sanitizeTopLevelShapes(report, issues);
  sanitizeFinancialStatements(report, issues);
  sanitizeCriticalScalars(report, issues);

  const typedReport = report as ReportData;
  const marketQuote = typedReport.ticker
    ? options.marketQuotes?.[typedReport.ticker.toUpperCase()]
    : undefined;
  const marketSnapshot = typedReport.ticker
    ? buildMarketSnapshot(typedReport.ticker, marketQuote)
    : null;

  if (typedReport.financial_statements) addStatementValidationIssues(typedReport, issues);
  addCrossSectionIssues(typedReport, issues, Boolean(marketSnapshot));

  if (options.requireMarketSnapshot && !marketSnapshot) {
    issue(issues, 'MARKET_SNAPSHOT_UNAVAILABLE', 'critical', 'market_data',
      'A provider-backed market snapshot is required before valuation can be persisted.',
      'market_snapshot');
  }

  const validation: ReportValidationResult = {
    status: statusFromIssues(issues),
    issues,
    checked_at: checkedAt,
    schema_version: CURRENT_REPORT_SCHEMA_VERSION,
  };
  typedReport.validation = validation;

  const normalized = normalizeReport(typedReport, typedReport.ticker, options.marketQuotes);
  normalized.schema_version = CURRENT_REPORT_SCHEMA_VERSION;
  normalized.generated_by_version = CURRENT_GENERATED_BY_VERSION;
  normalized.validation = validation;

  const prepared = blockCriticalFinancialOutputs(normalized, validation);
  prepared.report_provenance = buildReportProvenanceManifest(prepared, {
    generatedAt: checkedAt,
    schemaVersion: CURRENT_REPORT_SCHEMA_VERSION,
    generatedByVersion: CURRENT_GENERATED_BY_VERSION,
  });
  return {
    report: prepared,
    validation,
    canPersist: validation.status !== 'invalid',
  };
}

export function isLegacyHistoryReport(record: any): boolean {
  const schemaVersion = record?.schemaVersion ?? record?.data?.schema_version;
  return typeof schemaVersion !== 'number' || schemaVersion < CURRENT_REPORT_SCHEMA_VERSION;
}
