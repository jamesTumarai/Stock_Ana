#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const rootDir = resolve(process.cwd());

function findTestFiles(dir, fileList = []) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findTestFiles(fullPath, fileList);
      } else if (stat.isFile() && (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx'))) {
        fileList.push(fullPath);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return fileList;
}

// Discover tests across src and server (and root if any)
const srcTests = findTestFiles(join(rootDir, 'src'));
const serverTests = findTestFiles(join(rootDir, 'server'));
const allTestFiles = [...srcTests, ...serverTests].sort();

console.log(`Discovered ${allTestFiles.length} test files across repository:`);
console.log(`  - src/:    ${srcTests.length} test files`);
console.log(`  - server/: ${serverTests.length} test files`);
console.log('');

// Mandatory proof check for server security suites
const requiredServerTests = [
  join('server', 'routes', '__tests__', 'fileSecurity.test.ts'),
  join('server', 'routes', '__tests__', 'healthRoutes.test.ts'),
];

for (const reqTest of requiredServerTests) {
  const found = allTestFiles.some(f => f.endsWith(reqTest) || f.replace(/\\/g, '/').endsWith(reqTest.replace(/\\/g, '/')));
  if (!found) {
    console.error(`FATAL: Mandatory server security test not found in test discovery: ${reqTest}`);
    process.exit(1);
  }
}

let totalFilesPassed = 0;
let totalFilesFailed = 0;
let totalTestCasesPassed = 0;
let totalTestCasesFailed = 0;
let totalTestCasesSkipped = 0;

const serverTestProof = [];
const failedFileOutputs = [];

const startTime = Date.now();

for (let i = 0; i < allTestFiles.length; i++) {
  const absPath = allTestFiles[i];
  const relPath = relative(rootDir, absPath).replace(/\\/g, '/');

  // Group log format for GitHub Actions
  console.log(`::group::[${i + 1}/${allTestFiles.length}] ${relPath}`);

  const result = spawnSync(process.execPath, ['--import', 'tsx', absPath], {
    cwd: rootDir,
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
  });

  const output = (result.stdout || '') + (result.stderr || '');
  console.log(output);
  console.log('::endgroup::');

  // Parse node:test output
  // Format typically contains:
  // ℹ tests X
  // ℹ pass Y
  // ℹ fail Z
  let fileCasesPassed = 0;
  let fileCasesFailed = 0;
  let fileCasesSkipped = 0;

  const passMatch = output.match(/ℹ\s+pass\s+(\d+)/);
  const failMatch = output.match(/ℹ\s+fail\s+(\d+)/);
  const skipMatch = output.match(/ℹ\s+skipped\s+(\d+)/);

  if (passMatch) {
    fileCasesPassed = parseInt(passMatch[1], 10);
    totalTestCasesPassed += fileCasesPassed;
  }
  if (failMatch) {
    fileCasesFailed = parseInt(failMatch[1], 10);
    totalTestCasesFailed += fileCasesFailed;
  }
  if (skipMatch) {
    fileCasesSkipped = parseInt(skipMatch[1], 10);
    totalTestCasesSkipped += fileCasesSkipped;
  }

  // If node:test summary line was absent (e.g. file used custom asserts and exited 0)
  if (!passMatch && result.status === 0) {
    fileCasesPassed = 1; // Count as 1 passing test file suite
    totalTestCasesPassed += 1;
  }

  if (result.status === 0 && fileCasesFailed === 0) {
    totalFilesPassed++;
    if (relPath.startsWith('server/')) {
      serverTestProof.push({
        file: relPath,
        passed: fileCasesPassed,
        status: 'PASSED',
      });
    }
  } else {
    totalFilesFailed++;
    if (fileCasesFailed === 0) totalTestCasesFailed += 1;
    failedFileOutputs.push({ file: relPath, output, exitCode: result.status });
    if (relPath.startsWith('server/')) {
      serverTestProof.push({
        file: relPath,
        passed: fileCasesPassed,
        status: 'FAILED',
      });
    }
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('\n======================================================');
console.log('LUMINA REGRESSION TEST GATE SUMMARY');
console.log('======================================================');
console.log(`Test Execution Duration: ${duration}s`);
console.log('');
console.log('Test Files:');
console.log(`  Total Executed: ${allTestFiles.length}`);
console.log(`  src/ Files:     ${srcTests.length}`);
console.log(`  server/ Files:  ${serverTests.length}`);
console.log(`  Files Passed:   ${totalFilesPassed}`);
console.log(`  Files Failed:   ${totalFilesFailed}`);
console.log('');
console.log('Test Cases (from test runners):');
console.log(`  Cases Passed:   ${totalTestCasesPassed}`);
console.log(`  Cases Failed:   ${totalTestCasesFailed}`);
console.log(`  Cases Skipped:  ${totalTestCasesSkipped}`);
console.log('');
console.log('Server Security Test Proof:');
for (const proof of serverTestProof) {
  console.log(`  [${proof.status}] ${proof.file} — ${proof.passed} test case(s) executed`);
}
console.log('======================================================\n');

if (totalFilesFailed > 0 || totalTestCasesFailed > 0) {
  console.error(`REGRESSION GATE FAILED: ${totalFilesFailed} file(s) failed, ${totalTestCasesFailed} case(s) failed.`);
  for (const failed of failedFileOutputs) {
    console.error(`\n--- Failure in ${failed.file} (exit code ${failed.exitCode}) ---`);
    console.error(failed.output);
  }
  process.exit(1);
} else {
  console.log('REGRESSION GATE PASSED: All test files and cases succeeded.');
  process.exit(0);
}
