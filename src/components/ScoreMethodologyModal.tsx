import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, Award, PieChart, CheckCircle2, ShieldCheck, Scale, Zap } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isThai: boolean;
  convictionScore?: number | string;
}

export function ScoreMethodologyModal({ 
  isOpen, 
  onClose, 
  isThai, 
  convictionScore 
}: Props) {
  if (!isOpen) return null;

  const weights = [
    { nameEn: 'Revenue & Earnings Growth', nameTh: 'การเติบโตของรายได้และกำไร', weight: 30, color: 'bg-emerald-500', descTh: 'วัดอัตราการเติบโต YoY, การขยายตัวของกำไร และความสม่ำเสมอของ Guidance' },
    { nameEn: 'Financial Health & Cash Flow', nameTh: 'ความแข็งแรงทางการเงิน & กระแสเงินสด', weight: 30, color: 'bg-blue-500', descTh: 'ประเมิน FCF conversion, สภาพคล่อง, ภาระหนี้สิน (D/E ratio) และคุณภาพกำไร' },
    { nameEn: 'Valuation & Margin of Safety', nameTh: 'ระดับราคา & ส่วนเผื่อความปลอดภัย', weight: 20, color: 'bg-amber-500', descTh: 'เทียบ Trailing/Forward P/E, EV/EBITDA กับคู่แข่ง และผลต่างราคาเหมาะสมจาก DCF' },
    { nameEn: 'Moat, Management & Competitive Risk', nameTh: 'ความได้เปรียบในการแข่งขัน & ความเสี่ยง', weight: 20, color: 'bg-purple-500', descTh: 'ความแข็งแกร่งของ Moat, ความน่าเชื่อถือของผู้บริหาร และการบริหารความเสี่ยง 8 ด้าน' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto no-scrollbar scrollbar-hide"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="flex items-center gap-3 border-b border-stone-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-stone-900 text-white flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif]">
                {isThai ? 'วิธีคิดคะแนนความเชื่อมั่น (Conviction Score)' : 'Conviction Scoring Methodology'}
              </h3>
              <p className="text-xs text-stone-500">
                {isThai ? 'น้ำหนักการถ่วงคะแนนเชิงปริมาณและคุณภาพ' : 'Weighted mathematical & qualitative scoring formula'}
              </p>
            </div>
          </div>

          {/* Current Score Callout */}
          {convictionScore !== undefined && (
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                  {isThai ? 'คะแนนที่ได้ในรายงานนี้' : 'Current Report Conviction Score'}
                </span>
                <span className="text-xs text-stone-600">
                  {isThai ? 'คำนวณแบบพลวัตจากงบการเงินและเอกสาร SEC ล่าสุด' : 'Dynamically evaluated from latest SEC filings'}
                </span>
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#0b5a4b]">
                {convictionScore}<span className="text-sm font-normal text-stone-400">/100</span>
              </div>
            </div>
          )}

          {/* Weighting Breakdown */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              {isThai ? 'สัดส่วนน้ำหนัก 4 เสาหลัก (Weight Distribution)' : 'Scoring Pillar Weights'}
            </h4>
            
            <div className="space-y-3">
              {weights.map((w, idx) => (
                <div key={idx} className="bg-stone-50/80 p-3 rounded-xl border border-stone-100 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-sm font-semibold text-stone-900">
                    <span>{isThai ? w.nameTh : w.nameEn}</span>
                    <span className="font-mono text-[#0b5a4b] font-bold">{w.weight}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-stone-200 rounded-full overflow-hidden">
                    <div className={`h-full ${w.color}`} style={{ width: `${w.weight}%` }} />
                  </div>
                  <p className="text-[11px] text-stone-500 leading-relaxed font-sans mt-0.5">
                    {isThai ? w.descTh : w.nameEn}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Range Guide */}
          <div className="border-t border-stone-100 pt-4 flex flex-col gap-2">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              {isThai ? 'เกณฑ์การตีความคะแนน' : 'Interpretation Guide'}
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-emerald-50 text-[#0b5a4b] border border-emerald-200">
                <strong className="block font-mono">75 - 100</strong>
                <span className="text-[10px]">{isThai ? 'พื้นฐานแกร่งมาก' : 'High Conviction'}</span>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                <strong className="block font-mono">50 - 74</strong>
                <span className="text-[10px]">{isThai ? 'ปานกลาง / มีจุดระวัง' : 'Moderate / Neutral'}</span>
              </div>
              <div className="p-2 rounded-xl bg-red-50 text-red-700 border border-red-200">
                <strong className="block font-mono">0 - 49</strong>
                <span className="text-[10px]">{isThai ? 'ความเสี่ยงสูง / เลี่ยง' : 'High Risk / Avoid'}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer mt-1"
          >
            {isThai ? 'เข้าใจแล้ว' : 'Got it'}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
