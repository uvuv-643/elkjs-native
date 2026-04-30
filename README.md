# elkjs-native

Native TypeScript port of [elkjs](https://github.com/kieler/elkjs) — `layered`
algorithm only. Drop-in replacement for the subset of options used by our
flowchart UI.

Status: **Stage 1 (bootstrap)** — see [`plans/elkjs-native-migration.md`](../plans/elkjs-native-migration.md).

## Layout

- `src/` — TypeScript source (currently a stub).
- `test/fixtures/` — JSON graphs used both for golden tests and benchmarks.
- `test/golden/` — `<fixture>.expected.json` results produced by `elkjs@0.12.0`,
  committed to git as the reference oracle.
- `tools/` — dev-time scripts (curating fixtures, generating goldens, dumping
  slot lists, converting `.elkt → .json`). Not shipped.

## Scripts

```sh
pnpm install
pnpm run curate       # pick flat real-world JSON fixtures from elk-models
pnpm run golden       # run elkjs on every fixture, write *.expected.json
pnpm run dump-slots   # capture pipeline slot list from a patched elkjs worker
pnpm test
pnpm run build
```

`pnpm run harvest` (the full `.elkt → .json` conversion via the Gradle helper)
is documented in [`tools/README.md`](./tools/README.md) and currently requires
JDK 17+.
