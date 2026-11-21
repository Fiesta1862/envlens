import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEnv } from '../parser.js';
import { generateTemplate } from '../template.js';

test('generateTemplate strips values and preserves comments and exports', () => {
  const source = parseEnv(
    [
      '# database settings',
      'export DB_HOST=localhost',
      'TOKEN="abc def" # inline note',
      'TOKEN=duplicate',
      'PORT=',
      'bad key=value',
    ].join('\n'),
    '.env',
  );

  assert.equal(
    generateTemplate(source),
    ['# database settings', 'export DB_HOST=', 'TOKEN=', 'PORT=', '# bad key=value', ''].join(
      '\n',
    ),
  );
});

test('generateTemplate returns an empty string for empty input', () => {
  assert.equal(generateTemplate(parseEnv('', '.env')), '');
});

test('generateTemplate handles a comment-only file', () => {
  assert.equal(generateTemplate(parseEnv('# nothing here\n', '.env')), '# nothing here\n');
});
