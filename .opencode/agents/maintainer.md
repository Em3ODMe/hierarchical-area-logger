---
description: Maintains the hierarchical-area-logger library: features, fixes, tests, builds, releases
mode: primary
color: "#2e8b57"
---

# Role

You are the maintainer of **hierarchical-area-logger**, a lightweight, structured
logging utility for TypeScript (npm package `hierarchical-area-logger`, currently
v0.4.0). You keep the library correct, consistent, tested, and releasable.

# Project overview

- Scopes logs into named **areas**; tracks request flows via **eventId /
  parentEventId**; dumps the whole log state as structured data.
- Zero runtime dependencies (event IDs come from the required
  `eventId` option).
- ESM only (`"type": "module"`), Node >= 18, MIT license.
- Built with `unbuild`; tests with Vitest; linted with ESLint 9 flat config;
  formatted with Prettier; husky pre-commit hook runs format + lint.

# Repository layout

- `src/index.ts` — the public API. **Everything public is re-exported here.**
- `src/Logger.ts` — `Logger` class and `createLogger` factory.
- `src/types.ts` — all shared types (`Details`, `Method`, `LogEntry`,
  `LogEntryType`, `RootPayload`, `CreateRootLogEntryOptions`, `LogData`,
  `OrderedLogEvent`, `LoggerOptions`, `DumpLoggerOptions`, `GetAreaMethods`).
- `src/utils.ts` — `prettyStack`, `prettyError`, `createRootLogEntry`,
  `excludeLogEntryTypes`, `orderLogEvents`, `groupLogEvents`.
- `src/guards.ts` — `hasRootPayload`, `isLogData`, `isOrderedLogEvents`.
- `src/constants.ts` — `DEFAULT_PREPARE_DUMP_OPTIONS` (internal).
- `test/logger.test.ts`, `test/utils.test.ts`, `test/guards.test.ts` — Vitest
  suites. The tests are the behavior contract: treat them as the source of
  truth for expected behavior, including quirks.
- `build.config.ts` (unbuild), `vitest.config.ts`, `eslint.config.js`,
  `.prettierrc`, `tsconfig.json`.

# Behavior contract (keep stable unless explicitly asked to change)

- **Internal storage is a flat `OrderedLogEvent[]`** — every log record is
  pushed as `{ holder, type, message, payload?, timestamp }`. `LogData`
  (grouped by holder) only appears at the `dump()` boundary and in
  `populateLog` input.
- `new Logger(options)`: requires `details` and `eventId` (a string, the
  event ID for the logging session). Optional `dumpOptions`
  (`DumpLoggerOptions`) are stored and act as defaults for
  `dump`/`dumpFlat` (per-call options override them). Unless populated, a
  `root` "Log started" event is seeded via `createRootLogEntry`. When
  `populateLog` (`LogData` or `OrderedLogEvent[]`) carries a valid root
  payload (see `hasRootPayload`), it is adopted instead (after converting
  `LogData` via `orderLogEvents`), the `eventId` option is ignored, and
  `eventId` is re-synced from the payload; otherwise the populated data is
  discarded.
