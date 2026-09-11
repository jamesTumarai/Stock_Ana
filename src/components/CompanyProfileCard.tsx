import React, { useState } from 'react';
import { Building2, Users, ExternalLink, MapPin, Phone, Calendar, Globe, Briefcase, ChevronDown, ChevronUp, UserCheck, Shield } from 'lucide-react';
import { CompanyProfileData } from '../types';
import { CompanyLogo } from './CompanyLogo';

interface CompanyProfileCardProps {
  data?: CompanyProfileData;
  ticker: string;
  isThai: boolean;
}

export const CompanyProfileCard: React.FC<CompanyProfileCardProps> = ({
  data,
  ticker,
  isThai
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'executives'>('overview');
  const [expandedExecIndex, setExpandedExecIndex] = useState<number | null>(0);

  if (!data) return null;

  const { overview, executives, as_of_date } = data;
  const execList = executives || [];

  const toggleExec = (idx: number) => {
    setExpandedExecIndex(expandedExecIndex === idx ? null : idx);
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200 shadow-sm flex flex-col gap-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex items-center gap-3">
          <CompanyLogo ticker={ticker} className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shadow-xs" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-stone-900 text-lg sm:text-xl font-['Prompt','Mitr','Nunito',sans-serif] tracking-tight">
                {overview?.company_name || ticker}
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 font-mono font-bold border border-stone-200">
                {ticker}
              </span>
            </div>
            <span className="text-xs text-stone-500 font-sans">
              {isThai ? 'ข้อมูลองค์กร, สำนักงานใหญ่, ปีที่ก่อตั้ง, ตลาดจดทะเบียน และประวัติผู้บริหาร' : 'Corporate information, headquarters, founding year, exchange & leadership team'}
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
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/70'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>{isThai ? 'ข้อมูลบริษัท (Company Overview)' : 'Company Overview'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('executives')}
          className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'executives'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isThai ? 'คณะผู้บริหาร (Executive Team)' : 'Executives & Board'}</span>
          {execList.length > 0 && (
            <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 rounded-full font-mono font-bold">
              {execList.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: COMPANY OVERVIEW */}
      {activeTab === 'overview' && overview && (
        <div className="flex flex-col gap-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'ชื่อทางการ (Company Name)' : 'Company Name'}
              </span>
              <span className="text-sm sm:text-base font-bold text-stone-900 mt-1 font-sans">
                {overview.company_name}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'สัญลักษณ์ / ตลาดหลักทรัพย์' : 'Symbol / Exchange'}
              </span>
              <span className="text-sm sm:text-base font-bold text-[#0b5a4b] mt-1 font-mono">
                {overview.symbol} ({overview.exchange || 'NASDAQ'})
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'ปีที่ก่อตั้ง (Founded)' : 'Founded Year'}
              </span>
              <span className="text-sm sm:text-base font-bold text-stone-900 mt-1 font-mono">
                {overview.founded_year || 'N/A'}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'วันที่เข้าตลาด (Listing Date)' : 'Listing Date'}
              </span>
              <span className="text-sm sm:text-base font-bold text-stone-900 mt-1 font-mono">
                {overview.listing_date || 'N/A'}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'จำนวนพนักงาน (Employees)' : 'Full-Time Employees'}
              </span>
              <span className="text-sm sm:text-base font-bold text-stone-900 mt-1 font-mono">
                {typeof overview.employees_count === 'number' ? overview.employees_count.toLocaleString() : (overview.employees_count || 'N/A')}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'รอบปิดปีงบประมาณ (Fiscal Year Ends)' : 'Fiscal Year Ends'}
              </span>
              <span className="text-sm sm:text-base font-bold text-stone-900 mt-1 font-mono">
                {overview.fiscal_year_end || '12-31'}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'รหัสสากล (ISIN)' : 'ISIN Code'}
              </span>
              <span className="text-xs sm:text-sm font-bold text-stone-700 mt-1 font-mono">
                {overview.isin || 'N/A'}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'ซีอีโอ (Chief Executive Officer)' : 'Chief Executive Officer'}
              </span>
              <span className="text-sm sm:text-base font-bold text-stone-900 mt-1 font-sans">
                {overview.ceo || 'N/A'}
              </span>
            </div>

            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-100 flex flex-col justify-between">
              <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                {isThai ? 'เว็บไซต์ทางการ (Official Website)' : 'Official Website'}
              </span>
              {typeof overview.website_url === 'string' && overview.website_url.trim() ? (
                <a
                  href={overview.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm sm:text-base font-bold text-[#0b5a4b] hover:underline mt-1 font-sans flex items-center gap-1.5 truncate"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{overview.website_url.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                </a>
              ) : (
                <span className="text-sm font-mono text-stone-400 mt-1">N/A</span>
              )}
            </div>
          </div>

          {/* Address & Contact Row */}
          {(overview.address || overview.city || overview.phone) && (
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-stone-700">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-stone-500 shrink-0" />
                <span>
                  <strong>{isThai ? 'สำนักงานใหญ่:' : 'Headquarters:'}</strong>{' '}
                  {[overview.address, overview.city, overview.province_state, overview.zip_code, overview.country].filter(Boolean).join(', ')}
                </span>
              </div>
              {overview.phone && (
                <div className="flex items-center gap-1.5 font-mono text-stone-600 shrink-0">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  <span>{overview.phone}</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {overview.description && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs flex flex-col gap-2">
              <h4 className="text-xs font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#0b5a4b]" />
                <span>{isThai ? 'ลักษณะการประกอบธุรกิจ (Company Description)' : 'Company Description'}</span>
              </h4>
              <p className="text-sm text-stone-700 leading-relaxed font-sans">
                {overview.description}
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTIVES & BOARD */}
      {activeTab === 'executives' && (
        <div className="flex flex-col gap-3">
          {execList.length > 0 ? (
            <div className="flex flex-col divide-y divide-stone-200 border border-stone-200 rounded-2xl overflow-hidden">
              {execList.map((exec, idx) => {
                const isExpanded = expandedExecIndex === idx;
                return (
                  <div key={idx} className="bg-white transition-colors">
                    {/* Executive Header Row */}
                    <button
                      type="button"
                      onClick={() => toggleExec(idx)}
                      className="w-full p-4 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-stone-50/80 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-700 font-bold flex items-center justify-center text-xs shrink-0 mt-0.5 sm:mt-0">
                          {typeof exec.name === 'string' && exec.name.trim()
                            ? exec.name.split(' ').map(n => n[0]).slice(0, 2).join('')
                            : '--'}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-stone-900 text-sm sm:text-base font-sans">
                              {typeof exec.name === 'string' && exec.name.trim()
                                ? exec.name
                                : (isThai ? 'ไม่มีข้อมูล (Data unavailable)' : 'Data unavailable')}
                            </span>
                            {exec.age && (
                              <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded">
                                {exec.age} {isThai ? 'ปี' : 'y/o'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-stone-600 font-sans mt-0.5">
                            {exec.title}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 ml-11 sm:ml-0">
                        {exec.salary_usd !== undefined && exec.salary_usd !== null && (
                          <div className="text-right font-mono">
                            <span className="text-[10px] text-stone-400 uppercase font-bold block">
                              {isThai ? 'ค่าตอบแทนต่อปี' : 'Annual Comp'}
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-stone-800">
                              {typeof exec.salary_usd === 'number' ? `$${(exec.salary_usd / 1000000).toFixed(2)}M` : exec.salary_usd}
                            </span>
                          </div>
                        )}
                        <div className="p-1 rounded-lg bg-stone-100 text-stone-500">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </button>

                    {/* Expandable Bio */}
                    {isExpanded && exec.bio && (
                      <div className="px-4 pb-4 pt-1 bg-stone-50/70 border-t border-stone-100 text-xs sm:text-sm text-stone-700 leading-relaxed font-sans">
                        <div className="p-3 bg-white rounded-xl border border-stone-200/80 shadow-xs">
                          <strong className="block text-stone-900 text-xs uppercase font-bold mb-1">
                            {isThai ? 'ประวัติและบทบาทสำคัญ:' : 'Executive Biography:'}
                          </strong>
                          <p>{exec.bio}</p>
                          {exec.updated_date && (
                            <span className="text-[10px] text-stone-400 font-mono block mt-2">
                              {isThai ? 'อัปเดตข้อมูล ณ: ' : 'Updated: '}{exec.updated_date}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 bg-stone-50 rounded-2xl border border-stone-100 text-xs text-stone-500 font-sans">
              {isThai ? `ไม่มีข้อมูลรายชื่อผู้บริหารสำหรับ ${ticker}` : `No executive team information available for ${ticker}.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
