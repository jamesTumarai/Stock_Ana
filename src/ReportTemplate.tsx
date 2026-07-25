import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, FileText, CheckCircle2, ChevronRight, Link as LinkIcon, Calendar
, TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle} from 'lucide-react';
import { Info } from 'lucide-react';
import { ReportData } from './App';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface Props {
  data: ReportData;
  ticker: string;
  onClose: () => void;
  durationSecs?: number;
  toolRuns?: number;
  tokenCount?: number;
  documentCount?: number;
  language?: string;
  hideHeader?: boolean;
}

const AnalysisCard = ({ title, subtext, children, className = "", titleClassName = "text-stone-900", delay = 0 }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 10 }} 
    whileInView={{ opacity: 1, y: 0 }} 
    viewport={{ once: true }} 
    transition={{ duration: 0.4, delay }} 
    className={`bg-white rounded p-6 border border-stone-200 flex flex-col ${className}`}
  >
    <div className="flex justify-between items-start mb-2">
      <h3 className={`text-lg font-semibold ${titleClassName}`}>{title}</h3>
    </div>
    {subtext && (
      <div className="text-stone-700 text-[15px] mb-6">
        {subtext}
      </div>
    )}
    <div className="flex-1 w-full flex flex-col">
      {children}
    </div>
  </motion.div>
);

