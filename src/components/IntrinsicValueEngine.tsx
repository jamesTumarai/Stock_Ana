import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sliders, ShieldCheck, ShieldAlert, Sparkles, TrendingUp, 
  TrendingDown, ArrowRight, ChevronDown, ChevronUp, AlertTriangle, Calculator, Scale
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

  // Interactive DCF Simulator state
  const [showSimulator, setShowSimulator] = useState(false);
  const [simWacc, setSimWacc] = useState(dcf.assumptions.wacc_pct || 9.5);
  const [simGrowth, setSimGrowth] = useState(dcf.assumptions.terminal_growth_pct || 3.0);
  const [simCagr, setSimCagr] = useState(base.revenue_cagr_pct || 40);

  // Simplified live DCF formula calculation based on user adjustments
  const recalculatedBaseFairValue = useMemo(() => {
    const defaultWacc = dcf.assumptions.wacc_pct || 9.5;
    const defaultGrowth = dcf.assumptions.terminal_growth_pct || 3.0;
    const defaultCagr = base.revenue_cagr_pct || 40;
    const baseVal = base.fair_value_per_share || 165;

    // Sensitivity factor:
    // Higher CAGR increases value by ~1.2% per 1% CAGR
    const cagrDelta = (simCagr - defaultCagr) * 0.018;
    // Lower WACC increases value by ~8% per 1% decrease in WACC
    const waccDelta = (defaultWacc - simWacc) * 0.09;
    // Higher Terminal growth increases value by ~10% per 1% increase in g
    const growthDelta = (simGrowth - defaultGrowth) * 0.12;

    const adjustedValue = baseVal * (1 + cagrDelta + waccDelta + growthDelta);
    return Math.max(10, adjustedValue);
  }, [simWacc, simGrowth, simCagr, base, dcf]);

  const simulatedMarginOfSafety = useMemo(() => {
    return ((recalculatedBaseFairValue - currentPrice) / currentPrice) * 100;
  }, [recalculatedBaseFairValue, currentPrice]);

  // Upside/downside calculations
  const bearUpside = ((bear.fair_value_per_share - currentPrice) / currentPrice) * 100;
  const baseUpside = ((base.fair_value_per_share - currentPrice) / currentPrice) * 100;
  const bullUpside = ((bull.fair_value_per_share - currentPrice) / currentPrice) * 100;

  // Spectrum range calculation
  const rangeMin = Math.min(bear.fair_value_per_share * 0.85, currentPrice * 0.85);
  const rangeMax = Math.max(bull.fair_value_per_share * 1.15, currentPrice * 1.15);
  const totalSpan = rangeMax - rangeMin || 1;

  const getPos = (val: number) => `${Math.max(2, Math.min(98, ((val - rangeMin) / totalSpan) * 100))}%`;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. HERO COMPONENT: Range Spectrum Bar & Margin of Safety */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-md flex flex-col gap-6 relative overflow-hidden">
        {/* Subtle decorative background gradient */}
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

        {/* HERO SPECTRUM BAR */}
        <div className="flex flex-col gap-4 py-4">
          <div className="relative pt-12 pb-8">
            {/* The Gradient Spectrum Track */}
            <div className="h-4 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500 w-full relative shadow-inner">
              {/* Base Case Pin marker on track */}
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
              <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-0.5">Bear Case</span>
              <div className="bg-red-50 text-red-800 text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-red-200 shadow-xs">
                {formatPrice(bear.fair_value_per_share)}
              </div>
            </div>

            {/* Base Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(base.fair_value_per_share) }}
            >
              <span className="text-[10px] font-bold text-stone-800 uppercase tracking-wider mb-0.5">Base Case (Target)</span>
              <div className="bg-stone-900 text-white text-xs font-mono font-bold px-2.5 py-0.5 rounded-md shadow-md">
                {formatPrice(base.fair_value_per_share)}
              </div>
            </div>

            {/* Bull Pin */}
            <div 
              className="absolute top-1 -translate-x-1/2 flex flex-col items-center pointer-events-none"
              style={{ left: getPos(bull.fair_value_per_share) }}
            >
              <span className="text-[10px] font-bold text-[#0b5a4b] uppercase tracking-wider mb-0.5">Bull Case</span>
              <div className="bg-emerald-50 text-[#0b5a4b] text-xs font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-200 shadow-xs">
                {formatPrice(bull.fair_value_per_share)}
              </div>
            </div>

            {/* CURRENT PRICE INDICATOR (Hero Pin positioned below the bar pointing up) */}
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

          {/* Verdict summary text */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 text-sm text-stone-700 leading-relaxed font-sans mt-2">
            <strong>{isThai ? 'บทวิเคราะห์ Valuation:' : 'Valuation Verdict:'}</strong> {summary.verdict_text}
          </div>
        </div>
      </div>

      {/* 2. THREE SCENARIO CARDS (Bear / Base / Bull) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Bear Card */}
        <div 
          className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-red-200 transition-all gap-3"
        >
          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                {isThai ? 'กรณีแย่ที่สุด (Bear Case)' : 'Bear Case'}
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
        <div 
          className="bg-white rounded-2xl p-5 border-2 border-stone-900 shadow-md flex flex-col justify-between relative gap-3"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[10px] uppercase font-bold px-3 py-0.5 rounded-full tracking-wider">
            {isThai ? 'กรณีฐาน (Base Target)' : 'Base Target'}
          </div>

          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5 mt-1">
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                {isThai ? 'กรณีฐาน (Base Case)' : 'Base Case'}
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
        <div 
          className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between hover:border-emerald-200 transition-all gap-3"
        >
          <div>
            <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
              <span className="text-xs font-bold text-[#0b5a4b] uppercase tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {isThai ? 'กรณีเติบโตสูง (Bull Case)' : 'Bull Case'}
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

      {/* 3. RELATIVE VALUATION CROSS-CHECK & DCF SENSITIVITY DRAWER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        {/* Relative Valuation Cross-Check */}
        {data.relative_valuation && (
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
                    {formatPrice(data.relative_valuation.fair_value_per_share)}
                  </span>
                  <span className="text-xs text-stone-500 block">
                    {isThai ? 'มูลค่าประเมินจากตัวคูณกลุ่ม' : 'Fair value based on peer multiple'}
                  </span>
                </div>
                <div className="text-right text-xs font-mono text-stone-600">
                  <span className="text-stone-400 block text-[10px]">{isThai ? 'ตัวคูณที่ใช้' : 'Multiple'}</span>
                  <span className="font-bold text-stone-800">{data.relative_valuation.peer_multiple_used}x</span>
                </div>
              </div>
              <div className="text-xs text-stone-600 font-sans bg-stone-50 p-3 rounded-xl border border-stone-100">
                <span className="font-semibold">{isThai ? 'วิธีประเมิน: ' : 'Method: '}</span>
                {data.relative_valuation.method} ({data.relative_valuation.metric_applied})
              </div>
            </div>
          </div>
        )}

        {/* Interactive DCF Sensitivity Simulator Trigger (Clean Light Report Aesthetic) */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0b5a4b]" />
                <h4 className="font-bold text-stone-900 text-sm sm:text-base font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'ปรับสมมติฐาน DCF ด้วยตัวเอง (Interactive)' : 'Interactive DCF Sensitivity'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulator(!showSimulator)}
                className="text-xs bg-stone-100 hover:bg-stone-200/80 text-stone-800 border border-stone-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer font-medium shadow-2xs"
              >
                <span>{showSimulator ? (isThai ? 'ซ่อน' : 'Hide') : (isThai ? 'ลองปรับค่า' : 'Customize')}</span>
                {showSimulator ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
            
            <p className="text-xs text-stone-600 mt-2.5 leading-relaxed font-sans">
              {isThai 
                ? 'ทดลองปรับค่า WACC, อัตราเติบโตระยะยาว และ Revenue CAGR เพื่อดูผลกระทบต่อราคาเหมาะสมแบบเรียลไทม์'
                : 'Simulate how varying discount rates and growth assumptions impact intrinsic valuation in real time.'}
            </p>
          </div>

          <div className="flex items-center justify-between bg-stone-50 border border-stone-200 p-3 rounded-xl font-mono text-xs text-stone-700 shadow-2xs">
            <span>{isThai ? 'WACC ปัจจุบัน:' : 'WACC:'} <strong className="text-stone-900">{dcf.assumptions.wacc_pct}%</strong></span>
            <span>{isThai ? 'Terminal Growth:' : 'Term g:'} <strong className="text-stone-900">{dcf.assumptions.terminal_growth_pct}%</strong></span>
            <span className="text-[#0b5a4b] font-bold">{isThai ? '5-Yr Projection' : '5-Yr Model'}</span>
          </div>
        </div>
      </div>

      {/* 4. EXPANDABLE INTERACTIVE DCF SIMULATOR */}
      <AnimatePresence>
        {showSimulator && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-stone-50 rounded-2xl p-6 border-2 border-stone-800 shadow-sm flex flex-col gap-5 overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <Calculator className="w-5 h-5 text-[#0b5a4b]" />
              <h4 className="font-bold text-stone-900 text-base">
                {isThai ? 'เครื่องมือจำลองความอ่อนไหวของราคาเหมาะสม (Sensitivity Simulator)' : 'Live Sensitivity Simulator'}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Slider 1: Revenue CAGR */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'Revenue CAGR (5 ปี)' : '5-Yr Revenue CAGR'}</span>
                  <span className="font-mono text-[#0b5a4b] font-bold text-sm">{simCagr}%</span>
                </div>
                <input 
                  type="range" 
                  min="15" 
                  max="65" 
                  step="1"
                  value={simCagr}
                  onChange={(e) => setSimCagr(parseFloat(e.target.value))}
                  className="w-full accent-[#0b5a4b] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>15%</span>
                  <span>40% (Base)</span>
                  <span>65%</span>
                </div>
              </div>

              {/* Slider 2: WACC */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'อัตราคิดลด (WACC)' : 'Discount Rate (WACC)'}</span>
                  <span className="font-mono text-stone-900 font-bold text-sm">{simWacc}%</span>
                </div>
                <input 
                  type="range" 
                  min="6" 
                  max="14" 
                  step="0.5"
                  value={simWacc}
                  onChange={(e) => setSimWacc(parseFloat(e.target.value))}
                  className="w-full accent-stone-900 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>6.0%</span>
                  <span>9.5% (Base)</span>
                  <span>14.0%</span>
                </div>
              </div>

              {/* Slider 3: Terminal Growth Rate */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'อัตราเติบโตยั่งยืน (Terminal Growth)' : 'Terminal Growth (g)'}</span>
                  <span className="font-mono text-stone-900 font-bold text-sm">{simGrowth}%</span>
                </div>
                <input 
                  type="range" 
                  min="1.5" 
                  max="4.5" 
                  step="0.25"
                  value={simGrowth}
                  onChange={(e) => setSimGrowth(parseFloat(e.target.value))}
                  className="w-full accent-stone-900 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                  <span>1.5%</span>
                  <span>3.0% (Base)</span>
                  <span>4.5%</span>
                </div>
              </div>
            </div>

            {/* Live Recalculated Output Result */}
            <div className="bg-white p-4 rounded-xl border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
              <div>
                <span className="text-xs text-stone-500 block uppercase font-bold tracking-wider">
                  {isThai ? 'ผลลัพธ์ราคาเหมาะสมที่คำนวณใหม่ (Simulated Fair Value)' : 'Simulated Fair Value'}
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
                    setSimWacc(dcf.assumptions.wacc_pct || 9.5);
                    setSimGrowth(dcf.assumptions.terminal_growth_pct || 3.0);
                    setSimCagr(base.revenue_cagr_pct || 40);
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

      {/* Disclaimer */}
      <div className="text-[11px] text-stone-500 leading-relaxed italic bg-stone-100/60 p-3 rounded-xl border border-stone-200 text-center font-sans">
        {data.disclaimer || (isThai ? 'คำเตือน: การประเมินมูลค่าแท้จริงนี้เป็นแบบจำลองอย่างง่ายจากสมมติฐานทางคณิตศาสตร์ ไม่ใช่คำแนะนำการลงทุน ผลลัพธ์ขึ้นอยู่กับความแม่นยำของสมมติฐานที่นำเข้าเป็นหลัก' : 'Disclaimer: Intrinsic valuation models are simplified estimations based on assumptions and should not be considered investment advice.')}
      </div>
    </div>
  );
}
