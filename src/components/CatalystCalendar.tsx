import React from 'react';
import { motion } from 'motion/react';
import { 
  Calendar, Flame, Sparkles, TrendingUp, TrendingDown, 
  UserCheck, Shield, AlertCircle, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { CatalystsData, InsiderActivityData } from '../types';

interface Props {
  catalysts?: CatalystsData;
  insiderActivity?: InsiderActivityData;
  isThai: boolean;
  ticker?: string;
}

export function CatalystCalendar({ 
  catalysts, 
  insiderActivity, 
  isThai,
  ticker = 'STOCK' 
}: Props) {
  const items = catalysts?.items || [];
  const hasCatalysts = items.length > 0;
  const hasInsiders = !!insiderActivity;

  if (!hasCatalysts && !hasInsiders) return null;

  const bothPresent = hasCatalysts && hasInsiders;

  return (
    <div className={bothPresent ? "grid grid-cols-1 lg:grid-cols-2 gap-5 w-full" : "w-full"}>
      {/* Catalysts & Upcoming Events */}
      {hasCatalysts && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col justify-between gap-4 w-full">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shadow-xs shrink-0">
                  <Flame className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Mitr','Nunito',sans-serif]">
                    {isThai ? 'ปัจจัยเร่งและเหตุการณ์สำคัญ (Catalysts)' : 'Upcoming Catalysts & Events'}
                  </h3>
                  <p className="text-[11px] text-stone-500 font-sans mt-0.5">
                    {isThai ? 'เหตุการณ์และหมุดหมายสำคัญที่ส่งผลต่อการเติบโตและมูลค่าหุ้นในอนาคต' : 'Key milestones likely to impact business growth and market valuation'}
                  </p>
                </div>
              </div>
              {catalysts?.as_of_date && (
                <span className="text-[11px] text-stone-400 font-mono bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-100 shrink-0">
                  {catalysts.as_of_date}
                </span>
              )}
            </div>

            <div className={bothPresent ? "space-y-3 mt-4" : "grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-4"}>
              {items.map((cat, idx) => (
                <div key={idx} className="bg-stone-50/80 hover:bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col justify-between gap-2 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-stone-900 text-sm leading-snug">{cat.title}</span>
                      {cat.expected_impact && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          cat.expected_impact === 'high' ? 'bg-red-100 text-red-700' :
                          cat.expected_impact === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'
                        }`}>
                          {cat.expected_impact.toUpperCase()} IMPACT
                        </span>
                      )}
                    </div>
                    {cat.date && (
                      <span className="text-[11px] text-stone-500 font-mono flex items-center gap-1.5 mt-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-amber-600/70" /> {cat.date}
                      </span>
                    )}
                    <p className="text-xs text-stone-600 leading-relaxed font-sans mt-2">
                      {cat.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Insider & Institutional Activity Tracker */}
      {hasInsiders && (
        <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col justify-between gap-4 w-full">
          <div>
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-stone-900 text-base sm:text-lg font-['Prompt','Mitr','Nunito',sans-serif]">
                  {isThai ? 'ธุรกรรมผู้บริหาร & กองทุนสถาบัน' : 'Insider & Institutional Activity'}
                </h3>
              </div>
              {insiderActivity?.as_of_date && (
                <span className="text-[11px] text-stone-400 font-mono">
                  {insiderActivity.as_of_date}
                </span>
              )}
            </div>

            {/* Ownership stats */}
            <div className="grid grid-cols-2 gap-3 my-4">
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 text-center">
                <span className="text-[11px] text-stone-500 uppercase font-bold block">{isThai ? 'สัดส่วนผู้บริหารถือ' : 'Insider Ownership'}</span>
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {insiderActivity?.insider_ownership_pct !== undefined ? `${insiderActivity.insider_ownership_pct}%` : '-'}
                </span>
              </div>
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 text-center">
                <span className="text-[11px] text-stone-500 uppercase font-bold block">{isThai ? 'กองทุนสถาบันถือ' : 'Institutional Ownership'}</span>
                <span className="text-2xl font-bold font-mono text-stone-900">
                  {insiderActivity?.institutional_ownership_pct !== undefined ? `${insiderActivity.institutional_ownership_pct}%` : '-'}
                </span>
              </div>
            </div>

            {/* Recent Transactions List */}
            {insiderActivity?.recent_transactions && insiderActivity.recent_transactions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-stone-500 uppercase font-bold tracking-wider block">
                    {isThai ? 'ธุรกรรมผู้บริหารล่าสุด (Recent Insider Trades)' : 'Recent Transactions'}
                  </span>
                  <span className="text-[10px] text-stone-400 font-sans italic">
                    {isThai ? 'SEC Form 4' : 'SEC Form 4 Filings'}
                  </span>
                </div>
                {insiderActivity.recent_transactions.slice(0, 3).map((tx, idx) => (
                  <div key={idx} className="bg-stone-50 p-2.5 rounded-xl border border-stone-100 flex items-center justify-between text-xs font-mono">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-stone-900 font-sans">{tx.insider_name} ({tx.title || 'Insider'})</span>
                        {tx.transaction_type === 'sell' && (
                          <span className="text-[9px] bg-stone-200 text-stone-700 font-sans px-1.5 py-0.5 rounded font-medium">
                            {isThai ? 'ตามแผน Rule 10b5-1' : 'Rule 10b5-1 Plan'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono mt-0.5">{tx.date}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-bold block ${tx.transaction_type === 'buy' ? 'text-[#0b5a4b]' : 'text-red-600'}`}>
                        {tx.transaction_type === 'buy' ? '+ BUY' : '- SELL'} {tx.shares_count?.toLocaleString() || ''} shs
                      </span>
                      {tx.total_value_usd && (
                        <span className="text-[10px] text-stone-500">${(tx.total_value_usd / 1000000).toFixed(1)}M</span>
                      )}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-stone-400 mt-1 italic font-sans leading-tight">
                  {isThai 
                    ? '* การขายของผู้บริหารส่วนใหญ่เป็นไปตามแผนจัดสรรหุ้นและภาษีล่วงหน้าอัตโนมัติ (Rule 10b5-1 Trading Plan) ไม่ได้สะท้อนมุมมองลบต่อแนวโน้มธุรกิจ' 
                    : '* Executive sales typically execute under automated Rule 10b5-1 scheduled diversification plans.'}
                </p>
              </div>
            )}

            {insiderActivity?.commentary && (
              <p className="text-xs text-stone-600 leading-relaxed font-sans bg-stone-50 p-3 rounded-2xl border border-stone-100 mt-3">
                {insiderActivity.commentary}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
