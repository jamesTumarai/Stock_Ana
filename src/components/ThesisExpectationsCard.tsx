import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass, CheckCircle2, AlertTriangle, Clock, Edit3, Plus,
  Sparkles, Check, ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';
import { ReportData } from '../types';
import { extractMemorySnapshot } from '../domain/investmentMemory';
import {
  InvestmentThesisRecord,
  TrackedExpectation,
  extractDraftThesisFromReport,
  confirmUserThesis,
  evaluateExpectations
} from '../domain/thesisExpectations';
import {
  loadUserThesis,
  saveUserThesis,
  loadExpectations,
  saveExpectations
} from '../services/thesisExpectationsService';
import { ProvenanceBadge } from './ProvenanceBadge';

interface Props {
  ticker: string;
  currentReport: ReportData;
  isThai: boolean;
  currentUser?: any;
}

export function ThesisExpectationsCard({
  ticker,
  currentReport,
  isThai,
  currentUser
}: Props) {
  const [thesis, setThesis] = useState<InvestmentThesisRecord | null>(null);
  const [expectations, setExpectations] = useState<TrackedExpectation[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingExp, setIsAddingExp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

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

  // Load existing thesis & expectations on ticker change
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      const storedThesis = await loadUserThesis(ticker, currentUser);
      const storedExps = await loadExpectations(ticker, currentUser);

      if (!isMounted) return;

      if (storedThesis) {
        setThesis(storedThesis);
        setEditSummary(storedThesis.summary);
        setEditInvalidation(storedThesis.invalidationConditions.join('\n'));
      } else {
        // Create initial draft from current report
        const draft = extractDraftThesisFromReport(currentReport, currentUser?.uid);
        if (draft) {
          setThesis(draft);
          setEditSummary(draft.summary);
          setEditInvalidation(draft.invalidationConditions.join('\n'));
        }
      }

      // Re-evaluate expectations against current snapshot
      if (snapshot && storedExps.length > 0) {
        const evaluated = evaluateExpectations(storedExps, snapshot);
        setExpectations(evaluated);
      } else {
        setExpectations(storedExps);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [ticker, currentUser, currentReport, snapshot]);

  // Confirm thesis handler
  const handleConfirmThesis = async () => {
    if (!thesis) return;
    const updated = confirmUserThesis(thesis, undefined, currentUser?.uid);
    setThesis(updated);
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
      currentUser?.uid
    );
    setThesis(updated);
    setIsEditing(false);
    await saveUserThesis(updated, currentUser);
  };

  // Add new expectation handler
  const handleAddExpectation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTarget || !newPeriod) return;

    const targetNum = parseFloat(newTarget);
    if (isNaN(targetNum)) return;

    const metricLabels: Record<string, string> = {
      revenue: isThai ? 'รายได้รวม ($M)' : 'Revenue ($M)',
      operating_margin_pct: isThai ? 'อัตรากำไรจากการดำเนินงาน (%)' : 'Operating Margin (%)',
      free_cash_flow: isThai ? 'กระแสเงินสดอิสระ ($M)' : 'Free Cash Flow ($M)',
      net_income: isThai ? 'กำไรสุทธิ ($M)' : 'Net Income ($M)'
    };

    const newExp: TrackedExpectation = {
      expectationId: `exp_${Date.now()}`,
      ticker: ticker.toUpperCase().trim(),
      metricOrEvent: newMetric,
      metricLabel: metricLabels[newMetric] || newMetric,
      targetValue: targetNum,
      condition: newCondition,
      targetPeriod: newPeriod.trim().toUpperCase(),
      status: 'PENDING',
      origin: 'USER_EXPECTATION',
      sourceReportId: snapshot?.reportId || null,
      actualValue: null,
      evaluationDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: currentUser?.uid
    };

    let updatedList = [...expectations, newExp];
    if (snapshot) {
      updatedList = evaluateExpectations(updatedList, snapshot);
    }

    setExpectations(updatedList);
    setNewTarget('');
    setNewPeriod('');
    setIsAddingExp(false);
    await saveExpectations(ticker, updatedList, currentUser);
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
                {thesis.keyAssumptions.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-500 tracking-wider block mb-1">
                      {isThai ? 'สมมติฐานหลักในการประเมินมูลค่า' : 'Key Valuation Assumptions'}
                    </span>
                    <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                      {thesis.keyAssumptions.map((a, idx) => (
                        <li key={idx}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {thesis.invalidationConditions.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold uppercase text-rose-600 tracking-wider block mb-1">
                      {isThai ? 'เงื่อนไขที่อาจหักล้างสมมติฐาน (Invalidation Triggers)' : 'Invalidation Triggers'}
                    </span>
                    <ul className="list-disc list-inside text-xs text-stone-700 space-y-0.5">
                      {thesis.invalidationConditions.map((cond, idx) => (
                        <li key={idx} className="text-stone-800">{cond}</li>
                      ))}
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
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[10px] font-bold text-stone-600 mb-1">
                    {isThai ? 'ตัวชี้วัด' : 'Metric'}
                  </label>
                  <select
                    value={newMetric}
                    onChange={e => setNewMetric(e.target.value)}
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs"
                  >
                    <option value="revenue">Revenue ($M)</option>
                    <option value="operating_margin_pct">Operating Margin (%)</option>
                    <option value="free_cash_flow">Free Cash Flow ($M)</option>
                    <option value="net_income">Net Income ($M)</option>
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

                <div className="w-24">
                  <label className="block text-[10px] font-bold text-stone-600 mb-1">
                    {isThai ? 'เป้าหมาย' : 'Target'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    placeholder="e.g. 60000"
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs"
                  />
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
                    className="w-full p-2 bg-white border border-stone-300 rounded-lg text-xs uppercase"
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
                          <td className="py-2 px-3 font-medium text-stone-900">{exp.metricLabel}</td>
                          <td className="py-2 px-3 font-mono">{exp.condition} {exp.targetValue}</td>
                          <td className="py-2 px-3 font-mono uppercase">{exp.targetPeriod}</td>
                          <td className="py-2 px-3 font-mono">{exp.actualValue !== null ? exp.actualValue : '—'}</td>
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
