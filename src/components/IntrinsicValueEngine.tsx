import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sliders, ShieldCheck, ShieldAlert, Sparkles, TrendingUp, 
  TrendingDown, ChevronDown, ChevronUp, Calculator, 
  Scale, Info, AlertCircle
} from 'lucide-react';
import { IntrinsicValueData, ForecastDashboardData, DCFScenario } from '../types';

import { calculateStrictDCFValue } from '../utils/valuation/dcfMathEngine';


interface Props {
  data?: IntrinsicValueData;
  ticker?: string;
  forecastDashboard?: ForecastDashboardData;
  isThai: boolean;
  currencyMode?: 'USD' | 'THB';
  currencyRate?: number;
}

export function IntrinsicValueEngine({ 
  data, 
  ticker,
  forecastDashboard,
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

  if (data.dcf_model.inputs?.isValid === false) {
    const missing = data.dcf_model.inputs.missingFields?.join(', ');
    return (
      <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 text-amber-950">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold">{isThai ? 'ยังไม่แสดงราคาเหมาะสม' : 'Fair value is unavailable'}</h3>
            <p className="text-sm mt-1 leading-relaxed">
              {isThai
                ? 'รายงานนี้ไม่มีข้อมูล DCF ที่ครบและอยู่ในงวดเดียวกัน จึงไม่ใช้ค่าประมาณหรือข้อมูลแทนเพื่อสร้างราคาเป้าหมาย'
                : 'This report lacks a complete, same-period DCF input set, so no substitute values are used to create a price target.'}
            </p>
            {missing && <p className="text-xs mt-2 font-mono opacity-80">{missing}</p>}
          </div>
        </div>
      </div>
    );
  }

  const currSym = currencyMode === 'THB' ? '฿' : '$';
  const multiplier = currencyMode === 'THB' ? currencyRate : 1;

  const formatPrice = (val: number | null | undefined): string => {
    if (val === null || val === undefined || !Number.isFinite(val)) return isThai ? 'ไม่มีข้อมูล (Data unavailable)' : 'Data unavailable';
    return `${currSym}${(val * multiplier).toFixed(2)}`;
  };

  const dcf = data.dcf_model;
  const rawBear = dcf.scenarios.bear;
  const rawBase = dcf.scenarios.base;
  const rawBull = dcf.scenarios.bull;
  const rawAssumptions = dcf.assumptions;
  const requiredValuationNumbers = [
    data.current_price,
    rawAssumptions.wacc_pct,
    rawAssumptions.terminal_growth_pct,
    rawAssumptions.projection_years,
    rawBear.revenue_cagr_pct,
    rawBear.terminal_margin_pct,
    rawBear.fair_value_per_share,
    rawBase.revenue_cagr_pct,
    rawBase.terminal_margin_pct,
    rawBase.fair_value_per_share,
    rawBull.revenue_cagr_pct,
    rawBull.terminal_margin_pct,
    rawBull.fair_value_per_share,
  ];
  if (!requiredValuationNumbers.every(value => typeof value === 'number' && Number.isFinite(value))) {
    return (
      <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200 text-amber-950">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold">{isThai ? 'ยังไม่แสดงราคาเหมาะสม' : 'Fair value is unavailable'}</h3>
            <p className="text-sm mt-1 leading-relaxed">
              {isThai
                ? 'ข้อมูลสมมติฐานหรือผลลัพธ์ DCF ไม่ครบ จึงไม่แสดงตัวเลขแทนด้วยค่าเริ่มต้น'
                : 'DCF assumptions or outputs are incomplete, so no default values are shown.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentPrice = data.current_price as number;
  const assumptions = rawAssumptions as typeof rawAssumptions & {
    wacc_pct: number;
    terminal_growth_pct: number;
    projection_years: number;
  };
  const bear = rawBear as DCFScenario & { revenue_cagr_pct: number; terminal_margin_pct: number; fair_value_per_share: number };
  const base = rawBase as DCFScenario & { revenue_cagr_pct: number; terminal_margin_pct: number; fair_value_per_share: number };
  const bull = rawBull as DCFScenario & { revenue_cagr_pct: number; terminal_margin_pct: number; fair_value_per_share: number };
  const summary = data.summary;
  const modelSelector = data.selected_model;
  const coc = data.cost_of_capital;

  const [showSimulator, setShowSimulator] = useState(false);
  
  // Single Source of Truth: Region-aware CAPM WACC derived from stock Beta
  const effectiveWacc = coc?.wacc_pct ?? assumptions.wacc_pct;
  const effectiveGrowth = assumptions.terminal_growth_pct;
  const [simWacc, setSimWacc] = useState(effectiveWacc);
  const [simGrowth, setSimGrowth] = useState(effectiveGrowth);
  const [simCagr, setSimCagr] = useState(base.revenue_cagr_pct);

  React.useEffect(() => {
    setSimWacc(coc?.wacc_pct ?? assumptions.wacc_pct);
    setSimGrowth(assumptions.terminal_growth_pct);
    setSimCagr(base.revenue_cagr_pct);
  }, [coc?.wacc_pct, assumptions.wacc_pct, assumptions.terminal_growth_pct, base.revenue_cagr_pct]);

  // Dynamic DCF inputs from verified engine
  const dcfInputs = dcf.inputs;
  const startingRevM = dcfInputs?.startingRevenueM ?? Number.NaN;
  const sharesM = dcfInputs?.sharesOutstandingM ?? Number.NaN;
  const netCashM = dcfInputs?.netCashM ?? Number.NaN;

  // Exact closed-form live calculation based on user adjustments
  const recalculatedBaseFairValue = useMemo(() => {
    // 1. If stock uses specialized sector models (FinTech Forward P/E, Bank DDM, REIT AFFO, Cyclical Normalized, Space Relative):
    // Adjust the grounded Base Target dynamically using financial sensitivity factors!
    const isSpecializedModel = modelSelector?.model_type === 'relative_only' 
      || modelSelector?.model_type === 'fintech_pe'
      || modelSelector?.model_type === 'ddm'
      || modelSelector?.model_type === 'reit_affo'
      || modelSelector?.model_type === 'dcf_cyclical'
      || (data.selected_model?.model_type === 'relative_only')
      || (data.selected_model?.model_type === 'fintech_pe')
      || (data.selected_model?.model_type === 'ddm')
      || (data.selected_model?.model_type === 'reit_affo')
      || (data.selected_model?.model_type === 'dcf_cyclical')
      || (base.fair_value_per_share > 0 && assumptions.wacc_pct > 14 && base.revenue_cagr_pct > 40);

    if (isSpecializedModel) {
      const baseCagr = base.revenue_cagr_pct;
      const baseWacc = effectiveWacc;
      // Revenue CAGR sensitivity (2-year growth compound)
      const cagrFactor = Math.pow((1 + (simCagr / 100)) / (1 + (baseCagr / 100)), 2);
      // WACC discount sensitivity
      const waccFactor = (1 + (baseWacc / 100)) / (1 + (simWacc / 100));
      // Terminal growth sensitivity
      const gDiff = (simGrowth - effectiveGrowth) * 0.02;
      const totalFactor = Math.max(0.2, Math.min(4.0, cagrFactor * waccFactor * (1 + gDiff)));
      return Number((base.fair_value_per_share * totalFactor).toFixed(2));
    }

    // 2. Standard DCF Model
    const margin = base.terminal_margin_pct;

    const dcfVal = calculateStrictDCFValue(
      startingRevM,
      sharesM,
      netCashM,
      simWacc,
      simGrowth,
      simCagr,
      margin,
      assumptions.projection_years
    );

    return Number.isFinite(dcfVal) && dcfVal > 0 ? dcfVal : Number.NaN;
  }, [simWacc, simGrowth, simCagr, base, dcf, startingRevM, sharesM, netCashM, modelSelector, data.selected_model, effectiveWacc, effectiveGrowth, currentPrice]);

  // When simulator is open, synchronize Base price, Upside, and Margin of Safety dynamically!
  const effectiveBasePrice = showSimulator ? recalculatedBaseFairValue : base.fair_value_per_share;
  const effectiveBaseUpside = ((effectiveBasePrice - currentPrice) / currentPrice) * 100;
  const effectiveMarginOfSafety = ((effectiveBasePrice - currentPrice) / currentPrice) * 100;

  // Dynamic scaling for Bear and Bull based on simulation adjustment
  const simMultiplier = base.fair_value_per_share > 0 ? (effectiveBasePrice / base.fair_value_per_share) : 1;
  const effectiveBearPrice = showSimulator ? Number((bear.fair_value_per_share * simMultiplier).toFixed(2)) : bear.fair_value_per_share;
  const effectiveBullPrice = showSimulator ? Number((bull.fair_value_per_share * simMultiplier).toFixed(2)) : bull.fair_value_per_share;
  const scenarioCagr = (value: number | null | undefined): number | null => {
    if (!showSimulator) return typeof value === 'number' ? value : null;
    if (typeof value !== 'number' || typeof base.revenue_cagr_pct !== 'number' || base.revenue_cagr_pct === 0) return null;
    return Number((simCagr * (value / base.revenue_cagr_pct)).toFixed(0));
  };
  const bearCagr = scenarioCagr(bear.revenue_cagr_pct);
  const bullCagr = scenarioCagr(bull.revenue_cagr_pct);

  // Upside/Downside calculations for 3 Scenario Cards
  const bearUpside = ((effectiveBearPrice - currentPrice) / currentPrice) * 100;
  const baseUpside = effectiveBaseUpside;
  const bullUpside = ((effectiveBullPrice - currentPrice) / currentPrice) * 100;

  // Wall Street Consensus vs DCF Divergence Metrics
  const consensusMean = forecastDashboard?.price_target?.mean;
  const consensusTotalAnalysts = forecastDashboard?.total_analysts;
  const consensusRating = forecastDashboard?.consensus_rating;
  const consensusUpside = consensusMean && currentPrice > 0 
    ? Number((((consensusMean - currentPrice) / currentPrice) * 100).toFixed(1))
    : undefined;

  // Compute valuation gap multiple and percentage relative to DCF Base
  const valuationGapMultiple = consensusMean && effectiveBasePrice > 0 
    ? Number((consensusMean / effectiveBasePrice).toFixed(1))
    : null;

  const valuationGapPct = consensusMean && effectiveBasePrice > 0
    ? Number((((effectiveBasePrice - consensusMean) / consensusMean) * 100).toFixed(1))
    : null;

  const shouldShowDivergenceAlert = consensusMean !== undefined && (baseUpside < -20 || (valuationGapMultiple !== null && valuationGapMultiple >= 1.5));

  const rangeMin = Math.min(effectiveBearPrice * 0.85, currentPrice * 0.85, effectiveBasePrice * 0.85);
  const rangeMax = Math.max(effectiveBullPrice * 1.15, currentPrice * 1.15, effectiveBasePrice * 1.15);
  const totalSpan = rangeMax - rangeMin || 1;
  const getPos = (val: number) => `${Math.max(2, Math.min(98, ((val - rangeMin) / totalSpan) * 100))}%`;

  const minCagrLimit = 0.0;
  const maxCagrLimit = Math.max(200.0, Math.ceil(Math.max(bull.revenue_cagr_pct, base.revenue_cagr_pct * 2, 120) / 10) * 10);
  const minWaccLimit = 3.0;
  const maxWaccLimit = Math.max(25.0, Number((effectiveWacc + 8.0).toFixed(1)));
  const minGrowthLimit = 0.5;
  const maxGrowthLimit = 8.0;

  return (
    <div className="flex flex-col gap-6 w-full font-sans">
      
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
              {isThai ? 'ประเมินด้วยแบบจำลอง DCF 3 สถานการณ์ (Bear / Base / Bull) ควบคู่กับ Relative Valuation' : 'Multi-scenario Discounted Cash Flow model cross-checked with peer multiples.'}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 px-4 py-2.5 rounded-2xl shrink-0 self-start md:self-auto">
            {effectiveMarginOfSafety >= 0 ? (
              <ShieldCheck className="w-6 h-6 text-[#0b5a4b] shrink-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'ส่วนเผื่อความปลอดภัย (MARGIN OF SAFETY)' : 'MARGIN OF SAFETY'}
              </span>
              <span className={`text-base sm:text-lg font-bold font-mono ${effectiveMarginOfSafety >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                {effectiveMarginOfSafety > 0 ? `+${effectiveMarginOfSafety.toFixed(1)}%` : `${effectiveMarginOfSafety.toFixed(1)}%`}
                <span className="text-xs font-sans font-normal ml-1 text-stone-500">
                  ({effectiveMarginOfSafety >= 0 ? (isThai ? 'ต่ำกว่ามูลค่า' : 'Undervalued') : (isThai ? 'สูงกว่ามูลค่า Base' : 'Premium to Base')})
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Calculator className="w-3.5 h-3.5 text-[#0b5a4b] shrink-0" />
              <span><strong>{isThai ? 'แบบจำลอง:' : 'Model:'}</strong> {isThai ? (modelSelector?.model_name_th || '3-Stage DCF') : (modelSelector?.model_name_en || '3-Stage DCF')}</span>
              {modelSelector?.sector_category && (
                <span className="bg-emerald-100/70 text-[#0b5a4b] text-[10px] font-sans font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  {modelSelector.sector_category}
                </span>
              )}
              <span className="text-stone-300">•</span>
              <span>
                <strong>{modelSelector?.model_type === 'fintech_pe' || modelSelector?.model_type === 'ddm' ? 'Cost of Equity (Ke):' : 'WACC:'}</strong> {effectiveWacc.toFixed(1)}%
              </span>
              <span className="text-stone-300">•</span>
              <span><strong>Terminal g:</strong> {effectiveGrowth.toFixed(1)}%</span>
            </div>
            <div className="text-[11px] text-stone-500 font-sans">
              <span>{isThai ? 'คำนวณล่าสุดเมื่อ:' : 'Model Date:'} <strong className="font-mono text-stone-800">{data.as_of_date || new Date().toISOString().split('T')[0]}</strong></span>
            </div>
          </div>
          {(modelSelector?.reason_th || modelSelector?.reason_en) && (
            <div className="pt-2 border-t border-stone-200/60 text-[11px] font-sans text-stone-500 leading-relaxed flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 text-[#0b5a4b] shrink-0 mt-0.5" />
              <span>{isThai ? modelSelector.reason_th : modelSelector.reason_en}</span>
            </div>
          )}
        </div>

        {data.validation_alerts && data.validation_alerts.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {data.validation_alerts.map((alert, idx) => (
              <div 
                key={idx}
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                  alert.type === 'error'
                    ? 'bg-red-50/90 border-red-200 text-red-900'
                    : alert.type === 'warning'
                    ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                    : 'bg-blue-50/90 border-blue-200 text-blue-900'
                }`}
              >
                <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${
                  alert.type === 'error' ? 'text-red-600' : alert.type === 'warning' ? 'text-amber-600' : 'text-blue-600'
                }`} />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">{isThai ? alert.message_th : alert.message_en}</span>
                  {alert.detail && (
                    <span className="text-[11px] opacity-80 leading-relaxed font-sans">{alert.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 py-2">
          <div className="relative pt-12 pb-8">
            <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 w-full relative shadow-inner">
              <div 
                className="absolute top-0 bottom-0 w-1 bg-stone-900 z-10 -translate-x-1/2"
                style={{ left: getPos(effectiveBasePrice) }}
                title={`Base Case: ${formatPrice(effectiveBasePrice)}`}
              />
            </div>

            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(effectiveBearPrice) }}
            >
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-0.5">BEAR CASE</span>
              <div className="bg-red-50 text-red-800 text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-red-200 shadow-xs">
                {formatPrice(effectiveBearPrice)}
              </div>
            </div>

            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(effectiveBasePrice) }}
            >
              <span className="text-[10px] font-bold text-stone-800 uppercase tracking-wider mb-0.5">BASE CASE (TARGET)</span>
              <div className="bg-stone-900 text-white text-xs font-mono font-bold px-2.5 py-0.5 rounded-md shadow-md">
                {formatPrice(effectiveBasePrice)}
              </div>
            </div>

            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(effectiveBullPrice) }}
            >
              <span className="text-[10px] font-bold text-[#0b5a4b] uppercase tracking-wider mb-0.5">BULL CASE</span>
              <div className="bg-emerald-50 text-[#0b5a4b] text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-200 shadow-xs">
                {formatPrice(effectiveBullPrice)}
              </div>
            </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-red-200 transition-all gap-3">
          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                {isThai ? 'กรณีแย่ที่สุด (BEAR CASE)' : 'Bear Case'}
              </span>
              <span className={`text-xs font-mono font-bold ${bearUpside >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                {bearUpside >= 0 ? `+${bearUpside.toFixed(1)}%` : `${bearUpside.toFixed(1)}%`}
              </span>
            </div>

            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900">
                {formatPrice(effectiveBearPrice)}
              </div>
              <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                <span>CAGR: {bearCagr === null ? (isThai ? 'ไม่มีข้อมูล (Data unavailable)' : 'Data unavailable') : `${bearCagr}%`}</span>
                <span>•</span>
                <span>{isThai ? 'FCF Margin' : 'FCF Margin'}: {bear.terminal_margin_pct}%</span>
              </div>
            </div>

            <div className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100 font-sans">
              <strong className="block text-stone-800 mb-0.5">{isThai ? 'สมมติฐานหลัก:' : 'Key Assumption:'}</strong>
              {bear.key_assumption_note}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border-2 border-stone-900 shadow-md flex flex-col justify-between relative gap-3">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] uppercase font-bold px-3 py-0.5 rounded-full tracking-wider whitespace-nowrap">
            {isThai ? 'กรณีฐาน (BASE TARGET)' : 'Base Target'}
          </div>

          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5 mt-1">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {isThai ? 'กรณีฐาน (BASE CASE)' : 'Base Case'}
              </span>
              <span className={`text-xs font-mono font-bold ${baseUpside >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                {baseUpside >= 0 ? `+${baseUpside.toFixed(1)}%` : `${baseUpside.toFixed(1)}%`}
              </span>
            </div>

            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900">
                {formatPrice(effectiveBasePrice)}
              </div>
              <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                <span>CAGR: {showSimulator ? simCagr : base.revenue_cagr_pct}%</span>
                <span>•</span>
                <span>{isThai ? 'FCF Margin' : 'FCF Margin'}: {base.terminal_margin_pct}%</span>
              </div>
            </div>

            <div className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200 font-sans">
              <strong className="block text-stone-900 mb-0.5">{isThai ? 'สมมติฐานหลัก:' : 'Key Assumption:'}</strong>
              {base.key_assumption_note}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-all gap-3">
          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
              <span className="text-xs font-bold text-[#0b5a4b] uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {isThai ? 'กรณีเติบโตสูง (BULL CASE)' : 'Bull Case'}
              </span>
              <span className={`text-xs font-mono font-bold ${bullUpside >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                {bullUpside >= 0 ? `+${bullUpside.toFixed(1)}%` : `${bullUpside.toFixed(1)}%`}
              </span>
            </div>

            <div className="my-3">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#0b5a4b]">
                {formatPrice(effectiveBullPrice)}
              </div>
              <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                <span>CAGR: {bullCagr === null ? (isThai ? 'ไม่มีข้อมูล (Data unavailable)' : 'Data unavailable') : `${bullCagr}%`}</span>
                <span>•</span>
                <span>{isThai ? 'FCF Margin' : 'FCF Margin'}: {bull.terminal_margin_pct}%</span>
              </div>
            </div>

            <div className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100 font-sans">
              <strong className="block text-stone-800 mb-0.5">{isThai ? 'สมมติฐานหลัก:' : 'Key Assumption:'}</strong>
              {bull.key_assumption_note}
            </div>
          </div>
        </div>
      </div>

      {/* Wall Street Consensus vs DCF Divergence Notice */}
      {shouldShowDivergenceAlert && (
        <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-amber-50/70 border-2 border-amber-300/80 rounded-3xl p-5 sm:p-6 text-xs text-amber-950 font-sans shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/70 pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0 text-base shadow-2xs font-bold">
                ⚠️
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-amber-950 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                  {isThai 
                    ? 'ข้อสังเกตความต่าง: ฉันทามติตลาดวอลล์สตรีท (Wall Street Consensus) กับแบบจำลอง DCF' 
                    : 'Observation: Wall Street Consensus vs. Conservative DCF Model Divergence'}
                </h4>
                <p className="text-[11px] text-amber-800/90 mt-0.5">
                  {isThai
                    ? 'เปรียบเทียบขนาดช่องว่างความเชื่อมั่นระหว่างกระแสเงินสดพื้นฐานกับความคาดหวังของตลาด'
                    : 'Evaluating the valuation spread between fundamental cash flow model and market consensus'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {valuationGapMultiple && (
                <span className="bg-amber-600 text-white text-xs font-mono font-black px-2.5 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{isThai ? `ช่องว่างมูลค่า ~${valuationGapMultiple}x (${valuationGapPct}%)` : `Valuation Gap ~${valuationGapMultiple}x (${valuationGapPct}%)`}</span>
                </span>
              )}
              <span className="bg-amber-200/80 text-amber-900 text-[11px] font-sans font-bold px-2.5 py-1 rounded-xl border border-amber-300/80">
                {isThai ? 'มุมมองเฉพาะของโมเดล' : 'Model-Specific View'}
              </span>
            </div>
          </div>

          {/* 3-Pill Stat Strip: DCF Base vs Wall Street Mean vs Spread */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Card 1: DCF Base Case */}
            <div className="bg-white/95 rounded-2xl p-3.5 border border-amber-200/80 shadow-2xs flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  {isThai ? 'แบบจำลอง DCF (Base Case)' : 'DCF Model (Base Case)'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                  {baseUpside >= 0 ? `+${baseUpside.toFixed(1)}%` : `${baseUpside.toFixed(1)}%`}
                </span>
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-stone-900">
                  {formatPrice(effectiveBasePrice)}
                </div>
                <div className="text-[11px] text-stone-500 font-sans mt-0.5">
                  {isThai ? `FCF คิดลดด้วย WACC ${effectiveWacc.toFixed(1)}%` : `FCF discounted at WACC ${effectiveWacc.toFixed(1)}%`}
                </div>
              </div>
            </div>

            {/* Card 2: Wall Street Consensus */}
            <div className="bg-white/95 rounded-2xl p-3.5 border border-amber-200/80 shadow-2xs flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                  {isThai ? 'ฉันทามติ Wall Street (Mean)' : 'Wall Street Mean Target'}
                </span>
                {consensusUpside !== undefined && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md font-mono ${
                    consensusUpside >= 0 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {consensusUpside >= 0 ? `+${consensusUpside}%` : `${consensusUpside}%`}
                  </span>
                )}
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-[#0b5a4b]">
                  {consensusMean ? formatPrice(consensusMean) : '-'}
                </div>
                <div className="text-[11px] text-stone-500 font-sans mt-0.5">
                  {isThai 
                    ? `ฉันทามติ: ${consensusRating || '-'} (จาก ${consensusTotalAnalysts || '-'} สำนัก)`
                    : `Consensus: ${consensusRating || '-'} (${consensusTotalAnalysts || '-'} analysts)`}
                </div>
              </div>
            </div>

            {/* Card 3: Valuation Gap */}
            <div className="bg-white/95 rounded-2xl p-3.5 border-2 border-amber-300 shadow-2xs flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-950 uppercase tracking-wider">
                  {isThai ? 'ขนาดช่องว่างมูลค่า (Valuation Gap)' : 'Valuation Spread'}
                </span>
                {valuationGapPct !== null && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 font-mono">
                    {valuationGapPct}%
                  </span>
                )}
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-black font-mono text-amber-900">
                  {valuationGapMultiple ? `~${valuationGapMultiple}x` : '-'}
                </div>
                <div className="text-[11px] text-amber-800 font-sans mt-0.5">
                  {isThai 
                    ? `DCF ต่างจากเป้าหมาย Consensus ${Math.abs(valuationGapPct || 0)}%`
                    : `DCF differs from the Consensus target by ${Math.abs(valuationGapPct || 0)}%`}
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Sector Context */}
          <div className="bg-white/80 rounded-2xl p-4 border border-amber-200/70 text-[11.5px] leading-relaxed text-stone-700 font-sans flex flex-col gap-2">
            <p>
              {isThai
                ? 'DCF สะท้อนกระแสเงินสดตามสมมติฐานที่แสดงไว้ ส่วนฉันทามติตลาดอาจสะท้อน multiple และความคาดหวังการเติบโตที่ต่างออกไป จึงควรอ่านสองค่าควบคู่กับแหล่งที่มาและงวดข้อมูล'
                : 'DCF reflects the disclosed cash-flow assumptions, while market consensus can reflect different multiples and growth expectations. Read both alongside their sources and reporting periods.'}
            </p>
            <div className="pt-2 border-t border-amber-100 flex items-center gap-1.5 text-[11px] text-amber-900 font-medium">
              <span>💡</span>
              <span>
                {isThai 
                  ? 'คำแนะนำสำหรับผู้ลงทุน: แบบจำลอง DCF สะท้อน Safety Margin จากกระแสเงินสดพื้นฐานที่พิสูจน์แล้ว ในขณะที่เป้าหมาย Wall Street สะท้อนศักยภาพการเติบโตสูงสุดหากแผนงานเทคโนโลยีและแพลตฟอร์มสำเร็จตามเป้า'
                  : 'Investor Note: The DCF model serves as a cash-flow baseline safety margin, while Wall Street targets reflect full execution upside of platform and tech initiatives.'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
              <span className="text-xs font-bold text-[#0b5a4b] uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4" />
                {isThai ? 'การประเมินแบบเปรียบเทียบ (Relative Valuation)' : 'Relative Valuation'}
              </span>
            </div>
            <div className="my-3 flex items-baseline justify-between">
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900">
                  {formatPrice(data.relative_valuation?.fair_value_per_share)}
                </div>
                <div className="text-xs text-stone-500 font-sans mt-0.5">
                  {isThai ? 'มูลค่าประเมินจากตัวคูณกลุ่ม' : 'Implied Value from Peer Multiple'}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-stone-400 block">{isThai ? 'ตัวคูณที่ใช้' : 'Multiple'}</span>
                <span className="text-base font-extrabold font-mono text-stone-800">
                  {data.relative_valuation?.peer_multiple_used !== undefined ? `${data.relative_valuation.peer_multiple_used}x` : '-'}
                </span>
              </div>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-100 text-xs text-stone-600 font-sans leading-relaxed">
              <strong className="text-stone-800 block mb-0.5">{isThai ? 'วิธีประเมิน:' : 'Methodology:'}</strong>
              {data.relative_valuation?.method || 'Market multiples approach'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[#0b5a4b]" />
                {isThai ? 'ปรับสมมติฐาน DCF ด้วยตัวเอง (Interactive)' : 'Interactive DCF Assumptions'}
              </span>
              <button
                type="button"
                onClick={() => setShowSimulator(prev => !prev)}
                className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{showSimulator ? (isThai ? 'ซ่อนตัวจำลอง' : 'Hide') : (isThai ? 'ลองปรับค่า' : 'Simulate')}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSimulator ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-3 font-sans leading-relaxed">
              {isThai 
                ? 'ทดสอบปรับค่า WACC, อัตราเติบโตระยะยาว และ Revenue CAGR เพื่อดูผลกระทบต่อราคาเหมาะสมแบบเรียลไทม์' 
                : 'Live-adjust discount rate, growth, and projection CAGR to observe real-time fair value sensitivity.'}
            </p>
            <div className="grid grid-cols-3 gap-2 mt-4 text-center font-mono">
              <div className="bg-stone-50 p-2 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 uppercase font-bold block">{isThai ? 'WACC ปัจจุบัน' : 'WACC'}</span>
                <span className="text-xs font-bold text-stone-800">{effectiveWacc.toFixed(1)}%</span>
              </div>
              <div className="bg-stone-50 p-2 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 uppercase font-bold block">Terminal Growth</span>
                <span className="text-xs font-bold text-stone-800">{effectiveGrowth.toFixed(1)}%</span>
              </div>
              <div className="bg-stone-50 p-2 rounded-xl border border-stone-100">
                <span className="text-[10px] text-stone-400 uppercase font-bold block">{assumptions.projection_years}-Yr Projection</span>
                <span className="text-xs font-bold text-stone-800">{base.revenue_cagr_pct}% CAGR</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSimulator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-6 border-2 border-[#0b5a4b]/40 shadow-md flex flex-col gap-6"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0b5a4b]" />
                <span>{isThai ? 'ตัวจำลองความอ่อนไหวแบบละเอียด (0.1% Step Simulator)' : 'Live 0.1% Step Sensitivity Simulator'}</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSimWacc(effectiveWacc);
                  setSimGrowth(effectiveGrowth);
                  setSimCagr(base.revenue_cagr_pct);
                }}
                className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
              >
                {isThai ? 'คืนค่าเริ่มต้น' : 'Reset Defaults'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
                  <span>{isThai ? `Revenue CAGR (${assumptions.projection_years} ปี)` : `${assumptions.projection_years}-Yr Revenue CAGR`}</span>
                  <div className="flex items-center gap-1.5 font-mono text-[#0b5a4b] font-bold text-sm">
                    <button
                      type="button"
                      onClick={() => setSimCagr(prev => Math.max(minCagrLimit, Number((prev - 0.1).toFixed(1))))}
                      className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                      title="-0.1%"
                    >
                      -
                    </button>
                    <div className="flex items-center bg-stone-100 px-1.5 py-0.5 rounded-md border border-stone-200/80 focus-within:border-[#0b5a4b] focus-within:ring-1 focus-within:ring-[#0b5a4b]">
                      <input
                        type="number"
                        step="0.1"
                        min={minCagrLimit}
                        value={simCagr}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setSimCagr(val);
                        }}
                        className="w-16 text-center font-mono font-bold text-sm bg-transparent outline-none text-[#0b5a4b] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs font-bold text-[#0b5a4b]">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSimCagr(prev => Number((prev + 0.1).toFixed(1)))}
                      className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                      title="+0.1%"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input 
                  type="range" 
                  min={minCagrLimit} 
                  max={Math.max(maxCagrLimit, simCagr)} 
                  step="0.1"
                  value={simCagr}
                  onChange={(e) => setSimCagr(parseFloat(e.target.value))}
                  className="w-full accent-[#0b5a4b] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>{minCagrLimit.toFixed(1)}%</span>
                  <span>{base.revenue_cagr_pct.toFixed(1)}% (Base)</span>
                  <span>{Math.max(maxCagrLimit, simCagr).toFixed(1)}%</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'อัตราคิดลด (WACC)' : 'Discount Rate (WACC)'}</span>
                  <div className="flex items-center gap-1.5 font-mono text-stone-900 font-bold text-sm">
                    <button
                      type="button"
                      onClick={() => setSimWacc(prev => Math.max(minWaccLimit, Number((prev - 0.1).toFixed(1))))}
                      className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <div className="flex items-center bg-stone-100 px-1.5 py-0.5 rounded-md border border-stone-200/80 focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900">
                      <input
                        type="number"
                        step="0.1"
                        min={minWaccLimit}
                        value={simWacc}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setSimWacc(val);
                        }}
                        className="w-14 text-center font-mono font-bold text-sm bg-transparent outline-none text-stone-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs font-bold text-stone-900">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSimWacc(prev => Math.min(maxWaccLimit, Number((prev + 0.1).toFixed(1))))}
                      className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input 
                  type="range" 
                  min={minWaccLimit} 
                  max={Math.max(maxWaccLimit, simWacc)} 
                  step="0.1"
                  value={simWacc}
                  onChange={(e) => setSimWacc(parseFloat(e.target.value))}
                  className="w-full accent-stone-900 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>{minWaccLimit.toFixed(1)}%</span>
                  <span>{effectiveWacc.toFixed(1)}% (Base)</span>
                  <span>{Math.max(maxWaccLimit, simWacc).toFixed(1)}%</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'อัตราเติบโตยั่งยืน (Terminal Growth)' : 'Terminal Growth (g)'}</span>
                  <div className="flex items-center gap-1.5 font-mono text-stone-900 font-bold text-sm">
                    <button
                      type="button"
                      onClick={() => setSimGrowth(prev => Math.max(minGrowthLimit, Number((prev - 0.1).toFixed(1))))}
                      className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <div className="flex items-center bg-stone-100 px-1.5 py-0.5 rounded-md border border-stone-200/80 focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900">
                      <input
                        type="number"
                        step="0.1"
                        min={minGrowthLimit}
                        max={maxGrowthLimit}
                        value={simGrowth}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) setSimGrowth(val);
                        }}
                        className="w-14 text-center font-mono font-bold text-sm bg-transparent outline-none text-stone-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-xs font-bold text-stone-900">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSimGrowth(prev => Math.min(maxGrowthLimit, Number((prev + 0.1).toFixed(1))))}
                      className="w-5 h-5 rounded-md bg-stone-200/80 hover:bg-stone-300 text-stone-800 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
                <input 
                  type="range" 
                  min={minGrowthLimit} 
                  max={maxGrowthLimit} 
                  step="0.1"
                  value={simGrowth}
                  onChange={(e) => setSimGrowth(parseFloat(e.target.value))}
                  className="w-full accent-stone-900 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>{minGrowthLimit.toFixed(1)}%</span>
                  <span>{assumptions.terminal_growth_pct.toFixed(1)}% (Base)</span>
                  <span>{maxGrowthLimit.toFixed(1)}%</span>
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
                  <span className={`text-base font-mono font-bold ${effectiveMarginOfSafety >= 0 ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                    {effectiveMarginOfSafety > 0 ? `+${effectiveMarginOfSafety.toFixed(1)}%` : `${effectiveMarginOfSafety.toFixed(1)}%`}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. SECTION 11 PHILOSOPHY DISCLAIMER (Clean Footer Note) */}
      <div className="bg-stone-50 border-l-4 border-stone-400 rounded-r-xl p-3 text-stone-600 text-[11px] leading-relaxed flex items-start gap-2.5">
        <Info className="w-3.5 h-3.5 text-stone-500 mt-0.5 shrink-0" />
        <div>
          <strong className="text-stone-800">
            {isThai ? 'หมายเหตุเรื่องสมมติฐานการประเมินมูลค่า: ' : 'Valuation Note: '}
          </strong>
          {data.philosophy_disclaimer || (isThai
            ? 'มูลค่าที่คำนวณได้ขึ้นอยู่กับสมมติฐานที่ใส่เข้าไปทั้งหมด (WACC, อัตราการเติบโต, margin ที่คาดการณ์) ซึ่งเป็นการประมาณการอนาคต ไม่ใช่ข้อเท็จจริงที่ตรวจสอบถูกผิดได้แบบราคาตลาดหรือผลประกอบการที่เกิดขึ้นแล้ว นักวิเคราะห์ต่างสำนักคำนวณหุ้นตัวเดียวกันได้ราคาต่างกันได้มาก เพราะมุมมองอนาคตต่างกัน ไม่ใช่เพราะสูตรผิด'
            : 'Calculated intrinsic value depends entirely on projected forward assumptions (discount rates, growth, margins) rather than absolute historical facts.')}
        </div>
      </div>

    </div>
  );
}
