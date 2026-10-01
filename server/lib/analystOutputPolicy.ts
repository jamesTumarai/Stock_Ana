import {extractLastJsonObjectFromText} from './valuationAssumptionBridge';
/** A brace or truncated JSON fragment is never a usable completed report. */
export function hasUsableAnalystReport(text:string,ticker:string):boolean {
 const report=extractLastJsonObjectFromText(text);
 return Boolean(report && (!report.ticker || String(report.ticker).toUpperCase()===ticker.toUpperCase())
   && (report.verdict || report.comprehensive_analysis || report.technical_analysis));
}
export function selectAnalystReport(primary:string,validated:string,ticker:string) {
 const validationCompleted=hasUsableAnalystReport(validated,ticker);
 const text=validationCompleted?validated:hasUsableAnalystReport(primary,ticker)?primary:null;
 if(!text)return null;
 const report=extractLastJsonObjectFromText(text)!;
 return JSON.stringify({...report,generation_review:{status:validationCompleted?'VALIDATOR_COMPLETED':'PRIMARY_ONLY',
   reason:validationCompleted?null:'VALIDATOR_UNAVAILABLE_USING_COMPLETED_PRIMARY_REPORT'}});
}
