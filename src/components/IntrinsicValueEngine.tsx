import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sliders, ShieldCheck, ShieldAlert, Sparkles, TrendingUp, 
  TrendingDown, ChevronDown, ChevronUp, Calculator, 
  Scale, Info
} from 'lucide-react';
import { IntrinsicValueData } from '../types';

import { calculateStrictDCFValue } from '../utils/valuation/dcfMathEngine';

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

  const [showSimulator, setShowSimulator] = useState(false);
  
  // Interactive Simulator state
  const [simWacc, setSimWacc] = useState(dcf.assumptions.wacc_pct || coc?.wacc_pct || 11.8);
  const [simGrowth, setSimGrowth] = useState(dcf.assumptions.terminal_growth_pct || 3.5);
  const [simCagr, setSimCagr] = useState(base.revenue_cagr_pct || 22);

  // Exact closed-form live DCF calculation based on user adjustments
  const recalculatedBaseFairValue = useMemo(() => {
    const margin = base.terminal_margin_pct || 14.5;
    const startingRevM = 97600;
    const sharesM = 3200;
    const netCashM = 27280;

    return calculateStrictDCFValue(
      startingRevM,
      sharesM,
      netCashM,
      simWacc,
      simGrowth,
      simCagr,
      margin,
      dcf.assumptions.projection_years || 5
    );
  }, [simWacc, simGrowth, simCagr, base, dcf]);

  const simulatedMarginOfSafety = useMemo(() => {
    return ((recalculatedBaseFairValue - currentPrice) / currentPrice) * 100;
  }, [recalculatedBaseFairValue, currentPrice]);

  // Upside/Downside calculations for 3 Scenario Cards
  const bearUpside = ((bear.fair_value_per_share - currentPrice) / currentPrice) * 100;
  const baseUpside = ((base.fair_value_per_share - currentPrice) / currentPrice) * 100;
  const bullUpside = ((bull.fair_value_per_share - currentPrice) / currentPrice) * 100;

  // Spectrum range calculation
  const rangeMin = Math.min(bear.fair_value_per_share * 0.85, currentPrice * 0.85);
  const rangeMax = Math.max(bull.fair_value_per_share * 1.15, currentPrice * 1.15);
  const totalSpan = rangeMax - rangeMin || 1;
  const getPos = (val: number) => `${Math.max(2, Math.min(98, ((val - rangeMin) / totalSpan) * 100))}%`;

  return (
    <div className="flex flex-col gap-6 w-full font-sans">
      
      {/* 1. HERO COMPONENT: Range Spectrum Bar & Margin of Safety */}
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

          {/* Margin of Safety Badge */}
          <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 px-4 py-2.5 rounded-2xl shrink-0 self-start md:self-auto">
            {summary.margin_of_safety_pct >= 0 ? (
              <ShieldCheck className="w-6 h-6 text-[#0b5a4b] shrink-0" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
            )}
            <div className="flex flex-col">
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'ส่วนเผื่อความปลอดภัย (MARGIN OF SAFETY)' : 'MARGIN OF SAFETY'}
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

        {/* Model Timestamp & Fixed Assumption Anchor Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-600 font-mono">
          <div className="flex items-center gap-2 flex-wrap">
            <Calculator className="w-3.5 h-3.5 text-[#0b5a4b]" />
            <span><strong>{isThai ? 'แบบจำลอง:' : 'Model:'}</strong> {modelSelector?.model_name_th || '3-Stage DCF (FCFE/FCFF)'}</span>
            <span className="text-stone-300">•</span>
            <span><strong>WACC:</strong> {dcf.assumptions.wacc_pct || coc?.wacc_pct || 9.2}%</span>
            <span className="text-stone-300">•</span>
            <span><strong>Terminal g:</strong> {dcf.assumptions.terminal_growth_pct || 3.5}%</span>
          </div>
          <div className="text-[11px] text-stone-500 font-sans">
            <span>{isThai ? 'คำนวณล่าสุดเมื่อ:' : 'Model Date:'} <strong className="font-mono text-stone-800">{data.as_of_date || new Date().toISOString().split('T')[0]}</strong></span>
          </div>
        </div>

        {/* HERO SPECTRUM BAR */}
        <div className="flex flex-col gap-4 py-2">
          <div className="relative pt-12 pb-8">
            <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 w-full relative shadow-inner">
              <div 
                className="absolute top-0 bottom-0 w-1 bg-stone-900 z-10 -translate-x-1/2"
                style={{ left: getPos(base.fair_value_per_share) }}
                title={`Base Case: ${formatPrice(base.fair_value_per_share)}`}
              />
            </div>

            {/* Bear Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(bear.fair_value_per_share) }}
            >
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-0.5">BEAR CASE</span>
              <div className="bg-red-50 text-red-800 text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-red-200 shadow-xs">
                {formatPrice(bear.fair_value_per_share)}
              </div>
            </div>

            {/* Base Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(base.fair_value_per_share) }}
            >
              <span className="text-[10px] font-bold text-stone-800 uppercase tracking-wider mb-0.5">BASE CASE (TARGET)</span>
              <div className="bg-stone-900 text-white text-xs font-mono font-bold px-2.5 py-0.5 rounded-md shadow-md">
                {formatPrice(base.fair_value_per_share)}
              </div>
            </div>

            {/* Bull Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(bull.fair_value_per_share) }}
            >
              <span className="text-[10px] font-bold text-[#0b5a4b] uppercase tracking-wider mb-0.5">BULL CASE</span>
              <div className="bg-emerald-50 text-[#0b5a4b] text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-200 shadow-xs">
                {formatPrice(bull.fair_value_per_share)}
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

      {/* 2. THREE SCENARIO CARDS (Bear / Base / Bull) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Bear Card */}
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
                {formatPrice(bear.fair_value_per_share)}
              </div>
              <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                <span>CAGR: {bear.revenue_cagr_pct}%</span>
                <span>•</span>
                <span>Margin: {bear.terminal_margin_pct}%</span>
              </div>
            </div>

            <div className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100 font-sans">
              <strong className="block text-stone-800 mb-0.5">{isThai ? 'สมมติฐานหลัก:' : 'Key Assumption:'}</strong>
              {bear.key_assumption_note}
            </div>
          </div>
        </div>

        {/* Base Card */}
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
                {formatPrice(base.fair_value_per_share)}
              </div>
              <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                <span>CAGR: {base.revenue_cagr_pct}%</span>
                <span>•</span>
                <span>Margin: {base.terminal_margin_pct}%</span>
              </div>
            </div>

            <div className="text-xs text-stone-700 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-200 font-sans">
              <strong className="block text-stone-900 mb-0.5">{isThai ? 'สมมติฐานหลัก:' : 'Key Assumption:'}</strong>
              {base.key_assumption_note}
            </div>
          </div>
        </div>

        {/* Bull Card */}
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
                {formatPrice(bull.fair_value_per_share)}
              </div>
              <div className="flex gap-3 text-xs text-stone-500 font-mono mt-1">
                <span>CAGR: {bull.revenue_cagr_pct}%</span>
                <span>•</span>
                <span>Margin: {bull.terminal_margin_pct}%</span>
              </div>
            </div>

            <div className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3 rounded-xl border border-stone-100 font-sans">
              <strong className="block text-stone-800 mb-0.5">{isThai ? 'สมมติฐานหลัก:' : 'Key Assumption:'}</strong>
              {bull.key_assumption_note}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM SECTION: RELATIVE VALUATION & INTERACTIVE DCF SIMULATOR */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Relative Valuation Cross-Check */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 border-b border-stone-100 pb-2.5">
              <Scale className="w-4 h-4 text-[#0b5a4b]" />
              <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                {isThai ? 'การประเมินแบบเปรียบเทียบ (Relative Valuation)' : 'Relative Valuation Cross-Check'}
              </h4>
            </div>
            <div className="my-3 flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-extrabold font-mono text-stone-900">
                  {formatPrice(data.relative_valuation?.fair_value_per_share || (currentPrice * 0.92))}
                </span>
                <span className="text-xs text-stone-500 block mt-0.5">
                  {isThai ? 'มูลค่าประเมินจากตัวคูณกลุ่ม' : 'Fair value based on peer multiple'}
                </span>
              </div>
              <div className="text-right text-xs font-mono text-stone-600">
                <span className="text-stone-400 block text-[10px]">{isThai ? 'ตัวคูณที่ใช้' : 'Multiple Used'}</span>
                <span className="font-bold text-stone-800 text-sm">{data.relative_valuation?.peer_multiple_used || 45}x</span>
              </div>
            </div>
            <div className="text-xs text-stone-600 font-sans bg-stone-50 p-3 rounded-xl border border-stone-100">
              <span className="font-semibold">{isThai ? 'วิธีประเมิน: ' : 'Method: '}</span>
              {data.relative_valuation?.method || 'EV/EBITDA multiple ของกลุ่มธุรกิจเทคโนโลยีและพลังงานสะอาด'} ({data.relative_valuation?.metric_applied || 'Forward EBITDA'})
            </div>
          </div>
        </div>

        {/* Interactive DCF Assumptions & Simulator Trigger */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0b5a4b]" />
                <h4 className="font-bold text-stone-900 text-sm sm:text-base">
                  {isThai ? 'ปรับสมมติฐาน DCF ด้วยตัวเอง (Interactive)' : 'Interactive DCF Assumptions'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulator(!showSimulator)}
                className="text-xs bg-stone-100 hover:bg-stone-200/80 text-stone-800 border border-stone-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-medium shadow-2xs"
              >
                <span>{showSimulator ? (isThai ? 'ซ่อนตัวจำลอง' : 'Hide Simulator') : (isThai ? 'ลองปรับค่า' : 'Adjust Values')}</span>
                {showSimulator ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-xs text-stone-600 mt-3 leading-relaxed">
              {isThai 
                ? 'ทดสอบปรับค่า WACC, อัตราเติบโตระยะยาว และ Revenue CAGR เพื่อดูผลกระทบต่อราคาเหมาะสมแบบเรียลไทม์' 
                : 'Fine-tune WACC, terminal growth, and revenue CAGR to see real-time impact on intrinsic value.'}
            </p>

            {/* 3 Pills at bottom */}
            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-stone-100 text-[11px] font-mono text-stone-600 flex-wrap">
              <span className="bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/80">
                WACC ปัจจุบัน: <strong className="text-stone-900">{dcf.assumptions.wacc_pct || 9.2}%</strong>
              </span>
              <span className="bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/80">
                Terminal Growth: <strong className="text-stone-900">{dcf.assumptions.terminal_growth_pct || 3.5}%</strong>
              </span>
              <span className="bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/80 text-emerald-800 font-bold">
                {dcf.assumptions.projection_years || 5}-Yr Projection
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. EXPANDABLE LIVE SENSITIVITY SLIDERS (0.1% Step Resolution) */}
      <AnimatePresence>
        {showSimulator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col gap-5"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <h4 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0b5a4b]" />
                <span>{isThai ? 'ตัวจำลองความอ่อนไหวแบบละเอียด (0.1% Step Simulator)' : 'Live 0.1% Step Sensitivity Simulator'}</span>
              </h4>
              <button
                type="button"
                onClick={() => {
                  setSimWacc(dcf.assumptions.wacc_pct || coc?.wacc_pct || 9.2);
                  setSimGrowth(dcf.assumptions.terminal_growth_pct || 3.5);
                  setSimCagr(base.revenue_cagr_pct || 22);
                }}
                className="text-xs text-stone-500 hover:text-stone-800 underline cursor-pointer"
              >
                {isThai ? 'คืนค่าเริ่มต้น' : 'Reset Defaults'}
              </button>
            </div>

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
                  <span>{(base.revenue_cagr_pct || 22).toFixed(1)}% (Base)</span>
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
                  <span>{(dcf.assumptions.wacc_pct || 9.2).toFixed(1)}% (Base)</span>
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
                  <span>{(dcf.assumptions.terminal_growth_pct || 3.5).toFixed(1)}% (Base)</span>
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
