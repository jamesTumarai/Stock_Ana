import type { DCFModel } from '../../types';

export interface DcfSourceDescriptor {
  kind: 'sec_verified' | 'report_snapshot';
  labelEn: string;
  labelTh: string;
  detailEn: string;
  detailTh: string;
  sourcePeriod?: string;
  financialDataAsOf?: string;
  sharesAsOf?: string;
}

/**
 * Presentation-only description of the financial source used by the deterministic DCF engine.
 * This never upgrades an unknown/report source to SEC verified and never infers missing dates.
 */
export function describeDcfFinancialSource(inputs?: DCFModel['inputs']): DcfSourceDescriptor {
  if (inputs?.financialDataSource === 'sec_verified') {
    return {
      kind: 'sec_verified',
      labelEn: 'SEC Verified Financial Inputs',
      labelTh: 'ข้อมูลการเงิน DCF ตรวจสอบจาก SEC',
      detailEn: 'Revenue, net cash and current shares come from the runtime-validated SEC financial input set.',
      detailTh: 'Revenue, Net Cash และ Current Shares ที่ใช้ใน DCF มาจากชุดข้อมูล SEC ที่ผ่านการตรวจสอบของระบบ',
      sourcePeriod: inputs.sourcePeriod,
      financialDataAsOf: inputs.financialDataAsOf,
      sharesAsOf: inputs.sharesAsOf,
    };
  }

  return {
    kind: 'report_snapshot',
    labelEn: 'Report Snapshot Financial Inputs',
    labelTh: 'ข้อมูลการเงินจาก Report Snapshot',
    detailEn: 'DCF uses the validated report statement snapshot; these financial inputs are not labeled SEC verified.',
    detailTh: 'DCF ใช้ข้อมูลงบจาก Report Snapshot ที่ผ่าน validation แต่ยังไม่ระบุว่าเป็น SEC Verified',
    sourcePeriod: inputs?.sourcePeriod,
    financialDataAsOf: inputs?.financialDataAsOf,
    sharesAsOf: inputs?.sharesAsOf,
  };
}
