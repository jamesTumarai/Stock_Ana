import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp, Percent, ShieldCheck, DollarSign, Users,
  Sparkles, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Layers, Award, Scale, BarChart3, Check, SlidersHorizontal, Info, Lightbulb
} from 'lucide-react';
import type { FivePillarsData, FivePillarsResolvedMetric, PeerBenchmarkRow } from '../types';

const resolvedDisplay = (
  resolved: FivePillarsResolvedMetric | undefined,
  fallback: number | undefined,
  isThai: boolean,
  unit = '%',
  prefix = '+',
) => {
  const value = typeof resolved?.value === 'number' && Number.isFinite(resolved.value) ? resolved.value : fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return `${value > 0 ? prefix : ''}${value}${unit}`;
  return (isThai ? resolved?.reasonTh : resolved?.reason) || resolved?.reasonTh || resolved?.reason || 'N/A';
};

const pegBadge = (resolved: FivePillarsResolvedMetric | undefined, fallback: number | undefined, isThai: boolean) => {
  const value = typeof resolved?.value === 'number' && Number.isFinite(resolved.value) ? resolved.value : fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return `PEG ${value}x`;
  if (resolved?.status === 'TURNAROUND') return isThai ? 'PEG N/M · ฟื้นตัว' : 'PEG N/M · Turnaround';
  if (resolved?.status === 'BASIS_MISMATCH') return isThai ? 'PEG N/A · ต่างฐานเวลา' : 'PEG N/A · Basis mismatch';
  if (resolved?.status === 'GUARDED' || resolved?.status === 'NOT_APPLICABLE') return isThai ? 'PEG ไม่เหมาะกับธุรกิจนี้' : 'PEG not applicable';
  return 'PEG N/A';
};

interface Props {
  data?: FivePillarsData;
  isThai: boolean;
  ticker?: string;
}