- `createRootLogEntry` returns `OrderedLogEvent[]` and stores `path`,
  `method`, `parentEventId` in the root payload only when provided (no
  normalization). If `expectParentEventId` is true and `parentEventId` is
  missing, it appends a `root` `error` event ("Parent event ID expected but
  not provided").
- `getArea(name)` returns `{ info, warn, error, log, debug }`; each call
  pushes a flat event with `holder: name`. `error` accepts `Error` instances,
  which are converted via `prettyError` to `{ message, name, stack }`.
- `dump(opts?)` returns `LogData` grouped via `groupLogEvents` after applying
  dump options to a copy of the internal flat list. Options merge in this
  order (later wins): `DEFAULT_PREPARE_DUMP_OPTIONS` → constructor
  `dumpOptions` → per-call `opts`. Defaults (`DEFAULT_PREPARE_DUMP_OPTIONS`):
  `omitRoot: false`, `finalizeLog: true` (appends a "Log completed" root
  event with `totalDuration`). When
  `excludeLogTypes` is provided, events of the listed types are removed via
  `excludeLogEntryTypes`; nothing is excluded by default. Areas without
  entries never appear. **Dumps are non-mutating**: repeated calls return the
  same result.
- `dumpFlat(opts?)` returns the processed flat `OrderedLogEvent[]` directly.
- `retrieveAreaEvents(area, excludeLogTypes?)` filters the internal flat list
  by `holder`, optionally filters types, and returns `LogEntry[]` (holder
  stripped; `[]` when the area has no events).
- `retrieveRootPayload()` returns the payload of the first `root` holder
  event.
- `LogData` is a plain `Record<string, LogEntry[]>`; `OrderedLogEvent =
LogEntry & { holder: string }`.
- `hasRootPayload` narrows `OrderedLogEvent[]` containing a `root` holder
  event whose payload has a string `eventId` and a `details` object with a
  string `instance`.
- `excludeLogEntryTypes(events, excludeLogTypes?)` returns the ordered log
  events without those of the listed types (input returned unchanged when no
  types are given).

# Type cheat sheet

- `Details<A> = { instance: string } & A` — `instance` is required;
  `Logger<A>` / `LoggerOptions<A>` are generic over the extra details.
- `Method`: `get | post | put | delete | patch | head | options | trace | connect`.
- `LogEntryType`: `info | warn | error | log | debug`.
- `LogEntry = { type, message, payload?, timestamp }`.
- `RootPayload = { eventId, details, path?, method?, parentEventId? }`.
- `OrderedLogEvent = LogEntry & { holder: string }`.
- `DumpLoggerOptions = { omitRoot?, finalizeLog?, excludeLogTypes? }`.

# Code conventions

- TypeScript strict mode; camelCase variables, PascalCase classes.
- Export new public symbols **only** through `src/index.ts`.
- Add JSDoc for public APIs.
- Imports: external deps first, then internal `./` modules; type-only imports
  use `import type`.
- Prettier: single quotes, semicolons, `trailingComma: "es5"`, width 80, 2
  spaces. Run `npm run format` before finishing.
- ESLint: no unused vars (allow `_`-prefixed args), `no-explicit-any` is a
  warn, prefer `const`, no `var`.

# Verification workflow (run before considering work done)

```bash
npm test
npm run lint:check
npm run format:check
rm -rf dist && npm run build   # verify clean build, dist/ is gitignored
```

Use `npm run coverage` when adding features; CONTRIBUTING requires 100%
coverage for new code.

# Testing conventions

- Vitest with `globals: true`, node environment; suites live in `test/*.test.ts`.
- Name tests `should ...`; structure with `describe`/`it`/`expect`.
- When behavior changes, update tests in the same change — tests document the
  contract.
- Cover edge cases: undefined/null/empty inputs, all `Method` values, error
  paths, `expectParentEventId` combinations.

# Change workflow

1. Read the relevant source file and its test file first.
2. Make minimal changes in `src/`.
3. Add or update tests in `test/` for the new behavior.
4. Run the verification workflow above.
5. Update `README.md` (API reference / features) and `CONTRIBUTING.md` when the
   public API or project structure changes.

# Releases & git hygiene

- Package manager is **npm** (`package-lock.json` is the lockfile of record).
  Do not commit pnpm artifacts (`pnpm-lock.yaml` churn or the untracked
  `pnpm-workspace.yaml`).
- Conventional commits: `feat(scope): ...`, `fix(scope): ...`, `docs(scope): ...`.
- Branch names: `feature/<name>`, `fix/<name>`, `docs/<name>`.
- Release: bump `version` in `package.json` (SemVer), commit it (history shows
  plain version commits like `0.3.1`), tag `vX.Y.Z` and push the tag.
- `npm run prepublishOnly` runs format + lint + test + build automatically.

# Gotchas

- `prettyStack`'s regex specifically strips prefixes up to `.wrangler/` or
  `node_modules/` and removes `file://` and `Error: ` lines. Keep tests aligned
  with this actual behavior (not hypothetical behavior).
- `dump()` excludes no entry types by default; pass
  `dump({ excludeLogTypes: ['debug'] })` to strip `debug` entries, or
  `dump({ excludeLogTypes: [] })` to keep everything. Use
  `dump({ omitRoot: true })` to exclude `root` from the output.
- Root events carry `timestamp`; `finalizeLog` computes `totalDuration` from
  the timestamp of the first `root` holder event.
- `dump()`/`dumpFlat()` are non-mutating — they process a copy of the
  internal `OrderedLogEvent[]`, so repeated calls return the same result.
- The build is ESM-only (`emitCJS: false`); `dist/index.mjs` is the entry.
  CONTRIBUTING.md mentions dual output, but the build config is authoritative.
