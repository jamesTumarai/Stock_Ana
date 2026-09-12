import React, { useMemo } from 'react';
import {
  Gauge, Sliders
} from 'lucide-react';
import { ReverseDcfResult } from '../types';
import { calculateCanonicalReverseDcf, calculateReverseDcf } from '../utils/decisionEngine';
import type { CanonicalValuationSandboxInputs } from '../utils/valuationSandboxAdapter';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  sandboxInputs?: CanonicalValuationSandboxInputs;
  currentPrice?: number;
  baseFcfPerShare?: number;
  discountRatePct?: number;
  terminalGrowthPct?: number;
  isThai: boolean;
  onOpenScenarioModal?: () => void;
}

export function ReverseDcfCard({
  sandboxInputs,
  currentPrice,
  baseFcfPerShare,
  discountRatePct,
  terminalGrowthPct,
  isThai,
  onOpenScenarioModal
}: Props) {
  const result: ReverseDcfResult | null = useMemo(() => {
    if (sandboxInputs) {
      return calculateCanonicalReverseDcf(sandboxInputs);
    }

    if (
      typeof currentPrice === 'number' && currentPrice > 0 &&
      typeof baseFcfPerShare === 'number' && baseFcfPerShare > 0 &&
      typeof discountRatePct === 'number' && discountRatePct > 0 &&
      typeof terminalGrowthPct === 'number' && terminalGrowthPct >= 0 &&
      discountRatePct > terminalGrowthPct
    ) {
      return calculateReverseDcf(
        currentPrice,
        baseFcfPerShare,
        discountRatePct,
        terminalGrowthPct,
        5
      );
    }

    return null;
  }, [sandboxInputs, currentPrice, baseFcfPerShare, discountRatePct, terminalGrowthPct]);

  if (!result || result.currentPrice <= 0) return null;

  const getHurdleBadge = () => {
    if (result.impliedGrowthPct === null || result.isOutOfRange) {
      return {
        label: isThai ? 'อยู่นอกกรอบการประเมิน (Out of Range)' : 'Out of Modeled Range',
        color: 'bg-stone-100 text-stone-700 border-stone-300'
      };
    }
    if (result.impliedGrowthPct <= 5) {
      return {
        label: isThai ? 'เกณฑ์ต่ำ (Conservative)' : 'Conservative Hurdle',
        color: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    }
    if (result.impliedGrowthPct <= 14) {
      return {
        label: isThai ? 'เกณฑ์ปานกลาง (Moderate)' : 'Moderate Growth Hurdle',
        color: 'bg-blue-50 text-blue-800 border-blue-200'
      };
    }
    if (result.impliedGrowthPct <= 22) {
      return {
        label: isThai ? 'เกณฑ์สูง (Demanding)' : 'Demanding Growth Hurdle',
        color: 'bg-amber-50 text-amber-800 border-amber-200'
      };
    }
    return {
      label: isThai ? 'เกณฑ์สูงมาก (Aggressive)' : 'Aggressive Growth Hurdle',
      color: 'bg-rose-50 text-rose-800 border-rose-200'
    };
  };

  const hurdle = getHurdleBadge();

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col gap-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-stone-100 text-[#0b5a4b] flex items-center justify-center shadow-2xs shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {isThai ? 'Reverse DCF: ตลาดกำลังคาดหวังการเติบโตเท่าใด?' : 'Reverse DCF: Market-Implied Expectations'}
              </h3>
              <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
            </div>
            <p className="text-xs text-stone-500 font-sans">
              {isThai
                ? 'คำนวณย้อนกลับจากราคาตลาดปัจจุบันเพื่อตรวจสอบอัตราการเติบโตของรายได้ (Revenue CAGR) ที่สะท้อนในราคาหุ้น'
                : 'Back-solves the annual revenue growth hurdle (CAGR) baked into current price to test feasibility'}
            </p>
          </div>
        </div>

        {onOpenScenarioModal && (
          <button
            type="button"
            onClick={onOpenScenarioModal}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-stone-900 text-white hover:bg-stone-800 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isThai ? 'แบบจำลอง Sensitivity' : 'Scenario & Sensitivity'}</span>
          </button>
        )}
      </div>

      {/* Main Reverse DCF Metrics Box */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Left: Implied Growth Hurdle Gauge */}
        <div className="md:col-span-4 bg-stone-50/80 rounded-2xl p-4 border border-stone-200/80 flex flex-col items-center text-center justify-center">
          <span className="text-[10px] uppercase font-bold text-stone-400 font-mono tracking-wider">
            {isThai ? 'อัตราเติบโตรายได้ที่ราคาตลาดสะท้อน' : 'Implied Revenue CAGR'}
          </span>
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[#0b5a4b] mt-1.5">
            {result.impliedGrowthPct !== null
              ? `${result.impliedGrowthPct > 0 ? '+' : ''}${result.impliedGrowthPct}%`
              : (result.isOutOfRange ? (isThai ? 'อยู่นอกกรอบ' : 'Out of Range') : (isThai ? 'ไม่พร้อมใช้งาน' : 'Unavailable'))}
          </div>
          <span className="text-[10px] text-stone-500 font-sans mt-0.5">
            {isThai ? 'อัตราเติบโตรายได้ทบต้นต่อปีตลอด 5 ปีข้างหน้า' : 'Revenue CAGR required over next 5 years'}
          </span>

          <div className={`mt-3 px-2.5 py-1 rounded-full text-[11px] font-bold border ${hurdle.color}`}>
            {hurdle.label}
          </div>
        </div>

        {/* Right: Qualitative Institutional Assessment */}
        <div className="md:col-span-8 flex flex-col gap-3">
          <div className="bg-stone-50/60 rounded-2xl p-3.5 border border-stone-200/70">
            <span className="text-[10px] uppercase font-bold text-stone-400 font-mono">
              {isThai ? 'การประเมินความเป็นไปได้เชิงสถาบัน (Feasibility Analysis)' : 'Institutional Hurdle Assessment'}
            </span>
            <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium mt-1">
              {isThai ? result.assessmentTh : result.assessment}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs font-mono">
            <div className="p-2.5 bg-white rounded-xl border border-stone-200/80 flex flex-col">
              <span className="text-[10px] text-stone-400 font-sans uppercase">{isThai ? 'ราคาตลาด' : 'Market Price'}</span>
              <strong className="text-stone-900 mt-0.5">${result.currentPrice.toFixed(2)}</strong>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-stone-200/80 flex flex-col">
              <span className="text-[10px] text-stone-400 font-sans uppercase">
                {sandboxInputs ? (isThai ? 'FCF Margin ฐาน' : 'Base FCF Margin') : (isThai ? 'FCF ต่อหุ้นฐาน' : 'Base FCF/sh')}
              </span>
              <strong className="text-stone-900 mt-0.5">
                {sandboxInputs ? `${sandboxInputs.baseFcfMarginPct.toFixed(1)}%` : `$${result.baseFcfPerShare.toFixed(2)}`}
              </strong>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-stone-200/80 flex flex-col">
              <span className="text-[10px] text-stone-400 font-sans uppercase">{isThai ? 'อัตราคิดลด WACC' : 'Discount Rate'}</span>
              <strong className="text-stone-900 mt-0.5">{result.discountRatePct.toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
