import type { CheckReport, DiffRow } from './analyzer.js';
import type { EnvFile } from './parser.js';

export interface FormatOptions {
  json?: boolean;
  mask?: boolean;
  color?: boolean;
  all?: boolean;
}

const RED = 31;
const GREEN = 32;
const YELLOW = 33;
const CYAN = 36;
const DIM = 2;

function paint(text: string, code: number, enabled: boolean): string {
  return enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}

/** Mask a value while leaving enough shape to be useful. */
export function maskValue(value: string): string {
  if (value === '') return '<empty>';
  if (value.length <= 4) return '•'.repeat(value.length);
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}

function display(value: string | undefined, mask: boolean): string | undefined {
  if (value === undefined) return undefined;
  return mask ? maskValue(value) : value;
}

export function formatCheck(report: CheckReport, options: FormatOptions = {}): string {
  if (options.json) {
    return `${JSON.stringify(
      {
        ok: !report.failed,
        template: report.templatePath,
        target: report.targetPath,
        counts: { template: report.templateCount, target: report.targetCount },
        errors: report.errors,
        warnings: report.warnings,
        issues: report.issues,
      },
      null,
      2,
    )}\n`;
  }

  const color = options.color ?? false;
  const header = paint(`envlens: ${report.templatePath} → ${report.targetPath}`, CYAN, color);
  const counts = paint(
    `  template: ${report.templateCount} variables   target: ${report.targetCount} variables`,
    DIM,
    color,
  );

  if (report.issues.length === 0) {
    return `${header}\n${counts}\n\n  ${paint('✓', GREEN, color)} no issues found\n`;
  }

  const lines = report.issues.map((issue) => {
    const error = issue.severity === 'error';
    const icon = paint(error ? '✗' : '!', error ? RED : YELLOW, color);
    return `  ${icon} ${issue.message}`;
  });

  const summary = [
    report.errors > 0 ? `${report.errors} ${report.errors === 1 ? 'error' : 'errors'}` : '',
    report.warnings > 0
      ? `${report.warnings} ${report.warnings === 1 ? 'warning' : 'warnings'}`
      : '',
  ]
    .filter(Boolean)
    .join(', ');

  return `${header}\n${counts}\n\n${lines.join('\n')}\n\n  ${summary}\n`;
}

export function formatDiff(rows: DiffRow[], options: FormatOptions = {}): string {
  if (options.json) {
    return `${JSON.stringify(
      {
        rows: rows.map((row) => ({
          key: row.key,
          status: row.status,
          before: display(row.before, options.mask ?? true),
          after: display(row.after, options.mask ?? true),
        })),
      },
      null,
      2,
    )}\n`;
  }

  const color = options.color ?? false;
  const shown = options.all ? rows : rows.filter((row) => row.status !== 'unchanged');

  if (shown.length === 0) {
    return paint('No differences found.\n', GREEN, color);
  }

  const lines = shown.map((row) => {
    const before = display(row.before, options.mask ?? true) ?? '<unset>';
    const after = display(row.after, options.mask ?? true) ?? '<unset>';

    if (row.status === 'added') {
      return `  ${paint('+', GREEN, color)} ${row.key} = ${after}`;
    }
    if (row.status === 'removed') {
      return `  ${paint('-', RED, color)} ${row.key} = ${before}`;
    }
    if (row.status === 'changed') {
      return `  ${paint('~', YELLOW, color)} ${row.key}: ${before} → ${after}`;
    }
    return `  ${paint('=', DIM, color)} ${row.key} = ${after}`;
  });

  return `${lines.join('\n')}\n`;
}

export function formatList(file: EnvFile, options: FormatOptions = {}): string {
  const entries = [...file.entries].sort((left, right) => left.key.localeCompare(right.key));

  if (options.json) {
    return `${JSON.stringify(
      {
        file: file.path,
        count: entries.length,
        uniqueKeys: file.values.size,
        variables: entries.map((entry) => ({
          key: entry.key,
          value: display(entry.value, options.mask ?? true),
          line: entry.line,
        })),
      },
      null,
      2,
    )}\n`;
  }

  const color = options.color ?? false;
  const header = paint(
    `envlens: ${file.path} (${entries.length} entries, ${file.values.size} unique keys)`,
    CYAN,
    color,
  );

  if (entries.length === 0) return `${header}\n`;

  const lines = entries.map((entry) => {
    const value = display(entry.value, options.mask ?? true);
    return `  ${entry.key} = ${paint(value as string, DIM, color)}`;
  });

  return `${header}\n${lines.join('\n')}\n`;
}
