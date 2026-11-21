import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnv } from '../parser.js';

test('parses comments, exports, and quoted values', () => {
  const file = parseEnv(
    [
      '# a comment',
      '',
      'export API_KEY="hello\\nworld"',
      "GREETING='hi there' # stays inside the quotes",
      'URL=https://example.com/path#fragment',
      'FLAG',
      'EMPTY=',
    ].join('\n'),
    '.env',
  );

  assert.equal(file.entries.length, 5);
  assert.equal(file.values.get('API_KEY'), 'hello\nworld');
  assert.equal(file.values.get('GREETING'), 'hi there');
  assert.equal(file.values.get('URL'), 'https://example.com/path#fragment');
  assert.equal(file.values.get('FLAG'), '');
  assert.equal(file.values.get('EMPTY'), '');
  assert.deepEqual(file.duplicates, []);
  assert.deepEqual(file.invalidLines, []);
});

test('strips inline comments after unquoted values and handles CRLF and BOM', () => {
  const file = parseEnv('\uFEFFPORT=3000 # dev server\r\nDEBUG=true\r\n');
  assert.equal(file.values.get('PORT'), '3000');
  assert.equal(file.values.get('DEBUG'), 'true');
});

test('reports duplicate keys and invalid lines', () => {
  const file = parseEnv('A=1\nA=2\nB=3\nA=4\nnot valid=1\nKEY="unterminated\n');

  assert.deepEqual(file.duplicates, [{ key: 'A', lines: [1, 2, 4] }]);
  assert.equal(file.invalidLines.length, 2);
  assert.deepEqual(
    file.invalidLines.map((line) => line.reason),
    ['invalid variable name', 'unterminated quote'],
  );
  assert.equal(file.values.get('A'), '1');
});

test('accepts export followed by whitespace other than a space', () => {
  const file = parseEnv('export\tKEY=1\nexport   OTHER=2\n');
  assert.equal(file.values.get('KEY'), '1');
  assert.equal(file.values.get('OTHER'), '2');
});

test('rejects trailing junk after a closing quote', () => {
  const file = parseEnv('C="x"junk\nD=ok\n');
  assert.equal(file.invalidLines.length, 1);
  assert.equal(file.invalidLines[0]?.reason, 'unexpected characters after closing quote');
  assert.equal(file.values.get('D'), 'ok');
});

test('keeps the first value of a duplicated key', () => {
  const file = parseEnv('TOKEN=first\nTOKEN=second\n');
  assert.equal(file.values.get('TOKEN'), 'first');
  assert.equal(file.entries.length, 2);
});
