# envlens

A tiny, dependency-free CLI that keeps your `.env` files honest.

`envlens` compares a real `.env` file against a committed template (like
`.env.example`) and tells you exactly what's missing, extra, empty, or
duplicated. Values are masked by default, so it's safe to run in a terminal
with company secrets on screen.

## Features

- **Check** `.env` against `.env.example` (or any two files)
- **Diff** two env files by key and value
- **List** keys with masked values
- Detects duplicate keys, invalid lines, and empty values
- Respects comments, `export` prefixes, quoted values, and escapes
- JSON output for scripts and CI
- Zero runtime dependencies — just Node.js 20+

## Install

```bash
git clone https://github.com/Fiesta1862/envlens.git
cd envlens
npm install
npm run build
npm link
```

Then run `envlens --help` from anywhere.

## Usage

```bash
# Check .env against .env.example (the defaults)
envlens check

# Use custom paths
envlens check config/example.env config/local.env

# Compare two files
envlens diff .env.example .env.production

# List the keys in a file
envlens list .env
```

Example output:

```text
envlens: .env.example → .env
  template: 5 variables   target: 4 variables

  ✗ missing SESSION_SECRET (defined in .env.example)
  ! extra DEBUG (not in .env.example)
  ! LOG_LEVEL is empty
  ✗ duplicate API_KEY in .env (lines 3, 7)

  2 errors, 2 warnings
```

### Options

| Option | Description |
| --- | --- |
| `--json` | Emit machine-readable JSON |
| `--no-mask` | Print full values instead of masking them |
| `--strict` | Treat warnings as failures in `check` |
| `--all` | Include unchanged keys in `diff` |
| `--no-color` | Disable ANSI colors |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show version |

`check` exits with code `1` when errors are found (or warnings with
`--strict`), and `2` on invalid input such as a missing file.

### In CI

```yaml
- run: envlens check --strict
```

Use `--json` to build your own reporting on top:

```bash
envlens check --json | jq '.issues[].key'
```

## Library usage

```ts
import { readFileSync } from 'node:fs';
import { parseEnv, checkEnv } from 'envlens';

const template = parseEnv(readFileSync('.env.example', 'utf8'), '.env.example');
const target = parseEnv(readFileSync('.env', 'utf8'), '.env');
const report = checkEnv(template, target);

console.log(report.failed, report.issues);
```

## Development

```bash
npm install
npm test
```

## License

[MIT](LICENSE)
