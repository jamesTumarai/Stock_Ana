import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Firestore Rules Security Contract (Blocker J)', () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8');

  it('rejects broad wildcard match /{document=**} under /users/{userId}', () => {
    // Broad catch-all permissions under users collection must be strictly removed
    assert.doesNotMatch(
      rules,
      /match\s+\/\{document=\*\*\}/,
      'firestore.rules must not use broad recursive wildcard under /users/{userId}'
    );
  });

  it('enforces owner-only authentication on /users/{userId}', () => {
    assert.match(
      rules,
      /match\s+\/users\/\{userId\}\s*\{\s*allow\s+read,\s*write:\s*if\s+request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId;/,
      'User root must enforce request.auth.uid == userId'
    );
  });

  it('explicitly defines allowed /theses/{ticker} path with owner check and spoofing guard', () => {
    assert.match(rules, /match\s+\/theses\/\{ticker\}/);
    assert.match(rules, /allow\s+read:\s*if\s+request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId;/);
    // userId spoofing guard: if userId field is provided, it must match request.auth.uid
    assert.match(rules, /request\.resource\.data\.userId\s*==\s*userId/);
  });

  it('enforces append-only immutable semantics on /theses/{ticker}/revisions/{revisionId}', () => {
    assert.match(rules, /match\s+\/revisions\/\{revisionId\}/);
    // create allowed for owner
    assert.match(rules, /allow\s+create:\s*if\s+request\.auth\s*!=\s*null\s*&&\s*request\.auth\.uid\s*==\s*userId/);
    // update denied
    assert.match(rules, /allow\s+update:\s*if\s+false;/, 'thesis revisions must be immutable (no updates)');
    // delete denied
    assert.match(rules, /allow\s+delete:\s*if\s+false;/, 'thesis revisions must be immutable (no deletions)');
  });

  it('explicitly defines allowed /expectations/{expectationId} path with owner-only access and guards immutable target fields on update', () => {
    assert.match(rules, /match\s+\/expectations\/\{expectationId\}/);
    // owner check on update
    assert.match(rules, /resource\.data\.userId\s*==\s*userId/);
    // immutable target fields guard
    assert.match(
      rules,
      /hasAny\(\['userId',\s*'ticker',\s*'expectationId',\s*'targetValue',\s*'targetPeriod',\s*'condition',\s*'origin',\s*'createdAt',\s*'sourceReportId'\]\)/
    );
  });

  it('preserves reports collection immutability and audited soft-delete contract', () => {
    assert.match(rules, /match\s+\/reports\/\{reportId\}/);
    assert.match(rules, /allow\s+delete:\s*if\s+false;/, 'reports must reject hard delete');
    assert.match(rules, /hasOnly\(\['deletedAt',\s*'deletedByUserId',\s*'deletedByVersion'\]\)/);
  });
});
