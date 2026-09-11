import React, { useEffect } from 'react';
import { X, Calculator, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { MetricCalculationDetail } from '../utils/metricCalculations';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  detail: MetricCalculationDetail | null;
  isOpen: boolean;
  onClose: () => void;
  isThai: boolean;
  periodLabel?: string;
  currencyMode?: 'USD' | 'THB';
  currencyRate?: number;
}

export function CalculationModal({
  detail,
  isOpen,
  onClose,
  isThai,
  periodLabel,
  currencyMode = 'USD',
  currencyRate
}: Props) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !detail) return null;

  const multiplier = currencyMode === 'THB' && typeof currencyRate === 'number' && currencyRate > 0 ? currencyRate : 1;
  const currSym = currencyMode === 'THB' ? '฿' : '$';

  const formatVal = (val: number | null | undefined, isCurrency?: boolean, unit?: string) => {
    if (val === null || val === undefined) return '-';
    if (isCurrency) {
      const converted = val * multiplier;
      if (Math.abs(converted) >= 1000) {
        return `${currSym}${(converted / 1000).toFixed(2)}B`;
      }
      return `${currSym}${converted.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}M`;
    }
    return `${val.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}${unit || ''}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="calc-modal-title"
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 flex flex-col gap-5 relative overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Decorative ambient gradient */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-50 via-teal-50/30 to-transparent rounded-full pointer-events-none -mr-12 -mt-12 blur-xl" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0b5a4b] border border-emerald-200/80 flex items-center justify-center shadow-2xs shrink-0 mt-0.5">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 id="calc-modal-title" className="text-lg font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight leading-tight">
                  {isThai ? detail.nameTh : detail.nameEn}
                </h3>
                <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
              </div>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                {isThai ? (detail.nameEn !== detail.nameTh ? detail.nameEn : 'ที่มาสูตรคำนวณทางการเงิน') : 'Deterministic Financial Formula Breakdown'}
                {periodLabel ? ` • ${periodLabel}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-full hover:bg-stone-100 transition-colors shrink-0 cursor-pointer"
            aria-label="Close calculation modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mathematical Formula Box */}
        <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/90 flex flex-col gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
            {isThai ? 'สูตรคณิตศาสตร์ที่กำหนดแน่นอน (Deterministic Formula)' : 'Deterministic Formula'}
          </span>
          <div className="font-mono text-sm sm:text-base font-bold text-[#0b5a4b] bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs break-words">
            {detail.formulaDisplay}
          </div>
        </div>

        {/* Variables Plugged In */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-600">
            {isThai ? 'ตัวแปรที่ใช้คำนวณงวดนี้ (Period Inputs)' : 'Period Inputs & Variables'}
          </span>
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs divide-y divide-stone-100">
            {detail.variables.map((v, i) => (
              <div key={i} className="flex items-center justify-between p-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-stone-100 text-stone-700 font-mono font-bold flex items-center justify-center text-[11px] shrink-0">
                    {v.symbol}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-stone-900 truncate">{isThai ? v.nameTh : v.nameEn}</div>
                    <div className="text-[10px] text-stone-400">{isThai ? v.nameEn : v.nameTh}</div>
                  </div>
                </div>
                <div className="font-mono font-bold text-stone-900 text-right ml-2 shrink-0">
                  {formatVal(v.value, v.isCurrency, v.unit)}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 text-xs font-bold border-t border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-950">
                <ArrowRight className="w-4 h-4 text-[#0b5a4b]" />
                <span>{isThai ? 'ผลลัพธ์คำนวณสุทธิ' : 'Calculated Result'}</span>
              </div>
              <span className="font-mono text-sm text-[#0b5a4b]">
                {detail.resultValue !== null && detail.resultValue !== undefined
                  ? `${detail.resultValue}${detail.resultUnit}`
                  : (isThai ? 'ข้อมูลไม่ครบถ้วน (null)' : 'Incomplete (null)')}
              </span>
            </div>
          </div>
        </div>

        {/* Financial Context & Benchmarks */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3.5 rounded-2xl border border-stone-100">
            <span className="font-bold text-stone-900 block mb-1">
              {isThai ? 'ความหมายและการนำไปใช้:' : 'Financial Significance:'}
            </span>
            {isThai ? detail.explanationTh : detail.explanationEn}
          </div>

          {(detail.standardBenchmarkTh || detail.standardBenchmarkEn) && (
            <div className="flex items-start gap-2 p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[11px] text-amber-950">
              <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">{isThai ? 'เกณฑ์มาตรฐาน:' : 'Standard Benchmark:'} </span>
                {isThai ? detail.standardBenchmarkTh : detail.standardBenchmarkEn}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400 font-sans">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isThai ? 'คำนวณจากสูตรแน่นอน ไม่มีการคาดเดาจาก AI' : 'Deterministic math — 0% AI estimation'}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-600 hover:text-stone-900 font-semibold cursor-pointer"
          >
            {isThai ? 'ปิด' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
