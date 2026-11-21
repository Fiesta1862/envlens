export interface EnvEntry {
  key: string;
  value: string;
  line: number;
}

export interface DuplicateKey {
  key: string;
  lines: number[];
}

export interface InvalidLine {
  line: number;
  text: string;
  reason: string;
}

export interface EnvFile {
  path: string;
  entries: EnvEntry[];
  duplicates: DuplicateKey[];
  invalidLines: InvalidLine[];
  values: Map<string, string>;
  lines: string[];
}

interface ParsedValue {
  value: string;
  error?: string;
}

const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ESCAPES: Record<string, string> = {
  n: '\n',
  r: '\r',
  t: '\t',
  '"': '"',
  '\\': '\\',
};

/** Parse the contents of a .env file without executing any of it. */
export function parseEnv(contents: string, path = '<input>'): EnvFile {
  const lines = contents.replace(/^\uFEFF/, '').split(/\r?\n/);
  const entries: EnvEntry[] = [];
  const duplicates: DuplicateKey[] = [];
  const invalidLines: InvalidLine[] = [];
  const values = new Map<string, string>();
  const occurrences = new Map<string, number[]>();

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    let line = rawLine.trim();

    if (!line || line.startsWith('#')) return;
    line = line.replace(/^export\s+/, '');

    const equals = line.indexOf('=');
    const key = (equals === -1 ? line : line.slice(0, equals)).trim();

    if (!KEY_PATTERN.test(key)) {
      invalidLines.push({
        line: lineNumber,
        text: rawLine,
        reason: 'invalid variable name',
      });
      return;
    }

    const parsed = equals === -1 ? { value: '' } : parseValue(line.slice(equals + 1));
    if (parsed.error) {
      invalidLines.push({ line: lineNumber, text: rawLine, reason: parsed.error });
      return;
    }

    entries.push({ key, value: parsed.value, line: lineNumber });
    if (!values.has(key)) values.set(key, parsed.value);

    const seen = occurrences.get(key);
    if (seen) seen.push(lineNumber);
    else occurrences.set(key, [lineNumber]);
  });

  for (const [key, seen] of occurrences) {
    if (seen.length > 1) duplicates.push({ key, lines: seen });
  }

  return { path, entries, duplicates, invalidLines, values, lines };
}

function parseValue(input: string): ParsedValue {
  const text = input.trimStart();
  if (text.startsWith('"')) return parseQuoted(text, '"', true);
  if (text.startsWith("'")) return parseQuoted(text, "'", false);
  return { value: text.replace(/\s+#.*$/, '').trimEnd() };
}

function parseQuoted(text: string, quote: '"' | "'", unescape: boolean): ParsedValue {
  let value = '';

  for (let index = 1; index < text.length; index += 1) {
    const char = text[index] as string;

    if (char === '\\' && unescape && index + 1 < text.length) {
      const next = text[index + 1] as string;
      if (Object.prototype.hasOwnProperty.call(ESCAPES, next)) {
        value += ESCAPES[next];
        index += 1;
        continue;
      }
    }

    if (char === quote) {
      const remainder = text.slice(index + 1).trim();
      if (remainder && !remainder.startsWith('#')) {
        return { value, error: 'unexpected characters after closing quote' };
      }
      return { value };
    }
    value += char;
  }

  return { value, error: 'unterminated quote' };
}
