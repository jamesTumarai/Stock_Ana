import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  getApplicableExpectationMetrics,
  isValidTargetPeriod,
  snapshotToValuationBasis,
  reconstructValuationBasisFromLegacyThesis,
  createValuationSnapshot
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

const CONDITION_OPTIONS: { id: 'gte' | 'lte' | 'approx'; symbol: string; labelTh: string; labelEn: string }[] = [
  { id: 'gte', symbol: '≥', labelTh: '≥ (มากกว่าหรือเท่ากับ)', labelEn: '≥ (At least)' },
  { id: 'lte', symbol: '≤', labelTh: '≤ (น้อยกว่าหรือเท่ากับ)', labelEn: '≤ (At most)' },
  { id: 'approx', symbol: '~', labelTh: '~ (±5% ใกล้เคียง)', labelEn: '~ (±5% Approx)' },
];

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

  // Custom Dropdown Open States
  const [isMetricOpen, setIsMetricOpen] = useState(false);
  const [isConditionOpen, setIsConditionOpen] = useState(false);
  const [isBodyAnimating, setIsBodyAnimating] = useState(false);

  const metricDropdownRef = useRef<HTMLDivElement>(null);
  const conditionDropdownRef = useRef<HTMLDivElement>(null);

  const thesis = externalThesis !== undefined ? externalThesis : internalThesis;
  const expectations = externalExpectations !== undefined ? externalExpectations : internalExpectations;
  const isConfirmed = Boolean(thesis && (thesis.confirmationStatus === 'USER_CONFIRMED' || thesis.confirmationStatus === 'USER_EDITED'));

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

  const displayedBasis = useMemo(() => {
    if (isConfirmed && thesis) {
      if (thesis.frozenValuationBasis) {
        return thesis.frozenValuationBasis;
      }
      if (thesis.valuationSnapshot) {
        return snapshotToValuationBasis(thesis.valuationSnapshot, isThai);
      }
      const reconstructed = reconstructValuationBasisFromLegacyThesis(thesis, isThai);
      if (reconstructed) {
        return reconstructed;
      }
    }
    return activeBasis;
  }, [isConfirmed, thesis, isThai, activeBasis]);

  const hasCurrentReportBasisDiff = useMemo(() => {
    if (!isConfirmed) return false;
    const frozen = displayedBasis;
    if (frozen.methodTitleEn !== activeBasis.methodTitleEn) return true;
    if (frozen.isGuarded !== activeBasis.isGuarded) return true;
    if (frozen.assumptions.length !== activeBasis.assumptions.length) return true;
    for (let i = 0; i < frozen.assumptions.length; i++) {
      const fa = frozen.assumptions[i];
      const aa = activeBasis.assumptions.find(a => a.labelEn === fa.labelEn);
      if (!aa || aa.valueText !== fa.valueText) return true;
    }
    return false;
  }, [isConfirmed, displayedBasis, activeBasis]);

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

  // Click outside and escape key handling for custom animated dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (metricDropdownRef.current && !metricDropdownRef.current.contains(event.target as Node)) {
        setIsMetricOpen(false);
      }
      if (conditionDropdownRef.current && !conditionDropdownRef.current.contains(event.target as Node)) {
        setIsConditionOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMetricOpen(false);
        setIsConditionOpen(false);
      }
    }

    document.addEventListener('pointerdown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    const snap = createValuationSnapshot(currentReport, snapshot?.reportId, isThai);
    const updated = confirmUserThesis(thesis, undefined, currentUser?.uid, snapshot?.reportId, activeBasis, snap);
    setInternalThesis(updated);
    onThesisChange?.(updated);
    await saveUserThesis(updated, currentUser);
  };

  // Save thesis edits (creates vN+1 while preserving existing frozen valuation assumptions and snapshot)
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

  // Accept current report's updated valuation basis (creates vN+1 with new valuation assumptions frozen)
  const handleAcceptUpdatedValuationBasis = async () => {
    if (!thesis) return;
    const newSnapshot = createValuationSnapshot(currentReport, snapshot?.reportId, isThai);
    const updated = confirmUserThesis(
      thesis,
      {
        frozenValuationBasis: activeBasis,
        valuationSnapshot: newSnapshot
      },
      currentUser?.uid,
      snapshot?.reportId,
      activeBasis,
      newSnapshot
    );
    setInternalThesis(updated);
    onThesisChange?.(updated);
    await saveUserThesis(updated, currentUser);
  };

  // Add new expectation handler
  const handleAddExpectation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget || !newPeriod) return;

    const cleanPeriod = newPeriod.trim().toUpperCase();
    if (!isValidTargetPeriod(cleanPeriod)) return;

    const targetNum = parseFloat(newTarget);
    if (isNaN(targetNum)) return;

    const metricDef = applicableMetrics.find(m => m.id === newMetric) || applicableMetrics[0];
    const metricLabel = isThai ? metricDef.labelTh : metricDef.labelEn;

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
      setIsMetricOpen(false);
      setIsConditionOpen(false);
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
    setIsMetricOpen(false);
    setIsConditionOpen(false);
    onExpectationsChange?.(updatedList);
  };

  if (!thesis) return null;

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
              <span className="text-xs text-stone-400 font-mono" title={isThai ? `ข้อมูล ณ เวลายืนยัน v${thesis.version}` : `Snapshot at confirmation (v${thesis.version})`}>v{thesis.version}</span>
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
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirmThesis}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0b5a4b] hover:bg-[#09473b] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isThai ? 'ยืนยันสมมติฐาน' : 'Confirm Thesis'}</span>
            </motion.button>
          )}

          {!isEditing && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isThai ? 'แก้ไข' : 'Edit'}</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <motion.div animate={{ rotate: isExpanded ? 0 : 180 }} transition={{ duration: 0.2 }}>
              <ChevronUp className="w-4 h-4" />
            </motion.div>
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="thesis-card-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onAnimationStart={() => setIsBodyAnimating(true)}
            onAnimationComplete={() => setIsBodyAnimating(false)}
            className={`flex flex-col gap-4 ${isBodyAnimating ? 'overflow-hidden' : ''}`}
          >
            {/* Edit Form / Summary Display */}
            <AnimatePresence mode="wait">
              {isEditing ? (
                <motion.div
                  key="thesis-editing-form"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col gap-3 shadow-xs"
                >
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {isThai ? 'ใจความหลักของสมมติฐานการลงทุน' : 'Investment Thesis Summary'}
                    </label>
                    <textarea
                      value={editSummary}
                      onChange={e => setEditSummary(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0b5a4b]/20 focus:border-[#0b5a4b] focus:outline-hidden transition-all"
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
                      className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-[#0b5a4b]/20 focus:border-[#0b5a4b] focus:outline-hidden transition-all"
                      placeholder="e.g. Operating margin drops below 35.0%"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1.5 rounded-xl bg-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-300 transition-colors cursor-pointer"
                    >
                      {isThai ? 'ยกเลิก' : 'Cancel'}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleSaveEdits}
                      className="px-3 py-1.5 rounded-xl bg-[#0b5a4b] text-white text-xs font-semibold hover:bg-[#09473b] transition-colors cursor-pointer"
                    >
                      {isThai ? 'บันทึกการแก้ไข' : 'Save Changes'}
                    </motion.button>
                  </div>
                </motion.div>
              ) : (
                /* Thesis Summary Display */
                <motion.div
                  key="thesis-view-display"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                  className="bg-stone-50/70 p-4 sm:p-5 rounded-2xl border border-stone-100/90 flex flex-col gap-3 shadow-2xs"
                >
                  <p className="text-xs sm:text-sm text-stone-800 font-serif leading-relaxed italic">
                    "{thesis.summary}"
                  </p>

                  {/* Assumptions & Invalidation */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-stone-200/60">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-stone-500 tracking-wider block mb-1">
                        {isConfirmed
                          ? (isThai ? `สมมติฐานการประเมินมูลค่า (บันทึก ณ v${thesis.version})` : `Thesis Valuation Assumptions (v${thesis.version})`)
                          : (isThai ? 'ฐานและสมมติฐานการประเมินมูลค่า' : 'Valuation Basis & Assumptions')}
                      </span>
                      {displayedBasis.isGuarded ? (
                        <div className="flex flex-col gap-1.5 text-xs">
                          <div className="font-semibold text-stone-800">
                            {isThai ? displayedBasis.methodTitleTh : displayedBasis.methodTitleEn}
                          </div>
                          {displayedBasis.guardStatusTh && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50/90 text-amber-800 border border-amber-200/80 text-[11px] leading-snug">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{isThai ? displayedBasis.guardStatusTh : displayedBasis.guardStatusEn}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="font-semibold text-stone-800 mb-0.5">
                            {isThai ? displayedBasis.methodTitleTh : displayedBasis.methodTitleEn}
                          </div>
                          {displayedBasis.assumptions.length > 0 ? (
                            <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                              {displayedBasis.assumptions.map((a, idx) => (
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

                      {hasCurrentReportBasisDiff && (
                        <div className="mt-3 pt-2.5 border-t border-dashed border-stone-200">
                          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase text-amber-700 tracking-wider flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                              <span>
                                {isThai
                                  ? `สมมติฐานการประเมินมูลค่าปัจจุบันต่างจากที่ยืนยันใน v${thesis.version}`
                                  : `Current valuation assumptions differ from confirmed thesis v${thesis.version}`}
                              </span>
                            </span>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleAcceptUpdatedValuationBasis}
                              className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 hover:text-stone-900 text-[10px] font-semibold border border-stone-300 transition-colors cursor-pointer"
                            >
                              {isThai
                                ? `ยอมรับและสร้าง v${thesis.version + 1}`
                                : `Accept & Create v${thesis.version + 1}`}
                            </motion.button>
                          </div>
                          <div className="flex flex-col gap-1 text-xs pl-2 border-l-2 border-amber-300/60 bg-amber-50/40 py-1.5 rounded-r-lg">
                            <div className="font-semibold text-stone-700 mb-0.5">
                              {isThai ? activeBasis.methodTitleTh : activeBasis.methodTitleEn}
                            </div>
                            {activeBasis.assumptions.length > 0 && (
                              <ul className="list-disc list-inside text-xs text-stone-600 space-y-0.5">
                                {activeBasis.assumptions.map((a, idx) => (
                                  <li key={idx}>
                                    <span className="font-medium text-stone-600">{isThai ? a.labelTh : a.labelEn}:</span>{' '}
                                    <span className="font-mono text-stone-800 font-semibold">{a.valueText}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tracked Expectations Section */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#0b5a4b]" />
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    {isThai ? 'การติดตามผลประกอบการเทียบกับความคาดหวัง' : 'Tracked Expectations vs Actuals'}
                  </h4>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    setIsAddingExp(!isAddingExp);
                    setIsMetricOpen(false);
                    setIsConditionOpen(false);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b5a4b] hover:text-[#084237] px-2.5 py-1 rounded-lg hover:bg-emerald-50/80 transition-colors cursor-pointer print:hidden"
                >
                  <motion.span animate={{ rotate: isAddingExp ? 45 : 0 }} transition={{ duration: 0.2 }}>
                    <Plus className="w-3.5 h-3.5" />
                  </motion.span>
                  <span>{isAddingExp ? (isThai ? 'ปิดแบบฟอร์ม' : 'Close Form') : (isThai ? 'เพิ่มเป้าหมาย' : 'Add Expectation')}</span>
                </motion.button>
              </div>

              {/* Add Expectation Form with Custom Animated Dropdowns */}
              <AnimatePresence>
                {isAddingExp && (
                  <motion.form
                    key="add-exp-form"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    onSubmit={handleAddExpectation}
                    className="bg-stone-50/90 backdrop-blur-xs p-3.5 sm:p-4 rounded-2xl border border-stone-200/90 shadow-2xs flex flex-wrap gap-2.5 sm:gap-3 items-end text-xs print:hidden relative"
                    style={{ overflow: isMetricOpen || isConditionOpen ? 'visible' : undefined }}
                  >
                    {/* Metric Custom Dropdown */}
                    <div className="flex-1 min-w-[200px] relative" ref={metricDropdownRef}>
                      <label className="block text-[10px] font-bold text-stone-600 mb-1">
                        {isThai ? 'ตัวชี้วัด (ตามประเภทธุรกิจ)' : 'Metric (Business-Aware)'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsMetricOpen(prev => !prev);
                          setIsConditionOpen(false);
                        }}
                        className="w-full px-3 py-2 bg-white hover:bg-stone-50/80 border border-stone-300/80 hover:border-emerald-600/50 rounded-xl text-xs text-stone-800 shadow-2xs flex items-center justify-between gap-2 transition-all cursor-pointer focus:ring-2 focus:ring-[#0b5a4b]/20 focus:border-[#0b5a4b] focus:outline-hidden text-left"
                        aria-expanded={isMetricOpen}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-stone-900 truncate">
                            {isThai ? selectedMetricDef?.labelTh : selectedMetricDef?.labelEn}
                          </span>
                          {selectedMetricDef?.unit && (
                            <span className="text-[10px] font-mono text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                              {selectedMetricDef.unit}
                            </span>
                          )}
                        </div>
                        <motion.span animate={{ rotate: isMetricOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
                          <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        </motion.span>
                      </button>

                      {/* Custom Animated Metric Popover */}
                      <AnimatePresence>
                        {isMetricOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] max-w-sm max-h-72 overflow-y-auto bg-white/98 backdrop-blur-md border border-stone-200/90 rounded-2xl shadow-xl z-50 p-1.5 focus:outline-hidden"
                          >
                            {autoMetrics.length > 0 && (
                              <div className="mb-2">
                                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50/70 rounded-lg flex items-center gap-1.5 mb-1">
                                  <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{isThai ? 'ประเมินผลอัตโนมัติ (Auto-evaluable)' : 'Auto-evaluable'}</span>
                                </div>
                                <div className="space-y-0.5">
                                  {autoMetrics.map(m => {
                                    const isSelected = m.id === newMetric;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          setNewMetric(m.id);
                                          setIsMetricOpen(false);
                                        }}
                                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                          isSelected
                                            ? 'bg-emerald-50/90 text-emerald-950 font-semibold border border-emerald-200/70 shadow-2xs'
                                            : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isSelected ? (
                                            <Check className="w-3.5 h-3.5 text-[#0b5a4b] shrink-0" />
                                          ) : (
                                            <span className="w-3.5 h-3.5 shrink-0" />
                                          )}
                                          <span className="truncate">{isThai ? m.labelTh : m.labelEn}</span>
                                        </div>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 shrink-0 font-medium">
                                          {m.unit}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {manualMetrics.length > 0 && (
                              <div>
                                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50/70 rounded-lg flex items-center gap-1.5 mb-1">
                                  <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>{isThai ? 'ต้องตรวจสอบเอง (Manual Review)' : 'Manual Review'}</span>
                                </div>
                                <div className="space-y-0.5">
                                  {manualMetrics.map(m => {
                                    const isSelected = m.id === newMetric;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          setNewMetric(m.id);
                                          setIsMetricOpen(false);
                                        }}
                                        className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                          isSelected
                                            ? 'bg-amber-50/90 text-amber-950 font-semibold border border-amber-200/70 shadow-2xs'
                                            : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isSelected ? (
                                            <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                          ) : (
                                            <span className="w-3.5 h-3.5 shrink-0" />
                                          )}
                                          <span className="truncate">{isThai ? m.labelTh : m.labelEn}</span>
                                        </div>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 shrink-0 font-medium">
                                          {m.unit}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Condition Custom Dropdown */}
                    <div className="w-28 sm:w-32 relative" ref={conditionDropdownRef}>
                      <label className="block text-[10px] font-bold text-stone-600 mb-1">
                        {isThai ? 'เงื่อนไข' : 'Condition'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsConditionOpen(prev => !prev);
                          setIsMetricOpen(false);
                        }}
                        className="w-full px-3 py-2 bg-white hover:bg-stone-50/80 border border-stone-300/80 hover:border-emerald-600/50 rounded-xl text-xs font-mono font-bold text-stone-800 shadow-2xs flex items-center justify-between gap-1.5 transition-all cursor-pointer focus:ring-2 focus:ring-[#0b5a4b]/20 focus:border-[#0b5a4b] focus:outline-hidden"
                        aria-expanded={isConditionOpen}
                      >
                        <span>{CONDITION_OPTIONS.find(c => c.id === newCondition)?.symbol || '≥'}</span>
                        <motion.span animate={{ rotate: isConditionOpen ? 180 : 0 }} transition={{ duration: 0.18 }}>
                          <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        </motion.span>
                      </button>

                      {/* Custom Animated Condition Popover */}
                      <AnimatePresence>
                        {isConditionOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                            className="absolute left-0 top-full mt-1.5 w-44 bg-white/98 backdrop-blur-md border border-stone-200/90 rounded-2xl shadow-xl z-50 p-1.5 focus:outline-hidden"
                          >
                            <div className="space-y-0.5">
                              {CONDITION_OPTIONS.map(c => {
                                const isSelected = c.id === newCondition;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                      setNewCondition(c.id);
                                      setIsConditionOpen(false);
                                    }}
                                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-mono flex items-center justify-between gap-2 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-50/90 text-emerald-950 font-bold border border-emerald-200/70 shadow-2xs'
                                        : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900'
                                    }`}
                                  >
                                    <span>{isThai ? c.labelTh : c.labelEn}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-[#0b5a4b] shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Target Input */}
                    <div className="w-28 sm:w-32">
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
                          className="w-full p-2.5 pr-8 bg-white border border-stone-300/80 rounded-xl text-xs font-mono text-stone-900 shadow-2xs focus:ring-2 focus:ring-[#0b5a4b]/20 focus:border-[#0b5a4b] focus:outline-hidden transition-all"
                        />
                        {selectedMetricDef?.unit && (
                          <span className="absolute right-2.5 top-2.5 text-[10px] text-stone-400 pointer-events-none font-mono font-medium">
                            {selectedMetricDef.unit}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Target Period Input */}
                    <div className="w-28 sm:w-32">
                      <label className="block text-[10px] font-bold text-stone-600 mb-1">
                        {isThai ? 'งวดเป้าหมาย' : 'Target Period'}
                      </label>
                      <input
                        type="text"
                        required
                        value={newPeriod}
                        onChange={e => setNewPeriod(e.target.value)}
                        placeholder="e.g. Q4 2026"
                        className={`w-full p-2.5 bg-white border ${
                          newPeriod && !isValidTargetPeriod(newPeriod) ? 'border-rose-400 focus:border-rose-500' : 'border-stone-300/80'
                        } rounded-xl text-xs uppercase font-mono text-stone-900 shadow-2xs focus:ring-2 focus:ring-[#0b5a4b]/20 focus:border-[#0b5a4b] focus:outline-hidden transition-all`}
                        title={isThai ? 'รูปแบบที่รองรับ: Q1-Q4 YYYY หรือ FY YYYY (เช่น Q4 2026, FY2026)' : 'Supported: Q1-Q4 YYYY or FY YYYY (e.g. Q4 2026, FY2026)'}
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1.5 items-center">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        className="px-3.5 py-2.5 bg-[#0b5a4b] hover:bg-[#09473b] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isThai ? 'บันทึก' : 'Save'}</span>
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={() => {
                          setIsAddingExp(false);
                          setIsMetricOpen(false);
                          setIsConditionOpen(false);
                        }}
                        className="px-3 py-2.5 bg-stone-200/80 hover:bg-stone-300/80 text-stone-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        {isThai ? 'ยกเลิก' : 'Cancel'}
                      </motion.button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Expectations Table */}
              {expectations.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-4 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/40"
                >
                  <p className="text-xs text-stone-400 italic">
                    {isThai ? 'ยังไม่มีการตั้งความคาดหวังสำหรับหุ้นนี้' : 'No expectations tracked yet for this company.'}
                  </p>
                </motion.div>
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
                          <motion.tr
                            key={exp.expectationId}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18 }}
                            className="hover:bg-stone-50/60 transition-colors"
                          >
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
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
