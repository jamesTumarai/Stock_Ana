import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { streamInteraction } from '../../server/lib/agentClient';

console.log('Running managed-agent SSE stream checks...');

const debugLogPath = path.resolve('debug_delta.log');
if (fs.existsSync(debugLogPath)) fs.unlinkSync(debugLogPath);

const payloads = [
  {
    event_type: 'step.delta',
    delta: {
      name: 'google_search',
      arguments: { query: 'MSFT 10-Q' },
      call_id: 'call_1',
    },
  },
  {
    event_type: 'step.delta',
    delta: {
      result: { ok: true },
      call_id: 'call_1',
    },
  },
];

const sse = payloads.map(payload => `data: ${JSON.stringify(payload)}\n`).join('') + 'data: [DONE]\n';
const response = new Response(sse, {
  status: 200,
  headers: { 'Content-Type': 'text/event-stream' },
});

const events = [];
for await (const event of streamInteraction(response)) events.push(event);

assert.deepEqual(events.map(event => event.type), ['tool_call', 'tool_result', 'done']);
assert.equal(events[0]?.callId, 'call_1');
assert.equal(events[1]?.callId, 'call_1');
assert.equal(events[0]?.name, 'google_search');
assert.deepEqual(events[0]?.arguments, { query: 'MSFT 10-Q' });
assert.equal(events[1]?.result, JSON.stringify({ ok: true }));
assert.equal(fs.existsSync(debugLogPath), false, 'stream parsing must not write debug_delta.log');

console.log('Managed-agent SSE stream checks passed');
