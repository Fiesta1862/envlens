import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEnv, diffEnv } from '../analyzer.js';
import { parseEnv } from '../parser.js';

test('check reports missing, empty, and extra variables', () => {
  const template = parseEnv('API_KEY=\nPORT=3000\nDEBUG=false\n', '.env.example');
  const target = parseEnv('API_KEY=abc\nPORT=\nEXTRA=1\n', '.env');

  const report = checkEnv(template, target);

  assert.equal(report.errors, 1);
  assert.equal(report.warnings, 2);
  assert.equal(report.failed, true);
  assert.deepEqual(
    report.issues.map((issue) => issue.kind),
    ['missing', 'empty', 'extra'],
  );
  assert.deepEqual(
    report.issues.map((issue) => issue.key),
    ['DEBUG', 'PORT', 'EXTRA'],
  );
});

test('strict mode fails on warnings only', () => {
  const template = parseEnv('A=\n', '.env.example');
  const target = parseEnv('A=\nB=1\n', '.env');

  const relaxed = checkEnv(template, target);
  const strict = checkEnv(template, target, { strict: true });

  assert.equal(relaxed.errors, 0);
  assert.equal(relaxed.warnings, 2);
  assert.equal(relaxed.failed, false);
  assert.equal(strict.failed, true);
});

test('check reports duplicates in both files', () => {
  const template = parseEnv('A=1\nA=2\n', 'template');
  const target = parseEnv('A=3\nA=4\n', 'target');
  const report = checkEnv(template, target);

  assert.deepEqual(
    report.issues.map((issue) => issue.message),
    [
      'duplicate "A" in template (lines 1, 2)',
      'duplicate "A" in target (lines 1, 2)',
    ],
  );
});

test('check passes when files match', () => {
  const contents = 'A=1\nB=two\n';
  const report = checkEnv(parseEnv(contents, 'a'), parseEnv(contents, 'b'));

  assert.equal(report.issues.length, 0);
  assert.equal(report.failed, false);
});

test('diff classifies changed, added, removed, and unchanged keys', () => {
  const rows = diffEnv(
    parseEnv('A=1\nB=2\nC=3\n'),
    parseEnv('A=1\nB=9\nD=4\n'),
  );

  assert.deepEqual(rows, [
    { key: 'A', status: 'unchanged', before: '1', after: '1' },
    { key: 'B', status: 'changed', before: '2', after: '9' },
    { key: 'C', status: 'removed', before: '3' },
    { key: 'D', status: 'added', after: '4' },
  ]);
});
