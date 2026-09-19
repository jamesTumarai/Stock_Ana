import type { DataGapState } from './types.js';

export interface UserFacingExplanation {
  state: DataGapState;
  textEn: string;
  textTh: string;
  badgeLabelEn: string;
  badgeLabelTh: string;
}

export const DATA_GAP_EXPLANATIONS: Record<DataGapState, UserFacingExplanation> = {
  VERIFIED_AVAILABLE: {
    state: 'VERIFIED_AVAILABLE',
    textEn: 'Verified directly from official filing or disclosure documents.',
    textTh: 'ข้อมูลตรวจสอบแล้วจากเอกสารทางการของบริษัทหรือ SEC',
    badgeLabelEn: 'Verified Fact',
    badgeLabelTh: 'ข้อมูลทางการ',
  },
  VERIFIED_DERIVED: {
    state: 'VERIFIED_DERIVED',
    textEn: 'Calculated deterministically from verified financial inputs.',
    textTh: 'คำนวณด้วยสูตรทางคณิตศาสตร์จากงบการเงินที่ตรวจสอบแล้ว',
    badgeLabelEn: 'Verified Derived',
    badgeLabelTh: 'คำนวณจากงบจริง',
  },
  NOT_REPORTED: {
    state: 'NOT_REPORTED',
    textEn: 'Company does not report this metric in official disclosures.',
    textTh: 'บริษัทไม่ได้รายงานตัวชี้วัดนี้ในเอกสารทางการ',
    badgeLabelEn: 'Not Reported',
    badgeLabelTh: 'ไม่ได้รายงาน',
  },
  NOT_APPLICABLE: {
    state: 'NOT_APPLICABLE',
    textEn: 'Metric is not applicable to this industry or business model.',
    textTh: 'ไม่เหมาะกับโครงสร้างธุรกิจหรือประเภทอุตสาหกรรมนี้',
    badgeLabelEn: 'Not Applicable',
    badgeLabelTh: 'ไม่เกี่ยวข้อง',
  },
  NOT_FOUND_YET: {
    state: 'NOT_FOUND_YET',
    textEn: 'No verified data found in official public filings yet.',
    textTh: 'ยังไม่พบข้อมูลที่ตรวจสอบได้ในเอกสารทางการ',
    badgeLabelEn: 'Not Found',
    badgeLabelTh: 'ยังไม่พบข้อมูล',
  },
  EXTRACTION_GAP: {
    state: 'EXTRACTION_GAP',
    textEn: 'Disclosed in official filings but standard XBRL extraction could not map it.',
    textTh: 'มีข้อมูลในเอกสารทางการแต่ระบบยังไม่ได้ดึงเข้าสู่ฐานข้อมูล',
    badgeLabelEn: 'Extraction Gap',
    badgeLabelTh: 'รอการสกัดข้อมูล',
  },
  FOUND_UNVERIFIED: {
    state: 'FOUND_UNVERIFIED',
    textEn: 'Observed in secondary aggregators but not yet verified from official filings.',
    textTh: 'พบข้อมูลในแหล่งทุติยภูมิแต่ยังไม่สามารถยืนยันจากเอกสารทางการได้',
    badgeLabelEn: 'Unverified',
    badgeLabelTh: 'ยังไม่ยืนยัน',
  },
  SOURCE_CONFLICT: {
    state: 'SOURCE_CONFLICT',
    textEn: 'Conflicting values reported across official sources; failed closed for safety.',
    textTh: 'ข้อมูลจากแหล่งทางการหลายแห่งไม่ตรงกัน ปิดการแสดงผลเพื่อความถูกต้อง',
    badgeLabelEn: 'Source Conflict',
    badgeLabelTh: 'ข้อมูลขัดแย้ง',
  },
  INSUFFICIENT_PERIOD_DATA: {
    state: 'INSUFFICIENT_PERIOD_DATA',
    textEn: 'Insufficient verified data across the selected time periods.',
    textTh: 'ข้อมูลไม่ครบทุกงวดเวลาที่ต้องการสำหรับการคำนวณหรือแสดงแนวโน้ม',
    badgeLabelEn: 'Partial Data',
    badgeLabelTh: 'ข้อมูลไม่ครบงวด',
  },
};

/**
 * Returns a human-readable explanation for a data gap state.
 */
export function getDataGapExplanation(
  state: DataGapState,
  isThai: boolean = true
): {
  text: string;
  badgeLabel: string;
  th: string;
  en: string;
  badgeTh: string;
  badgeEn: string;
} {
  const item = DATA_GAP_EXPLANATIONS[state] || DATA_GAP_EXPLANATIONS.NOT_FOUND_YET;
  return {
    text: isThai ? item.textTh : item.textEn,
    badgeLabel: isThai ? item.badgeLabelTh : item.badgeLabelEn,
    th: item.textTh,
    en: item.textEn,
    badgeTh: item.badgeLabelTh,
    badgeEn: item.badgeLabelEn,
  };
}
