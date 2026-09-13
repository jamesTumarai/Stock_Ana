import React, { useMemo, useState, useEffect } from 'react';
import {
  Clock, TrendingUp, TrendingDown, ArrowRight, History,
  ChevronDown, ChevronUp, Scale, Sparkles, ShieldCheck, Layers,
  AlertCircle, AlertTriangle, CheckCircle2, Compass, Check
} from 'lucide-react';
import { ReportData } from '../types';
import {
  buildResearchTimeline,
  computeHistoricalDelta,
  extractReportDate,
  getPreviousReport
} from '../utils/researchTimeline';
import { extractMemorySnapshot } from '../domain/investmentMemory';
import { computeWhatChanged } from '../domain/whatChangedEngine';
import { buildDecisionContext } from '../domain/decisionContextEngine';
import {
  InvestmentThesisRecord,
  TrackedExpectation,
  evaluateExpectations,
  resolveActiveThesisForReport
} from '../domain/thesisExpectations';
import {
  loadUserThesis,
  loadExpectations,
  loadThesisRevisions
} from '../services/thesisExpectationsService';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  ticker: string;
  currentReport: ReportData;
  historyReports?: any[];
  isThai: boolean;
  currentUser?: any;
  externalThesis?: InvestmentThesisRecord | null;
  externalExpectations?: TrackedExpectation[];
}

