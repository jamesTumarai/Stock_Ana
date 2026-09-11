import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Zap,
  BarChart3,
  Sliders,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import {
  decomposeValuationDelta,
  type ValuationDecomposition,
} from '../utils/valuationDecompositionEngine';
import {
  evaluateMacroStressScenarios,
  type MacroStressScenario,
} from '../utils/macroStressEngine';
import {
  diffSecFinancialStatements,
  type SecFilingPeriodDiff,
} from '../utils/secFilingDiffEngine';
import { ReportData } from '../types';

interface ValuationDecompositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isThai?: boolean;
  currentReport: ReportData;
  previousReport?: ReportData | null;
}

export function ValuationDecompositionModal({
  isOpen,
  onClose,
  isThai = false,
  currentReport,
  previousReport,
}: ValuationDecompositionModalProps) {
  const [activeTab, setActiveTab] = useState<'decomposition' | 'macro_stress' | 'sec_diff'>('decomposition');

  // 1. Decomposition Calculation
  const decomposition: ValuationDecomposition | null = useMemo(() => {
    if (!previousReport) return null;
    return decomposeValuationDelta(currentReport, previousReport, isThai);
  }, [currentReport, previousReport, isThai]);

  // 2. Macro Stress Calculation
  const macroStressScenarios: MacroStressScenario[] = useMemo(() => {
    const fv = currentReport.intrinsic_value?.summary?.base_case_fair_value
      ?? currentReport.intrinsic_value?.dcf_model?.scenarios?.base?.fair_value_per_share
      ?? 0;
    const price = currentReport.intrinsic_value?.current_price
      ?? (currentReport as any).company_profile?.stock_price
      ?? 0;
    const baseDcf: any = currentReport.intrinsic_value?.dcf_model?.scenarios?.base || {};
    const wacc = Number(baseDcf.wacc_percentage) || 9.0;
    const tg = Number(baseDcf.terminal_growth_rate_percentage) || 3.0;
    const revGrowth = Number(baseDcf.projected_growth_rate) || 10.0;

    return evaluateMacroStressScenarios(
      {
        fairValue: fv,
        currentPrice: price,
        wacc,
        terminalGrowth: tg,
        revenueGrowth: revGrowth,
      },
      isThai
    );
  }, [currentReport, isThai]);

  // 3. SEC YoY Diff Calculation
  const secDiff: SecFilingPeriodDiff | null = useMemo(() => {
    const annuals = (currentReport as any).financial_statements?.annual;
    if (!Array.isArray(annuals) || annuals.length < 2) return null;
    return diffSecFinancialStatements(annuals, isThai);
  }, [currentReport, isThai]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-4xl bg-[#161618] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {isThai ? 'การวิเคราะห์เชิงลึก: ปัจจัยมูลค่า & ภาวะความเครียด' : 'Valuation Decomposition & Stress Testing'}
                </h2>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-stone-300">
                  {currentReport.ticker || 'EQUITY'}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {isThai
                  ? 'แยกแยะสมมติฐานการเติบโต, ต้นทุนเงินทุน WACC, และความอ่อนไหวต่อสภาวะเศรษฐกิจ'
                  : 'Marginal driver attribution, macroeconomic stress-testing, and SEC filings audit.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-black/40 px-5 pt-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('decomposition')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'decomposition'
                ? 'border-emerald-400 text-emerald-400 bg-white/[0.04]'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{isThai ? 'การแจกแจงปัจจัยมูลค่า (Waterfall)' : 'Valuation Waterfall'}</span>
          </button>

          <button
            onClick={() => setActiveTab('macro_stress')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'macro_stress'
                ? 'border-emerald-400 text-emerald-400 bg-white/[0.04]'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isThai ? 'ทดสอบภาวะวิกฤตมหภาค (Macro Stress)' : 'Macro Stress Sandbox'}</span>
          </button>

          <button
            onClick={() => setActiveTab('sec_diff')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
              activeTab === 'sec_diff'
                ? 'border-emerald-400 text-emerald-400 bg-white/[0.04]'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isThai ? 'เปรียบเทียบงบ SEC (YoY Diff)' : 'SEC Filing YoY Diff'}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm text-stone-300">
          {/* TAB 1: VALUATION WATERFALL DECOMPOSITION */}
          {activeTab === 'decomposition' && (
            <div className="space-y-4">
              {decomposition ? (
                <>
                  {/* Thesis Health Status Card */}
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                          {isThai ? 'สถานะสมมติฐานการลงทุน' : 'Investment Thesis Health'}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            decomposition.thesisHealth.status === 'upgraded'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : decomposition.thesisHealth.status === 'under_pressure'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : decomposition.thesisHealth.status === 'macro_driven'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          }`}
                        >
                          {decomposition.thesisHealth.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">
                        {decomposition.thesisHealth.headline}
                      </h3>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {decomposition.thesisHealth.summary}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 bg-black/40 p-3 rounded-lg border border-white/5 shrink-0">
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase tracking-wider">
                          {isThai ? 'Fair Value เดิม' : 'Previous FV'}
                        </div>
                        <div className="text-sm font-bold text-stone-300">
                          ${decomposition.previousFairValue.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-stone-600">→</div>
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase tracking-wider">
                          {isThai ? 'Fair Value ใหม่' : 'Current FV'}
                        </div>
                        <div className="text-base font-extrabold text-white">
                          ${decomposition.currentFairValue.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-stone-500 uppercase tracking-wider">
                          {isThai ? 'ผลต่างรวม' : 'Total Delta'}
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            decomposition.totalDeltaDollars >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {decomposition.totalDeltaDollars >= 0 ? '+' : ''}
                          ${decomposition.totalDeltaDollars.toFixed(2)} ({decomposition.totalDeltaPct > 0 ? '+' : ''}
                          {decomposition.totalDeltaPct.toFixed(1)}%)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Marginal Drivers List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                      {isThai ? 'การแจกแจงตามปัจจัยขับเคลื่อนทางการเงิน' : 'Marginal Value Drivers Attribution'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {decomposition.drivers.map((driver) => {
                        const isPositive = driver.dollarImpact > 0;
                        const isNegative = driver.dollarImpact < 0;
                        return (
                          <div
                            key={driver.key}
                            className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-stone-200">
                                {driver.label}
                              </span>
                              <span
                                className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                                  isPositive
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : isNegative
                                    ? 'bg-rose-500/10 text-rose-400'
                                    : 'bg-white/10 text-stone-400'
                                }`}
                              >
                                {isPositive ? '+' : ''}${driver.dollarImpact.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-400">
                              {driver.explanation || (isThai ? 'ผลกระทบเชิงคำนวณทางสถิติ' : 'Calculated marginal impact')}
                            </p>
                            <div className="mt-2 text-[10px] text-stone-500 text-right">
                              {driver.percentageContribution.toFixed(1)}% {isThai ? 'ของผลต่างรวม' : 'of net change'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 rounded-xl bg-white/[0.02] border border-white/10 text-center space-y-2">
                  <Layers className="w-8 h-8 text-stone-500 mx-auto" />
                  <h4 className="text-sm font-semibold text-white">
                    {isThai ? 'ต้องการรายงานในอดีตอย่างน้อย 1 ฉบับ' : 'Historical Report Required'}
                  </h4>
                  <p className="text-xs text-stone-400 max-w-md mx-auto">
                    {isThai
                      ? 'เมื่อคุณวิเคราะห์หุ้นตัวนี้เพิ่มเติมในอนาคต ระบบจะทำการแยกแยะปัจจัยมูลค่าเปรียบเทียบกับฉบับก่อนหน้าให้โดยอัตโนมัติ'
                      : 'Decomposition attribution evaluates how valuation parameters evolved against your prior reports for this ticker.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MACRO STRESS SANDBOX */}
          {activeTab === 'macro_stress' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {isThai
                    ? 'การทดสอบภาวะวิกฤต (Stress Test) ประเมินผลกระทบกรณีเกิดแรงกระแทกทางเศรษฐกิจมหภาค เช่น เงินเฟ้อพุ่ง หรือ ดอกเบี้ยยืนสูง เพื่อตรวจสอบความทนทานของ Margin of Safety'
                    : 'Institutional macro stress-testing simulates external macroeconomic shocks (stagflation, rate hikes, demand collapse) to gauge Margin of Safety resilience.'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {macroStressScenarios.map((scenario) => {
                  const isOpportunity = scenario.severity === 'opportunity';
                  const isHighRisk = scenario.severity === 'high';
                  return (
                    <div
                      key={scenario.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        isOpportunity
                          ? 'bg-emerald-950/20 border-emerald-500/30'
                          : isHighRisk
                          ? 'bg-rose-950/20 border-rose-500/30'
                          : 'bg-white/[0.02] border-white/10'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{scenario.name}</span>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                              isOpportunity
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isHighRisk
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-white/10 text-stone-300'
                            }`}
                          >
                            {scenario.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mb-3">{scenario.description}</p>
                      </div>

                      <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-stone-400">{isThai ? 'Fair Value ภายใต้แรงกดดัน:' : 'Stressed Fair Value:'}</span>
                          <span className="font-bold text-white font-mono">${scenario.stressedFairValue.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">{isThai ? 'ผลกระทบต่อมูลค่า:' : 'Fair Value Impact:'}</span>
                          <span
                            className={`font-bold font-mono ${
                              scenario.fairValueChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {scenario.fairValueChangePct >= 0 ? '+' : ''}
                            {scenario.fairValueChangePct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-stone-400">{isThai ? 'Margin of Safety ภายใต้แรงกดดัน:' : 'Stressed MoS:'}</span>
                          <span
                            className={`font-bold font-mono ${
                              scenario.stressedMarginOfSafety >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {scenario.stressedMarginOfSafety >= 0 ? '+' : ''}
                            {scenario.stressedMarginOfSafety.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: SEC FILING YOY DIFF */}
          {activeTab === 'sec_diff' && (
            <div className="space-y-4">
              {secDiff ? (
                <>
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-white">
                          {isThai ? 'การตรวจสอบงบการเงิน SEC ข้ามรอบปี' : 'Verified SEC Filing Comparison'}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-stone-400">
                        {secDiff.currentPeriod} vs {secDiff.priorPeriod}
                      </span>
                    </div>
                    <div
                      className={`text-xs p-2.5 rounded-lg border ${
                        secDiff.cashConversionStatus === 'warning'
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {secDiff.cashConversionSummary}
                    </div>
                  </div>

                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                        {isThai ? 'รายได้รวม YoY' : 'Revenue YoY'}
                      </div>
                      <div
                        className={`text-sm font-bold font-mono ${
                          (secDiff.revenueYoYPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {secDiff.revenueYoYPct !== null ? `${secDiff.revenueYoYPct >= 0 ? '+' : ''}${secDiff.revenueYoYPct}%` : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                        {isThai ? 'กำไรสุทธิ YoY' : 'Net Income YoY'}
                      </div>
                      <div
                        className={`text-sm font-bold font-mono ${
                          (secDiff.netIncomeYoYPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {secDiff.netIncomeYoYPct !== null ? `${secDiff.netIncomeYoYPct >= 0 ? '+' : ''}${secDiff.netIncomeYoYPct}%` : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                        {isThai ? 'กระแสเงินสด OCF' : 'Operating Cash Flow'}
                      </div>
                      <div
                        className={`text-sm font-bold font-mono ${
                          (secDiff.ocfYoYPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {secDiff.ocfYoYPct !== null ? `${secDiff.ocfYoYPct >= 0 ? '+' : ''}${secDiff.ocfYoYPct}%` : 'N/A'}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                        {isThai ? 'การเปลี่ยนแปลงมาร์จิ้น' : 'OP Margin Delta'}
                      </div>
                      <div
                        className={`text-sm font-bold font-mono ${
                          (secDiff.operatingMarginBpsDelta ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {secDiff.operatingMarginBpsDelta !== null
                          ? `${secDiff.operatingMarginBpsDelta >= 0 ? '+' : ''}${secDiff.operatingMarginBpsDelta} bps`
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 rounded-xl bg-white/[0.02] border border-white/10 text-center space-y-2">
                  <FileSpreadsheet className="w-8 h-8 text-stone-500 mx-auto" />
                  <h4 className="text-sm font-semibold text-white">
                    {isThai ? 'ไม่มีข้อมูลเปรียบเทียบงบ SEC ครบ 2 งวด' : 'Insufficient Verified SEC Periods'}
                  </h4>
                  <p className="text-xs text-stone-400 max-w-md mx-auto">
                    {isThai
                      ? 'ระบบต้องการงบการเงินอย่างน้อย 2 รอบปีเพื่อคำนวณการเติบโตและการเปลี่ยนแปลงของมาร์จิ้นอย่างแม่นยำ'
                      : 'Filing comparison requires at least 2 historical annual filing periods to derive factual YoY deltas.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02] flex justify-between items-center text-xs text-stone-400">
          <span>{isThai ? 'ข้อมูลตรวจสอบแล้วตามมาตรฐาน SEC EDGAR' : 'Deterministic financial calculations derived strictly from verified statements.'}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
          >
            {isThai ? 'ปิด' : 'Close'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
