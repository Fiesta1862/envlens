# Contributing to envlens

Thanks for helping out! This is a small project, so the barrier to entry is
low.

## Development setup

Requires Node.js 20 or newer.

```bash
git clone https://github.com/Fiesta1862/envlens.git
cd envlens
npm install
npm test
```

`npm test` compiles the TypeScript sources and runs the test suite against the
compiled output in `dist/`.

## Trying the CLI locally

```bash
npm run build
node dist/cli.js --help
node dist/cli.js check examples/.env.example examples/.env
```

## Making a change

1. Create a branch: `git checkout -b my-change`
2. Add or update tests in `src/__tests__/`.
3. Run `npm test` — all tests must pass.
4. Commit with a short imperative message, e.g. `fix: handle CRLF line endings`.
5. Push and open a pull request.

CI runs the suite on Node 20, 22, and 24 for every push and pull request.

## Publishing

Releases are published to npm by the `Publish to npm` workflow when a GitHub
release is published. Maintainers need to add an `NPM_TOKEN` secret to the
repository (an npm automation token with publish rights). To publish manually:

```bash
npm login
npm test
npm publish --access public
```

## Reporting bugs

Please use the issue templates and include the env file shape (with values
removed) that reproduces the problem. Never paste real secrets into an issue.

## Code style

- TypeScript with `strict` mode enabled.
- Use Node.js built-ins; the project intentionally has zero runtime
  dependencies.
- Keep CLI output concise and machine-readable with `--json`.
