import React, { useState } from 'react';
import { Coins, Scissors, RefreshCw, Calendar, TrendingUp, Info } from 'lucide-react';
import { CorporateActionsData } from '../types';

interface CorporateActionsCardProps {
  data?: CorporateActionsData;
  ticker: string;
  isThai: boolean;
  currencyMode?: 'USD' | 'THB';
  currencyRate?: number;
}

export const CorporateActionsCard: React.FC<CorporateActionsCardProps> = ({
  data,
  ticker,
  isThai,
  currencyMode = 'USD',
  currencyRate = 35.5
}) => {
  const [activeTab, setActiveTab] = useState<'dividends' | 'splits' | 'buybacks'>('dividends');

  if (!data) return null;

  const { dividends, stock_splits, buybacks, as_of_date } = data;
  const divSummary = dividends?.summary;
  const divHistory = dividends?.history || [];
  const splitsHistory = stock_splits || [];

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return 'N/A';
    if (currencyMode === 'THB') {
      return `฿${(val * currencyRate).toFixed(2)}`;
    }
    return `$${val.toFixed(2)}`;
  };

  const formatMillions = (valInMillions?: number) => {
    if (valInMillions === undefined || valInMillions === null) return 'N/A';
    const conv = currencyMode === 'THB' ? valInMillions * currencyRate : valInMillions;
    const prefix = currencyMode === 'THB' ? '฿' : '$';
    if (Math.abs(conv) >= 1000) {
      const inBillion = conv / 1000;
      return `${prefix}${inBillion.toFixed(2).replace(/\.?0+$/, '')}B`;
    }
    return `${prefix}${conv.toFixed(0)}M`;
  };

  const hasDividends = divSummary?.has_dividend || divHistory.length > 0;
  const hasSplits = splitsHistory.length > 0;
  const hasBuybacks = !!buybacks;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60 shadow-xs">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
              {isThai ? 'ผลตอบแทนผู้ถือหุ้น & การดำเนินการขององค์กร (Corporate Actions)' : 'Corporate Actions & Shareholder Returns'}
            </h3>
            <span className="text-xs text-stone-500 font-sans">
              {isThai ? 'เงินปันผล (Dividends), การแตกพาร์ (Stock Splits) และการซื้อหุ้นคืน' : 'Dividends, Stock Splits & Share Repurchases'}
            </span>
          </div>
        </div>
        {as_of_date && (
          <span className="text-xs text-stone-400 font-mono self-start sm:self-auto flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {as_of_date}
          </span>
        )}
      </div>

      {/* Tabs - Responsive flex-wrap with zero scrollbars */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-stone-100/90 rounded-2xl border border-stone-200/60 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('dividends')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'dividends'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>{isThai ? 'เงินปันผล (Dividends)' : 'Dividends'}</span>
          {hasDividends && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('splits')}
          className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'splits'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>{isThai ? 'ประวัติแตกพาร์ (Stock Splits)' : 'Stock Splits'}</span>
          {hasSplits && (
            <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 rounded-full font-mono font-bold">
              {splitsHistory.length}
            </span>
          )}
        </button>

        {hasBuybacks && (
          <button
            type="button"
            onClick={() => setActiveTab('buybacks')}
            className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'buybacks'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isThai ? 'ซื้อหุ้นคืน (Buybacks)' : 'Share Buybacks'}</span>
          </button>
        )}
      </div>

      {/* TAB 1: DIVIDENDS */}
      {activeTab === 'dividends' && (
        <div className="flex flex-col gap-4">
          {/* Summary Pills Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'อัตราผลตอบแทนปันผล (Yield)' : 'Dividend Yield (TTM)'}
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900 mt-1">
                {divSummary?.dividend_yield_pct !== undefined && divSummary?.dividend_yield_pct !== null
                  ? `${divSummary.dividend_yield_pct.toFixed(2)}%`
                  : (divSummary?.has_dividend === false ? '0.00%' : (isThai ? 'ไม่มีข้อมูล' : 'Data unavailable'))}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'เงินปันผลต่อปี (Annual Payout)' : 'Annual Payout'}
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900 mt-1">
                {divSummary?.annual_payout_usd !== undefined && divSummary?.annual_payout_usd !== null
                  ? formatCurrency(divSummary.annual_payout_usd)
                  : (divSummary?.has_dividend === false ? formatCurrency(0) : (isThai ? 'ไม่มีข้อมูล' : 'Data unavailable'))}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'สัดส่วนจ่ายปันผล (Payout Ratio)' : 'Payout Ratio'}
              </span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900 mt-1">
                {divSummary?.payout_ratio_pct !== undefined && divSummary?.payout_ratio_pct !== null
                  ? `${divSummary.payout_ratio_pct.toFixed(1)}%`
                  : (divSummary?.has_dividend === false ? '0.0%' : (isThai ? 'ไม่มีข้อมูล' : 'Data unavailable'))}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'ความถี่ / ประวัติการขึ้นปันผล' : 'Growth Streak'}
              </span>
              <span className="text-sm sm:text-base font-bold text-[#0b5a4b] mt-1.5 flex items-center gap-1 font-sans">
                {divSummary?.growth_streak_years ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-[#0b5a4b]" />
                    <span>{divSummary.growth_streak_years} {isThai ? 'ปีติดต่อกัน' : 'Years'}</span>
                  </>
                ) : (
                  <span>
                    {divSummary?.frequency || (divSummary?.has_dividend === false ? (isThai ? 'ไม่มีการจ่ายเงินปันผล' : 'No Dividend') : (isThai ? 'ไม่มีข้อมูล' : 'Data unavailable'))}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Policy Note Banner */}
          {divSummary?.policy_note && (
            <div className={`p-4 rounded-2xl border flex items-start gap-2.5 ${
              hasDividends ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-900' : 'bg-stone-50 border-stone-200 text-stone-700'
            }`}>
              <Info className={`w-4 h-4 shrink-0 mt-0.5 ${hasDividends ? 'text-[#0b5a4b]' : 'text-stone-500'}`} />
              <div className="text-xs sm:text-sm leading-relaxed font-sans">
                <strong className="block mb-0.5">{isThai ? 'นโยบายเงินปันผลของบริษัท:' : 'Dividend Policy:'}</strong>
                {divSummary.policy_note}
              </div>
            </div>
          )}

          {/* Dividend History Table */}
          {divHistory.length > 0 ? (
            <div className="overflow-x-auto w-full border border-stone-200 rounded-2xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-700 font-bold uppercase text-xs tracking-wider">
                    <th className="py-2.5 px-3.5 font-mono">{isThai ? 'วันประกาศ' : 'Announced'}</th>
                    <th className="py-2.5 px-3.5 font-mono text-right">{isThai ? 'เงินปันผลต่อหุ้น' : 'Allocation Plan'}</th>
                    <th className="py-2.5 px-3.5 font-mono text-center">{isThai ? 'วันขึ้น XD (Ex-Date)' : 'Ex-Date'}</th>
                    <th className="py-2.5 px-3.5 font-mono text-center">{isThai ? 'วันปิดสมุด (Record Date)' : 'Record Date'}</th>
                    <th className="py-2.5 px-3.5 font-mono text-center">{isThai ? 'วันจ่ายเงิน (Pay Date)' : 'Pay Date'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono text-xs sm:text-sm">
                  {divHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-2.5 px-3.5 text-stone-700 font-medium whitespace-nowrap">
                        {item.announced_date || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-[#0b5a4b] whitespace-nowrap">
                        {item.allocation_plan || `Cash Dividend: ${formatCurrency(item.amount_usd)}`}
                      </td>
                      <td className="py-2.5 px-3.5 text-center text-stone-800 font-bold whitespace-nowrap">
                        <span className="bg-amber-100/80 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200">
                          {item.ex_date}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-center text-stone-600 whitespace-nowrap">
                        {item.record_date || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-center text-stone-700 whitespace-nowrap">
                        {item.pay_date || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 bg-stone-50 rounded-2xl border border-stone-100 text-xs text-stone-500 font-sans">
              {isThai ? `ไม่มีประวัติการจ่ายเงินปันผลสำหรับ ${ticker} (มุ่งเน้นการนำกระแสเงินสดไปลงทุนขยายธุรกิจ Growth)` : `No dividend payment history recorded for ${ticker}.`}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STOCK SPLITS */}
      {activeTab === 'splits' && (
        <div className="flex flex-col gap-4">
          {splitsHistory.length > 0 ? (
            <div className="overflow-x-auto w-full border border-stone-200 rounded-2xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-700 font-bold uppercase text-xs tracking-wider">
                    <th className="py-2.5 px-4 font-mono">{isThai ? 'วันที่มีผล (Effective Date)' : 'Announced / Effective'}</th>
                    <th className="py-2.5 px-4 font-mono">{isThai ? 'ประเภท' : 'Type'}</th>
                    <th className="py-2.5 px-4 font-mono text-right">{isThai ? 'อัตราส่วน (Ratio)' : 'Ratio'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono text-xs sm:text-sm">
                  {splitsHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-stone-900 whitespace-nowrap">
                        {item.effective_date || item.announced_date}
                      </td>
                      <td className="py-3 px-4 text-stone-700 whitespace-nowrap">
                        <span className="bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-200 text-xs">
                          {item.split_type || 'Split'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-[#0b5a4b] text-base whitespace-nowrap">
                        {item.ratio}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 bg-stone-50 rounded-2xl border border-stone-100 text-xs text-stone-500 font-sans flex flex-col items-center gap-1.5">
              <Scissors className="w-5 h-5 text-stone-400" />
              <span>{isThai ? `${ticker} ยังไม่เคยมีประวัติการแตกพาร์หรือรวมหุ้น (No Stock Splits History)` : `No stock split history for ${ticker}.`}</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SHARE BUYBACKS */}
      {activeTab === 'buybacks' && buybacks && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'วงเงินซื้อหุ้นคืนที่ได้รับอนุมัติ' : 'Authorized Buyback'}
              </span>
              <span className="text-2xl font-bold font-mono text-stone-900 mt-1">
                {formatMillions(buybacks.authorized_amount_musd)}
              </span>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'วงเงินคงเหลือ' : 'Remaining Authorization'}
              </span>
              <span className="text-2xl font-bold font-mono text-[#0b5a4b] mt-1">
                {formatMillions(buybacks.remaining_amount_musd)}
              </span>
            </div>

            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 flex flex-col">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'การลดจำนวนหุ้นสุทธิ (12M)' : 'Net Share Reduction'}
              </span>
              <span className="text-2xl font-bold font-mono text-blue-700 mt-1">
                {buybacks.net_share_reduction_pct !== undefined ? `${buybacks.net_share_reduction_pct > 0 ? '+' : ''}${buybacks.net_share_reduction_pct}%` : 'N/A'}
              </span>
            </div>
          </div>

          {buybacks.commentary && (
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans">
              <strong className="block text-stone-900 mb-1">{isThai ? 'บทวิเคราะห์โครงการซื้อหุ้นคืน:' : 'Buyback Analysis:'}</strong>
              {buybacks.commentary}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
