import React from 'react';
import { motion } from 'motion/react';
import { Users, TrendingUp, TrendingDown, HelpCircle, Layers } from 'lucide-react';
import { PeerComparisonData, PeerCompanyItem } from '../types';

interface Props {
  data?: PeerComparisonData;
  isThai: boolean;
  targetTicker?: string;
}

export function PeerComparisonTable({ 
  data, 
  isThai, 
  targetTicker = 'PLTR' 
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

        {data.as_of_date && (
          <span className="text-xs text-stone-400 font-mono self-start sm:self-auto">
            {isThai ? 'ข้อมูล ณ ' : 'As of '}{data.as_of_date}
          </span>
        )}
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
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-mono text-xs sm:text-sm">
            {peers.map((peer, idx) => {
              const isTarget = peer.ticker.toUpperCase() === targetTicker.toUpperCase();
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
                  </td>
                  <td className="py-3 px-3 text-right text-stone-800">{peer.market_cap || '-'}</td>
                  <td className="py-3 px-3 text-right font-bold text-stone-900">
                    {peer.pe_trailing !== null && peer.pe_trailing !== undefined ? `${peer.pe_trailing}x` : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-right text-stone-700">
                    {peer.pe_forward !== null && peer.pe_forward !== undefined ? `${peer.pe_forward}x` : 'N/A'}
                  </td>
                  <td className={`py-3 px-3 text-right font-bold ${
                    (peer.revenue_growth_yoy_pct || 0) > 20 ? 'text-[#0b5a4b]' : 'text-stone-800'
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


