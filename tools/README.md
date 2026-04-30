# elkjs-native dev tools

All scripts in this directory are **dev-only**: nothing here is shipped as a
runtime dependency.

## `curate-realworld.mjs`

Picks ~10 flat JSON graphs from `elk-models/realworld/ptolemy/flattened/` that
don't use features we intentionally drop (compound, self-loops, splines, …).
Output:
- `test/fixtures/realworld/*.json`
- `test/fixtures/REALWORLD.md` (list of picks)

## `golden.mjs`

Runs `elkjs@0.12.0` on every fixture under `test/fixtures/` and writes the
result to `test/golden/<same path>.expected.json`. Deterministic — identical
input gives identical bytes.

## `dump-slots.mjs`

Best-effort capture of the actual processor pipeline elkjs runs. Tries to
monkey-patch `node_modules/elkjs/lib/elk-worker.js` to enable
`BasicProgressMonitor` logging; if the anchor isn't found in the GWT bundle,
falls back to writing the canonical list from the plan (§0.4).

Output: `test/golden/<name>.slots.txt` for `user-flowchart` and one realworld
fixture.

## `elkt-to-json/` — deferred

The full plan calls for a Gradle-based converter that turns `.elkt` text
fixtures (under `elk-models/tests/layered/...`) into JSON. It needs JDK 17+
and is not strictly required until we start adding fixture-driven tests for
intermediate processors (Stages 5–8). It is therefore **not implemented in
Stage 1**; we currently rely on the JSON fixtures already shipped under
`elk-models/realworld/...` plus the hand-written `user-flowchart.json`.

When we get to Stages 5–8, this directory will hold:
- `build.gradle` — depends on `org.eclipse.elk.graph.text` sources;
- `Convert.java` — `ElkGraphStandaloneSetup.doSetup()` + `ElkGraphJson.forGraph(...).toJson()`;
- `harvest-fixtures.sh` — bash wrapper that walks the whitelist of
  `elk-models/tests/layered/...` directories and runs the converter.

JDK requirement (current machine has only JDK 8) is the reason for the
deferral; documented here so we don't lose track.
