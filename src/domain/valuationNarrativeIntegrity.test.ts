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

test('all current narrative consumers use the same TTM flow and distinguish missing net cash from cash',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  snapshot.growth.revenueTtm=384687;
  snapshot.balanceSheet.netCashOrDebt=null;
  const claim='รายได้รอบ TTM 383,929 ล้านดอลลาร์; สถานะเงินสดสุทธิ (Net Cash) สูงถึง 236,915 ล้านดอลลาร์';
  const current:any={verdict:{summary:claim,key_takeaways:[claim]},
    comprehensive_analysis:{financial_overview:claim,fundamentals_check:claim,beginner_summary:{top_3_strengths:['สถานะเงินสดสุทธิกว่า 2.36 แสนล้านดอลลาร์']},
      previous_snapshot:{financial_overview:claim},sources:[claim]},five_pillars:{solvency:{analysis:claim}},final_report:claim};
  const originalHistory=structuredClone(current.comprehensive_analysis.previous_snapshot);
  reconcileCurrentValuationProse(current,snapshot);
  for(const prose of [current.verdict.summary,...current.verdict.key_takeaways,current.comprehensive_analysis.financial_overview,
    current.comprehensive_analysis.fundamentals_check,current.five_pillars.solvency.analysis,current.final_report]){
    assert.match(prose,/384,687/);assert.doesNotMatch(prose,/383,929|236,915/);assert.match(prose,/ยังไม่มีข้อมูล canonical/);
  }
  assert.doesNotMatch(current.comprehensive_analysis.beginner_summary.top_3_strengths[0],/2\.36/);
  assert.deepEqual(current.comprehensive_analysis.previous_snapshot,originalHistory);
  assert.deepEqual(current.comprehensive_analysis.sources,[claim]);
  const first=JSON.stringify(current);reconcileCurrentValuationProse(current,snapshot);assert.equal(JSON.stringify(current),first);
});

test('current flow reconciliation preserves attributed, historical and projected monetary observations',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  snapshot.growth.revenueTtm=2000;snapshot.balanceSheet.netCashOrDebt=1000;
  const claims=['Historical Net Cash $9 billion','FY2025 TTM Revenue $8 billion','Expected TTM Revenue $8 billion',
    'TTM Revenue is projected at $8 billion','Peer Net Cash $9 billion','Morningstar Net Cash $9 billion','อดีตมีสถานะเงินสดสุทธิ 9,000 ล้านดอลลาร์'];
  const current:any={comprehensive_analysis:{financial_overview:claims.join('\n')}};
  reconcileCurrentValuationProse(current,snapshot);
  assert.equal(current.comprehensive_analysis.financial_overview,claims.join('\n'));
});

test('large Thai monetary units are display conversions of the canonical net-cash value',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');snapshot.balanceSheet.netCashOrDebt=200000;
  const current:any={comprehensive_analysis:{financial_overview:'สถานะเงินสดสุทธิ 2.36 แสนล้านดอลลาร์; Net Cash $236.915 billion'}};
  reconcileCurrentValuationProse(current,snapshot);
  assert.match(current.comprehensive_analysis.financial_overview,/สถานะเงินสดสุทธิ 2 แสนล้านดอลลาร์/);
  assert.match(current.comprehensive_analysis.financial_overview,/Net Cash \$200 billion/);
});

test('current debt/liquidity ratios reject unsupported prose and preserve actual zero and historical ratios',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  snapshot.balanceSheet.debtToEquity=null;snapshot.balanceSheet.currentRatio=2;
  const current:any={comprehensive_analysis:{fundamentals_check:'อัตราส่วนหนี้สินต่อทุน (D/E) เพียง 0.17 เท่า; Current Ratio 9x\nHistorical D/E 0.17x'}};
  reconcileCurrentValuationProse(current,snapshot);
  assert.match(current.comprehensive_analysis.fundamentals_check,/ยังไม่มีข้อมูล canonical/);
  assert.doesNotMatch(current.comprehensive_analysis.fundamentals_check.split('\n')[0],/0\.17/);
  assert.match(current.comprehensive_analysis.fundamentals_check,/Current Ratio 2 x/);
  assert.match(current.comprehensive_analysis.fundamentals_check,/Historical D\/E 0\.17x/);
  snapshot.balanceSheet.debtToEquity=0;
  const zero:any={comprehensive_analysis:{fundamentals_check:'D/E 0.17x'}};
  reconcileCurrentValuationProse(zero,snapshot);assert.equal(zero.comprehensive_analysis.fundamentals_check,'D/E 0 x');
});

