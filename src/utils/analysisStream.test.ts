import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AnalysisStreamDecoder } from './analysisStream';

test('analysis transport retains terminal provider errors and split UTF-8/CRLF frames', () => {
  const stream = new AnalysisStreamDecoder();
  const input = new TextEncoder().encode(': keepalive\r\n\r\ndata:{"type":"thinking","text":"กำลังตรวจ"}\r\n\r\ndata: {"type":"error","message":"Provider quota exceeded"}');
  const events = [];
  for (let i = 0; i < input.length; i += 3) events.push(...stream.push(input.slice(i, i + 3)));
  events.push(...stream.finish());
  assert.deepEqual(events, [
    { type: 'thinking', text: 'กำลังตรวจ' },
    { type: 'error', message: 'Provider quota exceeded' },
  ]);
});

test('transport ignores comments/malformed frames and does not duplicate text at EOF', () => {
  const stream = new AnalysisStreamDecoder();
  const events = stream.push(new TextEncoder().encode(': comment\n\ndata: malformed\n\ndata: {"type":"text","text":"complete"}\n\ndata: [DONE]\n\n'));
  assert.deepEqual(events, [{ type: 'text', text: 'complete' }]);
  assert.deepEqual(stream.finish(), []);
});
