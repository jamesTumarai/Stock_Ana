from pathlib import Path

# 1) Report type model
path = Path('src/types.ts')
text = path.read_text()
sec_import = "import type { SecVerificationEnvelope } from './domain/secVerification';\n"
provenance_import = "import type { ReportProvenanceManifest } from './domain/reportProvenance';\n"
if provenance_import not in text:
    if text.count(sec_import) != 1:
        raise SystemExit('types SEC import anchor mismatch')
    text = text.replace(sec_import, sec_import + provenance_import, 1)
report_anchor = "  validation?: ReportValidationResult;\n  sec_verification?: SecVerificationEnvelope;\n"
report_replacement = report_anchor + "  report_provenance?: ReportProvenanceManifest;\n"
if "report_provenance?: ReportProvenanceManifest;" not in text:
    if text.count(report_anchor) != 1:
        raise SystemExit('AnalysisReport provenance anchor mismatch')
    text = text.replace(report_anchor, report_replacement, 1)
path.write_text(text)

# 2) Runtime preparation and version metadata
path = Path('src/utils/reportValidation.ts')
text = path.read_text()
validator_import = "import { detectStatementTemplate, validateFinancialStatements } from './statementValidator';\n"
provenance_builder_import = "import { buildReportProvenanceManifest } from './reportProvenance';\n"
if provenance_builder_import not in text:
    if text.count(validator_import) != 1:
        raise SystemExit('reportValidation import anchor mismatch')
    text = text.replace(validator_import, validator_import + provenance_builder_import, 1)
if "export const CURRENT_GENERATED_BY_VERSION = 'lumina-phase2';" in text:
    text = text.replace(
        "export const CURRENT_GENERATED_BY_VERSION = 'lumina-phase2';",
        "export const CURRENT_GENERATED_BY_VERSION = 'lumina-phase3-provenance-v1';",
        1,
    )
return_anchor = """  const prepared = blockCriticalFinancialOutputs(normalized, validation);
  return {
    report: prepared,
"""
return_replacement = """  const prepared = blockCriticalFinancialOutputs(normalized, validation);
  prepared.report_provenance = buildReportProvenanceManifest(prepared, {
    generatedAt: checkedAt,
    schemaVersion: CURRENT_REPORT_SCHEMA_VERSION,
    generatedByVersion: CURRENT_GENERATED_BY_VERSION,
  });
  return {
    report: prepared,
"""
if "prepared.report_provenance = buildReportProvenanceManifest" not in text:
    if text.count(return_anchor) != 1:
        raise SystemExit('reportValidation prepared anchor mismatch')
    text = text.replace(return_anchor, return_replacement, 1)
path.write_text(text)

# 3) Regression expectations for prepared reports
path = Path('src/utils/reportValidation.test.ts')
text = path.read_text()
assertion_anchor = "  assert.equal(prepared.report?.schema_version, 2);\n"
assertion_replacement = assertion_anchor + "  assert.equal(prepared.report?.generated_by_version, 'lumina-phase3-provenance-v1');\n  assert.equal(prepared.report?.report_provenance?.research_narrative.source, 'ai_research');\n  assert.equal(prepared.report?.report_provenance?.financial_statements.source, 'report_snapshot');\n  assert.equal(prepared.report?.report_provenance?.dcf_financial_inputs.source, 'report_snapshot');\n"
if "report_provenance?.research_narrative.source" not in text:
    if text.count(assertion_anchor) != 1:
        raise SystemExit('reportValidation test anchor mismatch')
    text = text.replace(assertion_anchor, assertion_replacement, 1)
path.write_text(text)

# 4) User-facing report-level provenance panel
path = Path('src/ReportTemplate.tsx')
text = path.read_text()
vars_anchor = "  const warningValidationIssues = validation?.issues?.filter(issue => issue.severity === 'warning') ?? [];\n"
vars_replacement = vars_anchor + "  const provenance = data.report_provenance;\n"
if "const provenance = data.report_provenance;" not in text:
    if text.count(vars_anchor) != 1:
        raise SystemExit('ReportTemplate provenance vars anchor mismatch')
    text = text.replace(vars_anchor, vars_replacement, 1)

