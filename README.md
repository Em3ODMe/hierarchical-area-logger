# 🌲 Hierarchical Area Logger

A lightweight, structured logging utility for TypeScript applications. It allows you to scope logs to specific **Areas**, track request flows via **Event IDs**, and **dump** the entire execution history for debugging or monitoring.

## 🚀 Features

- **Scoped Logging:** Group logs by logical "areas" (e.g., `db-layer`, `auth-instance`).
- **Traceability:** User-supplied Event IDs and Parent Event ID mapping for distributed tracing.
- **Structured Payloads:** Log rich objects and Error instances without losing metadata.
- **Snapshot Dumping:** Retrieve the entire log state at any time for analysis or reporting — nested or flattened.
- **Hydration:** Continue logging on top of existing log data (from another instance or a previous run).
- **Lightweight:** Zero runtime dependencies.

---

## 🛠 Installation

```bash
npm install hierarchical-area-logger
# or
yarn add hierarchical-area-logger

```

---

## 💡 Functionality Showcase

### 1. Basic Scoped Logging

Instead of a flat stream of text, the logger categorizes logs into logical areas.

```typescript
import { createLogger } from 'hierarchical-area-logger';

const logger = createLogger({
  details: { instance: 'payment-gateway' },
  eventId: crypto.randomUUID(),
});

const checkout = logger.getArea('checkout-process');

checkout.info('User started checkout');
checkout.warn('Retry attempt 1 for payment');
checkout.error('Transaction failed', new Error('Timeout'));

// View the structured output
console.log(logger.dump());
```

### 2. Request Traceability

Track a request across your system by linking `eventId` and `parentEventId`.

```typescript
const logger = createLogger({
  details: { instance: 'payment-gateway' },
  eventId: crypto.randomUUID(),
  path: '/api/v1/user',
  parentEventId: 'incoming-request-id-001',
});

console.log(logger.eventId); // ID provided via eventId
console.log(logger.retrieveRootPayload().parentEventId); // 'incoming-request-id-001'
```

### 3. Log Hydration & State Management

You can pre-populate a logger with existing log data — useful for consolidating logs from multiple micro-tasks or continuing a flow started elsewhere. Hydration accepts `LogData` or an array of `OrderedLogEvent`s; when the data carries a valid root payload, it is adopted and its `eventId` is reused.

```typescript
const mainLogger = createLogger({
  details: { instance: 'orchestrator' },
  eventId: crypto.randomUUID(),
  populateLog: {
    root: [
      {
        type: 'info',
        message: 'Log started',
        payload: {
          eventId: 'upstream-event-001',
          details: { instance: 'orchestrator' },
        },
        timestamp: Date.now(),
      },
    ],
    'worker-1': [
      { type: 'info', message: 'Task complete', timestamp: Date.now() },
    ],
  },
});

console.log(mainLogger.eventId); // 'upstream-event-001'
```

---

## 📖 API Reference

### `createLogger(options)`

Factory function to initialize a new `Logger` instance. `details` and `eventId` are required; `details` can carry any additional fields, typed via the `Details`/`Logger` generic parameter.

| Option                | Type                           | Required | Description                                                                                                  |
| --------------------- | ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `details`             | `Details`                      | ✓        | Metadata about the instance or environment. `instance` is required.                                          |
| `eventId`             | `string`                       | ✓        | The event ID for this logging session, stored in the root payload.                                           |
| `path`                | `string`                       |          | The request path/route, stored in the root payload.                                                          |
| `method`              | `Method`                       |          | HTTP method (`get`, `post`, `put`, `delete`, `patch`, `head`, `options`, `trace`, `connect`).                |
| `parentEventId`       | `string`                       |          | ID of the event that triggered this one, stored in the root payload.                                         |
| `expectParentEventId` | `boolean`                      |          | Logs an error entry when `parentEventId` is expected but missing.                                            |
| `populateLog`         | `LogData \| OrderedLogEvent[]` |          | Pre-populate the logger with existing log data. A valid root payload is adopted and its `eventId` is reused. |
| `dumpOptions`         | `DumpLoggerOptions`            |          | Default options applied by `dump()`/`dumpFlat()`; per-call options override them.                            |

### `Logger` instance

Properties:

- **`eventId: string`** — the unique ID of this logging session (provided via the `eventId` option, or adopted from populated log data).

#### `getArea(name)`

Returns a scoped logger for a specific area, creating it lazily on first use.

The returned area logger exposes:

- `.info(message, payload?)`
- `.warn(message, payload?)`
- `.error(message, payload? | Error)` — `Error` instances are converted to `{ message, name, stack }`
- `.log(message, payload?)`
- `.debug(message, payload?)`

#### `dump(options?)`

Returns the current log data as a `LogData` object (areas mapped to arrays of entries), derived from the internal flat list of ordered log events.

