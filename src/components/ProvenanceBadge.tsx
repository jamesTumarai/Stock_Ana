import React from 'react';
import { ShieldCheck, Calculator, Sliders, TrendingUp, Sparkles, AlertCircle } from 'lucide-react';

export type FinancialClassification =
  | 'verified'          // Verified SEC EDGAR XBRL / Filing fact
  | 'calculated'        // Deterministic formula (FCF, margins, net debt, canonical DCF)
  | 'assumption'        // Explicit model input (WACC, terminal growth, forecast CAGR)
  | 'market'            // Market price, 52W range, live volume, market beta
  | 'ai_interpretation' // AI qualitative thesis, moat commentary, management context
  | 'unavailable';      // Explicitly null / unavailable per integrity rules

interface Props {
  classification: FinancialClassification;
  isThai: boolean;
  label?: string;
  detail?: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const CONFIGS: Record<FinancialClassification, {
  labelEn: string;
  labelTh: string;
  detailEn: string;
  detailTh: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  verified: {
    labelEn: 'Verified Fact',
    labelTh: 'ข้อมูลตรวจสอบแล้ว',
    detailEn: 'Independently verified from SEC EDGAR XBRL standard filings.',
    detailTh: 'ตรวจสอบตรงจากข้อมูลงบการเงินทางการของ SEC EDGAR XBRL',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-800',
    icon: ShieldCheck,
  },
  calculated: {
    labelEn: 'Calculated',
    labelTh: 'คำนวณจากสูตรตรง',
    detailEn: 'Deterministic mathematical calculation with zero AI hallucination.',
    detailTh: 'คำนวณด้วยสูตรคณิตศาสตร์ตายตัว (Deterministic) ไม่ผ่านการคาดเดาของ AI',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-200',
    textClass: 'text-sky-800',
    icon: Calculator,
  },
  assumption: {
    labelEn: 'Model Assumption',
    labelTh: 'สมมติฐานแบบจำลอง',
    detailEn: 'Explicit valuation parameter; separated from verified financial facts.',
    detailTh: 'สมมติฐานที่ระบุชัดเจนสำหรับโมเดลประเมินมูลค่า แยกอิสระจากข้อมูลงบจริง',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-800',
    icon: Sliders,
  },
  market: {
    labelEn: 'Market Data',
    labelTh: 'ข้อมูลราคาตลาด',
    detailEn: 'Market trading quote, volume, or historical exchange price action.',
    detailTh: 'ข้อมูลราคาซื้อขาย ปริมาณการซื้อขาย หรือสถิติจากตลาดหลักทรัพย์',
    bgClass: 'bg-stone-100',
    borderClass: 'border-stone-200',
    textClass: 'text-stone-700',
    icon: TrendingUp,
  },
  ai_interpretation: {
    labelEn: 'AI Interpretation',
    labelTh: 'บทวิเคราะห์ AI',
    detailEn: 'Qualitative reasoning and synthesis; does not invent financial numbers.',
    detailTh: 'การวิเคราะห์เชิงคุณภาพและบทวิเคราะห์เชิงสังเคราะห์ของ AI',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    textClass: 'text-purple-800',
    icon: Sparkles,
  },
  unavailable: {
    labelEn: 'Data Unavailable',
    labelTh: 'ไม่มีข้อมูลในงบ',
    detailEn: 'Omitted per strict integrity rules; no fabricated placeholder used.',
    detailTh: 'ไม่มีในรายงานการเงินทางการ คงสถานะว่างตามกฎความถูกต้องทางการเงิน',
    bgClass: 'bg-stone-50',
    borderClass: 'border-stone-200',
    textClass: 'text-stone-500',
    icon: AlertCircle,
  },
};

export function ProvenanceBadge({
  classification,
  isThai,
  label,
  detail,
  size = 'sm',
  className = '',
}: Props) {
  const cfg = CONFIGS[classification];
  const Icon = cfg.icon;
  const displayLabel = label || (isThai ? cfg.labelTh : cfg.labelEn);
  const displayTitle = detail || (isThai ? cfg.detailTh : cfg.detailEn);

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  return (
    <span
      title={displayTitle}
      className={`inline-flex items-center font-medium rounded-lg border font-mono shrink-0 select-none transition-colors ${cfg.bgClass} ${cfg.borderClass} ${cfg.textClass} ${sizeClasses} ${className}`}
    >
      <Icon className={`${iconSizes} shrink-0 opacity-80`} />
      <span>{displayLabel}</span>
    </span>
  );
}
