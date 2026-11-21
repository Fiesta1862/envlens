#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkEnv, diffEnv } from './analyzer.js';
import { formatCheck, formatDiff, formatList, type FormatOptions } from './formatter.js';
import { parseEnv, type EnvFile } from './parser.js';

const HELP = `envlens — see through your .env files

Usage:
  envlens check [template] [target]   Validate a .env file against a template
                                      (defaults: .env.example, .env)
  envlens diff <from> <to>            Compare two .env files
  envlens list [file]                 List keys and masked values (default: .env)

Options:
  --json        Output machine-readable JSON
  --no-mask     Show full values instead of masking them
  --strict      Treat warnings as failures in 'check'
  --all         Include unchanged keys in 'diff'
  --no-color    Disable colored output
  -h, --help    Show this help
  -v, --version Show the version

Examples:
  envlens check
  envlens check config/example.env .env.local --strict
  envlens diff .env.example .env.production
  envlens list --json
`;

class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 2,
  ) {
    super(message);
  }
}

interface Arguments {
  command?: string;
  positionals: string[];
  flags: Set<string>;
}

function parseArguments(argv: string[]): Arguments {
  const flags = new Set<string>();
  const positionals: string[] = [];
  let command: string | undefined;

  for (const argument of argv) {
    if (argument.startsWith('-')) flags.add(argument);
    else if (command === undefined) command = argument;
    else positionals.push(argument);
  }

  return { command, positionals, flags };
}

function version(): string {
  try {
    const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
    return (JSON.parse(packageJson) as { version: string }).version;
  } catch {
    return '0.0.0';
  }
}

function load(path: string): EnvFile {
  try {
    return parseEnv(readFileSync(resolve(path), 'utf8'), path);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new CliError(`cannot read "${path}": ${reason}`);
  }
}

function formatOptions(flags: Set<string>): FormatOptions {
  return {
    json: flags.has('--json'),
    mask: !flags.has('--no-mask'),
    color:
      !flags.has('--no-color') &&
      !flags.has('--json') &&
      !process.env.NO_COLOR &&
      Boolean(process.stdout.isTTY),
    all: flags.has('--all'),
  };
}

function main(): void {
  const args = parseArguments(process.argv.slice(2));
  const { command, positionals, flags } = args;

  if (flags.has('--version') || flags.has('-v')) {
    process.stdout.write(`envlens ${version()}\n`);
    return;
  }

  if (flags.has('--help') || flags.has('-h') || command === undefined) {
    process.stdout.write(HELP);
    return;
  }

  const format = formatOptions(flags);

  if (command === 'check') {
    const [templatePath = '.env.example', targetPath = '.env'] = positionals;
    const report = checkEnv(load(templatePath), load(targetPath), {
      strict: flags.has('--strict'),
    });
    process.stdout.write(formatCheck(report, format));
    if (report.failed) process.exitCode = 1;
    return;
  }

  if (command === 'diff') {
    if (positionals.length !== 2) {
      throw new CliError("'diff' needs exactly two files: envlens diff <from> <to>");
    }
    const rows = diffEnv(load(positionals[0] as string), load(positionals[1] as string));
    process.stdout.write(formatDiff(rows, format));
    return;
  }

  if (command === 'list') {
    const [file = '.env'] = positionals;
    process.stdout.write(formatList(load(file), format));
    return;
  }

  throw new CliError(`unknown command "${command}"\n\nRun "envlens --help" for usage.`);
}

try {
  main();
} catch (error) {
  if (error instanceof CliError) {
    process.stderr.write(`envlens: ${error.message}\n`);
    process.exitCode = error.exitCode;
  } else {
    throw error;
  }
}