| Option            | Type             | Default | Description                                                                |
| ----------------- | ---------------- | ------- | -------------------------------------------------------------------------- |
| `omitRoot`        | `boolean`        | `false` | Excludes `root` holder events from the output.                             |
| `finalizeLog`     | `boolean`        | `true`  | Appends a "Log completed" entry (with `totalDuration`) to the `root` area. |
| `excludeLogTypes` | `LogEntryType[]` | —       | Entry types to remove from every area. No types are excluded by default.   |

Areas without entries are omitted from the returned object. Dumps work on a copy of the internal log, so calling `dump()` repeatedly always returns the same result.

Options are merged in this order (later wins): built-in defaults → constructor `dumpOptions` → per-call options.

```typescript
// Configure dump defaults once at construction:
const logger = createLogger({
  details: { instance: 'payment-gateway' },
  eventId: crypto.randomUUID(),
  dumpOptions: { excludeLogTypes: ['debug'], omitRoot: true },
});

// Both calls honor the construction defaults; per-call options override them:
logger.dump(); // no root, no debug entries
logger.dump({ omitRoot: false }); // root included, still no debug entries
```

#### `dumpFlat(options?)`

Same options and processing as `dump`, but returns the internal flat `OrderedLogEvent[]` — the chronological list of events, each tagged with the name of its `holder` area — instead of grouping them into a `LogData` object.

#### `retrieveAreaEvents(area, excludeLogTypes?)`

Returns every `LogEntry` logged for the given area (an empty array when the area has never been used). When `excludeLogTypes` is provided, entries of the listed types are filtered out.

#### `retrieveRootPayload()`

Returns the root payload — the payload of the first entry in the `root` area (`path`, `method`, `eventId`, `parentEventId`, `details`).

### Exported Utilities

#### `prettyError(error)`

Converts an `Error` into a structured `{ message, name, stack }` object, with the stack trace cleaned up (no `Error: ` lines, no `file://` prefixes, truncated absolute paths).

```typescript
import { prettyError } from 'hierarchical-area-logger';

const structured = prettyError(new Error('Boom'));
// { message: 'Boom', name: 'Error', stack: ['at ...', ...] }
```

#### `orderLogEvents(logData)`

Flattens a `LogData` object into a single array of events sorted by timestamp in ascending order. Each event is tagged with the name of its holder area.

```typescript
import { orderLogEvents } from 'hierarchical-area-logger';

const logData = {
  'db-layer': [{ type: 'info', message: 'Query complete', timestamp: 200 }],
  root: [{ type: 'info', message: 'Log started', timestamp: 100 }],
};

const ordered = orderLogEvents(logData);
// [
//   { holder: 'root', type: 'info', message: 'Log started', timestamp: 100 },
//   { holder: 'db-layer', type: 'info', message: 'Query complete', timestamp: 200 },
// ]
```

#### `groupLogEvents(events)`

The inverse of `orderLogEvents`: groups an array of `OrderedLogEvent`s back into a `LogData` object keyed by the holder area of each event.

```typescript
import { groupLogEvents } from 'hierarchical-area-logger';

const logData = groupLogEvents([
  { holder: 'root', type: 'info', message: 'Log started', timestamp: 100 },
  {
    holder: 'db-layer',
    type: 'info',
    message: 'Query complete',
    timestamp: 200,
  },
]);
```

### Exported Guards

Type guards that narrow an `unknown` value to the library's log types by validating its structure.

- **`isLogData(data)`** — narrows to `LogData` (a non-array object whose values are arrays of valid log entries).
- **`isOrderedLogEvents(data)`** — narrows to `OrderedLogEvent[]` (log entries tagged with a string `holder`).
- **`hasRootPayload(log)`** — narrows to an `OrderedLogEvent[]` containing a valid root payload (a `root` holder event whose payload carries a string `eventId` and a `details` object with a string `instance`).

```typescript
import {
  isLogData,
  isOrderedLogEvents,
  hasRootPayload,
} from 'hierarchical-area-logger';

if (isLogData(value)) {
  // value is LogData here
} else if (isOrderedLogEvents(value)) {
  // value is OrderedLogEvent[] here
}

if (hasRootPayload(value)) {
  // value is an OrderedLogEvent[] with a valid root payload here
}
```

### Exported Types

`LogData`, `LogEntry`, `LogEntryType`, `Details`, `RootPayload`, `OrderedLogEvent`, `DumpLoggerOptions`.

---

## 🧪 Development & Testing

This project uses **Vitest** for unit testing.

```bash
# Run tests
npm test

# Run tests with coverage
npm run coverage

```

> **Note:** Every logger seeds its `root` area with a "Log started" entry. With `finalizeLog` enabled (the default), `dump()` and `dumpFlat()` append a "Log completed" entry carrying the total request duration.
