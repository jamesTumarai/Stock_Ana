import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildCanonicalExecutiveSnapshot,reconcileBaseValuationNarrative,reconcileCurrentValuationProse,extractBaseValuationMentionedValue,validateSection1Integrity} from './canonicalExecutiveSnapshot';

const report:any={ticker:'UNSEEN',company_profile:{sector:'Technology',industry:'Software'},
  market_snapshot:{ticker:'UNSEEN',price:100,provider:'Test',dataKind:'market_quote'},
  intrinsic_value:{current_price:100,canonical_run:{primaryMethod:'FCFF_DCF',status:'AVAILABLE',baseFairValue:148,currentPrice:100,marginOfSafetyPct:48,missingInputs:[]},
    summary:{base_case_fair_value:148,margin_of_safety_pct:48}}};

test('Thai method-in-the-middle and parenthesized MoS claims use the finalized run',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  const raw='ปี FY2026 WACC 9.5% ส่วนต่างความปลอดภัย (Margin of Safety) สูงถึง 27.29% เทียบกับมูลค่า DCF กรณีฐานที่ $12.30';
  assert.equal(extractBaseValuationMentionedValue(raw),12.30);
  assert.ok(validateSection1Integrity({...report,canonical_executive_snapshot:snapshot,verdict:{summary:raw,key_takeaways:[]}},'UNSEEN').issues.some(issue=>/Margin of Safety|base valuation/.test(issue)));
  const prose=reconcileBaseValuationNarrative(raw,snapshot);
  assert.match(prose,/\$148\.00/);assert.match(prose,/48\.00%/);
  assert.match(prose,/FY2026 WACC 9\.5%/);assert.doesNotMatch(prose,/12\.30|27\.29/);
  assert.equal(validateSection1Integrity({...report,canonical_executive_snapshot:snapshot,verdict:{summary:prose,key_takeaways:[]}},'UNSEEN').issues.filter(issue=>/Margin of Safety|base valuation/.test(issue)).length,0);
});

test('actual report grammar with Thai suitable-value and bilingual parenthesized Base Case is canonical in every section',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  const text='การประเมินมูลค่าหุ้นด้วยวิธี DCF แบบอนุรักษนิยมชี้มูลค่าเหมาะสมในกรณีฐาน (Base Case) อยู่ที่ $285.00 ซึ่งมี Margin of Safety สูงถึง 172.40%';
  assert.equal(extractBaseValuationMentionedValue(text),285);
  const fixed=reconcileBaseValuationNarrative(text,snapshot);
  assert.match(fixed,/\$148\.00/);assert.match(fixed,/48\.00%/);assert.doesNotMatch(fixed,/285\.00|172\.40/);
  const source='Morningstar มูลค่าเหมาะสมในกรณีฐาน (Base Case) อยู่ที่ $285.00';
  assert.equal(reconcileBaseValuationNarrative(source,snapshot),source);
});
test('explicit external targets and their MoS remain attributed rather than becoming Lumina values',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  const external='GuruFocus มูลค่า DCF กรณีฐานที่ $180.00 และ Margin of Safety อยู่ที่ 80.00%';
  assert.equal(reconcileBaseValuationNarrative(external,snapshot),external);
});
test('unavailable valuation removes current prose claims instead of resurrecting model values',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot({...report,intrinsic_value:{canonical_run:{primaryMethod:'UNAVAILABLE',status:'INSUFFICIENT_VERIFIED_DATA',baseFairValue:null,marginOfSafetyPct:null,missingInputs:[]}}},'UNSEEN');
  const prose=reconcileBaseValuationNarrative('มูลค่า DCF กรณีฐานที่ $12.30 ส่วนเผื่อความปลอดภัย (MoS) อยู่ที่ 27.29%',snapshot);
  assert.doesNotMatch(prose,/12\.30|27\.29/);assert.match(prose,/ยังประเมินมูลค่าพื้นฐานไม่ได้/);
});

