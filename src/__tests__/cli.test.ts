import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const cli = fileURLToPath(new URL('../cli.js', import.meta.url));

function workspace(template: string, target: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'envlens-test-'));
  writeFileSync(join(directory, '.env.example'), template);
  writeFileSync(join(directory, '.env'), target);
  return directory;
}

function run(directory: string, args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

test('check exits 1 and reports missing variables', () => {
  const directory = workspace('API_KEY=\nPORT=3000\n', 'API_KEY=abc\n');
  try {
    const result = run(directory, ['check']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /missing "PORT"/);
    assert.match(result.stdout, /1 error/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('check exits 0 when the files agree', () => {
  const directory = workspace('A=1\n', 'A=1\n');
  try {
    const result = run(directory, ['check', '--json']);
    assert.equal(result.status, 0);
    assert.equal(JSON.parse(result.stdout).ok, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('list masks values unless --no-mask is given', () => {
  const directory = workspace('TOKEN=supersecret\n', 'TOKEN=supersecret\n');
  try {
    const masked = run(directory, ['list', '--json']);
    const revealed = run(directory, ['list', '--json', '--no-mask']);

    assert.equal(JSON.parse(masked.stdout).variables[0].value, '•••• (11 chars)');
    assert.equal(JSON.parse(revealed.stdout).variables[0].value, 'supersecret');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('strict mode fails on warnings', () => {
  const directory = workspace('A=\n', 'A=\nB=1\n');
  try {
    const result = run(directory, ['check', '--strict']);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /2 warnings/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('diff supports JSON output and --all', () => {
  const directory = workspace('A=1\nB=2\n', 'A=1\nB=9\n');
  try {
    const plain = run(directory, ['diff', '.env.example', '.env', '--json']);
    const all = run(directory, ['diff', '.env.example', '.env', '--json', '--all']);
    const keys = (result: typeof plain): string[] =>
      (JSON.parse(result.stdout) as { rows: { key: string }[] }).rows.map((row) => row.key);

    assert.equal(plain.status, 0);
    assert.deepEqual(keys(plain), ['B']);
    assert.deepEqual(keys(all), ['A', 'B']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects unknown flags and extra positional arguments', () => {
  const directory = workspace('A=1\n', 'A=1\n');
  try {
    const unknownFlag = run(directory, ['check', '--strcit']);
    assert.equal(unknownFlag.status, 2);
    assert.match(unknownFlag.stderr, /unknown option "--strcit"/);

    const extraFile = run(directory, ['check', '.env.example', '.env', 'third']);
    assert.equal(extraFile.status, 2);
    assert.match(extraFile.stderr, /expects 0 to 2 file argument/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('init never overwrites its source, even through a symlink', () => {
  const directory = workspace('SECRET=abc\n', 'SECRET=abc\n');
  try {
    symlinkSync(join(directory, '.env'), join(directory, 'link.env'));

    const direct = run(directory, ['init', '.env', '.env', '--force']);
    assert.equal(direct.status, 2);
    assert.match(direct.stderr, /different files/);

    const linked = run(directory, ['init', '.env', 'link.env', '--force']);
    assert.equal(linked.status, 2);
    assert.match(linked.stderr, /different files/);

    assert.equal(readFileSync(join(directory, '.env'), 'utf8'), 'SECRET=abc\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('init generates a template and requires --force to overwrite', () => {
  const directory = workspace('SECRET=abc\n', 'TOKEN=one\nTOKEN=two\n# note\n');
  try {
    const created = run(directory, ['init', '.env', 'generated.env']);
    assert.equal(created.status, 0);
    assert.match(created.stdout, /wrote generated\.env/);
    assert.equal(readFileSync(join(directory, 'generated.env'), 'utf8'), 'TOKEN=\n# note\n');

    const refused = run(directory, ['init', '.env', 'generated.env']);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /already exists/);

    const forced = run(directory, ['init', '.env', 'generated.env', '--force']);
    assert.equal(forced.status, 0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('list counts every entry while also reporting unique keys', () => {
  const directory = workspace('A=1\n', 'TOKEN=first\nTOKEN=second\n');
  try {
    const result = run(directory, ['list', '--json']);
    const payload = JSON.parse(result.stdout);

    assert.equal(payload.count, 2);
    assert.equal(payload.uniqueKeys, 1);
    assert.equal(payload.variables.length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('--version prints the version even without a command', () => {
  const directory = workspace('A=1\n', 'A=1\n');
  try {
    const result = run(directory, ['--version']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /^envlens \d+\.\d+\.\d+\n$/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('missing files produce a friendly error with exit code 2', () => {
  const directory = workspace('A=1\n', 'A=1\n');
  try {
    const result = run(directory, ['check', 'nope.env', '.env']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /cannot read "nope.env"/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
