import assert from 'node:assert/strict';
import { isSoftDeletedReportRecord, sanitizeUndefinedForPersistence } from './firestorePersistence';

const collectUndefinedPaths = (value: unknown, path = 'root', out: string[] = []): string[] => {
  if (value === undefined) {
    out.push(path);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUndefinedPaths(item, `${path}[${index}]`, out));
    return out;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      collectUndefinedPaths(item, `${path}.${key}`, out);
    }
  }
  return out;
};

{
  const source = {
    keepNull: null,
    keepZero: 0,
    keepFalse: false,
    dropUndefined: undefined,
    nested: {
      revenue: 100,
      unavailable: undefined,
    },
    series: [10, undefined, null, 40],
  };

  const sanitized = sanitizeUndefinedForPersistence(source) as any;
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'dropUndefined'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.nested, 'unavailable'), false);
  assert.deepEqual(sanitized.series, [10, null, null, 40]);
  assert.equal(sanitized.keepNull, null);
  assert.equal(sanitized.keepZero, 0);
  assert.equal(sanitized.keepFalse, false);
  assert.equal(sanitized.nested.revenue, 100);
  assert.equal(source.dropUndefined, undefined, 'Source object must remain unchanged');
  assert.equal(source.series[1], undefined, 'Source arrays must remain unchanged');
}

{
  const reportLike = {
    validation: {
      status: 'warning',
      issues: [{ code: 'MISSING_GENERATED_AT', severity: 'warning', detail: undefined }],
    },
    five_pillars: {
      growth: { revenue_growth_yoy_pct: undefined },
      profitability: { net_margin_pct: undefined },
    },
    sec_verification: {
      status: 'verified_eligible',
      dcf_financial_inputs: {
        eligible: true,
        startingRevenueM: 331839,
        trailingFourFreeCashFlowM: 66987,
      },
    },
    report_provenance: {
      financial_statements: {
        source: 'report_snapshot',
        source_period: undefined,
        as_of: undefined,
      },
      dcf_financial_inputs: { source: 'sec_verified' },
      market_price: { source: 'market_snapshot' },
    },
    intrinsic_value: {
      dcf_model: {
        inputs: {
          financialDataSource: 'sec_verified',
          priceSource: 'market_snapshot',
          startingRevenueM: 331839,
          trailingFourFreeCashFlowM: 66987,
        },
        scenarios: {
          base: { fair_value_per_share: 263.91 },
        },
      },
    },
  };

  const sanitized = sanitizeUndefinedForPersistence(reportLike) as any;
  assert.deepEqual(collectUndefinedPaths(sanitized), []);
  assert.equal(sanitized.sec_verification.status, 'verified_eligible');
  assert.equal(sanitized.sec_verification.dcf_financial_inputs.startingRevenueM, 331839);
  assert.equal(sanitized.sec_verification.dcf_financial_inputs.trailingFourFreeCashFlowM, 66987);
  assert.equal(sanitized.intrinsic_value.dcf_model.inputs.financialDataSource, 'sec_verified');
  assert.equal(sanitized.intrinsic_value.dcf_model.inputs.priceSource, 'market_snapshot');
  assert.equal(sanitized.intrinsic_value.dcf_model.scenarios.base.fair_value_per_share, 263.91);
  assert.equal(sanitized.report_provenance.dcf_financial_inputs.source, 'sec_verified');
  assert.equal(sanitized.report_provenance.market_price.source, 'market_snapshot');
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.report_provenance.financial_statements, 'source_period'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized.report_provenance.financial_statements, 'as_of'), false);
}

{
  assert.equal(isSoftDeletedReportRecord({ id: 'legacy' }), false);
  assert.equal(isSoftDeletedReportRecord({ deletedAt: null }), false);
  assert.equal(isSoftDeletedReportRecord({ deletedAt: { seconds: 1 } }), true);
  assert.equal(isSoftDeletedReportRecord(null), false);
}

console.log('firestorePersistence tests passed');
