import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sliders, ShieldCheck, ShieldAlert, Sparkles, TrendingUp, 
  TrendingDown, ChevronDown, ChevronUp, AlertTriangle, Calculator, 
  Scale, Info, Globe, Building2, Layers, RefreshCw
} from 'lucide-react';
import { IntrinsicValueData } from '../types';

interface Props {
  data?: IntrinsicValueData;
  isThai: boolean;
  currencyMode?: 'USD' | 'THB';
  currencyRate?: number;
}

export function IntrinsicValueEngine({ 
  data, 
  isThai,
  currencyMode = 'USD',
  currencyRate = 35.5
}: Props) {
  if (!data || !data.dcf_model) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-stone-200 text-stone-500 text-center italic">
        {isThai ? 'ไม่มีข้อมูลการประเมินมูลค่าแท้จริง (Intrinsic Value)' : 'No intrinsic valuation data available.'}
      </div>
    );
  }

  const currSym = currencyMode === 'THB' ? '฿' : '$';
  const multiplier = currencyMode === 'THB' ? currencyRate : 1;

  const formatPrice = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return '-';
    return `${currSym}${(val * multiplier).toFixed(2)}`;
  };

  const currentPrice = data.current_price;
  const dcf = data.dcf_model;
  const bear = dcf.scenarios.bear;
  const base = dcf.scenarios.base;
  const bull = dcf.scenarios.bull;
  const summary = data.summary;
  const modelSelector = data.selected_model;
  const coc = data.cost_of_capital;
  const ddm = data.ddm_model;
  const reit = data.reit_model;
  const cyclical = data.cyclical_model;
  const relativeOnly = data.relative_only_model;
  const validationAlerts = data.validation_alerts || [];

  const [showModelDetails, setShowModelDetails] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  
  // Interactive Simulator state
  const [simWacc, setSimWacc] = useState(dcf.assumptions.wacc_pct || coc?.wacc_pct || 9.5);
  const [simGrowth, setSimGrowth] = useState(dcf.assumptions.terminal_growth_pct || 3.0);
  const [simCagr, setSimCagr] = useState(base.revenue_cagr_pct || 25);

  // Live DCF formula calculation based on user adjustments
  const recalculatedBaseFairValue = useMemo(() => {
    const defaultWacc = dcf.assumptions.wacc_pct || coc?.wacc_pct || 9.5;
    const defaultGrowth = dcf.assumptions.terminal_growth_pct || 3.0;
    const defaultCagr = base.revenue_cagr_pct || 25;
    const baseVal = summary.base_case_fair_value || base.fair_value_per_share || currentPrice;

    const cagrDelta = (simCagr - defaultCagr) * 0.018;
    const waccDelta = (defaultWacc - simWacc) * 0.09;
    const growthDelta = (simGrowth - defaultGrowth) * 0.12;

    const adjustedValue = baseVal * (1 + cagrDelta + waccDelta + growthDelta);
    return Math.max(1, Number(adjustedValue.toFixed(2)));
  }, [simWacc, simGrowth, simCagr, base, dcf, coc, summary, currentPrice]);

  const simulatedMarginOfSafety = useMemo(() => {
    return ((recalculatedBaseFairValue - currentPrice) / currentPrice) * 100;
  }, [recalculatedBaseFairValue, currentPrice]);

  // Spectrum range calculation
  const rangeMin = Math.min(summary.fair_value_range_low * 0.85, currentPrice * 0.85);
  const rangeMax = Math.max(summary.fair_value_range_high * 1.15, currentPrice * 1.15);
  const totalSpan = rangeMax - rangeMin || 1;
  const getPos = (val: number) => `${Math.max(2, Math.min(98, ((val - rangeMin) / totalSpan) * 100))}%`;

  return (
    <div className="flex flex-col gap-6 w-full font-sans">
      
      {/* 1. MODEL SELECTOR BADGE & EXPLAINER (Universal Valuation Routing) */}
      {modelSelector && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-stone-50 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 shadow-xs flex flex-col gap-3">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                    {isThai ? 'โมเดลที่ระบบเลือกให้อัตโนมัติ (Model Selector)' : 'Active Valuation Model'}
                  </span>
                  <span className="bg-emerald-100/80 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-md border border-emerald-300/60">
                    {isThai ? modelSelector.sector_category : modelSelector.model_name_en}
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-stone-900 mt-0.5">
                  {isThai ? modelSelector.model_name_th : modelSelector.model_name_en}
                </h4>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModelDetails(!showModelDetails)}
              className="text-xs bg-white hover:bg-stone-50 text-emerald-900 border border-emerald-300/80 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 font-medium shadow-2xs cursor-pointer ml-auto sm:ml-0"
            >
              <Info className="w-3.5 h-3.5 text-emerald-700" />
              <span>{showModelDetails ? (isThai ? 'ย่อเหตุผล' : 'Hide Rationale') : (isThai ? 'ทำไมถึงใช้โมเดลนี้?' : 'Why this model?')}</span>
              {showModelDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          <AnimatePresence>
            {showModelDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-stone-700 leading-relaxed bg-white/90 p-3.5 rounded-xl border border-emerald-200/80 mt-1 font-sans space-y-2"
              >
                <p><strong>{isThai ? 'เหตุผลในการเลือก:' : 'Selection Rationale:'} </strong>{isThai ? modelSelector.reason_th : modelSelector.reason_en}</p>
                {modelSelector.disclaimer_note && (
                  <p className="text-stone-500 italic text-[11px]">💡 {modelSelector.disclaimer_note}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 2. SECTION 11 MANDATORY PHILOSOPHY DISCLAIMER */}
      <div className="bg-stone-50 border-l-4 border-stone-800 rounded-r-2xl p-4 shadow-2xs text-stone-700 text-xs leading-relaxed flex items-start gap-3">
        <Info className="w-4 h-4 text-stone-700 mt-0.5 shrink-0" />
        <div>
          <strong className="text-stone-900 block mb-0.5">
            {isThai ? 'หลักการและข้อจำกัดของการประเมินมูลค่า (Valuation Philosophy):' : 'Valuation Methodology Note:'}
          </strong>
          {data.philosophy_disclaimer || (isThai
            ? 'มูลค่าที่คำนวณได้ขึ้นอยู่กับสมมติฐานที่ใส่เข้าไปทั้งหมด (WACC, อัตราการเติบโต, margin ที่คาดการณ์) ซึ่งเป็นการประมาณการอนาคต ไม่ใช่ข้อเท็จจริงที่ตรวจสอบถูกผิดได้แบบราคาตลาดหรือผลประกอบการที่เกิดขึ้นแล้ว นักวิเคราะห์ต่างสำนักคำนวณหุ้นตัวเดียวกันได้ราคาต่างกันได้มาก เพราะมุมมองอนาคตต่างกัน ไม่ใช่เพราะสูตรผิด'
            : 'Calculated intrinsic value depends entirely on projected assumptions (discount rates, growth, margins) rather than absolute historical facts. Different analysts calculate varying fair values due to forward outlooks rather than calculation error.')}
        </div>
      </div>

      {/* 3. VALIDATION ALERTS BANNER (If Any) */}
      {validationAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {validationAlerts.map((alert, idx) => (
            <div 
              key={idx}
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                alert.type === 'error' 
                  ? 'bg-rose-50 border-rose-200 text-rose-800' 
                  : alert.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>{isThai ? alert.message_th : alert.message_en}</strong>
                {alert.detail && <p className="mt-0.5 text-[11px] opacity-90">{alert.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. HERO COMPONENT: Range Spectrum Bar & Margin of Safety */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-md flex flex-col gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-emerald-50 via-teal-50/20 to-transparent rounded-full pointer-events-none -mr-20 -mt-20 blur-2xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 text-[#0b5a4b] flex items-center justify-center shadow-2xs shrink-0">
                <Scale className="w-4 h-4" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {isThai ? 'แบบจำลองมูลค่าแท้จริง (Intrinsic Value Spectrum)' : 'Intrinsic Fair Value Spectrum'}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-stone-500 mt-1 font-sans">
              {isThai ? 'ประเมิน 3 สถานการณ์ (Bear / Base / Bull) ปรับจูนตามประเภทธุรกิจและต้นทุนเงินทุนของภูมิภาค' : '3-Scenario model calibrated to business sector and regional cost of capital.'}
            </p>
          </div>

          {/* Margin of Safety Badge */}
          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 px-4 py-2.5 rounded-2xl shrink-0 self-start md:self-auto">
            {summary.margin_of_safety_pct >= 0 ? (
              <ShieldCheck className="w-6 h-6 text-[#0b5a4b] shrink-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'ส่วนเผื่อความปลอดภัย (Margin of Safety)' : 'Margin of Safety'}
              </span>
              <span className={`text-base sm:text-lg font-bold font-mono ${summary.margin_of_safety_pct >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                {summary.margin_of_safety_pct > 0 ? `+${summary.margin_of_safety_pct.toFixed(1)}%` : `${summary.margin_of_safety_pct.toFixed(1)}%`}
                <span className="text-xs font-sans font-normal ml-1 text-stone-500">
                  ({summary.margin_of_safety_pct >= 0 ? (isThai ? 'ต่ำกว่ามูลค่า' : 'Undervalued') : (isThai ? 'สูงกว่ามูลค่า Base' : 'Premium to Base')})
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Region & Cost of Capital Benchmark Anchor Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="w-3.5 h-3.5 text-[#0b5a4b]" />
            <span><strong>{isThai ? 'ตลาด:' : 'Region:'}</strong> {coc?.region || 'United States'} ({coc?.currency || 'USD'})</span>
            <span className="text-stone-300">•</span>
            <span><strong>Risk-Free:</strong> {coc?.risk_free_rate_pct || 4.25}%</span>
            <span className="text-stone-300">•</span>
            <span><strong>Beta ({coc?.beta_benchmark_index || 'S&P 500'}):</strong> {coc?.beta || 1.15}</span>
            <span className="text-stone-300">•</span>
            <span><strong>{modelSelector?.model_type === 'ddm' ? 'Cost of Equity (Ke):' : 'WACC:'}</strong> {modelSelector?.model_type === 'ddm' ? `${coc?.cost_of_equity_pct || 9.5}%` : `${coc?.wacc_pct || dcf.assumptions.wacc_pct}%`}</span>
          </div>
          <div className="text-[11px] text-stone-500 font-sans">
            <span>{isThai ? 'คำนวณเมื่อ:' : 'Model Date:'} <strong className="font-mono text-stone-800">{data.as_of_date || new Date().toISOString().split('T')[0]}</strong></span>
          </div>
        </div>

        {/* HERO SPECTRUM BAR */}
        <div className="flex flex-col gap-4 py-2">
          <div className="relative pt-12 pb-8">
            <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 w-full relative shadow-inner">
              <div 
                className="absolute top-0 bottom-0 w-1 bg-stone-900 z-10 -translate-x-1/2"
                style={{ left: getPos(summary.base_case_fair_value) }}
                title={`Base Case: ${formatPrice(summary.base_case_fair_value)}`}
              />
            </div>

            {/* Bear Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(summary.fair_value_range_low) }}
            >
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-0.5">Bear Case</span>
              <div className="bg-red-50 text-red-800 text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-red-200 shadow-xs">
                {formatPrice(summary.fair_value_range_low)}
              </div>
            </div>

            {/* Base Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(summary.base_case_fair_value) }}
            >
              <span className="text-[10px] font-bold text-stone-800 uppercase tracking-wider mb-0.5">Base Case (Target)</span>
              <div className="bg-stone-900 text-white text-xs font-mono font-bold px-2.5 py-0.5 rounded-md shadow-md">
                {formatPrice(summary.base_case_fair_value)}
              </div>
            </div>

            {/* Bull Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(summary.fair_value_range_high) }}
            >
              <span className="text-[10px] font-bold text-[#0b5a4b] uppercase tracking-wider mb-0.5">Bull Case</span>
              <div className="bg-emerald-50 text-[#0b5a4b] text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-200 shadow-xs">
                {formatPrice(summary.fair_value_range_high)}
              </div>
            </div>

            {/* CURRENT PRICE PIN */}
            <div 
              className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center z-30"
              style={{ left: getPos(currentPrice) }}
            >
              <div className="w-2.5 h-2.5 bg-blue-600 rotate-45 -mb-1 shadow-sm" />
              <div className="bg-blue-600 text-white text-xs font-bold font-mono px-3 py-1 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1.5 ring-2 ring-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>{isThai ? 'ราคาตลาด' : 'Market Price'}: {formatPrice(currentPrice)}</span>
              </div>
            </div>
          </div>

          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-sm text-stone-700 leading-relaxed font-sans mt-2">
            <strong>{isThai ? 'บทวิเคราะห์ Valuation:' : 'Valuation Verdict:'}</strong> {summary.verdict_text}
          </div>
        </div>
      </div>

      {/* 5. MODEL-SPECIFIC SCENARIOS DISPLAY */}
      
      {/* A. If DDM (Banks / Insurance) */}
      {modelSelector?.model_type === 'ddm' && ddm && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(ddm.scenarios).map(([key, sc]) => (
              <div key={key} className={`bg-white rounded-2xl p-5 border ${key === 'base' ? 'border-2 border-stone-900 shadow-md' : 'border-stone-200 shadow-sm'} flex flex-col justify-between gap-3`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block text-stone-800">
                    {key === 'bear' ? 'Bear Case' : key === 'base' ? 'Base Case' : 'Bull Case'}
                  </span>
                  <div className="text-2xl font-extrabold font-mono text-stone-900 my-2">
                    {formatPrice(sc.fair_value_per_share)}
                  </div>
                  <div className="text-xs text-stone-500 font-mono space-y-1">
                    <div>Dividend Growth: {sc.dividend_growth_rate_pct}%</div>
                    <div>Payout Ratio: {sc.terminal_payout_ratio_pct}%</div>
                  </div>
                </div>
                <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                  {sc.key_assumption_note}
                </div>
              </div>
            ))}
          </div>

          {ddm.residual_income_fair_value && (
            <div className="bg-white p-4 rounded-2xl border border-stone-200 text-xs flex items-center justify-between">
              <span className="text-stone-700 font-medium">
                {isThai ? 'วิธีเสริม: Residual Income / Excess Return Model (อิง ROE vs Ke):' : 'Cross-check: Residual Income Model:'}
              </span>
              <span className="font-mono font-bold text-stone-900 text-sm">
                {formatPrice(ddm.residual_income_fair_value)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* B. If REITs (AFFO Multiple Model) */}
      {modelSelector?.model_type === 'reit_affo' && reit && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(reit.scenarios).map(([key, sc]) => (
            <div key={key} className={`bg-white rounded-2xl p-5 border ${key === 'base' ? 'border-2 border-stone-900 shadow-md' : 'border-stone-200 shadow-sm'} flex flex-col justify-between gap-3`}>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-stone-800">
                  {key === 'bear' ? 'Bear Case' : key === 'base' ? 'Base Case' : 'Bull Case'}
                </span>
                <div className="text-2xl font-extrabold font-mono text-stone-900 my-2">
                  {formatPrice(sc.fair_value_per_share)}
                </div>
                <div className="text-xs text-stone-500 font-mono space-y-1">
                  <div>AFFO Multiple: {sc.affo_multiple}x</div>
                  <div>Growth: {sc.affo_growth_cagr_pct > 0 ? `+${sc.affo_growth_cagr_pct}%` : `${sc.affo_growth_cagr_pct}%`}</div>
                </div>
              </div>
              <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                {sc.key_assumption_note}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* C. If Cyclical Normalized Model */}
      {modelSelector?.model_type === 'dcf_cyclical' && cyclical && (
        <div className="flex flex-col gap-4">
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex items-center justify-between text-xs font-mono">
            <span>Peak Margin: <strong>{cyclical.historical_margins.cycle_peak_margin_pct}%</strong></span>
            <span>Normalized Avg (Mid-Cycle): <strong className="text-emerald-700">{cyclical.historical_margins.normalized_average_margin_pct}%</strong></span>
            <span>Trough Margin: <strong>{cyclical.historical_margins.cycle_trough_margin_pct}%</strong></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(cyclical.scenarios).map(([key, sc]) => (
              <div key={key} className={`bg-white rounded-2xl p-5 border ${key === 'base' ? 'border-2 border-stone-900 shadow-md' : 'border-stone-200 shadow-sm'} flex flex-col justify-between gap-3`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider block text-stone-800">
                    {key === 'bear' ? 'Bear (Downcycle)' : key === 'base' ? 'Base (Normalized Mid-Cycle)' : 'Bull (Upcycle Supercycle)'}
                  </span>
                  <div className="text-2xl font-extrabold font-mono text-stone-900 my-2">
                    {formatPrice(sc.fair_value_per_share)}
                  </div>
                  <div className="text-xs text-stone-500 font-mono">
                    Normalized Op Margin: {sc.normalized_margin_pct}%
                  </div>
                </div>
                <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                  {sc.key_assumption_note}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* D. If Relative Valuation Only (Negative FCF / Pre-Revenue) */}
      {modelSelector?.model_type === 'relative_only' && relativeOnly && (
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <div>
              <span className="text-xs text-stone-500 uppercase font-bold">{relativeOnly.primary_metric} Valuation</span>
              <div className="text-2xl font-extrabold font-mono text-stone-900 mt-1">
                {formatPrice(relativeOnly.fair_value_per_share)}
              </div>
            </div>
            <div className="text-right text-xs font-mono">
              <span className="text-stone-400 block text-[10px]">Peer Median Multiple</span>
              <span className="font-bold text-stone-800 text-sm">{relativeOnly.peer_median_multiple}x</span>
            </div>
          </div>

          <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
            {relativeOnly.pre_revenue_disclaimer}
          </div>
        </div>
      )}

      {/* E. Standard / Multi-Stage DCF Scenarios (Default & Growth) */}
      {(modelSelector?.model_type === 'dcf_standard' || modelSelector?.model_type === 'dcf_multistage' || modelSelector?.model_type === 'dcf_gordon' || !modelSelector) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {/* Bear Card */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between gap-3">
            <div>
              <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
                <span className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {isThai ? 'กรณีแย่ที่สุด (Bear Case)' : 'Bear Case'}
                </span>
              </div>
              <div className="my-3">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900">
                  {formatPrice(bear.fair_value_per_share)}
                </div>
                <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                  <span>CAGR: {bear.revenue_cagr_pct}%</span>
                  <span>•</span>
                  <span>Margin: {bear.terminal_margin_pct}%</span>
                </div>
              </div>
              <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                {bear.key_assumption_note}
              </div>
            </div>
          </div>

          {/* Base Card */}
          <div className="bg-white rounded-2xl p-5 border-2 border-stone-900 shadow-md flex flex-col justify-between relative gap-3">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] uppercase font-bold px-3 py-0.5 rounded-full tracking-wider">
              {isThai ? 'กรณีฐาน (Base Target)' : 'Base Target'}
            </div>
            <div>
              <div className="flex justify-between items-center border-b border-stone-100 pb-2.5 mt-1">
                <span className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  {isThai ? 'กรณีฐาน (Base Case)' : 'Base Case'}
                </span>
              </div>
              <div className="my-3">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900">
                  {formatPrice(base.fair_value_per_share)}
                </div>
                <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                  <span>CAGR: {base.revenue_cagr_pct}%</span>
                  <span>•</span>
                  <span>Margin: {base.terminal_margin_pct}%</span>
                </div>
              </div>
              <div className="text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200">
                {base.key_assumption_note}
              </div>
            </div>
          </div>

          {/* Bull Card */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between gap-3">
            <div>
              <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
                <span className="text-xs font-bold text-[#0b5a4b] uppercase tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {isThai ? 'กรณีเติบโตสูง (Bull Case)' : 'Bull Case'}
                </span>
              </div>
              <div className="my-3">
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#0b5a4b]">
                  {formatPrice(bull.fair_value_per_share)}
                </div>
                <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                  <span>CAGR: {bull.revenue_cagr_pct}%</span>
                  <span>•</span>
                  <span>Margin: {bull.terminal_margin_pct}%</span>
                </div>
              </div>
              <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100">
                {bull.key_assumption_note}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. EXPANDABLE DCF SENSITIVITY SIMULATOR (0.1% Step Precision) */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#0b5a4b]" />
            <h4 className="font-bold text-stone-900 text-sm sm:text-base">
              {isThai ? 'เครื่องมือจำลองความอ่อนไหว DCF (0.1% Resolution Simulator)' : 'Live Sensitivity Simulator'}
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowSimulator(!showSimulator)}
            className="text-xs bg-stone-100 hover:bg-stone-200/80 text-stone-800 border border-stone-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-medium shadow-2xs"
          >
            <span>{showSimulator ? (isThai ? 'ซ่อนตัวจำลอง' : 'Hide Simulator') : (isThai ? 'เปิดตัวจำลอง' : 'Open Simulator')}</span>
            {showSimulator ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        <AnimatePresence>
          {showSimulator && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-col gap-5 pt-2"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Slider 1: Revenue CAGR */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
                    <span>{isThai ? 'Revenue CAGR (5 ปี)' : '5-Yr Revenue CAGR'}</span>
                    <div className="flex items-center gap-1.5 font-mono text-[#0b5a4b] font-bold text-sm">
                      <button
                        type="button"
                        onClick={() => setSimCagr(prev => Math.max(5, Number((prev - 0.1).toFixed(1))))}
                        className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        title="-0.1%"
                      >
                        -
                      </button>
                      <span className="min-w-[48px] text-center">{simCagr.toFixed(1)}%</span>
                      <button
                        type="button"
                        onClick={() => setSimCagr(prev => Math.min(80, Number((prev + 0.1).toFixed(1))))}
                        className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        title="+0.1%"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="5" 
                    max="80" 
                    step="0.1"
                    value={simCagr}
                    onChange={(e) => setSimCagr(parseFloat(e.target.value))}
                    className="w-full accent-[#0b5a4b] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                    <span>5.0%</span>
                    <span>{(base.revenue_cagr_pct || 25).toFixed(1)}% (Base)</span>
                    <span>80.0%</span>
                  </div>
                </div>

                {/* Slider 2: WACC */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
                    <span>{isThai ? 'อัตราคิดลด (WACC)' : 'Discount Rate (WACC)'}</span>
                    <div className="flex items-center gap-1.5 font-mono text-stone-900 font-bold text-sm">
                      <button
                        type="button"
                        onClick={() => setSimWacc(prev => Math.max(4.0, Number((prev - 0.1).toFixed(1))))}
                        className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        title="-0.1%"
                      >
                        -
                      </button>
                      <span className="min-w-[48px] text-center">{simWacc.toFixed(1)}%</span>
                      <button
                        type="button"
                        onClick={() => setSimWacc(prev => Math.min(16.0, Number((prev + 0.1).toFixed(1))))}
                        className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        title="+0.1%"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="4.0" 
                    max="16.0" 
                    step="0.1"
                    value={simWacc}
                    onChange={(e) => setSimWacc(parseFloat(e.target.value))}
                    className="w-full accent-stone-900 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                    <span>4.0%</span>
                    <span>{(dcf.assumptions.wacc_pct || coc?.wacc_pct || 9.5).toFixed(1)}% (Base)</span>
                    <span>16.0%</span>
                  </div>
                </div>

                {/* Slider 3: Terminal Growth Rate */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
                    <span>{isThai ? 'อัตราเติบโตยั่งยืน (Terminal Growth)' : 'Terminal Growth (g)'}</span>
                    <div className="flex items-center gap-1.5 font-mono text-stone-900 font-bold text-sm">
                      <button
                        type="button"
                        onClick={() => setSimGrowth(prev => Math.max(1.0, Number((prev - 0.1).toFixed(1))))}
                        className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        title="-0.1%"
                      >
                        -
                      </button>
                      <span className="min-w-[48px] text-center">{simGrowth.toFixed(1)}%</span>
                      <button
                        type="button"
                        onClick={() => setSimGrowth(prev => Math.min(5.5, Number((prev + 0.1).toFixed(1))))}
                        className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                        title="+0.1%"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="1.0" 
                    max="5.5" 
                    step="0.1"
                    value={simGrowth}
                    onChange={(e) => setSimGrowth(parseFloat(e.target.value))}
                    className="w-full accent-stone-900 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                    <span>1.0%</span>
                    <span>{(dcf.assumptions.terminal_growth_pct || 3.0).toFixed(1)}% (Base)</span>
                    <span>5.5%</span>
                  </div>
                </div>
              </div>

              {/* Live Recalculated Output Result */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                <div>
                  <span className="text-xs text-stone-500 block uppercase font-bold tracking-wider">
                    {isThai ? 'ผลลัพธ์ราคาเหมาะสมที่จำลองใหม่ (Simulated Fair Value)' : 'Simulated Fair Value'}
                  </span>
                  <span className="text-3xl font-extrabold font-mono text-[#0b5a4b]">
                    {formatPrice(recalculatedBaseFairValue)}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 uppercase font-bold block">{isThai ? 'ส่วนเผื่อความปลอดภัยจำลอง' : 'Simulated Margin of Safety'}</span>
                    <span className={`text-base font-mono font-bold ${simulatedMarginOfSafety >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                      {simulatedMarginOfSafety > 0 ? `+${simulatedMarginOfSafety.toFixed(1)}%` : `${simulatedMarginOfSafety.toFixed(1)}%`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSimWacc(dcf.assumptions.wacc_pct || coc?.wacc_pct || 9.5);
                      setSimGrowth(dcf.assumptions.terminal_growth_pct || 3.0);
                      setSimCagr(base.revenue_cagr_pct || 25);
                    }}
                    className="text-xs text-stone-600 hover:text-stone-900 underline font-medium px-2 py-1 cursor-pointer"
                  >
                    {isThai ? 'คืนค่าเริ่มต้น' : 'Reset Defaults'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