export function ResearchTimelineCard({
  ticker,
  currentReport,
  historyReports = [],
  isThai,
  currentUser,
  externalThesis,
  externalExpectations
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalThesis, setInternalThesis] = useState<InvestmentThesisRecord | null>(null);
  const [internalExpectations, setInternalExpectations] = useState<TrackedExpectation[]>([]);
  const [thesisRevisions, setThesisRevisions] = useState<InvestmentThesisRecord[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadContext() {
      const t = await loadUserThesis(ticker, currentUser);
      const e = await loadExpectations(ticker, currentUser);
      const revs = await loadThesisRevisions(ticker, currentUser);
      if (isMounted) {
        if (externalThesis === undefined) setInternalThesis(t);
        if (externalExpectations === undefined) setInternalExpectations(e);
        setThesisRevisions(revs);
      }
    }
    loadContext();
    return () => {
      isMounted = false;
    };
  }, [ticker, currentUser, externalThesis, externalExpectations]);

  const timeline = useMemo(() => {
    return buildResearchTimeline(ticker, historyReports, currentReport);
  }, [ticker, historyReports, currentReport]);

  const previousReport = useMemo(() => {
    return getPreviousReport(ticker, historyReports, currentReport);
  }, [ticker, historyReports, currentReport]);

  const delta = useMemo(() => {
    if (!previousReport) return null;
    return computeHistoricalDelta(currentReport, previousReport);
  }, [currentReport, previousReport]);

  const currentSnapshot = useMemo(() => {
    return extractMemorySnapshot(currentReport);
  }, [currentReport]);

  const previousSnapshot = useMemo(() => {
    return previousReport ? extractMemorySnapshot(previousReport) : null;
  }, [previousReport]);

  const historicalSnapshots = useMemo(() => {
    return (historyReports || [])
      .map(r => extractMemorySnapshot(r))
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [historyReports]);

  const expectations = useMemo(() => {
    const raw = externalExpectations !== undefined ? externalExpectations : internalExpectations;
    if (!currentSnapshot || raw.length === 0) return raw;
    return evaluateExpectations(raw, currentSnapshot, historicalSnapshots);
  }, [externalExpectations, internalExpectations, currentSnapshot, historicalSnapshots]);

  const currentThesis = useMemo(() => {
    if (externalThesis !== undefined) return externalThesis;
    return resolveActiveThesisForReport(currentReport, thesisRevisions, internalThesis);
  }, [currentReport, thesisRevisions, internalThesis, externalThesis]);

  const previousThesis = useMemo(() => {
    if (!previousReport) return null;
    return resolveActiveThesisForReport(previousReport, thesisRevisions, null);
  }, [previousReport, thesisRevisions]);

  const whatChanged = useMemo(() => {
    if (!currentSnapshot || !previousSnapshot) return null;
    return computeWhatChanged(currentSnapshot, previousSnapshot, expectations);
  }, [currentSnapshot, previousSnapshot, expectations]);

  const decisionContext = useMemo(() => {
    if (!currentSnapshot || !previousSnapshot) return null;
    return buildDecisionContext(
      currentSnapshot,
      previousSnapshot,
      currentThesis,
      whatChanged,
      expectations,
      previousThesis
    );
  }, [currentSnapshot, previousSnapshot, currentThesis, whatChanged, expectations, previousThesis]);

  // If there is only 1 report and no previous history, show an initial baseline badge
  if (timeline.length <= 1 && !delta) {
    return null;
  }

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-stone-100 text-[#0b5a4b] flex items-center justify-center shadow-2xs shrink-0">
            <History className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {isThai ? 'ไทม์ไลน์งานวิจัย & สิ่งที่เปลี่ยนแปลง (Research Timeline & What Changed)' : 'Research Timeline & Historical Deltas'}
              </h3>
              <ProvenanceBadge classification="calculated" isThai={isThai} size="xs" />
            </div>
            <p className="text-xs text-stone-500 font-sans">
              {isThai
                ? `เปรียบเทียบข้อเท็จจริงกับบทวิเคราะห์ก่อนหน้า (${timeline.length > 1 ? timeline.length - 1 : 0} บันทึกประวัติศาสตร์)`
                : `Empirical comparison across ${timeline.length} documented analysis snapshots`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>{isExpanded ? (isThai ? 'ย่อ' : 'Collapse') : (isThai ? 'ดูไทม์ไลน์' : 'Expand Timeline')}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* DECISION CONTEXT STANCE BANNER */}
      {decisionContext && (
        <div className={`p-4 rounded-2xl border flex flex-col gap-2.5 ${
          decisionContext.stance === 'THESIS_CONDITION_TRIGGERED'
            ? 'bg-rose-50/80 border-rose-200 text-rose-950'
            : decisionContext.stance === 'RE_EVALUATION_WARRANTED'
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : decisionContext.stance === 'MONITORING_CONTINUES_UNCHANGED'
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-stone-50 border-stone-200 text-stone-900'
        }`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {decisionContext.stance === 'THESIS_CONDITION_TRIGGERED' ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : decisionContext.stance === 'RE_EVALUATION_WARRANTED' ? (
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : decisionContext.stance === 'MONITORING_CONTINUES_UNCHANGED' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 text-stone-500 shrink-0" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                {isThai ? 'บริบทการตัดสินใจ (Decision Context)' : 'Decision Context'}
              </span>
            </div>

            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
              decisionContext.stance === 'THESIS_CONDITION_TRIGGERED'
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : decisionContext.stance === 'RE_EVALUATION_WARRANTED'
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : decisionContext.stance === 'MONITORING_CONTINUES_UNCHANGED'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-stone-200 text-stone-700 border-stone-300'
            }`}>
              {decisionContext.stance.replace(/_/g, ' ')}
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-stone-900 font-['Prompt','Nunito',sans-serif]">
              {isThai ? decisionContext.headlineTh : decisionContext.headline}
            </h4>
            <p className="text-xs text-stone-700 mt-1 leading-relaxed">
              {isThai ? decisionContext.summaryNarrativeTh : decisionContext.summaryNarrative}
            </p>
          </div>

          {/* Key Reasons / Triggers */}
          {decisionContext.reasons.length > 0 && (
            <div className="pt-2 border-t border-stone-200/60 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 font-mono">
                {isThai ? 'เหตุผลและปัจจัยสำคัญที่ระบุได้:' : 'Identified Contributing Reasons:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {decisionContext.reasons.map((r) => (
                  <div key={r.id} className="p-2 bg-white/90 rounded-xl border border-stone-200/80 text-xs flex flex-col">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-stone-900">{isThai ? r.titleTh : r.title}</span>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                        r.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                        r.severity === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                        'bg-stone-100 text-stone-600'
                      }`}>
                        {r.severity}
                      </span>
                    </div>
                    <span className="text-[11px] text-stone-600">{isThai ? r.detailTh : r.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invalidation Triggers Alert */}
          {decisionContext.invalidationTriggersFound.length > 0 && (
            <div className="p-2.5 rounded-xl bg-rose-100/70 border border-rose-200 text-xs text-rose-900 flex flex-col gap-1">
              <span className="font-bold flex items-center gap-1 text-rose-800">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                {isThai ? 'เงื่อนไขหักล้างสมมติฐานที่ตรวจพบ:' : 'Invalidation Triggers Detected:'}
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                {decisionContext.invalidationTriggersFound.map((trig, idx) => (
                  <li key={idx}>{trig}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* WHAT CHANGED INTELLIGENCE */}
      {whatChanged && (
        <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-200/80 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#0b5a4b]" />
              <span className="text-xs font-bold text-stone-900 uppercase font-mono tracking-wider">
                {isThai ? 'การเปลี่ยนแปลงที่ตรวจพบ (What Changed Intelligence)' : 'What Changed Intelligence'}
              </span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              whatChanged.hasMaterialChanges
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {whatChanged.hasMaterialChanges
                ? (isThai ? `พบ ${whatChanged.materialChangesCount} การเปลี่ยนแปลงสำคัญ` : `${whatChanged.materialChangesCount} Material Changes`)
                : (isThai ? 'ไม่มีการเปลี่ยนแปลงสำคัญ' : 'No Material Changes')}
            </span>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed font-sans">
            {isThai ? whatChanged.summaryNarrativeTh : whatChanged.summaryNarrative}
          </p>

          {/* Material Changes List */}
          {whatChanged.hasMaterialChanges && whatChanged.items.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {whatChanged.items.map(ch => (
                <div key={ch.id} className="p-2.5 bg-white rounded-xl border border-stone-200/80 text-xs flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-stone-900">{isThai ? ch.metricLabelTh : ch.metricLabel}</span>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                      ch.materiality === 'HIGH' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                      ch.materiality === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-stone-100 text-stone-600'
                    }`}>
                      {ch.materiality}
                    </span>
                  </div>
                  <div className="font-mono text-stone-700 text-[11px] mb-1">
                    {ch.previousValue ?? '—'} → <strong>{ch.currentValue ?? '—'}</strong>
                    <span className="ml-1.5 font-bold text-stone-900">
                      ({ch.deltaDisplay})
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500">{isThai ? ch.explanationTh : ch.explanation}</span>
                </div>
              ))}
            </div>
          )}

          {/* Valuation Change Attribution */}
          {whatChanged.valuationAttribution && (
            <div className="p-3 bg-white rounded-xl border border-stone-200 flex flex-col gap-1.5 mt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-900 font-mono">
                  {isThai ? 'การแจกแจงสาเหตุมูลค่า DCF ที่เปลี่ยนไป (Valuation Attribution)' : 'Valuation Change Attribution'}
                </span>
                <span className="font-mono font-bold text-[#0b5a4b] text-[11px]">
                  {whatChanged.valuationAttribution.primaryDriver}
                </span>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                {isThai ? whatChanged.valuationAttribution.impactDescriptionTh : whatChanged.valuationAttribution.impactDescription}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Primary What Changed Empirical Delta Box */}
      {delta && (
        <div className="bg-stone-50/90 rounded-2xl p-4 border border-stone-200/90 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>
              {isThai ? 'ช่วงห่างจากบทวิเคราะห์ก่อนหน้า:' : 'Elapsed Since Prior Report:'} <strong>{delta.daysBetween} {isThai ? 'วัน' : 'days'}</strong> ({delta.previousReportDate} → {delta.currentReportDate})
            </span>
            <span className="text-[10px] uppercase font-bold text-stone-400">
              {isThai ? 'ตัวเลขจริง ไม่ใช่คำบรรยายแต่งเติม' : 'Empirical Deltas Only'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Market Price Change */}
            {delta.priceDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'ราคาตลาด' : 'Market Price'}
                </span>
                <span className="text-sm font-mono font-bold text-stone-900 mt-0.5">
                  ${delta.priceDelta.previous.toFixed(2)} → ${delta.priceDelta.current.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.priceDelta.deltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.priceDelta.deltaPct >= 0 ? '+' : ''}{delta.priceDelta.deltaPct.toFixed(2)}%
                </span>
              </div>
            )}

            {/* Base Fair Value Change */}
            {delta.fairValueDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'มูลค่าแท้จริง DCF' : 'Base Fair Value'}
                </span>
                <span className="text-sm font-mono font-bold text-[#0b5a4b] mt-0.5">
                  ${delta.fairValueDelta.previous.toFixed(2)} → ${delta.fairValueDelta.current.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.fairValueDelta.deltaPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.fairValueDelta.deltaPct >= 0 ? '+' : ''}{delta.fairValueDelta.deltaPct.toFixed(2)}%
                </span>
              </div>
            )}

            {/* Conviction Score Delta */}
            {delta.convictionScoreDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'คะแนน Conviction' : 'Conviction Score'}
                </span>
                <span className="text-sm font-mono font-bold text-stone-900 mt-0.5">
                  {delta.convictionScoreDelta.previous} → {delta.convictionScoreDelta.current}
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.convictionScoreDelta.deltaPoints >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.convictionScoreDelta.deltaPoints >= 0 ? '+' : ''}{delta.convictionScoreDelta.deltaPoints} pts
                </span>
              </div>
            )}

            {/* Operating Margin Delta */}
            {delta.operatingMarginDelta && (
              <div className="p-3 bg-white rounded-xl border border-stone-200/80 flex flex-col">
                <span className="text-[10px] font-mono uppercase font-bold text-stone-400">
                  {isThai ? 'Operating Margin' : 'Operating Margin'}
                </span>
                <span className="text-sm font-mono font-bold text-stone-900 mt-0.5">
                  {delta.operatingMarginDelta.previous}% → {delta.operatingMarginDelta.current}%
                </span>
                <span className={`text-[10px] font-mono font-bold mt-0.5 ${delta.operatingMarginDelta.deltaPctPoints >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {delta.operatingMarginDelta.deltaPctPoints >= 0 ? '+' : ''}{delta.operatingMarginDelta.deltaPctPoints.toFixed(2)}% pts
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Chronological Timeline Steps */}
      {isExpanded && (
        <div className="flex flex-col gap-3 pt-2">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider font-mono">
            {isThai ? 'ประวัติรายงานตามลำดับเวลา' : 'Chronological Analysis History'}
          </span>
          <div className="relative pl-6 border-l-2 border-stone-200 space-y-4 my-2">
            {timeline.map((entry, idx) => {
              const isCurrent = idx === 0;
              return (
                <div key={entry.id || idx} className="relative group">
                  {/* Timeline dot */}
                  <div className={`absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white ${
                    isCurrent ? 'border-[#0b5a4b] ring-4 ring-emerald-100' : 'border-stone-400'
                  }`} />

                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-stone-900">{entry.reportDate}</span>
                        {isCurrent && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-[#0b5a4b] uppercase font-mono">
                            {isThai ? 'ปัจจุบัน' : 'Current'}
                          </span>
                        )}
                        <span className="text-[10px] text-stone-500 font-sans">
                          {entry.analysisType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono text-stone-700 mt-1">
                        {entry.marketPrice && (
                          <span>{isThai ? 'ราคา:' : 'Price:'} <strong>${entry.marketPrice.toFixed(2)}</strong></span>
                        )}
                        {entry.fairValue && (
                          <span>{isThai ? 'มูลค่าแท้จริง:' : 'Fair Value:'} <strong className="text-[#0b5a4b]">${entry.fairValue.toFixed(2)}</strong></span>
                        )}
                        {entry.marginOfSafetyPct !== null && entry.marginOfSafetyPct !== undefined && (
                          <span className={entry.marginOfSafetyPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            MoS: {entry.marginOfSafetyPct > 0 ? '+' : ''}{entry.marginOfSafetyPct.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {typeof entry.convictionScore === 'number' && (
                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-mono">
                        <span className="text-[10px] text-stone-400 uppercase font-bold">Conviction:</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-stone-900 text-amber-300">
                          {entry.convictionScore}/100
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
