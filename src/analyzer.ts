import type { EnvFile } from './parser.js';

export type IssueKind = 'missing' | 'extra' | 'empty' | 'duplicate' | 'invalid';
export type Severity = 'error' | 'warning';

export interface Issue {
  kind: IssueKind;
  severity: Severity;
  key?: string;
  line?: number;
  message: string;
}

export interface CheckReport {
  templatePath: string;
  targetPath: string;
  templateCount: number;
  targetCount: number;
  issues: Issue[];
  errors: number;
  warnings: number;
  failed: boolean;
}

export interface CheckOptions {
  strict?: boolean;
}

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffRow {
  key: string;
  status: DiffStatus;
  before?: string;
  after?: string;
  beforeLine?: number;
  afterLine?: number;
}

const ISSUE_ORDER: Record<IssueKind, number> = {
  missing: 0,
  duplicate: 1,
  invalid: 2,
  empty: 3,
  extra: 4,
};

/** Compare a target env file against a template env file. */
export function checkEnv(
  template: EnvFile,
  target: EnvFile,
  options: CheckOptions = {},
): CheckReport {
  const issues: Issue[] = [];
  const templateKeys = new Set(template.values.keys());
  const targetKeys = new Set(target.values.keys());

  for (const key of templateKeys) {
    if (!targetKeys.has(key)) {
      issues.push({
        kind: 'missing',
        severity: 'error',
        key,
        message: `missing "${key}" (defined in ${template.path})`,
      });
    }
  }

  for (const key of targetKeys) {
    if (!templateKeys.has(key)) {
      issues.push({
        kind: 'extra',
        severity: 'warning',
        key,
        message: `extra "${key}" (not in ${template.path})`,
      });
    }

    const value = target.values.get(key) as string;
    if (value.trim() === '') {
      issues.push({
        kind: 'empty',
        severity: 'warning',
        key,
        message: `"${key}" is empty`,
      });
    }
  }

  for (const { file, duplicates } of [
    { file: template.path, duplicates: template.duplicates },
    { file: target.path, duplicates: target.duplicates },
  ]) {
    for (const duplicate of duplicates) {
      issues.push({
        kind: 'duplicate',
        severity: 'error',
        key: duplicate.key,
        line: duplicate.lines[0],
        message: `duplicate "${duplicate.key}" in ${file} (lines ${duplicate.lines.join(', ')})`,
      });
    }
  }

  for (const { file, invalidLines } of [
    { file: template.path, invalidLines: template.invalidLines },
    { file: target.path, invalidLines: target.invalidLines },
  ]) {
    for (const invalid of invalidLines) {
      issues.push({
        kind: 'invalid',
        severity: 'error',
        line: invalid.line,
        message: `${file}:${invalid.line}: ${invalid.reason}: ${invalid.text.trim()}`,
      });
    }
  }

  issues.sort((left, right) => {
    const byKind = ISSUE_ORDER[left.kind] - ISSUE_ORDER[right.kind];
    if (byKind !== 0) return byKind;
    const byKey = (left.key ?? '').localeCompare(right.key ?? '');
    if (byKey !== 0) return byKey;
    return (left.line ?? 0) - (right.line ?? 0);
  });

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;

  return {
    templatePath: template.path,
    targetPath: target.path,
    templateCount: template.values.size,
    targetCount: target.values.size,
    issues,
    errors,
    warnings,
    failed: errors > 0 || (options.strict === true && warnings > 0),
  };
}

/** Compare keys and values between two env files. */
export function diffEnv(from: EnvFile, to: EnvFile): DiffRow[] {
  const keys = new Set([...from.values.keys(), ...to.values.keys()]);
  const rows: DiffRow[] = [];

  for (const key of keys) {
    const before = from.values.get(key);
    const after = to.values.get(key);

    if (before === undefined) {
      rows.push({ key, status: 'added', after });
    } else if (after === undefined) {
      rows.push({ key, status: 'removed', before });
    } else if (before === after) {
      rows.push({ key, status: 'unchanged', before, after });
    } else {
      rows.push({ key, status: 'changed', before, after });
    }
  }

  return rows.sort((left, right) => left.key.localeCompare(right.key));
}
