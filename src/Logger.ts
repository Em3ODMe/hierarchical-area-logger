import {
  createRootLogEntry,
  excludeLogEntryTypes,
  groupLogEvents,
  orderLogEvents,
  prettyError,
} from './utils';
import type {
  DumpLoggerOptions,
  GetAreaMethods,
  LogData,
  LogEntry,
  LogEntryType,
  LoggerOptions,
  OrderedLogEvent,
  RootPayload,
} from './types';
import { hasRootPayload, isLogData, isOrderedLogEvents } from './guards';
import { DEFAULT_PREPARE_DUMP_OPTIONS } from './constants';

export class Logger<
  AdditionalDetails extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Unique ID identifying this logging session (provided via `eventId` or adopted from populated log data). */
  public eventId: string;
  private log: OrderedLogEvent[];
  private logPopulated: boolean;
  private dumpOptions?: DumpLoggerOptions;

  /**
   * Creates a new logger. Unless populated from `populateLog`, a `root`
   * "Log started" event is seeded and `eventId` is set via
   * `eventId`. When `populateLog` carries a valid root payload, it is
   * adopted instead and `eventId` is re-synced from it. `dumpOptions` act as
   * defaults for `dump`/`dumpFlat` and can be overridden per call.
   */
  constructor({
    details,
    path,
    method,
    parentEventId,
    expectParentEventId,
    populateLog,
    dumpOptions,
    eventId,
  }: LoggerOptions<AdditionalDetails>) {
    this.dumpOptions = dumpOptions;
    this.logPopulated = false;
    this.eventId = 'unknown';
    this.log = [];

    if (populateLog) {
      if (isOrderedLogEvents(populateLog)) {
        this.log = this.finalizeHydratedLog(populateLog);
      } else if (isLogData(populateLog)) {
        this.log = this.finalizeHydratedLog(orderLogEvents(populateLog));
      }
    }

    if (!this.logPopulated) {
      this.eventId = eventId;

      this.log = createRootLogEntry<AdditionalDetails>({
        eventId: this.eventId,
        path,
        method,
        details,
        parentEventId,
        expectParentEventId,
      });
    }
  }

  /**
   * Adopts the populated log when it contains a valid root payload
   * (re-syncing `eventId` from it). Populated data without a valid root
   * payload is discarded in favor of the freshly created log.
   */
  private finalizeHydratedLog(log: OrderedLogEvent[]): OrderedLogEvent[] {
    if (hasRootPayload(log)) {
      const { eventId } = this.getRootPayload(log);
      this.eventId = eventId;
      this.logPopulated = true;
      return log;
    }
    return this.log;
  }

  /**
   * Appends the closing "Log completed" event to the `root` holder,
   * carrying the total duration since the "Log started" event.
   */
  private finalizeLog(log: OrderedLogEvent[]): OrderedLogEvent[] {
    // A logger always holds a `root` event after construction
    const rootEvent = log.find((event) => event.holder === 'root')!;

    log.push({
      holder: 'root',
      type: 'info',
      message: 'Log completed',
      payload: {
        totalDuration: Date.now() - rootEvent.timestamp,
      },
      timestamp: Date.now(),
    });
    return log;
  }

  /**
   * Pushes a single ordered log event into the given area. `Error` payloads
   * are converted into structured objects via `prettyError`.
   */
  private addMessage(
    name: string,
    type: LogEntryType,
    message: string,
    rawPayload?: LogEntry['payload'] | Error
  ): void {
    const payload =
      rawPayload instanceof Error ? prettyError(rawPayload) : rawPayload;

    this.log.push({
      holder: name,
      type,
      message,
      payload,
      timestamp: Date.now(),
    });
  }

  /**
   * Extracts the root payload — the payload of the first event held by the
   * `root` area.
   */
  private getRootPayload(log: OrderedLogEvent[]): RootPayload {
    return log.find((event) => event.holder === 'root')!.payload as RootPayload;
  }

  /**
   * Returns a scoped logging API for an area.
   *
   * The returned API exposes `info`, `warn`, `error`, `log` and `debug`;
   * `error` also accepts `Error` instances as its payload.
   */
  public getArea(name: string): GetAreaMethods {
    return {
      info: (message, payload) =>
        this.addMessage(name, 'info', message, payload),
      warn: (message, payload) =>
        this.addMessage(name, 'warn', message, payload),
      error: (message, payload) =>
        this.addMessage(name, 'error', message, payload),
      log: (message, payload) => this.addMessage(name, 'log', message, payload),
      debug: (message, payload) =>
        this.addMessage(name, 'debug', message, payload),
    };
  }

  /**
   * Applies the dump options to a copy of the internal ordered log events
   * and returns the processed list. The internal log is never mutated.
   *
   * Options are merged in this order (later wins):
   * `DEFAULT_PREPARE_DUMP_OPTIONS` → constructor `dumpOptions` → per-call
   * `opts`.
   *
   * Defaults (see `DEFAULT_PREPARE_DUMP_OPTIONS`):
   * - `omitRoot: false` — `root` holder events are kept in the output.
   * - `finalizeLog: true` — a "Log completed" event is appended to the
   *   `root` holder.
   * - `excludeLogTypes` — when provided, events of the listed types are
   *   removed; no types are excluded by default.
   */
  private prepareLog(opts?: DumpLoggerOptions): OrderedLogEvent[] {
    const { omitRoot, finalizeLog, excludeLogTypes } = {
      ...DEFAULT_PREPARE_DUMP_OPTIONS,
      ...this.dumpOptions,
      ...opts,
    };

    let localLog: OrderedLogEvent[] = [...this.log];

    if (omitRoot) {
      localLog = localLog.filter((event) => event.holder !== 'root');
    }

    if (finalizeLog && !omitRoot) {
      localLog = this.finalizeLog(localLog);
    }

    if (excludeLogTypes) {
      localLog = excludeLogEntryTypes(localLog, excludeLogTypes);
    }

    return localLog;
  }

  /**
   * Returns the current log data as a `LogData` object (areas mapped to
   * arrays of entries) after applying the dump options. Areas without
   * entries are omitted from the returned object.
   */
  public dump(opts?: DumpLoggerOptions): LogData {
    return groupLogEvents(this.prepareLog(opts));
  }

  /**
   * Returns the current log data as an `OrderedLogEvent[]` — the flat,
   * chronological list of events each tagged with the name of its holder
   * area — after applying the same options as `dump`.
   */
  public dumpFlat(opts?: DumpLoggerOptions): OrderedLogEvent[] {
    return this.prepareLog(opts);
  }

  /**
   * Returns every entry logged for the given area (an empty array when the
   * area has never been used). When `excludeLogTypes` is provided, entries
   * of the listed types are filtered out.
   */
  public retrieveAreaEvents(
    area: string,
    excludeLogTypes?: LogEntryType[]
  ): LogEntry[] {
    const areaEvents = this.log.filter((event) => event.holder === area);

    return excludeLogEntryTypes(areaEvents, excludeLogTypes).map(
      ({ holder: _holder, ...entry }) => entry
    );
  }

  /**
   * Returns the root payload — the payload of the first event held by the
   * `root` area (`path`, `method`, `eventId`, `parentEventId`, `details`).
   */
  public retrieveRootPayload(): RootPayload {
    return this.getRootPayload(this.log);
  }
}

// Factory function for convenience
export const createLogger = <
  AdditionalDetails extends Record<string, unknown> = Record<string, unknown>,
>(
  options: LoggerOptions<AdditionalDetails>
): Logger<AdditionalDetails> => {
  return new Logger(options);
};
