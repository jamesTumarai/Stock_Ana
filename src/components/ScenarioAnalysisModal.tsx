import React, { useState, useMemo } from 'react';
import {
  X, Sliders, Table, RotateCcw, AlertTriangle, ShieldAlert
} from 'lucide-react';
import {
  generateCanonicalScenarios,
  computeCanonicalSensitivityMatrix,
  generateValuationScenarios,
  computeSensitivityMatrix,
  calculateDcfPerShare
} from '../utils/decisionEngine';
import type { CanonicalValuationSandboxInputs } from '../utils/valuationSandboxAdapter';
import { recalculateSandboxFairValue } from '../utils/valuationSandboxAdapter';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticker: string;
  sandboxInputs?: CanonicalValuationSandboxInputs | null;
  currentPrice?: number;
  baseFcfPerShare?: number;
  initialGrowthPct?: number;
  initialWaccPct?: number;
  initialTerminalGrowthPct?: number;
  isThai: boolean;
}

export function ScenarioAnalysisModal({
  isOpen,
  onClose,
  ticker,
  sandboxInputs,
  currentPrice: propPrice,
  baseFcfPerShare: propFcf,
  initialGrowthPct: propGrowth,
  initialWaccPct: propWacc,
  initialTerminalGrowthPct: propTg,
  isThai
}: Props) {
  // Determine if we have valid canonical inputs
  const hasCanonical = Boolean(sandboxInputs && sandboxInputs.currentPrice > 0);

  // Baseline values (strictly from canonical inputs or explicit props; NO hidden defaults)
  const defaultGrowth = sandboxInputs?.baseRevenueCagrPct ?? propGrowth;
  const defaultWacc = sandboxInputs?.waccPct ?? propWacc;
  const defaultTg = sandboxInputs?.terminalGrowthPct ?? propTg;
  const effectivePrice = sandboxInputs?.currentPrice ?? propPrice ?? 0;

  const isEligible = hasCanonical || (
    typeof propPrice === 'number' && propPrice > 0 &&
    typeof propFcf === 'number' && propFcf > 0 &&
    typeof defaultGrowth === 'number' && Number.isFinite(defaultGrowth) &&
    typeof defaultWacc === 'number' && defaultWacc > 0 &&
    typeof defaultTg === 'number' && defaultTg >= 0 &&
    defaultWacc > defaultTg
  );

  const [growthPct, setGrowthPct] = useState<number>(defaultGrowth ?? 0);
  const [waccPct, setWaccPct] = useState<number>(defaultWacc ?? 0);
  const [terminalGrowthPct, setTerminalGrowthPct] = useState<number>(defaultTg ?? 0);

  // Sync state if sandbox inputs change
  React.useEffect(() => {
    if (defaultGrowth !== undefined) setGrowthPct(defaultGrowth);
    if (defaultWacc !== undefined) setWaccPct(defaultWacc);
    if (defaultTg !== undefined) setTerminalGrowthPct(defaultTg);
  }, [defaultGrowth, defaultWacc, defaultTg]);

  // Compute customized DCF per share using canonical engine or strict fallback
  const customFairValue = useMemo(() => {
    if (!isEligible) return 0;

    if (sandboxInputs) {
      const fv = recalculateSandboxFairValue(sandboxInputs, {
        revenueCagrPct: growthPct,
        waccPct,
        terminalGrowthPct
      });
      return Number.isFinite(fv) && fv > 0 ? fv : 0;
    }

    if (propFcf && propFcf > 0 && waccPct > terminalGrowthPct) {
      return calculateDcfPerShare(
        propFcf,
        growthPct,
        waccPct,
        terminalGrowthPct,
        5
      );
    }

    return 0;
  }, [isEligible, sandboxInputs, propFcf, growthPct, waccPct, terminalGrowthPct]);

  const customMosPct = useMemo(() => {
    if (customFairValue <= 0 || effectivePrice <= 0) return 0;
    return Number((((customFairValue - effectivePrice) / effectivePrice) * 100).toFixed(1));
  }, [customFairValue, effectivePrice]);

  // Compute Bear, Base, Bull Scenarios
  const scenarios = useMemo(() => {
    if (!isEligible) return [];

    if (sandboxInputs) {
      return generateCanonicalScenarios(sandboxInputs, {
        growthPct: defaultGrowth,
        waccPct: defaultWacc,
        terminalGrowthPct: defaultTg
      });
    }

    if (propFcf && propFcf > 0 && typeof defaultGrowth === 'number' && typeof defaultWacc === 'number' && typeof defaultTg === 'number') {
      return generateValuationScenarios(
        propFcf,
        effectivePrice,
        defaultGrowth,
        defaultWacc,
        defaultTg
      );
    }

    return [];
  }, [isEligible, sandboxInputs, propFcf, effectivePrice, defaultGrowth, defaultWacc, defaultTg]);

  // Compute 5x5 Sensitivity Matrix
  const sensitivityMatrix = useMemo(() => {
    if (!isEligible) return { discountRates: [], terminalGrowthRates: [], cells: [] };

    if (sandboxInputs) {
      return computeCanonicalSensitivityMatrix(sandboxInputs, growthPct);
    }

    if (propFcf && propFcf > 0 && typeof defaultWacc === 'number' && typeof defaultTg === 'number') {
      return computeSensitivityMatrix(
        propFcf,
        effectivePrice,
        waccPct,
        terminalGrowthPct,
        growthPct
      );
    }

    return { discountRates: [], terminalGrowthRates: [], cells: [] };
  }, [isEligible, sandboxInputs, propFcf, effectivePrice, waccPct, terminalGrowthPct, growthPct, defaultWacc, defaultTg]);

  if (!isOpen) return null;

  const handleReset = () => {
    if (defaultGrowth !== undefined) setGrowthPct(defaultGrowth);
    if (defaultWacc !== undefined) setWaccPct(defaultWacc);
    if (defaultTg !== undefined) setTerminalGrowthPct(defaultTg);
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
          {!isEligible ? (
            <div className="p-8 rounded-2xl border border-amber-200 bg-amber-50/50 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-950">
                  {isThai ? 'ไม่สามารถเปิดแบบจำลอง Scenario ได้' : 'Scenario Sandbox Unavailable'}
                </h3>
                <p className="text-xs text-amber-800 max-w-md mt-1 leading-relaxed">
                  {isThai
                    ? 'ข้อมูลสำหรับการประเมินมูลค่าตามหลักเกณฑ์ไม่ครบถ้วน หรือบริษัทจัดอยู่ในกลุ่มธุรกิจที่ไม่ใช้แบบจำลองกระแสเงินสดอิสระ (FCFF) ระบบ Lumina จะไม่สร้างตัวเลขจำลองขึ้นมาเองโดยไม่มีข้อมูลอ้างอิงที่ผ่านการตรวจสอบ'
                    : 'Canonical DCF inputs are missing or unverified, or this issuer utilizes a non-FCFF model (such as a financial institution). Lumina never substitutes fabricated numeric defaults.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Bear, Base, Bull Scenarios */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] uppercase tracking-wider">
                    {isThai ? '3 สถานการณ์จำลอง (Deterministic Scenarios)' : 'Deterministic Valuation Scenarios'}
                  </h3>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {isThai ? 'ราคาตลาดปัจจุบัน: ' : 'Market Price: '}
                    <strong className="text-stone-900 font-mono">${effectivePrice.toFixed(2)}</strong>
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
                      {isThai ? 'จำลองปรับสมมติฐานด้วยตัวเอง (User Assumptions)' : 'Interactive Sandbox (User Assumptions)'}
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
                      <span>{isThai ? 'สมมติฐานเติบโต (Growth)' : 'Revenue Growth (CAGR)'}</span>
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
                      <span>{isThai ? 'สมมติฐานคิดลด (WACC)' : 'Discount Rate (WACC)'}</span>
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
                      <span>{isThai ? 'สมมติฐานโตระยะยาว (Terminal)' : 'Terminal Growth'}</span>
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
                  <span className="text-[10px] text-stone-400 font-sans">{isThai ? 'สีเขียว = ส่วนเผื่อความปลอดภัย / สีแดง = ต่ำกว่าราคาตลาด' : 'Green = Value discount / Red = Premium'}</span>
                </div>

                {sensitivityMatrix.discountRates.length > 0 ? (
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
                            {sensitivityMatrix.cells[rowIdx]?.map((cell, colIdx) => (
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
                ) : (
                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center text-xs text-stone-500">
                    {isThai ? 'ไม่มีข้อมูลสำหรับตาราง Sensitivity' : 'Sensitivity matrix unavailable.'}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