export function FivePillarsAnalysis({
  data,
  isThai,
  ticker = 'PLTR'
}: Props) {
  const [activePillarTab, setActivePillarTab] = useState<'all' | 'growth' | 'profit' | 'solvency' | 'yield' | 'peer'>('all');

  const metric = (v: number | undefined | null, unit = '', prefix = '') =>
    typeof v === 'number' && Number.isFinite(v) ? `${prefix}${v}${unit}` : 'N/A';

  const growth = data?.growth || {};
  const resolvedGrowth = growth.resolved_metrics;
  const profit = data?.profitability || {};
  const balance = data?.balance_sheet || {};
  const yields = data?.yields || {};
  const peerMatrix: PeerBenchmarkRow[] = data?.peer_matrix || [];

  const isFinancial = data?.archetype
    ? ['bank', 'lender', 'fintech', 'insurer'].includes(data.archetype)
    : Boolean(yields.is_fcf_guarded);
  const isReit = data?.archetype === 'reit';

  // Adaptive titles
  const p1Title = isFinancial
    ? (isThai ? '1. การเติบโต & ขยายฐานธุรกิจ (Growth & Franchise)' : '1. Growth & Franchise Expansion')
    : isReit
      ? (isThai ? '1. การเติบโตของรายได้ค่าเช่า & ทรัพย์สิน (Property & NOI Growth)' : '1. Property & NOI Growth')
      : (isThai ? '1. เครื่องยนต์การเติบโต (Growth Engine)' : '1. Growth Engine');

  const p2Title = isFinancial
    ? (isThai ? '2. คุณภาพกำไร & ผลตอบแทนผู้ถือหุ้น (ROE / ROA)' : '2. Profitability & Equity Returns (ROE / ROA)')
    : isReit
      ? (isThai ? '2. คุณภาพกระแสเงินสด FFO / AFFO' : '2. FFO / AFFO Quality')
      : (isThai ? '2. คุณภาพกำไร & ผลตอบแทนเงินทุน (ROIC / ROE)' : '2. ROIC & Capital Efficiency');

  const p3Title = isFinancial
    ? (isThai ? '3. ความแข็งแกร่งของเงินกองทุน & แหล่งเงินฝาก (Capital & Funding)' : '3. Capital, Funding & Balance Sheet')
    : (isThai ? '3. ความแข็งแกร่งงบดุล (Balance Sheet Fortress)' : '3. Balance Sheet & Solvency');

  const p4Title = isFinancial
    ? (isThai ? '4. มิติมูลค่าหุ้นสถาบันการเงิน (Equity Valuation & Multiples)' : '4. Equity Valuation & Multiples')
    : (isThai ? '4. มิติผลตอบแทนเงินสด (Yield Perspective)' : '4. Yield Perspective');

  const p5Title = isFinancial
    ? (isThai ? '5. ตารางเปรียบเทียบกับคู่แข่งสถาบันการเงิน (Financial Peer Benchmark)' : '5. Financial Peer Benchmark')
    : (isThai ? '5. ตารางเปรียบเทียบเชิงลึกกับค่ากลางกลุ่มคู่แข่ง (Peer Benchmark Matrix)' : '5. Peer Benchmark Matrix');

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-6 w-full">
      {peerMatrix.length === 0 && (
        <p className="text-xs text-amber-800 bg-amber-50/70 px-3 py-2 rounded-xl border border-amber-200/60">
          {isThai
            ? 'ยังไม่พบกลุ่มบริษัทที่เปรียบเทียบได้และมีข้อมูลที่ตรวจสอบแล้วเพียงพอ'
            : 'No sufficiently comparable source-verified peer set is currently available.'}
        </p>
      )}

      {/* 1. Header with Badge & Info */}
      <div className="flex flex-col gap-4 border-b border-stone-100 pb-5">
        <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-[#0b5a4b] flex items-center justify-center border border-emerald-200/80 shadow-2xs shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {isThai ? '5 เสาหลักการประเมินมูลค่า & ปัจจัยพื้นฐาน (5 Fundamental Pillars)' : '5 Core Fundamental & Valuation Pillars'}
              </h3>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                {isThai
                  ? isFinancial
                    ? 'วิเคราะห์เจาะลึก 5 มิติสถาบันการเงิน: การเติบโตของแฟรนไชส์, คุณภาพผลตอบแทน (ROE/ROA/NIM), ฐานเงินทุน, มูลค่าหุ้น และการเปรียบเทียบคู่แข่ง'
                    : 'วิเคราะห์เจาะลึก 5 มิติ: การเติบโต, คุณภาพกำไร (ROIC/ROE), ความแข็งแกร่งของงบดุล, มิติผลตอบแทน (Yields) และการเปรียบเทียบกับคู่แข่ง'
                  : 'Deep-dive across Growth, Profitability (ROIC/ROE), Balance Sheet, Yields & Peer Benchmarks.'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Pillar Filter Tabs - Symmetrical Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200/60 shadow-2xs">
          {[
            { id: 'all', label: isThai ? 'ทั้งหมด (All 5)' : 'All 5', icon: Layers },
            { id: 'growth', label: isThai ? '1. Growth' : '1. Growth', icon: TrendingUp },
            { id: 'profit', label: isFinancial ? (isThai ? '2. ROE & Profit' : '2. ROE') : (isThai ? '2. ROIC & Profit' : '2. ROIC'), icon: Percent },
            { id: 'solvency', label: isFinancial ? (isThai ? '3. Capital' : '3. Capital') : (isThai ? '3. Balance Sheet' : '3. Solvency'), icon: ShieldCheck },
            { id: 'yield', label: isFinancial ? (isThai ? '4. Valuation' : '4. Valuation') : (isThai ? '4. Yields (FCF)' : '4. Yields'), icon: DollarSign },
            { id: 'peer', label: isThai ? '5. Peer Matrix' : '5. Peers', icon: Users },
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActivePillarTab(tab.id as any)}
                className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                  activePillarTab === tab.id
                    ? 'bg-[#0b5a4b] text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Top 4 Pillar Cards - Spacious 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* PILLAR 1: GROWTH */}
        {(activePillarTab === 'all' || activePillarTab === 'growth') && (
          <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200/80 flex flex-col justify-between gap-5 shadow-2xs hover:shadow-xs transition-all">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/80 text-[#0b5a4b] flex items-center justify-center shadow-2xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <span className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Nunito',sans-serif]">
                  {p1Title}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-white text-stone-800 font-mono text-xs sm:text-sm font-bold border border-stone-200 shadow-2xs">
                {isFinancial
                  ? growth.revenue_growth_yoy_pct !== undefined
                    ? `Rev +${growth.revenue_growth_yoy_pct}%`
                    : 'N/A'
                  : pegBadge(resolvedGrowth?.peg, growth.peg_ratio, isThai)}
              </span>
            </div>

            <div className="space-y-2.5 font-mono">
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isThai ? 'รายได้เติบโต YoY (Revenue Growth):' : 'Revenue YoY Growth:'}
                </span>
                <span className="font-bold text-emerald-700 text-base sm:text-lg">{metric(growth.revenue_growth_yoy_pct, '%', '+')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isThai ? 'กำไร EPS เติบโต YoY (EPS Growth):' : 'EPS YoY Growth:'}
                </span>
                <span className="font-bold text-emerald-700 text-right text-sm sm:text-base max-w-[58%]" title={resolvedGrowth?.eps_growth_yoy.reasonTh || resolvedGrowth?.eps_growth_yoy.reason}>
                  {resolvedDisplay(resolvedGrowth?.eps_growth_yoy, growth.eps_growth_yoy_pct, isThai)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isFinancial
                    ? (isThai ? 'FCF Growth (ไม่ใช้กับธนาคาร):' : 'FCF Growth (Guarded):')
                    : (isThai ? 'กระแสเงินสด FCF เติบโต YoY:' : 'FCF YoY Growth:')}
                </span>
                <span className={`text-right max-w-[58%] ${isFinancial || typeof resolvedGrowth?.fcf_growth_yoy.value !== 'number' ? 'text-stone-500 font-sans text-xs sm:text-sm' : 'font-bold text-emerald-700 text-sm sm:text-base'}`} title={resolvedGrowth?.fcf_growth_yoy.reasonTh || resolvedGrowth?.fcf_growth_yoy.reason}>
                  {resolvedDisplay(resolvedGrowth?.fcf_growth_yoy, growth.fcf_growth_yoy_pct, isThai)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-500 font-sans text-xs sm:text-sm">
                  {isThai ? 'การเติบโตเฉลี่ย 3 ปี (3Y Rev CAGR):' : '3Y Revenue CAGR:'}
                </span>
                <span className="font-bold text-stone-800 text-right text-xs sm:text-sm max-w-[58%]" title={resolvedGrowth?.revenue_cagr_3y.reasonTh || resolvedGrowth?.revenue_cagr_3y.reason}>
                  {resolvedDisplay(resolvedGrowth?.revenue_cagr_3y, growth.revenue_cagr_3yr_pct, isThai)}
                </span>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-stone-700 font-sans leading-relaxed bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/70 shadow-2xs flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" />
              <span>{(isThai ? resolvedGrowth?.peg.reasonTh : resolvedGrowth?.peg.reason) || growth.peg_interpretation || 'N/A'}</span>
            </div>
          </div>
        )}

        {/* PILLAR 2: PROFITABILITY & RETURNS */}
        {(activePillarTab === 'all' || activePillarTab === 'profit') && (
          <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200/80 flex flex-col justify-between gap-5 shadow-2xs hover:shadow-xs transition-all">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/80 text-[#0b5a4b] flex items-center justify-center shadow-2xs">
                  <Percent className="w-4 h-4" />
                </div>
                <span className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Nunito',sans-serif]">
                  {p2Title}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-white text-stone-800 font-mono text-xs sm:text-sm font-bold border border-stone-200 shadow-2xs">
                {isFinancial ? `ROE ${metric(profit.roe_pct, '%', '')}` : `ROIC ${metric(profit.roic_pct, '%', '')}`}
              </span>
            </div>

            <div className="space-y-2.5 font-mono">
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isFinancial
                    ? (isThai ? 'ผลตอบแทนต่อส่วนผู้ถือหุ้น (ROE):' : 'Return on Equity (ROE):')
                    : (isThai ? 'ผลตอบแทนจากเงินลงทุน (ROIC):' : 'Return on Invested Capital (ROIC):')}
                </span>
                <span className="font-bold text-stone-900 text-base sm:text-lg">
                  {isFinancial ? metric(profit.roe_pct, '%', '') : metric(profit.roic_pct, '%', '')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isFinancial
                    ? (isThai ? 'ผลตอบแทนจากสินทรัพย์รวม (ROA):' : 'Return on Assets (ROA):')
                    : (isThai ? 'ผลตอบแทนต่อส่วนผู้ถือหุ้น (ROE):' : 'Return on Equity (ROE):')}
                </span>
                <span className="font-bold text-stone-900 text-base sm:text-lg">
                  {isFinancial ? (profit.roa_pct !== undefined ? `${profit.roa_pct}%` : 'N/A') : metric(profit.roe_pct, '%', '')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isFinancial
                    ? (isThai ? 'อัตรากำไรขั้นต้น (Gross Margin):' : 'Gross Margin:')
                    : (isThai ? 'อัตรากำไรขั้นต้น (Gross Margin):' : 'Gross Margin:')}
                </span>
                <span className={`text-base sm:text-lg ${isFinancial ? 'text-stone-400 font-sans text-xs sm:text-sm italic' : 'font-bold text-stone-800'}`}>
                  {isFinancial ? (isThai ? 'ไม่เหมาะกับธุรกิจการเงิน' : 'Not Applicable (No COGS)') : metric(profit.gross_margin_pct, '%', '')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-500 font-sans text-xs sm:text-sm">
                  {isThai ? 'อัตรากำไรสุทธิ (Net Margin):' : 'Net Margin:'}
                </span>
                <span className="font-bold text-stone-800 text-sm sm:text-base">{metric(profit.net_margin_pct, '%', '')}</span>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-stone-700 font-sans leading-relaxed bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/70 shadow-2xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" />
              <span>{profit.capital_efficiency_verdict ?? 'N/A'}</span>
            </div>
          </div>
        )}

        {/* PILLAR 3: BALANCE SHEET */}
        {(activePillarTab === 'all' || activePillarTab === 'solvency') && (
          <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200/80 flex flex-col justify-between gap-5 shadow-2xs hover:shadow-xs transition-all">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/80 text-[#0b5a4b] flex items-center justify-center shadow-2xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Nunito',sans-serif]">
                  {p3Title}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-white text-stone-800 font-mono text-xs sm:text-sm font-bold border border-stone-200 shadow-2xs">
                {isFinancial
                  ? `D/E ${metric(balance.debt_to_equity, 'x', '')}`
                  : balance.is_net_cash === undefined
                    ? 'N/A'
                    : `${balance.is_net_cash ? 'Net Cash +' : 'Net Debt '}${metric(balance.net_cash_or_debt_b, 'B', '$')}`}
              </span>
            </div>

            <div className="space-y-2.5 font-mono">
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isFinancial
                    ? (isThai ? 'เงินสด & สินทรัพย์สภาพคล่องสูง:' : 'Cash & Liquid Assets:')
                    : (isThai ? 'เงินสด & เงินลงทุนระยะสั้น:' : 'Total Cash & ST Investments:')}
                </span>
                <span className="font-bold text-stone-900 text-base sm:text-lg">{metric(balance.total_cash_and_investments_b, 'B', '$')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isFinancial
                    ? (isThai ? 'เงินกู้ยืมและตราสารหนี้ (Borrowings):' : 'Total Borrowings & Debt:')
                    : (isThai ? 'หนี้สินที่มีภาระดอกเบี้ย (Total Debt):' : 'Total Interest-Bearing Debt:')}
                </span>
                <span className="font-bold text-stone-700 text-base sm:text-lg">{metric(balance.total_debt_b, 'B', '$')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isThai ? 'อัตราส่วนหนี้สินต่อทุน (Debt / Equity):' : 'Debt / Equity Ratio:'}
                </span>
                <span className="font-bold text-stone-800 text-base sm:text-lg">{metric(balance.debt_to_equity, 'x', '')}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-500 font-sans text-xs sm:text-sm">
                  {isFinancial
                    ? (isThai ? 'โครงสร้างเงินทุน (Financial Context):' : 'Capital Structure:')
                    : (isThai ? 'ความสามารถจ่ายดอกเบี้ย (Interest Coverage):' : 'Interest Coverage Ratio:')}
                </span>
                <span className={`text-sm sm:text-base ${isFinancial ? 'text-stone-600 font-sans text-xs sm:text-sm' : 'font-bold text-stone-800'}`}>
                  {isFinancial ? (isThai ? 'เงินฝากเป็นวัตถุดิบดำเนินงาน' : 'Deposits as Operating Inventory') : metric(balance.interest_coverage, 'x', '')}
                </span>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-stone-700 font-sans leading-relaxed bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/70 shadow-2xs flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" />
              <span>{balance.solvency_score_label ?? 'N/A'}</span>
            </div>
          </div>
        )}

        {/* PILLAR 4: YIELDS & VALUATION */}
        {(activePillarTab === 'all' || activePillarTab === 'yield') && (
          <div className="bg-stone-50/70 rounded-3xl p-6 sm:p-7 border border-stone-200/80 flex flex-col justify-between gap-5 shadow-2xs hover:shadow-xs transition-all">
            <div className="flex items-center justify-between border-b border-stone-200/70 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white border border-stone-200/80 text-[#0b5a4b] flex items-center justify-center shadow-2xs">
                  <DollarSign className="w-4 h-4" />
                </div>
                <span className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Nunito',sans-serif]">
                  {p4Title}
                </span>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-white text-stone-800 font-mono text-xs sm:text-sm font-bold border border-stone-200 shadow-2xs">
                {isFinancial ? `Earnings Yield ${metric(yields.earnings_yield_pct, '%', '')}` : `FCF Yield ${metric(yields.fcf_yield_pct, '%', '')}`}
              </span>
            </div>

            <div className="space-y-2.5 font-mono">
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isFinancial
                    ? (isThai ? 'FCF Yield (ไม่ใช้กับสถาบันการเงิน):' : 'FCF Yield (Guarded):')
                    : (isThai ? 'ผลตอบแทนกระแสเงินสดอิสระ (FCF Yield):' : 'FCF Yield (FCF / MCap):')}
                </span>
                <span className={`text-base sm:text-lg ${isFinancial ? 'text-amber-800 font-sans text-xs sm:text-sm italic font-medium' : 'font-bold text-stone-900'}`}>
                  {isFinancial ? (isThai ? 'Not used — Financial Sector Guard' : 'Not used — Financial Sector Guard') : metric(yields.fcf_yield_pct, '%', '')}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isThai
                    ? `ผลตอบแทนจากกำไร (Earnings Yield = 1/${yields.earnings_yield_basis || 'PE'}):`
                    : `Earnings Yield (1 / ${yields.earnings_yield_basis || 'PE'}):`}
                </span>
                <span className="font-bold text-stone-800 text-base sm:text-lg">{metric(yields.earnings_yield_pct, '%', '')}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-stone-200/40">
                <span className="text-stone-600 font-sans text-sm sm:text-base">
                  {isThai ? 'ผลตอบแทนพันธบัตรสหรัฐฯ 10 ปี (10Y US Treasury):' : '10Y US Treasury Benchmark:'}
                </span>
                <span className="font-bold text-stone-700 text-base sm:text-lg">{metric(yields.treasury_10yr_yield_pct, '%', '')}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-stone-500 font-sans text-xs sm:text-sm">
                  {isFinancial ? (isThai ? 'P/B Multiple ในตารางเปรียบเทียบ:' : 'P/B Multiple in Peer Matrix:') : 'Price / Free Cash Flow Multiple:'}
                </span>
                <span className="font-bold text-stone-800 text-sm sm:text-base">
                  {isFinancial ? (isThai ? 'ดูตารางเปรียบเทียบข้อ 5' : 'See Peer Matrix (Pillar 5)') : metric(yields.pfcf_multiple, 'x', '')}
                </span>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-stone-700 font-sans leading-relaxed bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200/80 shadow-2xs flex items-start gap-2">
              <BarChart3 className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" />
              <span>{yields.yield_interpretation ?? 'N/A'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. PILLAR 5: PEER BENCHMARK MATRIX TABLE */}
      {(activePillarTab === 'all' || activePillarTab === 'peer') && (
        <div className="flex flex-col gap-3 mt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0b5a4b]" />
              <h4 className="font-bold text-stone-900 text-sm sm:text-base font-['Prompt','Nunito',sans-serif]">
                {p5Title}
              </h4>
            </div>
            <span className="text-xs text-stone-500 font-mono">
              {isThai ? 'ถูกเมื่อเทียบอดีต ≠ ถูกเมื่อเทียบกับคู่แข่ง' : 'Relative valuation context'}
            </span>
          </div>

          {peerMatrix.length === 0 ? (
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs sm:text-sm text-stone-600 leading-relaxed font-sans">
              {isThai
                ? 'ยังไม่พบกลุ่มบริษัทที่เปรียบเทียบได้และมีข้อมูลที่ตรวจสอบแล้วเพียงพอ'
                : 'No sufficiently comparable source-verified peer set is currently available.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 shadow-2xs">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-600 font-bold text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 shadow-xs min-w-[180px]">
                      {isThai ? 'ดัชนีชี้วัด (Metric)' : 'Metric'}
                    </th>
                    <th className="py-3 px-3 text-right font-mono min-w-[110px] bg-emerald-50/60 text-[#0b5a4b]">
                      {ticker} ({isThai ? 'หุ้นเป้าหมาย' : 'Target'})
                    </th>
                    <th className="py-3 px-3 text-right font-mono min-w-[110px]">
                      {isThai ? 'ค่ากลางกลุ่มคู่แข่ง (Peer)' : 'Peer Median'}
                    </th>
                    <th className="py-3 px-3 text-right font-mono min-w-[130px]">
                      {peerMatrix[0]?.direct_peer_ticker ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-stone-400 font-sans font-normal uppercase">
                            {isThai
                              ? (peerMatrix[0].direct_peer_relation === 'DIRECT_PEER' ? 'คู่แข่งตรง' : 'บริษัทเทียบเคียง')
                              : (peerMatrix[0].direct_peer_relation === 'DIRECT_PEER' ? 'Direct Peer' : 'Closest Comparable')}
                          </span>
                          <span
                            tabIndex={0}
                            aria-label={`${peerMatrix[0].direct_peer_ticker} — ${peerMatrix[0].direct_peer_name || ''}`}
                            className="text-xs font-bold text-stone-800 max-w-[220px] whitespace-normal break-words text-right rounded focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                            title={`${peerMatrix[0].direct_peer_ticker} — ${peerMatrix[0].direct_peer_name || ''}`}
                          >
                            {peerMatrix[0].direct_peer_ticker} {peerMatrix[0].direct_peer_name ? `— ${peerMatrix[0].direct_peer_name}` : ''}
                          </span>
                        </div>
                      ) : (
                        isThai ? 'คู่แข่งตรง (Direct Peer)' : 'Direct Peer'
                      )}
                    </th>
                    <th className="py-3 px-4 text-center font-sans min-w-[140px]">
                      {isThai ? 'การประเมินสถานะ' : 'Benchmark Status'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-xs sm:text-sm font-sans">
                  {peerMatrix.map((row, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-medium text-stone-800 sticky left-0 bg-inherit z-10 shadow-xs">
                        <div>{row.metric_name}</div>
                        {row.metric_name_th && isThai && (
                          <div className="text-[11px] text-stone-400 font-normal">{row.metric_name_th}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-950 bg-emerald-50/30">
                        {row.target_value}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-600">
                        {row.sector_median}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-stone-700 font-medium">
                        {row.direct_peer_value}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
                          row.status === 'better'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                            : row.status === 'premium'
                              ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                              : 'bg-stone-100 text-stone-700 border-stone-200'
                        }`}>
                          {row.status === 'better' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {row.status === 'premium' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          <span>{isThai && row.status_label_th ? row.status_label_th : row.status.toUpperCase()}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Summary Footer */}
      <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#0b5a4b] mt-0.5 shrink-0" />
        <p className="text-xs text-stone-700 leading-relaxed font-sans">
          <strong>{isThai ? 'สรุปมุมมองนักวิเคราะห์:' : 'Analyst Synthesis:'} </strong>
          {data?.analyst_takeaway || (isThai ? 'ยังไม่มีบทสรุปที่ตรวจสอบแหล่งข้อมูล' : 'No source-verified summary available')}
        </p>
      </div>
    </div>
  );
}
