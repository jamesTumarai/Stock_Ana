import React from 'react';
import { motion } from 'motion/react';
import { Users, TrendingUp, TrendingDown, Layers, RefreshCw } from 'lucide-react';
import { PeerComparisonData, PeerCompanyItem } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface Props {
  data?: PeerComparisonData;
  isThai: boolean;
  targetTicker?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function PeerComparisonTable({ 
  data, 
  isThai, 
  targetTicker = 'PLTR',
  onRefresh,
  isRefreshing = false
}: Props) {
  if (!data || !data.peers || data.peers.length === 0) {
    return null;
  }

  const peers = data.peers;

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-5 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-[#0b5a4b]" />
          <div>
            <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
              {isThai ? 'ตารางเปรียบเทียบกับคู่แข่งในอุตสาหกรรม (Peer Comparison)' : 'Peer Group Comparison'}
            </h3>
            {data.industry_name && (
              <span className="text-xs text-stone-500 font-sans">
                {isThai ? 'กลุ่มอุตสาหกรรม: ' : 'Industry: '}{data.industry_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer select-none ${
                isRefreshing 
                  ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse'
                  : 'bg-stone-50 hover:bg-emerald-50 border-stone-200 hover:border-emerald-300 text-stone-600 hover:text-emerald-700 shadow-2xs'
              }`}
              title={isThai ? 'ดึง Market Snapshot ล่าสุดจาก Yahoo Finance (อาจล่าช้าตามผู้ให้บริการ)' : 'Refresh the latest Yahoo Finance market snapshot; provider data may be delayed'}
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-600' : 'text-emerald-600'}`} />
              <span className="font-sans font-medium">{isRefreshing ? (isThai ? 'กำลังดึง...' : 'Refreshing...') : (isThai ? '↻ อัปเดต Snapshot' : '↻ Refresh Snapshot')}</span>
            </button>
          )}
          {data.as_of_date && (
            <span className="text-xs text-stone-400 font-mono">
              {isThai ? 'ข้อมูล ณ ' : 'As of '}{data.as_of_date}
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-700 font-bold uppercase text-xs tracking-wider">
              <th className="py-3 px-4 sticky left-0 bg-stone-50 z-10 min-w-[160px] shadow-[1px_0_0_#e7e5e4]">
                {isThai ? 'บริษัท / Ticker' : 'Company / Ticker'}
              </th>
              <th className="py-3 px-3 text-right font-mono min-w-[100px]">{isThai ? 'Market Cap' : 'Market Cap'}</th>
              <th className="py-3 px-3 text-right font-mono min-w-[90px]">{isThai ? 'P/E (Trailing)' : 'P/E (TTM)'}</th>
              <th className="py-3 px-3 text-right font-mono min-w-[90px]">{isThai ? 'Forward P/E' : 'Fwd P/E'}</th>
              <th className="py-3 px-3 text-right font-mono min-w-[110px]">{isThai ? 'เติบโต YoY' : 'YoY Growth'}</th>
              <th className="py-3 px-3 text-right font-mono min-w-[100px]">{isThai ? 'Gross Margin' : 'Gross Margin'}</th>
              <th className="py-3 px-3 text-right font-mono min-w-[100px]">{isThai ? 'Net Margin' : 'Net Margin'}</th>
              <th className="py-3 px-3 text-right font-mono min-w-[90px]">EV/EBITDA</th>
              <th className="py-3 px-4 font-sans text-left min-w-[170px]">{isThai ? 'การประเมินสถานะ' : 'Status Assessment'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-mono text-xs sm:text-sm">
            {peers.map((peer, idx) => {
              const isTarget = peer.ticker.toUpperCase() === targetTicker.toUpperCase();
              const statusLabel = isThai ? (peer.status_label_th || 'ระดับมาตรฐาน') : (peer.status_label_en || 'Standard peer');
              return (
                <tr 
                  key={idx} 
                  className={`hover:bg-stone-50 transition-colors ${
                    isTarget ? 'bg-emerald-50/50 font-bold' : ''
                  }`}
                >
                  <td className={`py-3 px-4 font-sans sticky left-0 shadow-[1px_0_0_#e7e5e4] ${
                    isTarget ? 'bg-emerald-50 text-[#0b5a4b]' : 'bg-white text-stone-900'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <CompanyLogo ticker={peer.ticker} className="w-8 h-8 rounded-lg shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{peer.ticker}</span>
                          {isTarget && (
                            <span className="text-[10px] bg-[#0b5a4b] text-white px-1.5 py-0.2 rounded font-mono font-normal">
                              {isThai ? 'หุ้นนี้' : 'Target'}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-stone-500 font-normal block truncate max-w-[140px]">
                          {peer.company_name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right text-stone-800">{peer.market_cap || '-'}</td>
                  <td className="py-3 px-3 text-right font-bold text-stone-900">
                    {peer.pe_trailing !== null && peer.pe_trailing !== undefined ? `${peer.pe_trailing}x` : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-700">
                    {peer.pe_forward !== null && peer.pe_forward !== undefined ? `${peer.pe_forward}x` : 'N/A'}
                  </td>
                  <td className={`py-3 px-3 text-right font-bold ${
                    typeof peer.revenue_growth_yoy_pct === 'number' && peer.revenue_growth_yoy_pct > 20 ? 'text-[#0b5a4b]' : 'text-stone-800'
                  }`}>
                    {peer.revenue_growth_yoy_pct !== null && peer.revenue_growth_yoy_pct !== undefined 
                      ? `${peer.revenue_growth_yoy_pct > 0 ? '+' : ''}${peer.revenue_growth_yoy_pct}%` 
                      : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-800">
                    {peer.gross_margin_pct !== null && peer.gross_margin_pct !== undefined ? `${peer.gross_margin_pct}%` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-800">
                    {peer.net_margin_pct !== null && peer.net_margin_pct !== undefined ? `${peer.net_margin_pct}%` : '-'}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-800">
                    {peer.ev_ebitda !== null && peer.ev_ebitda !== undefined ? `${peer.ev_ebitda}x` : 'N/A'}
                  </td>
                  <td className="py-3 px-4 font-sans text-xs text-stone-700">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                      isTarget 
                        ? 'bg-emerald-50 text-[#0b5a4b] border-emerald-200' 
                        : 'bg-stone-50 text-stone-700 border-stone-200'
                    }`}>
                      {statusLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {data.key_takeaway && (
        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans">
          <strong>{isThai ? 'ข้อสรุปการเปรียบเทียบ:' : 'Comparative Takeaway:'}</strong> {data.key_takeaway}
        </div>
      )}
    </div>
  );
}


