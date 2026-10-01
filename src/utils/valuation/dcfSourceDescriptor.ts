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
      detailEn: 'Available revenue, net cash and current shares use verified SEC observations. Missing required inputs remain unavailable.',
      detailTh: 'Revenue, Net Cash และ Current Shares ที่มีข้อมูลใช้ข้อเท็จจริง SEC ที่ตรวจสอบแล้ว ข้อมูลจำเป็นที่ขาดยังคงแสดงว่าไม่พร้อมใช้งาน',
      sourcePeriod: inputs.sourcePeriod,
      financialDataAsOf: inputs.financialDataAsOf,
      sharesAsOf: inputs.sharesAsOf,
    };
  }

  return {
    kind: 'report_snapshot',
    labelEn: 'Report Snapshot Financial Inputs',
    labelTh: 'ข้อมูลการเงินจาก Report Snapshot',
    detailEn: 'The DCF financial source is the report statement snapshot; these inputs are not labeled SEC verified.',
    detailTh: 'แหล่งข้อมูลการเงินของ DCF ยังเป็น Report Snapshot และยังไม่ระบุว่าเป็น SEC Verified',
    sourcePeriod: inputs?.sourcePeriod,
    financialDataAsOf: inputs?.financialDataAsOf,
    sharesAsOf: inputs?.sharesAsOf,
  };
}