const parsePrice = (str: string) => {
  const match = str.match(/[\d,]+(\.\d+)?/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
};

export default function ReportTemplate({ data, ticker, onClose, durationSecs = 0, toolRuns = 0, tokenCount = 0, documentCount = 0, language = 'English', hideHeader = false }: Props) {
  const isThai = language === 'Thai';

  const generatePDF = () => {
    window.print();
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-[#0b5a4b]';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const findings = data.findings || [];
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={`min-h-full bg-[#F6F4F0] text-stone-900 font-sans w-full flex flex-col print:overflow-visible print:h-auto print:bg-white print:block ${hideHeader ? 'mb-8 border-b-4 border-stone-300 pb-8' : 'h-full overflow-y-auto'}`}>
      {!hideHeader && (
        <div className="w-full border-b border-stone-200 px-[40px] py-4 flex items-center justify-between sticky top-0 z-50 bg-[#F6F4F0] print:static print:bg-white">
          <div className="font-display uppercase font-bold text-stone-900 text-lg tracking-wider flex items-center gap-2">
            {isThai ? `การวิเคราะห์เอกสาร ${ticker}` : `${ticker} Document Analysis`}
          </div>
          <div className="flex items-center gap-4 print:hidden">
            <button
              onClick={generatePDF}
              className="text-stone-700 hover:text-stone-900 transition-colors flex items-center justify-center p-2 text-sm font-medium border border-stone-300 rounded px-4 gap-2 cursor-pointer"
            >
              {isThai ? "พิมพ์ / บันทึก PDF" : "Print / Save PDF"}
            </button>
            <button 
              onClick={onClose}
              className="text-stone-700 hover:text-stone-900 transition-colors flex items-center justify-center p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
      <div id="report-content" className="flex-1 py-8 px-[40px] w-full max-w-[1200px] mx-auto flex flex-col gap-6 bg-[#F6F4F0]">
        
        {/* Executive Summary */}
        <div className="flex flex-col gap-6">
          <AnalysisCard title={isThai ? "บทสรุปผู้บริหาร" : "Executive Summary"} className="w-full">
            <div className="bg-stone-50 p-5 rounded-xl border border-stone-100 mb-6 text-stone-800 leading-relaxed font-medium text-lg w-full">
              "{data.verdict?.summary || (isThai ? 'ไม่มีบทสรุป' : 'No summary available.')}"
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-10 gap-8 w-full mt-2">
              <div className="md:col-span-7 flex flex-col">
                {data.verdict?.key_takeaways && (Array.isArray(data.verdict.key_takeaways) ? data.verdict.key_takeaways.length > 0 : true) && (
                  <div className="w-full text-left flex-1">
                     <div className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-4 border-b border-stone-100 pb-2">{isThai ? "ประเด็นสำคัญ" : "Key Takeaways"}</div>
                     <div className="space-y-3">
                       {Array.isArray(data.verdict.key_takeaways) ? data.verdict.key_takeaways.map((takeaway, i) => (
                          <div key={i} className="flex gap-3 text-base">
                             <CheckCircle2 className="w-5 h-5 text-[#0b5a4b] shrink-0 mt-0.5" />
                             <div className="text-stone-700 leading-relaxed">{takeaway}</div>
                          </div>
                       )) : (
                          <div className="flex gap-3 text-base">
                             <CheckCircle2 className="w-5 h-5 text-[#0b5a4b] shrink-0 mt-0.5" />
                             <div className="text-stone-700 leading-relaxed">{String(data.verdict.key_takeaways)}</div>
                          </div>
                       )}
                     </div>
                  </div>
                )}
              </div>
              
              <div className="md:col-span-3 flex flex-col h-full text-center md:border-l md:border-stone-100 md:pl-8">
                 <h4 className="text-sm font-bold text-stone-700 uppercase tracking-wider mb-1">{isThai ? "คะแนนความเชื่อมั่น" : "Conviction Score"}</h4>
                 <p className="text-xs text-stone-600 mb-4">{isThai ? "อ้างอิงจากเอกสารที่วิเคราะห์" : "Based on analyzed filings"}</p>
                 <div className={`text-6xl font-display font-bold mb-1 flex-1 flex items-center justify-center ${data.verdict ? scoreColor(data.verdict.conviction_score) : 'text-stone-600'}`}>
                    {data.verdict?.conviction_score || '-'}
                 </div>
                 
                 <div className="text-xs text-stone-700 uppercase tracking-widest font-bold mb-6">{isThai ? "เต็ม 100" : "out of 100"}</div>
                 <div className="grid grid-cols-4 gap-1 border-t border-stone-100 pt-4 mt-auto w-full">
                   <div className="flex flex-col items-center">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "เอกสาร" : "Docs"}</div>
                     <div className="text-sm font-mono text-stone-800">{documentCount}</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-100">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "เวลา" : "Time"}</div>
                     <div className="text-sm font-mono text-stone-800">{durationSecs}s</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-100">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "การทำงาน" : "Runs"}</div>
                     <div className="text-sm font-mono text-stone-800">{toolRuns}</div>
                   </div>
                   <div className="flex flex-col items-center border-l border-stone-100">
                     <div className="text-[10px] text-stone-700 uppercase font-bold tracking-wider mb-1">{isThai ? "โทเค็น" : "Tokens"}</div>
                     <div className="text-sm font-mono text-stone-800">
                        {tokenCount > 0 ? (tokenCount / 1000).toFixed(1) + 'k' : '-'}
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </AnalysisCard>
        </div>

        {/* Comprehensive Analysis */}
        {data.comprehensive_analysis && (
          <div className="flex flex-col gap-6 mt-2">
            <h2 className="text-2xl font-display font-bold text-stone-900 uppercase tracking-wider border-b border-stone-200 pb-2 mt-4">
              {isThai ? "การวิเคราะห์ปัจจัยพื้นฐานเชิงลึก" : "Comprehensive Fundamental Analysis"}
            </h2>
            
            <AnalysisCard title={isThai ? "ภาพรวมธุรกิจ (Business Overview)" : "Business Overview"}>
               <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.business_overview || ''}</p>
            </AnalysisCard>
             
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnalysisCard title={isThai ? "กลุ่มลูกค้า (Target Customers)" : "Target Customers"}>
                 <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.target_customers || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "โมเดลรายได้ (Revenue Model)" : "Revenue Model & Quality"}>
                 <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.revenue_model || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ภาพรวมงบการเงิน (Financials)" : "Financial Overview"}>
                 <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.financial_overview || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความแข็งแกร่ง (Strengths/Moat)" : "Business Strengths"}>
                 <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.business_strengths || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "โอกาสเติบโต (Future Growth)" : "Future Growth"}>
                 <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.future_growth || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความเสี่ยง (Key Risks)" : "Key Risks"}>
                 <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.key_risks || ''}</p>
              </AnalysisCard>
            </div>
            
            <AnalysisCard title={isThai ? "ผู้บริหาร (Management)" : "Management"}>
               <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.management || ''}</p>
            </AnalysisCard>
            <AnalysisCard title={isThai ? "คุณภาพพื้นฐาน (Fundamentals Check)" : "Fundamentals Check"} className="bg-stone-50 border-stone-200">
               <p className="text-stone-700 leading-relaxed text-[15px]">{data.comprehensive_analysis.fundamentals_check || ''}</p>
            </AnalysisCard>

            {data.comprehensive_analysis.beginner_summary && (
              <AnalysisCard title={isThai ? "สรุปสำหรับมือใหม่ (Beginner Summary)" : "Beginner Summary"} className="bg-white border-stone-200" titleClassName="text-stone-900">
                <div className="text-stone-700 leading-relaxed text-[15px] mb-6 border-b border-stone-200 pb-4">
                  {data.comprehensive_analysis.beginner_summary.business_type_simple || ''}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-[#0b5a4b] uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> {isThai ? "จุดเด่นหลัก" : "Top 3 Strengths"}</h4>
                    <ul className="space-y-2">
                      {(data.comprehensive_analysis.beginner_summary.top_3_strengths || []).map((s, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <CheckCircle2 className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" /> <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {isThai ? "ความเสี่ยงหลัก" : "Top 3 Risks"}</h4>
                    <ul className="space-y-2">
                      {(data.comprehensive_analysis.beginner_summary.top_3_risks || []).map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-stone-200 text-sm text-stone-700">
                   <div><strong className="text-stone-900">{isThai ? "เหมาะกับใคร:" : "Suitable For:"}</strong> {data.comprehensive_analysis.beginner_summary.suitable_investor_type || ''}</div>
                   <div><strong className="text-stone-900">{isThai ? "อ่านเพิ่มเติม:" : "Further Reading:"}</strong> {data.comprehensive_analysis.beginner_summary.further_reading || ''}</div>
                </div>
              </AnalysisCard>
            )}

            {data.comprehensive_analysis.scoring && (
              <AnalysisCard title={isThai ? "คะแนนประเมินปัจจัย (1-10)" : "Factor Scoring (1-10)"}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(data.comprehensive_analysis.scoring).map(([key, item]) => {
                     if (!item) return null;
                     const labels: Record<string, string> = {
                        understandability: isThai ? 'ความเข้าใจง่าย' : 'Understandability',
                        revenue_quality: isThai ? 'คุณภาพรายได้' : 'Revenue Quality',
                        financial_strength: isThai ? 'ความแข็งแรงทางการเงิน' : 'Financial Strength',
                        growth_potential: isThai ? 'โอกาสเติบโต' : 'Growth Potential',
                        risk_level: isThai ? 'ความเสี่ยง (น้อย=ดี)' : 'Risk Level',
                        overall_attractiveness: isThai ? 'ความน่าสนใจโดยรวม' : 'Overall Attractiveness'
                     };
                     const scoreData = item as {score: number, reason: string};
                     return (
                      <div key={key} className="flex flex-col p-3 border border-stone-100 rounded bg-stone-50">
                         <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-sm text-stone-700">{labels[key] || key}</span>
                            <span className={`font-mono font-bold ${scoreColor((scoreData.score || 0) * 10)}`}>{scoreData.score || '-'}/10</span>
                         </div>
                         <div className="text-xs text-stone-700">{scoreData.reason || ''}</div>
                      </div>
                     );
                  })}
                </div>
              </AnalysisCard>
            )}

            {data.comprehensive_analysis.final_verdict_summary && (
              <AnalysisCard title={isThai ? "บทสรุปสุดท้าย (Final Verdict)" : "Final Verdict Summary"}>
                 <div className="space-y-4 text-[15px] text-stone-700 leading-relaxed">
                   <div><strong className="text-stone-900">{isThai ? "น่าศึกษาต่อไหม:" : "Worth Studying Further?"}</strong> {data.comprehensive_analysis.final_verdict_summary.worth_further_study || ''}</div>
                   <div><strong className="text-stone-900">{isThai ? "พื้นฐานดีจริงไหม:" : "Strong Fundamentals?"}</strong> {data.comprehensive_analysis.final_verdict_summary.strong_fundamentals || ''}</div>
                   <div><strong className="text-stone-900">{isThai ? "สิ่งที่ต้องดูเพิ่ม:" : "What to Look For:"}</strong> {data.comprehensive_analysis.final_verdict_summary.what_to_look_for || ''}</div>
                 </div>
              </AnalysisCard>
            )}
          </div>
        )}

        {/* Financial Charts */}
        {data.financial_charts && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <AnalysisCard title={isThai ? "ราคาหุ้น" : "Stock Price"} subtext={isThai ? "แผนภูมินี้แสดงราคาปิดย้อนหลังรายสัปดาห์ในวันซื้อขายสุดท้าย" : "This chart shows the weekly closing price for the past few weeks."}>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={(data.financial_charts.stock_price_history || data.financial_charts.stock_price_history) ? [...(data.financial_charts.stock_price_history || data.financial_charts.stock_price_history)] : []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dx={-10} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`$${value}`, isThai ? 'ราคา' : 'Price']}
                    />
                    <Line type="linear" dataKey="price" stroke="#0b5a4b" strokeWidth={2} dot={{ r: 4, fill: '#0b5a4b', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AnalysisCard>
            
                        <AnalysisCard 
              title={isThai ? "ผลประกอบการทางการเงิน" : "Financial Performance"}
              subtext={data.financial_charts.financial_performance_4q && data.financial_charts.financial_performance_4q.length > 0 && data.financial_charts.financial_performance_4q[0].distributions !== undefined ? (isThai ? "แผนภูมินี้แสดงการจ่ายปันผลรายไตรมาส (เงินปันผล/ผลตอบแทนต่อหุ้น) สำหรับสี่ไตรมาสที่ผ่านมา" : "This chart shows the quarterly distributions (dividends/yield per share) for the past four completed quarters.") : (isThai ? "แผนภูมินี้แสดงรายได้และกำไรสุทธิสำหรับสี่ไตรมาสที่ผ่านมา" : "This chart shows the revenue and net income for the past four completed quarters.")}
            >
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.financial_charts.financial_performance_4q ? [...data.financial_charts.financial_performance_4q] : []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
                    <XAxis dataKey="quarter" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#78716c' }} dx={-10} tickFormatter={(value) => data.financial_charts?.financial_performance_4q?.[0]?.distributions !== undefined ? `$${value}` : `${value}B`} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e4', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number, name: string) => name === (isThai ? 'เงินปันผล' : 'Distributions') || name === 'Distributions' ? [`$${value}`, isThai ? 'เงินปันผล' : 'Distributions'] : [`$${value}B`, name === 'Revenue' || name === 'รายได้' ? (isThai ? 'รายได้' : 'Revenue') : (isThai ? 'กำไรสุทธิ' : 'Net Income')]}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                    {data.financial_charts.financial_performance_4q && data.financial_charts.financial_performance_4q.length > 0 && data.financial_charts.financial_performance_4q[0].distributions !== undefined ? (
                      <Bar dataKey="distributions" name={isThai ? "เงินปันผล" : "Distributions"} fill="#10b981" radius={[4, 4, 0, 0]} barSize={48} />
                    ) : (
                      <>
                        <Bar dataKey="revenue" name={isThai ? "รายได้" : "Revenue"} fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                        <Bar dataKey="net_income" name={isThai ? "กำไรสุทธิ" : "Net Income"} fill="#1e3a8a" radius={[4, 4, 0, 0]} barSize={32} />
                      </>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalysisCard>
          </div>
        )}

        {/* Technical Analysis */}
        {data.technical_analysis && (
          <div className="flex flex-col gap-6 mt-2">
            <h2 className="text-2xl font-display font-bold text-stone-900 uppercase tracking-wider border-b border-stone-200 pb-2 mt-4">
              {isThai ? "การวิเคราะห์ทางเทคนิค (Technical Analysis)" : "Technical Analysis"}
            </h2>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <span>
                  <strong>{isThai ? "คำเตือน:" : "Disclaimer:"}</strong> {isThai ? "ข้อมูลนี้ไม่ใช่คำแนะนำการลงทุน (Not Investment Advice). การวิเคราะห์ทางเทคนิคมีความผันผวนสูงและล้าสมัยเร็ว" : "This is not investment advice. Technical analysis is highly volatile and becomes outdated quickly."}
                </span>
              </div>
              <div className="text-yellow-700 font-medium whitespace-nowrap ml-4">
                {isThai ? "ข้อมูล ณ" : "Data as of"} {new Date().toLocaleString(isThai ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div className="w-full h-[500px] bg-white rounded-xl shadow-sm border border-stone-100 overflow-hidden relative">
              <iframe 
                src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${ticker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=%5B%22MASimple%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%2C%22RSI%40tv-basicstudies%22%2C%22BollingerBands%40tv-basicstudies%22%5D&theme=light&style=1&timezone=Asia%2FBangkok&withdateranges=1&showpopupbutton=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=&utm_medium=widget&utm_campaign=chart&utm_term=${ticker}`}
                width="100%" 
                height="100%" 
                frameBorder="0" 
                 
                scrolling="no" 
                allowFullScreen={true}
              ></iframe>
            </div>
            
            {/* 3. Signal Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AnalysisCard title={isThai ? "สถานะปัจจุบัน" : "Signal Status"} className="bg-stone-50">
                 <div className="flex items-center justify-center py-4">
                   <div className={`px-6 py-2 rounded-full font-bold text-lg text-white ${data.technical_analysis.signal_summary?.status?.toLowerCase().includes('buy') ? 'bg-[#0b5a4b]' : data.technical_analysis.signal_summary?.status?.toLowerCase().includes('avoid') || data.technical_analysis.signal_summary?.status?.toLowerCase().includes('sell') ? 'bg-red-600' : 'bg-yellow-600'}`}>
                     {data.technical_analysis.signal_summary?.status || 'Wait'}
                   </div>
                 </div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "แนวโน้ม (Trend)" : "Trend Badges"} className="bg-stone-50">
                 <div className="flex flex-col gap-2 mt-2">
                   <div className="flex justify-between items-center text-sm font-medium">
                     <span className="text-stone-500">Weekly</span>
                     <span className="text-stone-900">{data.technical_analysis.signal_summary?.trend_weekly || '-'}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-medium">
                     <span className="text-stone-500">Daily</span>
                     <span className="text-stone-900">{data.technical_analysis.signal_summary?.trend_daily || '-'}</span>
                   </div>
                   <div className="flex justify-between items-center text-sm font-medium">
                     <span className="text-stone-500">4H</span>
                     <span className="text-stone-900">{data.technical_analysis.signal_summary?.trend_4h || '-'}</span>
                   </div>
                 </div>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความสอดคล้องสัญญาณ" : "Confluence Meter"} className="bg-stone-50">
                 <div className="flex items-center justify-center h-full">
                    <span className="text-xl font-bold text-stone-900">{data.technical_analysis.signal_summary?.confluence_score || '-'}</span>
                 </div>
              </AnalysisCard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnalysisCard title={isThai ? "แผนการเทรด (Trade Plan)" : "Trade Plan"}>
                 <div className="flex flex-col gap-3">
                   <div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "จุดเข้า (Entry)" : "Entry"}</span>
                     <span className="text-stone-900 font-bold">{data.technical_analysis.trade_plan?.entry_zone || '-'}</span>
                   </div>
                   <div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "จุดตัดขาดทุน (Stop-Loss)" : "Stop-Loss"}</span>
                     <span className="text-red-600 font-bold">{data.technical_analysis.trade_plan?.stop_loss || '-'}</span>
                   </div>
                   <div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "เป้าหมาย 1 (Target 1)" : "Target 1"}</span>
                     <span className="text-[#0b5a4b] font-bold">{data.technical_analysis.trade_plan?.target_1 || '-'}</span>
                   </div>
                   <div className="flex justify-between border-b border-stone-100 pb-2">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "เป้าหมาย 2 (Target 2)" : "Target 2"}</span>
                     <span className="text-[#0b5a4b] font-bold">{data.technical_analysis.trade_plan?.target_2 || '-'}</span>
                   </div>
                   <div className="flex justify-between pt-1">
                     <span className="text-stone-500 text-sm font-medium">{isThai ? "ความคุ้มค่า (Risk/Reward)" : "Risk/Reward"}</span>
                     <span className="text-stone-900 font-bold">{data.technical_analysis.trade_plan?.risk_reward_ratio || '-'}</span>
                   </div>
                 </div>
              </AnalysisCard>
              
              <AnalysisCard title={isThai ? "แนวรับ-แนวต้าน (Key Levels)" : "Key Levels"}>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-red-600 uppercase mb-2">{isThai ? "แนวต้าน (Resistance)" : "Resistance"}</h4>
                      <ul className="space-y-2">
                        {[...(data.technical_analysis.key_levels?.resistance || [])].sort((a, b) => parsePrice(a) - parsePrice(b)).map((r, i) => (
                          <li key={i} className="text-sm font-medium text-stone-700 bg-red-50 px-2 py-1 rounded">R{i+1}: {r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-[#0b5a4b] uppercase mb-2">{isThai ? "แนวรับ (Support)" : "Support"}</h4>
                      <ul className="space-y-2">
                        {[...(data.technical_analysis.key_levels?.support || [])].sort((a, b) => parsePrice(b) - parsePrice(a)).map((s, i) => (
                          <li key={i} className="text-sm font-medium text-stone-700 bg-green-50 px-2 py-1 rounded">S{i+1}: {s}</li>
                        ))}
                      </ul>
                    </div>
                 </div>
              </AnalysisCard>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnalysisCard title={isThai ? "ภาพรวมแนวโน้มหลัก (Overall Trend)" : "Overall Trend"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.overall_trend || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "โครงสร้างราคา (Price Structure)" : "Price Structure"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.price_structure || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ปริมาณการซื้อขาย (Volume Analysis)" : "Volume Analysis"} tooltip={isThai ? "ปริมาณหุ้นที่ถูกซื้อขายในแต่ละช่วงเวลา ใช้ยืนยันความแข็งแกร่งของเทรนด์" : "Amount of shares traded, used to confirm trend strength"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.volume_analysis || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "กลุ่มเทรนด์ (Trend Indicators)" : "Trend Indicators"} tooltip={isThai ? "บ่งบอกทิศทางของราคา เช่น MA, MACD" : "Indicates price direction e.g. MA, MACD"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.trend_indicators || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "กลุ่มโมเมนตัม (Momentum Indicators)" : "Momentum Indicators"} tooltip={isThai ? "วัดความแรงและอ่อนของราคา เช่น RSI, Stochastic" : "Measures strength of price movement e.g. RSI, Stochastic"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.momentum_indicators || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "กลุ่มความผันผวน (Volatility Indicators)" : "Volatility Indicators"} tooltip={isThai ? "วัดความแกว่งตัวของราคา เช่น Bollinger Bands, ATR" : "Measures price variance e.g. Bollinger Bands, ATR"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.volatility_indicators || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "รูปแบบราคาและแท่งเทียน (Chart Patterns)" : "Chart Patterns"} tooltip={isThai ? "รูปแบบที่มักจะเกิดซ้ำเพื่อคาดเดาทิศทาง เช่น Head and Shoulders, Doji" : "Recurring formations to predict direction e.g. Head and Shoulders, Doji"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.chart_patterns || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "เปรียบเทียบกับตลาด (Relative Strength)" : "Relative Strength"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.relative_strength || ''}</p>
              </AnalysisCard>
              <AnalysisCard title={isThai ? "ความเสี่ยงเชิงเทคนิค (Technical Risks)" : "Technical Risks"}>
                 <p className="text-stone-700 leading-relaxed text-[15px] whitespace-pre-wrap">{data.technical_analysis.technical_risks || ''}</p>
              </AnalysisCard>
            </div>

            {data.technical_analysis.beginner_summary && (
              <AnalysisCard title={isThai ? "สรุปสำหรับมือใหม่ (Beginner Summary)" : "Beginner Summary"} className="bg-white border-stone-200" titleClassName="text-stone-900">
                <div className="text-stone-700 leading-relaxed text-[15px] mb-6 border-b border-stone-200 pb-4 whitespace-pre-wrap">
                  {data.technical_analysis.beginner_summary.technical_overview || ''}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-[#0b5a4b] uppercase tracking-wider mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/> {isThai ? "จุดที่น่าสนใจ 3 ข้อ" : "Top 3 Points"}</h4>
                    <ul className="space-y-2">
                      {(data.technical_analysis.beginner_summary.top_3_points || []).map((s, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <CheckCircle2 className="w-4 h-4 text-[#0b5a4b] shrink-0 mt-0.5" /> <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/> {isThai ? "จุดที่ต้องระวัง 3 ข้อ" : "Top 3 Cautions"}</h4>
                    <ul className="space-y-2">
                      {(data.technical_analysis.beginner_summary.top_3_cautions || []).map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm text-stone-700">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="pt-4 border-t border-stone-200 text-sm text-stone-700">
                   <div><strong className="text-stone-900">{isThai ? "เหมาะกับสไตล์การเทรดแบบไหน:" : "Suitable Trade Style:"}</strong> {data.technical_analysis.beginner_summary.suitable_trade_style || ''}</div>
                </div>
              </AnalysisCard>
            )}

            {data.technical_analysis.scoring && (
              <AnalysisCard title={isThai ? "คะแนนประเมิน (1-10)" : "Scoring (1-10)"} className="col-span-1 md:col-span-2">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <div className="w-full md:w-1/2 h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={
                        Object.entries(data.technical_analysis.scoring).map(([key, item]) => {
                          const labels: Record<string, string> = {
                            trend_clarity: isThai ? 'เทรนด์' : 'Trend Clarity',
                            momentum_strength: isThai ? 'โมเมนตัม' : 'Momentum Strength',
                            risk_reward: isThai ? 'Risk/Reward' : 'Risk/Reward',
                            signal_confluence: isThai ? 'ความสอดคล้อง' : 'Signal Confluence',
                            false_signal_risk: isThai ? 'ความเสี่ยงหลอก' : 'False Signal Risk',
                            overall_attractiveness: isThai ? 'ภาพรวม' : 'Overall'
                          };
                          return {
                            subject: labels[key] || key,
                            A: Number(item.score),
                            fullMark: 10,
                          };
                        })
                      }>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#444', fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#888' }} />
                        <Radar name="Score" dataKey="A" stroke="#0b5a4b" fill="#0b5a4b" fillOpacity={0.5} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full md:w-1/2 grid grid-cols-1 gap-4">
                    {Object.entries(data.technical_analysis.scoring).map(([key, item]) => {
                       if (!item) return null;
                       const labels: Record<string, string> = {
                          trend_clarity: isThai ? 'ความชัดเจนของเทรนด์' : 'Trend Clarity',
                          momentum_strength: isThai ? 'ความแข็งแรงของโมเมนตัม' : 'Momentum Strength',
                          risk_reward: isThai ? 'คุณภาพ Risk/Reward' : 'Risk/Reward Quality',
                          signal_confluence: isThai ? 'ความสอดคล้องของสัญญาณ' : 'Signal Confluence',
                          false_signal_risk: isThai ? 'ความเสี่ยงสัญญาณหลอก (ยิ่งเสี่ยงมาก คะแนนยิ่งต่ำ)' : 'False Signal Risk',
                          overall_attractiveness: isThai ? 'ความน่าสนใจโดยรวม' : 'Overall Attractiveness'
                       };
                       return (
                         <div key={key} className="flex flex-col p-3 rounded-lg border border-stone-100 bg-stone-50">
                           <div className="flex items-center justify-between mb-1">
                             <span className="text-xs font-bold text-stone-500 uppercase">{labels[key] || key}</span>
                             <span className={`text-sm font-bold ${scoreColor(Number(item.score) * 10)}`}>{item.score}/10</span>
                           </div>
                           <div className="text-sm text-stone-700 leading-snug">{item.reason}</div>
                         </div>
                       );
                    })}
                  </div>
                </div>
              </AnalysisCard>
            )}

            {data.technical_analysis.final_verdict_summary && (
              <AnalysisCard title={isThai ? "บทสรุปสุดท้าย (Final Verdict)" : "Final Verdict Summary"}>
                 <div className="space-y-4 text-[15px] text-stone-700 leading-relaxed">
                   <div><strong className="text-stone-900">{isThai ? "จังหวะน่าเข้าไหม:" : "Good Timing?"}</strong> {data.technical_analysis.final_verdict_summary.is_good_timing || ''}</div>
                   <div><strong className="text-stone-900">{isThai ? "ถ้ารอ ต้องรออะไร:" : "What to wait for:"}</strong> {data.technical_analysis.final_verdict_summary.what_to_wait_for || ''}</div>
                   <div><strong className="text-stone-900">{isThai ? "แผนการเข้าสั้นๆ:" : "Trade Plan:"}</strong> {data.technical_analysis.final_verdict_summary.trade_plan || ''}</div>
                 </div>
              </AnalysisCard>
            )}
          </div>
        )}

        {/* Deep Insights */}
        {data.deep_insights && data.deep_insights.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-display font-bold text-stone-900 uppercase tracking-wider mb-6">{isThai ? "ข้อมูลเชิงลึก" : "Deep Insights"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.deep_insights.slice(0, 3).map((insight, index) => (
                <div key={index} className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col">
                   <div className="flex items-start justify-between mb-4 border-b border-stone-100 pb-4">
                     <div className="flex items-center gap-3">
                       <div>
                         <div className="text-xs text-stone-700 font-bold uppercase tracking-wider">{insight.category}</div>
                         <h4 className="font-bold text-stone-900 text-lg mt-0.5 leading-tight">{insight.title}</h4>
                       </div>
                     </div>
                   </div>
                   <div className="text-stone-700 leading-relaxed text-[15px] flex-1">{insight.description}</div>
                   <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
                     <span className="text-xs text-stone-700 font-bold uppercase tracking-wider">{isThai ? "คะแนนผลกระทบ" : "Impact Score"}</span>
                     <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${insight.impact_score >= 8 ? 'bg-red-50 text-red-700' : insight.impact_score >= 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>{insight.impact_score}/10</span>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Detailed Findings */}
        <div className="mt-8">
           <h2 className="text-2xl font-display font-bold text-stone-900 uppercase tracking-wider mb-6">{isThai ? "ผลการค้นพบในเอกสาร" : "Document Findings"}</h2>
           
           {findings.length === 0 ? (
             <div className="text-stone-700 italic p-8 bg-white rounded border border-stone-200 text-center">
               {isThai ? "ไม่พบข้อมูลจากเอกสารเฉพาะเจาะจง" : "No specific document findings returned."}
             </div>
           ) : (
             <div className="flex flex-col gap-6">
               {findings.map((finding, index) => (
                 <div key={index} className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col">
                   <div className="flex items-start justify-between mb-4 border-b border-stone-100 pb-4">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded bg-stone-100 text-stone-600 flex items-center justify-center">
                         <FileText className="w-5 h-5" />
                       </div>
                       <div>
                         <h4 className="font-bold text-stone-900 text-lg">{finding.documentType || finding.document_type || (isThai ? "เอกสาร" : "Document")}</h4>
                         {finding.date && (
                           <div className="text-xs text-stone-700 font-mono flex items-center gap-1 mt-1">
                             <Calendar className="w-3 h-3" /> {finding.date}
                           </div>
                         )}
                       </div>
                     </div>
                     {(finding.sourceUrl || finding.source_url) && (
                       <a href={finding.sourceUrl || finding.source_url} target="_blank" rel="noreferrer" className="hover:opacity-80 transition-opacity flex items-center justify-center p-1" title="View Source">
                         <img src="https://upload.wikimedia.org/wikipedia/commons/8/87/PDF_file_icon.svg" alt="PDF" className="w-8 h-8" />
                       </a>
                     )}
                   </div>
                   
                   <ul className="space-y-3 mt-2 flex-1">
                     {Array.isArray(finding.keyInsights || finding.key_insights) ? (finding.keyInsights || finding.key_insights)?.map((insight, i) => (
                       <li key={i} className="flex gap-2 text-sm text-stone-700 leading-relaxed">
                         <ChevronRight className="w-4 h-4 text-stone-600 mt-0.5 shrink-0" />
                         <span>{insight}</span>
                       </li>
                     )) : (finding.keyInsights || finding.key_insights) ? (
                       <li className="flex gap-2 text-sm text-stone-700 leading-relaxed">
                         <ChevronRight className="w-4 h-4 text-stone-600 mt-0.5 shrink-0" />
                         <span>{String(finding.keyInsights || finding.key_insights)}</span>
                       </li>
                     ) : null}
                   </ul>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </motion.div>
  );
}