test('all monetary grammars preserve externally attributed fair values and ignore fiscal years',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  for (const prose of ['Morningstar Fair Value: $180.00','GuruFocus DCF base case = $180.00',
    'ฉันทามตินักวิเคราะห์ มูลค่าพื้นฐาน DCF อยู่ที่ 180.00 ดอลลาร์']) {
    assert.equal(reconcileBaseValuationNarrative(prose,snapshot),prose);
    assert.equal(extractBaseValuationMentionedValue(prose),null);
    const unavailable=buildCanonicalExecutiveSnapshot({...report,intrinsic_value:{canonical_run:{primaryMethod:'UNAVAILABLE',status:'INSUFFICIENT_VERIFIED_DATA',baseFairValue:null,missingInputs:[]}}},'UNSEEN');
    assert.equal(reconcileBaseValuationNarrative(prose,unavailable),prose);
  }
  for (const prose of ['DCF 2026 assumptions use a 10-year horizon','DCF FY2026 has WACC 9.5%',
    'The Fair Value framework assumes FY2026 revenue growth of 12%']) {
    assert.equal(extractBaseValuationMentionedValue(prose),null);
    assert.equal(reconcileBaseValuationNarrative(prose,snapshot),prose);
  }
});

test('Thai method-in-the-middle uses the selected sector method rather than manufacturing a DCF label',()=>{
  const bank=buildCanonicalExecutiveSnapshot({...report,company_profile:{sector:'Financial Services',industry:'Banks'},
    intrinsic_value:{canonical_run:{primaryMethod:'RESIDUAL_INCOME',status:'AVAILABLE',baseFairValue:148,marginOfSafetyPct:48,missingInputs:[]}}},'UNSEEN');
  const prose=reconcileBaseValuationNarrative('มูลค่า DCF กรณีฐานที่ $12.30',bank);
  assert.match(prose,/148\.00/);
  assert.doesNotMatch(prose,/DCF/);
});

test('transaction and aggregate monetary amounts are never rewritten as a per-share fair value',()=>{
  const raw='ผลการดำเนินงานมีแรงหนุนจากกำไรพิเศษหลังภาษีจากการแปลงหุ้น Class B-2 มูลค่า 2,000 ล้านดอลลาร์สหรัฐ ซื้อกิจการมูลค่า $5,000 ล้าน และสินทรัพย์มูลค่า 100 ดอลลาร์';
  for (const primaryMethod of ['FCFF_DCF','RESIDUAL_INCOME','UNAVAILABLE']) {
    const snapshot=buildCanonicalExecutiveSnapshot({...report,intrinsic_value:{canonical_run:{
      primaryMethod,status:primaryMethod==='UNAVAILABLE'?'INSUFFICIENT_VERIFIED_DATA':'AVAILABLE',
      baseFairValue:primaryMethod==='UNAVAILABLE'?null:148,missingInputs:[],
    }}},'UNSEEN');
    assert.equal(extractBaseValuationMentionedValue(raw),null);
    assert.equal(reconcileBaseValuationNarrative(raw,snapshot),raw);
  }
});

test('current ratio prose uses the canonical TTM value while historical/forecast/peer claims and History remain immutable',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  snapshot.profitability={...snapshot.profitability,roe:7.09,roic:null,period:'Q2 2026'};
  const current:any={verdict:{summary:'ROE อยู่ที่ 6.1%',key_takeaways:['ROIC: 15%']},
    comprehensive_analysis:{fundamentals_check:'ROIC / ROE: อัตราผลตอบแทน (ROE) ปรับตัวขึ้นสู่ระดับ 6.1%',
      historical:'ROE 6.1%',previous_snapshot:'ROIC 15%'},
    final_report:'FY2025 ROE 6.1%\nExpected ROE 20%\nPeer ROE 12%'};
  const saved=JSON.stringify(current.comprehensive_analysis.historical);
  reconcileCurrentValuationProse(current,snapshot);
  assert.match(current.verdict.summary,/7\.09%/);
  assert.doesNotMatch(current.verdict.key_takeaways[0],/15%/);
  assert.match(current.comprehensive_analysis.fundamentals_check,/7\.09%/);
  assert.equal(JSON.stringify(current.comprehensive_analysis.historical),saved);
  assert.equal(current.final_report,'FY2025 ROE 6.1%\nExpected ROE 20%\nPeer ROE 12%');
  assert.equal(current.current_narrative_audit.length,2);
  const first=JSON.stringify(current);reconcileCurrentValuationProse(current,snapshot);assert.equal(JSON.stringify(current),first);
});
