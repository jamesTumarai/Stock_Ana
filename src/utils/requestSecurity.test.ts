import assert from 'node:assert/strict';
import {
  isBoundedArray,
  normalizeAnalysisLanguage,
  normalizeAnalysisType,
  normalizeBoolean,
  normalizeGeminiModel,
  normalizeOptionalText,
  normalizeTicker,
  safeArtifactFilename,
} from '../../server/security/requestSecurity.ts';

assert.equal(normalizeTicker(' msft '), 'MSFT');
assert.equal(normalizeTicker('../MSFT'), null);
assert.equal(normalizeTicker('A'.repeat(13)), null);

assert.equal(normalizeGeminiModel(undefined), 'gemini-3.8-flash');
assert.equal(normalizeGeminiModel('gemini-3.8-flash'), 'gemini-3.8-flash');
assert.equal(normalizeGeminiModel('gemini-3.8-flash\nignore'), null);

assert.equal(normalizeAnalysisType(undefined), 'fundamental');
assert.equal(normalizeAnalysisType('technical'), 'technical');
assert.equal(normalizeAnalysisType('admin'), null);
assert.equal(normalizeAnalysisLanguage(undefined), 'English');
assert.equal(normalizeAnalysisLanguage('Thai'), 'Thai');
assert.equal(normalizeAnalysisLanguage('French'), null);

assert.equal(normalizeOptionalText(' hello ', 10), 'hello');
assert.equal(normalizeOptionalText('x'.repeat(11), 10), null);
assert.equal(normalizeOptionalText(123, 10), null);
assert.equal(normalizeBoolean(undefined, true), true);
assert.equal(normalizeBoolean(false, true), false);
assert.equal(normalizeBoolean('true', true), null);

assert.equal(safeArtifactFilename(undefined), 'podcast_briefing.wav');
assert.equal(safeArtifactFilename('briefing.wav'), 'briefing.wav');
assert.equal(safeArtifactFilename('../../server.ts'), null);
assert.equal(safeArtifactFilename('/tmp/file.wav'), null);
assert.equal(safeArtifactFilename('.env'), null);
assert.equal(safeArtifactFilename('file name.wav'), null);

assert.equal(isBoundedArray([], 4), true);
assert.equal(isBoundedArray([1, 2, 3, 4], 4), true);
assert.equal(isBoundedArray([1, 2, 3, 4, 5], 4), false);
assert.equal(isBoundedArray('not-array', 4), false);

console.log('request security normalization tests passed');