validation_anchor = "        {validation && validation.status !== 'valid' && (\n"
panel = """        {provenance && (
          <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0b5a4b] shrink-0" />
                <strong className="text-sm text-stone-900">{isThai ? 'แหล่งข้อมูลของรายงาน (Data Provenance)' : 'Report Data Provenance'}</strong>
              </div>
              <span className="text-[10px] font-mono text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5">
                {provenance.report_generated_by_version}
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              {isThai
                ? 'คำว่า SEC Verified ใช้เฉพาะส่วนที่ระบบระบุไว้เท่านั้น ไม่ได้หมายความว่า Narrative หรือตารางงบทั้งรายงานได้รับการรับรองจาก SEC'
                : 'SEC Verified applies only to explicitly labeled sections; it does not certify the report narrative or displayed statement snapshot.'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-violet-900"><Sparkles className="w-3.5 h-3.5" />{isThai ? 'บทวิเคราะห์' : 'Research Narrative'}</div>
                <div className="text-xs mt-1 text-violet-800">AI Research Snapshot</div>
                <div className="text-[10px] mt-1 text-violet-700/80">{isThai ? 'สังเคราะห์โดย AI • ไม่ใช่ SEC Certified' : 'AI synthesis • not SEC certified'}</div>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900"><FileText className="w-3.5 h-3.5" />{isThai ? 'ตารางงบการเงิน' : 'Financial Statements'}</div>
                <div className="text-xs mt-1 text-amber-800">{provenance.financial_statements.source === 'report_snapshot' ? 'Report Snapshot' : (isThai ? 'ไม่มีข้อมูล' : 'Unavailable')}</div>
                <div className="text-[10px] mt-1 text-amber-700/80">
                  {isThai ? 'ผ่าน runtime checks แต่ไม่ถูกยกระดับเป็น SEC Verified' : 'Runtime-checked, but not promoted to SEC Verified'}
                </div>
              </div>
              <div className={`rounded-xl border p-3 ${provenance.dcf_financial_inputs.source === 'sec_verified' ? 'border-emerald-200 bg-emerald-50/70' : provenance.dcf_financial_inputs.source === 'report_snapshot' ? 'border-amber-200 bg-amber-50/60' : 'border-stone-200 bg-stone-50'}`}>
                <div className={`flex items-center gap-1.5 text-xs font-bold ${provenance.dcf_financial_inputs.source === 'sec_verified' ? 'text-emerald-900' : provenance.dcf_financial_inputs.source === 'report_snapshot' ? 'text-amber-900' : 'text-stone-700'}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />DCF Financial Inputs
                </div>
                <div className="text-xs mt-1 font-semibold">
                  {provenance.dcf_financial_inputs.source === 'sec_verified'
                    ? 'SEC Verified Financial Inputs'
                    : provenance.dcf_financial_inputs.source === 'report_snapshot'
                    ? 'Report Snapshot Financial Inputs'
                    : (isThai ? 'ยังไม่มีชุดข้อมูล DCF ที่ใช้ได้' : 'DCF input set unavailable')}
                </div>
                {(provenance.dcf_financial_inputs.source_period || provenance.dcf_financial_inputs.as_of) && (
                  <div className="text-[10px] mt-1 font-mono opacity-70">
                    {[provenance.dcf_financial_inputs.source_period, provenance.dcf_financial_inputs.as_of].filter(Boolean).join(' • ')}
                  </div>
                )}
              </div>
            </div>
            <div className="text-[10px] sm:text-[11px] text-stone-500 border-t border-stone-100 pt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-bold">SEC cross-check:</span>
              <span className="font-mono">{provenance.sec_cross_check.status}</span>
              <span>•</span>
              <span>{isThai ? 'สถานะนี้ไม่ใช่การรับรองรายงานทั้งฉบับ' : 'This status is not a certification of the full report.'}</span>
            </div>
          </div>
        )}

"""
if "Report Data Provenance" not in text:
    if text.count(validation_anchor) != 1:
        raise SystemExit('ReportTemplate validation panel anchor mismatch')
    text = text.replace(validation_anchor, panel + validation_anchor, 1)
path.write_text(text)
