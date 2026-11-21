import type { EnvFile } from './parser.js';

/**
 * Build a safe-to-commit template from an existing env file: values are
 * removed, comments are kept, duplicate assignments are dropped, and lines
 * that could not be parsed are commented out for manual review.
 */
export function generateTemplate(file: EnvFile): string {
  const duplicateLines = new Set<number>();
  for (const duplicate of file.duplicates) {
    for (const line of duplicate.lines.slice(1)) duplicateLines.add(line);
  }

  const invalidLines = new Set(file.invalidLines.map((invalid) => invalid.line));
  const entriesByLine = new Map(file.entries.map((entry) => [entry.line, entry]));
  const output: string[] = [];

  file.lines.forEach((raw, index) => {
    const lineNumber = index + 1;

    if (duplicateLines.has(lineNumber)) return;

    if (invalidLines.has(lineNumber)) {
      output.push(`# ${raw.trim()}`);
      return;
    }

    const entry = entriesByLine.get(lineNumber);
    if (!entry) {
      output.push(raw);
      return;
    }

    const prefix = /^\s*export\s+/.test(raw) ? 'export ' : '';
    output.push(`${prefix}${entry.key}=`);
  });

  while (output.length > 0 && output[output.length - 1]?.trim() === '') output.pop();
  if (output.length === 0) return '';
  return `${output.join('\n').trimEnd()}\n`;
}
