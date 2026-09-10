import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const agentFiles = fs.readFileSync('server/lib/agentFiles.ts', 'utf8');
const agentRetry = fs.readFileSync('server/lib/agentRetry.ts', 'utf8');

assert.equal(server.includes('function loadAgentFiles('), false, 'agent file loader must not remain inline in server.ts');
assert.equal(server.includes('async function createInteractionWithRetry'), false, 'retry orchestration must not remain inline in server.ts');
assert.ok(server.includes('import { loadAgentFiles } from "./server/lib/agentFiles.ts";'));
assert.ok(server.includes('import { createInteractionWithRetry } from "./server/lib/agentRetry.ts";'));
assert.ok(server.includes('import { streamInteraction } from "./server/lib/agentClient.ts";'));
assert.ok(server.includes('loadAgentFiles(path.join(process.cwd(), "agent"), "/.agents")'));
assert.ok(server.includes('createInteractionWithRetry(res,'), 'Analyze must continue using retry orchestration');

assert.ok(agentFiles.includes('export function loadAgentFiles'));
assert.ok(agentFiles.includes('path.posix.join(basePath, entry.name)'));
assert.ok(agentFiles.includes("fs.readFileSync(fullPath, 'utf-8')"));
assert.ok(agentRetry.includes("const fallbackModel = 'gemini-3.7-flash'"));
assert.ok(agentRetry.includes('const retryBudgetMs = 45_000'));
assert.ok(agentRetry.includes('while (attempt < 4)'));
assert.ok(agentRetry.includes("currentOpts.model === 'gemini-3.8-flash'"));
assert.ok(agentRetry.includes('return await createInteraction(currentOpts)'));

console.log('Analyze support modularization checks passed');
