import assert from 'node:assert/strict';
import test from 'node:test';
import { checkEnv, diffEnv } from '../analyzer.js';
import { formatCheck, formatDiff, maskValue } from '../formatter.js';
import { parseEnv } from '../parser.js';

test('maskValue never reveals characters from the value', () => {
  assert.equal(maskValue('supersecret'), '•••• (11 chars)');
  assert.equal(maskValue('abc'), '•••');
  assert.equal(maskValue(''), '<empty>');
});

test('check output masks raw invalid lines unless --no-mask is set', () => {
  const report = checkEnv(parseEnv('not valid=supersecret\n', 'template'), parseEnv('A=1\n', 'target'));
  const hidden = JSON.parse(formatCheck(report, { json: true })) as {
    issues: { kind: string; message: string }[];
  };
  const shown = JSON.parse(formatCheck(report, { json: true, mask: false })) as {
    issues: { kind: string; message: string }[];
  };
  const hiddenMessage = hidden.issues.find((issue) => issue.kind === 'invalid')?.message ?? '';
  const shownMessage = shown.issues.find((issue) => issue.kind === 'invalid')?.message ?? '';

  assert.doesNotMatch(hiddenMessage, /supersecret/);
  assert.match(shownMessage, /supersecret/);
});

test('diff JSON honors the all option', () => {
  const rows = diffEnv(parseEnv('A=1\nB=2\n'), parseEnv('A=1\nB=9\n'));
  const keys = (json: string): string[] =>
    (JSON.parse(json) as { rows: { key: string }[] }).rows.map((row) => row.key);

  assert.deepEqual(keys(formatDiff(rows, { json: true })), ['B']);
  assert.deepEqual(keys(formatDiff(rows, { json: true, all: true })), ['A', 'B']);
});
