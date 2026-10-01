import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveValuationPriceMetrics} from './valuationPriceMetrics';
import {getMetricCalculationDetail} from '../../utils/metricCalculations';

test('price-derived measures and the formula dialog consume one value and denominator convention',()=>{
  const result=resolveValuationPriceMetrics(157.32,123.45);
  assert.equal(result.upsidePct,27.44);
  assert.equal(getMetricCalculationDetail('margin_of_safety',0,undefined,{fairValue:157.32,currentPrice:123.45})!.resultValue,result.marginOfSafetyPct);
  for(const price of [null,undefined,0,-1,NaN,Infinity]) assert.deepEqual(resolveValuationPriceMetrics(157.32,price),{upsidePct:null,marginOfSafetyPct:null});
  assert.equal(resolveValuationPriceMetrics(100,110).upsidePct,-9.09);
});
