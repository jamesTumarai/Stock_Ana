import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass, CheckCircle2, AlertTriangle, Clock, Edit3, Plus,
  Sparkles, Check, ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';
import { ReportData } from '../types';
import { extractMemorySnapshot, ResearchMemorySnapshot } from '../domain/investmentMemory';
import {
  InvestmentThesisRecord,
  TrackedExpectation,
  extractDraftThesisFromReport,
  confirmUserThesis,
  evaluateExpectations,
  classifyInvalidationCondition,
  getActiveValuationAssumptions,
  getApplicableExpectationMetrics
} from '../domain/thesisExpectations';
import {
  loadUserThesis,
  saveUserThesis,
  loadExpectations,
  createAndEvaluateExpectation,
  evaluateAndPersistExpectations
} from '../services/thesisExpectationsService';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  ticker: string;
  currentReport: ReportData;
  isThai: boolean;
  currentUser?: any;
  externalThesis?: InvestmentThesisRecord | null;
  externalExpectations?: TrackedExpectation[];
  historicalSnapshots?: ResearchMemorySnapshot[];
  onThesisChange?: (thesis: InvestmentThesisRecord) => void;
  onExpectationsChange?: (expectations: TrackedExpectation[]) => void;
}

export function ThesisExpectationsCard({
  ticker,
  currentReport,
  isThai,
  currentUser,
  externalThesis,
  externalExpectations,
  historicalSnapshots = [],
  onThesisChange,
  onExpectationsChange
}: Props) {
  const [internalThesis, setInternalThesis] = useState<InvestmentThesisRecord | null>(null);
  const [internalExpectations, setInternalExpectations] = useState<TrackedExpectation[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingExp, setIsAddingExp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const thesis = externalThesis !== undefined ? externalThesis : internalThesis;
  const expectations = externalExpectations !== undefined ? externalExpectations : internalExpectations;

  // Edit fields
  const [editSummary, setEditSummary] = useState('');
  const [editInvalidation, setEditInvalidation] = useState('');

  // New expectation fields
  const [newMetric, setNewMetric] = useState('revenue');
  const [newTarget, setNewTarget] = useState('');
  const [newPeriod, setNewPeriod] = useState('');
  const [newCondition, setNewCondition] = useState<'gte' | 'lte' | 'approx'>('gte');

  const snapshot = useMemo(() => {
    return extractMemorySnapshot(currentReport);
  }, [currentReport]);

  const activeBasis = useMemo(() => {
    return getActiveValuationAssumptions(currentReport, isThai);
  }, [currentReport, isThai]);

  const applicableMetrics = useMemo(() => {
    return getApplicableExpectationMetrics(currentReport, ticker);
  }, [currentReport, ticker]);

  const autoMetrics = useMemo(() => {
    return applicableMetrics.filter(m => m.evaluationMode === 'AUTO');
  }, [applicableMetrics]);

  const manualMetrics = useMemo(() => {
    return applicableMetrics.filter(m => m.evaluationMode === 'MANUAL');
  }, [applicableMetrics]);

  const selectedMetricDef = useMemo(() => {
    return applicableMetrics.find(m => m.id === newMetric) || applicableMetrics[0];
  }, [applicableMetrics, newMetric]);

  useEffect(() => {
    if (applicableMetrics.length > 0 && !applicableMetrics.some(m => m.id === newMetric)) {
      setNewMetric(applicableMetrics[0].id);
    }
  }, [applicableMetrics, newMetric]);

  useEffect(() => {
    if (!isEditing && thesis) {
      setEditSummary(thesis.summary);
      setEditInvalidation(thesis.invalidationConditions.join('\n'));
    }
  }, [thesis, isEditing]);

  // Load existing thesis & expectations on ticker change if not controlled
  useEffect(() => {
    if (externalThesis !== undefined && externalExpectations !== undefined) return;
    let isMounted = true;

    async function loadData() {
      const storedThesis = await loadUserThesis(ticker, currentUser);
      const storedExps = await loadExpectations(ticker, currentUser);

      if (!isMounted) return;

      if (storedThesis) {
        setInternalThesis(storedThesis);
      } else {
        // Create initial draft from current report
        const draft = extractDraftThesisFromReport(currentReport, currentUser?.uid);
        if (draft) {
          setInternalThesis(draft);
        }
      }

      // Re-evaluate expectations against current snapshot & persist terminal outcomes
      if (snapshot && storedExps.length > 0) {
        const { expectations: evaluated, hasPersistedChanges } = await evaluateAndPersistExpectations(
          ticker,
          storedExps,
          snapshot,
          historicalSnapshots,
          currentUser
        );
        setInternalExpectations(evaluated);
        if (hasPersistedChanges) {
          onExpectationsChange?.(evaluated);
        }
      } else {
        setInternalExpectations(storedExps);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [ticker, currentUser, currentReport, snapshot, externalThesis, externalExpectations, historicalSnapshots]);

  // Confirm thesis handler
  const handleConfirmThesis = async () => {
    if (!thesis) return;
    const updated = confirmUserThesis(thesis, undefined, currentUser?.uid, snapshot?.reportId);
    setInternalThesis(updated);
    onThesisChange?.(updated);
    await saveUserThesis(updated, currentUser);
  };

  // Save thesis edits
  const handleSaveEdits = async () => {
    if (!thesis) return;
    const invalConditions = editInvalidation
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const updated = confirmUserThesis(
      thesis,
      {
        summary: editSummary,
        invalidationConditions: invalConditions
      },
      currentUser?.uid,
      snapshot?.reportId
    );
    setInternalThesis(updated);
    setIsEditing(false);
    onThesisChange?.(updated);
    await saveUserThesis(updated, currentUser);
  };

  // Add new expectation handler
  const handleAddExpectation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget || !newPeriod) return;

    const targetNum = parseFloat(newTarget);
    if (isNaN(targetNum)) return;

    const metricDef = applicableMetrics.find(m => m.id === newMetric) || applicableMetrics[0];
    const metricLabel = isThai ? metricDef.labelTh : metricDef.labelEn;
    const cleanPeriod = newPeriod.trim().toUpperCase();

    // Prevent duplicate identical active expectation
    const isDuplicate = expectations.some(
      exp => exp.metricOrEvent === newMetric &&
             exp.targetPeriod.trim().toUpperCase() === cleanPeriod &&
             exp.condition === newCondition &&
             Number(exp.targetValue) === targetNum &&
             (exp.status === 'PENDING' || exp.status === 'MET')
    );
    if (isDuplicate) {
      setIsAddingExp(false);
      return;
    }

    const newExp: TrackedExpectation = {
      expectationId: `exp_${Date.now()}`,
      ticker: ticker.toUpperCase().trim(),
      metricOrEvent: newMetric,
      metricLabel: `${metricLabel} (${metricDef.unit})`,
      targetValue: targetNum,
      condition: newCondition,
      targetPeriod: cleanPeriod,
      status: 'PENDING',
      origin: 'USER_EXPECTATION',
      evaluationMode: metricDef.evaluationMode,
      unit: metricDef.unit,
      sourceReportId: snapshot?.reportId || null,
      actualValue: null,
      evaluationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUser?.uid
    };

    const updatedList = await createAndEvaluateExpectation(
      ticker, expectations, newExp, snapshot, historicalSnapshots, currentUser
    );

    setInternalExpectations(updatedList);
    setNewTarget('');
    setNewPeriod('');
    setIsAddingExp(false);
    onExpectationsChange?.(updatedList);
  };

  if (!thesis) return null;

  const isConfirmed = thesis.confirmationStatus === 'USER_CONFIRMED' || thesis.confirmationStatus === 'USER_EDITED';

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#0b5a4b] flex items-center justify-center shadow-2xs shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-stone-900 font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {isThai ? 'สมมติฐานการลงทุน & ความคาดหวังที่ติดตาม (Investment Thesis & Tracked Expectations)' : 'Investment Thesis & Tracked Expectations'}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isConfirmed
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                {isConfirmed ? (isThai ? 'ยืนยันโดยผู้ใช้' : 'User Confirmed') : (isThai ? 'ร่างโดย AI' : 'AI Draft')}
              </span>
              <span className="text-xs text-stone-400 font-mono">v{thesis.version}</span>
            </div>
            <p className="text-xs text-stone-500 font-sans">
              {isThai
                ? 'บันทึกสมมติฐานที่คงทนและติดตามผลประกอบการเปรียบเทียบกับความคาดหวังจริง'
                : 'Durable personal thesis tracking and deterministic expectation verification across research cycles'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {!isConfirmed && !isEditing && (
            <button
              onClick={handleConfirmThesis}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0b5a4b] hover:bg-[#09473b] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isThai ? 'ยืนยันสมมติฐาน' : 'Confirm Thesis'}</span>
            </button>
          )}

          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isThai ? 'แก้ไข' : 'Edit'}</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-4">
          {/* Edit Form */}
          {isEditing ? (
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isThai ? 'ใจความหลักของสมมติฐานการลงทุน' : 'Investment Thesis Summary'}
                </label>
                <textarea
                  value={editSummary}
                  onChange={e => setEditSummary(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0b5a4b] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isThai ? 'เงื่อนไขการหักล้างสมมติฐาน (แยกบรรทัดละ 1 ข้อ)' : 'Invalidation Conditions (One per line)'}
                </label>
                <textarea
                  value={editInvalidation}
                  onChange={e => setEditInvalidation(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0b5a4b] focus:outline-hidden"
                  placeholder="e.g. Operating margin drops below 35.0%"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-xl bg-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-300 transition-colors"
                >
                  {isThai ? 'ยกเลิก' : 'Cancel'}
                </button>
                <button
                  onClick={handleSaveEdits}
                  className="px-3 py-1.5 rounded-xl bg-[#0b5a4b] text-white text-xs font-semibold hover:bg-[#09473b] transition-colors"
                >
                  {isThai ? 'บันทึกการแก้ไข' : 'Save Changes'}
                </button>
              </div>
            </div>
          ) : (
            /* Thesis Summary Display */
            <div className="bg-stone-50/70 p-4 rounded-2xl border border-stone-100 flex flex-col gap-3">
              <p className="text-xs sm:text-sm text-stone-800 font-serif leading-relaxed italic">
                "{thesis.summary}"
              </p>

              {/* Assumptions & Invalidation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-stone-200/60">
                <div>
                  <span className="text-[10px] font-bold uppercase text-stone-500 tracking-wider block mb-1">
                    {isThai ? 'ฐานและสมมติฐานการประเมินมูลค่า' : 'Valuation Basis & Assumptions'}
                  </span>
                  {activeBasis.isGuarded ? (
                    <div className="flex flex-col gap-1.5 text-xs">
                      <div className="font-semibold text-stone-800">
                        {isThai ? activeBasis.methodTitleTh : activeBasis.methodTitleEn}
                      </div>
                      {activeBasis.guardStatusTh && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50/90 text-amber-800 border border-amber-200/80 text-[11px] leading-snug">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{isThai ? activeBasis.guardStatusTh : activeBasis.guardStatusEn}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 text-xs">
                      <div className="font-semibold text-stone-800 mb-0.5">
                        {isThai ? activeBasis.methodTitleTh : activeBasis.methodTitleEn}
                      </div>
                      {activeBasis.assumptions.length > 0 ? (
                        <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                          {activeBasis.assumptions.map((a, idx) => (
                            <li key={idx}>
                              <span className="font-medium text-stone-700">{isThai ? a.labelTh : a.labelEn}:</span>{' '}
                              <span className="font-mono text-stone-900 font-semibold">{a.valueText}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-stone-400 italic text-[11px]">
                          {isThai ? 'ไม่มีสมมติฐานที่ต้องระบุเพิ่มเติม' : 'No explicit assumptions required.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {thesis.invalidationConditions.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-rose-600 tracking-wider block mb-1">
                      {isThai ? 'เงื่อนไขที่อาจหักล้างสมมติฐาน (Invalidation Triggers)' : 'Invalidation Triggers'}
                    </span>
                    <ul className="list-disc list-inside text-xs text-stone-700 space-y-1">
                      {thesis.invalidationConditions.map((cond, idx) => {
                        const classified = classifyInvalidationCondition(cond);
                        return (
                          <li key={idx} className="text-stone-800 flex items-center justify-between gap-2 py-0.5">
                            <span>{cond}</span>
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded shrink-0 font-semibold uppercase ${
                              classified.type === 'DETERMINISTIC_TRIGGER'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {classified.type === 'DETERMINISTIC_TRIGGER'
                                ? (isThai ? 'ติดตามอัตโนมัติ' : 'Auto-Monitored')
                                : (isThai ? 'ต้องตรวจสอบเอง' : 'Manual Review Needed')}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tracked Expectations Section */}
          <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#0b5a4b]" />
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  {isThai ? 'การติดตามผลประกอบการเทียบกับความคาดหวัง' : 'Tracked Expectations vs Actuals'}
                </h4>
              </div>

              <button
                onClick={() => setIsAddingExp(!isAddingExp)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b5a4b] hover:text-[#084237] transition-colors cursor-pointer print:hidden"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isThai ? 'เพิ่มเป้าหมาย' : 'Add Expectation'}</span>
              </button>
            </div>

            {/* Add Expectation Form */}
            {isAddingExp && (
              <form onSubmit={handleAddExpectation} className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 flex flex-wrap gap-2.5 items-end text-xs print:hidden">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-bold text-stone-600 mb-1">
                    {isThai ? 'ตัวชี้วัด (ตามประเภทธุรกิจ)' : 'Metric (Business-Aware)'}
                  </label>
                  <select
                    value={newMetric}
                    onChange={e => setNewMetric(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs"
                  >
                    {autoMetrics.length > 0 && (
                      <optgroup label={isThai ? 'ประเมินผลอัตโนมัติ (Auto-evaluable)' : 'Auto-evaluable'}>
                        {autoMetrics.map(m => (
                          <option key={m.id} value={m.id}>
                            {isThai ? m.labelTh : m.labelEn} ({m.unit})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {manualMetrics.length > 0 && (
                      <optgroup label={isThai ? 'ต้องตรวจสอบเอง (Manual Review)' : 'Manual Review'}>
                        {manualMetrics.map(m => (
                          <option key={m.id} value={m.id}>
                            {isThai ? m.labelTh : m.labelEn} ({m.unit})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="w-24">
                  <label className="block text-[10px] font-bold text-stone-600 mb-1">
                    {isThai ? 'เงื่อนไข' : 'Condition'}
                  </label>
                  <select
                    value={newCondition}
                    onChange={e => setNewCondition(e.target.value as any)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs font-mono"
                  >
                    <option value="gte">&gt;=</option>
                    <option value="lte">&lt;=</option>
                    <option value="approx">~ (±5%)</option>
                  </select>
                </div>

                <div className="w-28">
                  <label className="block text-[10px] font-bold text-stone-600 mb-1 flex items-center justify-between">
                    <span>{isThai ? 'เป้าหมาย' : 'Target'}</span>
                    <span className="text-stone-400 font-mono text-[9px]">{selectedMetricDef?.unit || ''}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={newTarget}
                      onChange={e => setNewTarget(e.target.value)}
                      placeholder={selectedMetricDef?.unit === '%' ? 'e.g. 25.5' : 'e.g. 60000'}
                      className="w-full p-2 pr-7 bg-white border border-stone-300 rounded-lg text-xs font-mono"
                    />
                    {selectedMetricDef?.unit && (
                      <span className="absolute right-2 top-2 text-[10px] text-stone-400 pointer-events-none font-mono">
                        {selectedMetricDef.unit}
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-28">
                  <label className="block text-[10px] font-bold text-stone-600 mb-1">
                    {isThai ? 'งวดเป้าหมาย' : 'Target Period'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newPeriod}
                    onChange={e => setNewPeriod(e.target.value)}
                    placeholder="e.g. Q4 2026"
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs uppercase font-mono"
                  />
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="submit"
                    className="px-3 py-2 bg-[#0b5a4b] text-white text-xs font-semibold rounded-lg hover:bg-[#09473b] transition-colors"
                  >
                    {isThai ? 'บันทึก' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingExp(false)}
                    className="px-2.5 py-2 bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg hover:bg-stone-300 transition-colors"
                  >
                    {isThai ? 'ยกเลิก' : 'Cancel'}
                  </button>
                </div>
              </form>
            )}

            {/* Expectations Table */}
            {expectations.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-1">
                {isThai ? 'ยังไม่มีการตั้งความคาดหวังสำหรับหุ้นนี้' : 'No expectations tracked yet for this company.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-stone-200">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 border-b border-stone-200 text-[10px] font-bold uppercase text-stone-500 tracking-wider">
                    <tr>
                      <th className="py-2 px-3">{isThai ? 'ตัวชี้วัด' : 'Metric'}</th>
                      <th className="py-2 px-3">{isThai ? 'เป้าหมาย' : 'Target'}</th>
                      <th className="py-2 px-3">{isThai ? 'งวดที่คาด' : 'Period'}</th>
                      <th className="py-2 px-3">{isThai ? 'ผลลัพธ์จริง' : 'Actual'}</th>
                      <th className="py-2 px-3 text-right">{isThai ? 'สถานะ' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {expectations.map(exp => {
                      let statusBadge = (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                          {exp.status}
                        </span>
                      );

                      if (exp.status === 'MET' || exp.status === 'EXCEEDED') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
                            {exp.status}
                          </span>
                        );
                      } else if (exp.status === 'MISSED') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-rose-50 text-rose-700 border-rose-200">
                            {exp.status}
                          </span>
                        );
                      } else if (exp.status === 'UNAVAILABLE') {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-stone-100 text-stone-600 border-stone-300">
                            {exp.status}
                          </span>
                        );
                      }

                      return (
                        <tr key={exp.expectationId} className="hover:bg-stone-50/50">
                          <td className="py-2 px-3">
                            <div className="font-medium text-stone-900 flex items-center gap-1.5 flex-wrap">
                              <span>{exp.metricLabel}</span>
                              {exp.evaluationMode === 'MANUAL' && (
                                <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[9px] font-semibold">
                                  {isThai ? 'ตรวจสอบเอง' : 'Manual'}
                                </span>
                              )}
                            </div>
                            {exp.evaluationNotes && <div className="text-[10px] text-stone-400 mt-0.5 font-normal">{exp.evaluationNotes}</div>}
                          </td>
                          <td className="py-2 px-3 font-mono">{exp.condition} {exp.targetValue} {exp.unit && !exp.metricLabel.includes(`(${exp.unit})`) ? exp.unit : ''}</td>
                          <td className="py-2 px-3 font-mono uppercase">{exp.targetPeriod}</td>
                          <td className="py-2 px-3 font-mono">{exp.actualValue !== null && exp.actualValue !== undefined ? `${exp.actualValue} ${exp.unit || ''}` : '—'}</td>
                          <td className="py-2 px-3 text-right">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
