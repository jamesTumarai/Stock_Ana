import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const run = (args: string[]) =>
  spawnSync(process.execPath, ['scripts/firebaseRulesPreflight.mjs', ...args], {
    encoding: 'utf8',
  });

const valid = run(['--project', 'stock-analyze-a89d0']);
assert.equal(valid.status, 0, valid.stderr || valid.stdout);
assert.match(valid.stdout, /Firebase rules preflight passed/);
assert.match(valid.stdout, /stock-analyze-a89d0/);
assert.match(valid.stdout, /\(default\)/);

const missingProject = run([]);
assert.notEqual(missingProject.status, 0, 'preflight must require an explicit project');
assert.match(missingProject.stderr, /explicit --project is required/);

const wrongProject = run(['--project', 'not-production']);
assert.notEqual(wrongProject.status, 0, 'preflight must reject any unexpected project');
assert.match(wrongProject.stderr, /refusing project not-production/);

console.log('Firebase rules deploy preflight checks passed');