test('financial current-ratio prose is not-applicable rather than a fabricated liquidity multiple',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot({...report,company_profile:{sector:'Financial Services',industry:'Banks'}},'UNSEEN');
  const current:any={comprehensive_analysis:{fundamentals_check:'Current Ratio 9x'}};
  reconcileCurrentValuationProse(current,snapshot);
  assert.match(current.comprehensive_analysis.fundamentals_check,/not applicable/);
  assert.doesNotMatch(current.comprehensive_analysis.fundamentals_check,/9x/);
});

test('unstructured model-average per-share ranges use the selected canonical base across current prose',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot({...report,company_profile:{sector:'Financial Services',industry:'Banks'},
    intrinsic_value:{canonical_run:{primaryMethod:'RESIDUAL_INCOME',status:'AVAILABLE',baseFairValue:330.97,missingInputs:[]}}},'UNSEEN');
  const claim='การประเมินมูลค่าตามแบบจำลอง Residual Income และ DDM ให้มูลค่าเหมาะสมเฉลี่ย 345.50 - 352.00 ดอลลาร์ต่อหุ้น';
  assert.equal(extractBaseValuationMentionedValue(claim),345.5);
  const current:any={verdict:{summary:claim,key_takeaways:[claim]},comprehensive_analysis:{financial_overview:claim},final_report:claim};
  reconcileCurrentValuationProse(current,snapshot);
  for(const text of [current.verdict.summary,...current.verdict.key_takeaways,current.comprehensive_analysis.financial_overview,current.final_report]){
    assert.match(text,/330\.97/);assert.doesNotMatch(text,/345\.50|352\.00|เฉลี่ย/);
  }
  const first=JSON.stringify(current);reconcileCurrentValuationProse(current,snapshot);assert.equal(JSON.stringify(current),first);
});

test('method before English Base Case with Thai linker and approximate MoS consumes canonical truth',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  const claim='ส่งผลให้มูลค่าพื้นฐานตามแบบจำลอง DCF Base Case ที่ $425.00 มี Margin of Safety เพียงราว 14.7%';
  assert.equal(extractBaseValuationMentionedValue(claim),425);
  const fixed=reconcileBaseValuationNarrative(claim,snapshot);
  assert.match(fixed,/148\.00/);assert.match(fixed,/48\.00%/);assert.doesNotMatch(fixed,/425\.00|14\.7%/);
  const current:any={...report,verdict:{summary:claim,key_takeaways:[claim]},comprehensive_analysis:{financial_overview:claim},canonical_executive_snapshot:snapshot};
  reconcileCurrentValuationProse(current,snapshot);
  assert.equal(validateSection1Integrity(current,'UNSEEN').issues.filter(issue=>/base valuation|Margin of Safety|Base Case/.test(issue)).length,0);
  const attributed='Morningstar '+claim;
  assert.equal(reconcileBaseValuationNarrative(attributed,snapshot),attributed);
});

test('explicit per-share ranges use canonical scenarios while external quotes and aggregate transactions remain separate',()=>{
  const snapshot=buildCanonicalExecutiveSnapshot(report,'UNSEEN');
  snapshot.canonicalValuation!.bearFairValue=120;snapshot.canonicalValuation!.bullFairValue=200;
  const fixed=reconcileBaseValuationNarrative('Fair value range $10–$20 per share',snapshot,false);
  assert.match(fixed,/\$120\.00–\$200\.00/);
  for(const source of ['Morningstar fair value $180 per share','Historical fair value $180 per share','ซื้อกิจการมูลค่า 2,000 ล้านดอลลาร์'])
    assert.equal(reconcileBaseValuationNarrative(source,snapshot,false),source);
  const mixed='Fair value $10 per share. Morningstar มูลค่า DCF กรณีฐานที่ $180.00';
  assert.match(reconcileBaseValuationNarrative(mixed,snapshot,false),/Morningstar มูลค่า DCF กรณีฐานที่ \$180\.00/);
  snapshot.canonicalValuation!.baseFairValue=null;snapshot.valuation.fairValue=null;
  assert.doesNotMatch(reconcileBaseValuationNarrative('Fair value range $10–$20 per share',snapshot,false),/120|200/);
});
