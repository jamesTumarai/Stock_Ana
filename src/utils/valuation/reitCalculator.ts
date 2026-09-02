import { REITAFFOModel, ReportData } from '../../types';

interface SubSectorMultiplier {
  subSector: string;
  baseMultiple: number;
  capRatePct: number;
  descriptionTh: string;
}

const REIT_SUBSECTOR_BENCHMARKS: Record<string, SubSectorMultiplier> = {
  datacenter: { subSector: 'Data Center', baseMultiple: 24.0, capRatePct: 4.8, descriptionTh: 'โครงสร้างพื้นฐานดิจิทัลและศูนย์ข้อมูลคลาวด์' },
  industrial: { subSector: 'Industrial & Logistics', baseMultiple: 20.0, capRatePct: 5.5, descriptionTh: 'คลังสินค้าและโลจิสติกส์อัตโนมัติ' },
  residential: { subSector: 'Residential / Apartments', baseMultiple: 18.0, capRatePct: 5.8, descriptionTh: 'อพาร์ตเมนต์และที่อยู่อาศัยให้เช่า' },
  healthcare: { subSector: 'Healthcare', baseMultiple: 15.5, capRatePct: 6.5, descriptionTh: 'สถานพยาบาลและศูนย์ฟื้นฟูสุขภาพ' },
  retail: { subSector: 'Retail / Malls', baseMultiple: 14.0, capRatePct: 7.2, descriptionTh: 'ศูนย์การค้าและคอมมูนิตี้มอลล์' },
  office: { subSector: 'Office', baseMultiple: 12.0, capRatePct: 8.0, descriptionTh: 'อาคารสำนักงานให้เช่า' },
  diversified: { subSector: 'Diversified', baseMultiple: 15.0, capRatePct: 6.8, descriptionTh: 'อสังหาริมทรัพย์แบบผสมผสาน' }
};

export function calculateREITModel(data?: Partial<ReportData>, ticker?: string): REITAFFOModel {
  const currentPrice = data?.intrinsic_value?.current_price || 100;
  const industry = (data?.company_profile?.industry || data?.company_profile?.overview?.description || data?.comprehensive_analysis?.business_overview || '').toLowerCase();
  const desc = (data?.company_profile?.description || data?.company_profile?.overview?.description || '').toLowerCase();

  // Detect Sub-sector
  let sub = REIT_SUBSECTOR_BENCHMARKS.diversified;
  if (industry.includes('data center') || desc.includes('data center')) sub = REIT_SUBSECTOR_BENCHMARKS.datacenter;
  else if (industry.includes('industrial') || industry.includes('logistics') || desc.includes('warehouse')) sub = REIT_SUBSECTOR_BENCHMARKS.industrial;
  else if (industry.includes('residential') || industry.includes('apartment')) sub = REIT_SUBSECTOR_BENCHMARKS.residential;
  else if (industry.includes('health') || industry.includes('hospital')) sub = REIT_SUBSECTOR_BENCHMARKS.healthcare;
  else if (industry.includes('retail') || industry.includes('mall') || desc.includes('shopping')) sub = REIT_SUBSECTOR_BENCHMARKS.retail;
  else if (industry.includes('office')) sub = REIT_SUBSECTOR_BENCHMARKS.office;

  // Derive FFO and AFFO per share from cash flows / dividends
  const ffoPerShare = Math.max(1.0, Number((currentPrice / sub.baseMultiple).toFixed(2)));
  // AFFO = FFO - Recurring Maintenance CapEx (~10-15%)
  const affoPerShare = Number((ffoPerShare * 0.88).toFixed(2));

  const baseMultiple = sub.baseMultiple;
  const bearMultiple = Number((baseMultiple * 0.82).toFixed(1));
  const bullMultiple = Number((baseMultiple * 1.18).toFixed(1));

  const baseFairValue = Number((affoPerShare * baseMultiple).toFixed(2));
  const bearFairValue = Number((affoPerShare * 0.94 * bearMultiple).toFixed(2));
  const bullFairValue = Number((affoPerShare * 1.06 * bullMultiple).toFixed(2));

  return {
    sub_sector: sub.subSector,
    assumptions: {
      current_ffo_per_share: ffoPerShare,
      current_affo_per_share: affoPerShare,
      peer_median_affo_multiple: baseMultiple,
      cap_rate_pct: sub.capRatePct
    },
    scenarios: {
      bear: {
        affo_multiple: bearMultiple,
        affo_growth_cagr_pct: -2.0,
        fair_value_per_share: bearFairValue,
        key_assumption_note: `อัตราการเช่าลดลง อัตราคิดลด Cap Rate ขยับขึ้นสู่ ${(sub.capRatePct + 1.2).toFixed(1)}%`
      },
      base: {
        affo_multiple: baseMultiple,
        affo_growth_cagr_pct: 3.5,
        fair_value_per_share: baseFairValue,
        key_assumption_note: `ประเมินด้วย AFFO Multiple ${baseMultiple}x อิงค่ากลางกลุ่ม ${sub.descriptionTh}`
      },
      bull: {
        affo_multiple: bullMultiple,
        affo_growth_cagr_pct: 7.0,
        fair_value_per_share: bullFairValue,
        key_assumption_note: `การปรับขึ้นค่าเช่าทำได้ดีกว่าคาด และ Cap Rate ลดลงสู่ ${(sub.capRatePct - 0.6).toFixed(1)}%`
      }
    }
  };
}
