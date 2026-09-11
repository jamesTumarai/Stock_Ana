import React, { useState, useMemo } from 'react';
import {
  X, Sliders, Table, TrendingUp, TrendingDown, Scale,
  RotateCcw, Sparkles, ShieldCheck, HelpCircle, Layers
} from 'lucide-react';
import {
  generateValuationScenarios,
  computeSensitivityMatrix,
  calculateDcfPerShare
} from '../utils/decisionEngine';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  currentPrice: number;
  baseFcfPerShare: number;
  initialGrowthPct?: number;
  initialWaccPct?: number;
  initialTerminalGrowthPct?: number;
  isThai: boolean;
}

export function ScenarioAnalysisModal({
  isOpen,
  onClose,
  ticker,
  currentPrice,
  baseFcfPerShare,
  initialGrowthPct = 10,
  initialWaccPct = 9.0,
  initialTerminalGrowthPct = 2.5,
  isThai
}: Props) {
  const [growthPct, setGrowthPct] = useState(initialGrowthPct);
  const [waccPct, setWaccPct] = useState(initialWaccPct);
  const [terminalGrowthPct, setTerminalGrowthPct] = useState(initialTerminalGrowthPct);

  // Compute customized DCF per share
  const customFairValue = useMemo(() => {
    return calculateDcfPerShare(
      baseFcfPerShare,
      growthPct,
      waccPct,
      terminalGrowthPct,
      5
    );
  }, [baseFcfPerShare, growthPct, waccPct, terminalGrowthPct]);

  const customMosPct = useMemo(() => {
    if (customFairValue <= 0 || currentPrice <= 0) return 0;
    return Number((((customFairValue - currentPrice) / currentPrice) * 100).toFixed(1));
  }, [customFairValue, currentPrice]);

  // Compute Bear, Base, Bull Scenarios
  const scenarios = useMemo(() => {
    return generateValuationScenarios(
      baseFcfPerShare,
      currentPrice,
      initialGrowthPct,
      initialWaccPct,
      initialTerminalGrowthPct
    );
  }, [baseFcfPerShare, currentPrice, initialGrowthPct, initialWaccPct, initialTerminalGrowthPct]);

  // Compute 5x5 Sensitivity Matrix
  const sensitivityMatrix = useMemo(() => {
    return computeSensitivityMatrix(
      baseFcfPerShare,
      currentPrice,
      waccPct,
      terminalGrowthPct,
      growthPct
    );
  }, [baseFcfPerShare, currentPrice, waccPct, terminalGrowthPct, growthPct]);

  if (!isOpen) return null;

  const handleReset = () => {
    setGrowthPct(initialGrowthPct);
    setWaccPct(initialWaccPct);
    setTerminalGrowthPct(initialTerminalGrowthPct);
  };

  const getCellBg = (mos: number) => {
    if (mos >= 20) return 'bg-emerald-100 text-emerald-950 font-bold border-emerald-300';
    if (mos > 0) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (mos > -15) return 'bg-rose-50 text-rose-800 border-rose-200';
    return 'bg-rose-100 text-rose-950 font-bold border-rose-300';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-modal-title"
    >
      <div
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stone-100 text-[#0b5a4b] border border-stone-200/80 flex items-center justify-center shadow-2xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="scenario-modal-title" className="text-xl font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                  {isThai ? `แบบจำลอง Sensitivity & Scenarios (${ticker})` : `${ticker} Sensitivity & Scenario Engine`}
                </h2>
                <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
              </div>
              <p className="text-xs text-stone-500 font-sans">
                {isThai
                  ? 'ทดสอบความทนทานของมูลค่าหุ้นต่อการเปลี่ยนแปลงของสมมติฐานการเติบโตและต้นทุนเงินทุน'
                  : 'Evaluate intrinsic value resilience across varying WACC discount rates and growth assumptions'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-2 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
          {/* Bear, Base, Bull Scenarios */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] uppercase tracking-wider">
                {isThai ? '3 สถานการณ์จำลอง (Deterministic Scenarios)' : 'Deterministic Valuation Scenarios'}
              </h3>
              <span className="text-[10px] text-stone-400 font-mono">
                {isThai ? 'ราคาตลาดปัจจุบัน: ' : 'Market Price: '}
                <strong className="text-stone-900 font-mono">${currentPrice.toFixed(2)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scenarios.map((sc) => {
                const isBull = sc.name === 'bull';
                const isBear = sc.name === 'bear';
                const theme = isBull
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : isBear
                    ? 'border-stone-200 bg-stone-50/50'
                    : 'border-[#0b5a4b]/30 bg-[#0b5a4b]/5';

                return (
                  <div key={sc.name} className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${theme}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                        {sc.name === 'bear' ? (isThai ? 'กรณีแย่ (Bear)' : 'Bear Case') : sc.name === 'base' ? (isThai ? 'กรณีฐาน (Base)' : 'Base Case') : (isThai ? 'กรณีดี (Bull)' : 'Bull Case')}
                      </span>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${sc.marginOfSafetyPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {sc.marginOfSafetyPct >= 0 ? '+' : ''}{sc.marginOfSafetyPct}% MoS
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-stone-400 font-sans">{isThai ? 'มูลค่าประเมินต่อหุ้น' : 'Fair Value'}</span>
                      <span className="text-2xl font-mono font-extrabold text-stone-900">
                        ${sc.fairValuePerShare.toFixed(2)}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-stone-200/60 grid grid-cols-2 gap-1 text-[11px] font-mono text-stone-500">
                      <div>Growth: <strong>{sc.revenueGrowthPct}%</strong></div>
                      <div>WACC: <strong>{sc.discountRatePct}%</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Sliders Simulation Box */}
          <div className="bg-stone-50/80 rounded-2xl p-4 sm:p-5 border border-stone-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0b5a4b]" />
                <h4 className="text-sm font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'จำลองปรับสมมติฐานด้วยตัวเอง (Interactive DCF)' : 'Interactive Sensitivity Sandbox'}
                </h4>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 cursor-pointer transition-colors"
                title="Reset to defaults"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isThai ? 'รีเซ็ต' : 'Reset'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Growth Rate Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'อัตราเติบโต 5 ปี (Growth)' : '5-Yr FCF Growth'}</span>
                  <span className="font-mono font-bold text-[#0b5a4b]">{growthPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="35"
                  step="0.5"
                  value={growthPct}
                  onChange={(e) => setGrowthPct(parseFloat(e.target.value))}
                  className="accent-[#0b5a4b] cursor-pointer"
                />
              </div>

              {/* Discount Rate (WACC) Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'อัตราคิดลด (WACC)' : 'Discount Rate (WACC)'}</span>
                  <span className="font-mono font-bold text-[#0b5a4b]">{waccPct}%</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="16"
                  step="0.25"
                  value={waccPct}
                  onChange={(e) => setWaccPct(parseFloat(e.target.value))}
                  className="accent-[#0b5a4b] cursor-pointer"
                />
              </div>

              {/* Terminal Growth Rate Slider */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                  <span>{isThai ? 'อัตราโตระยะยาว (Terminal)' : 'Terminal Growth'}</span>
                  <span className="font-mono font-bold text-[#0b5a4b]">{terminalGrowthPct}%</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="4.5"
                  step="0.25"
                  value={terminalGrowthPct}
                  onChange={(e) => setTerminalGrowthPct(parseFloat(e.target.value))}
                  className="accent-[#0b5a4b] cursor-pointer"
                />
              </div>
            </div>

            {/* Recalculated Output Result Banner */}
            <div className="bg-white rounded-xl p-3 border border-stone-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-stone-500 uppercase">{isThai ? 'ผลลัพธ์จำลอง:' : 'Calculated Value:'}</span>
                <span className="text-xl font-mono font-black text-stone-900">${customFairValue.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500">{isThai ? 'Margin of Safety:' : 'Margin of Safety:'}</span>
                <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded-md ${customMosPct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {customMosPct >= 0 ? '+' : ''}{customMosPct}%
                </span>
              </div>
            </div>
          </div>

          {/* 2D Sensitivity Matrix Table */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] uppercase tracking-wider flex items-center gap-1.5">
                <Table className="w-4 h-4 text-[#0b5a4b]" />
                <span>{isThai ? 'ตารางความไว 2 มิติ (2D Sensitivity Matrix)' : '2D Sensitivity Matrix (WACC vs Terminal Growth)'}</span>
              </h4>
              <span className="text-[10px] text-stone-400 font-sans">{isThai ? 'สีเขียว = ปลอดภัย / สีแดง = ต่ำกว่าทุน' : 'Green = Value discount / Red = Premium'}</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full text-center text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-600 font-mono text-[11px]">
                    <th className="p-2.5 border-b border-r border-stone-200 text-left font-sans">{isThai ? 'WACC \\ Term. Growth' : 'WACC \\ TG'}</th>
                    {sensitivityMatrix.terminalGrowthRates.map(tg => (
                      <th key={tg} className="p-2.5 border-b border-stone-200 font-mono">
                        {tg.toFixed(1)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sensitivityMatrix.discountRates.map((wacc, rowIdx) => (
                    <tr key={wacc} className="border-b border-stone-100 font-mono">
                      <td className="p-2.5 bg-stone-50 border-r border-stone-200 font-bold text-stone-700 text-left font-mono">
                        {wacc.toFixed(1)}%
                      </td>
                      {sensitivityMatrix.cells[rowIdx].map((cell, colIdx) => (
                        <td
                          key={colIdx}
                          className={`p-2.5 border-r border-stone-100 last:border-r-0 transition-colors ${getCellBg(cell.marginOfSafetyPct)}`}
                          title={`Fair Value: $${cell.fairValue.toFixed(2)} (${cell.marginOfSafetyPct > 0 ? '+' : ''}${cell.marginOfSafetyPct}% MoS)`}
                        >
                          <div className="font-bold text-xs">${cell.fairValue.toFixed(0)}</div>
                          <div className="text-[9px] opacity-80">{cell.marginOfSafetyPct > 0 ? '+' : ''}{cell.marginOfSafetyPct.toFixed(0)}%</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
