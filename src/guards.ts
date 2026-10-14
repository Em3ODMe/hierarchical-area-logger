import type {
  Details,
  LogData,
  LogEntry,
  LogEntryType,
  OrderedLogEvent,
  RootPayload,
} from './types';

const isLogEntryType = (value: unknown): value is LogEntryType => {
  return (
    value === 'info' ||
    value === 'warn' ||
    value === 'error' ||
    value === 'log' ||
    value === 'debug'
  );
};

const isLogEntry = (value: unknown): value is LogEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    isLogEntryType(entry.type) &&
    typeof entry.message === 'string' &&
    typeof entry.timestamp === 'number' &&
    (entry.payload === undefined ||
      (typeof entry.payload === 'object' && entry.payload !== null))
  );
};

/**
 * Type guard: checks whether the given value is an ordered log event array
 * containing a valid root payload — a `root` holder event whose payload
 * carries a string `eventId` and a `details` object with a string `instance`.
 */
export const hasRootPayload = (log: unknown): log is OrderedLogEvent[] => {
  if (!isOrderedLogEvents(log)) return false;

  const rootEvent = log.find((event) => event.holder === 'root');
  if (!rootEvent) return false;

  const rootPayload = rootEvent.payload as RootPayload | undefined;
  if (typeof rootPayload !== 'object' || rootPayload === null) return false;

  if (typeof rootPayload.eventId !== 'string') return false;

  const details = rootPayload.details as Details | null;
  if (typeof details !== 'object' || details === null) return false;

  return typeof details.instance === 'string';
};

/**
 * Type guard: checks whether the given value is a valid `LogData` object (a
 * non-array object whose values are arrays of log entries).
 */
export const isLogData = (data: unknown): data is LogData => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  return Object.values(data).every(
    (area) => Array.isArray(area) && area.every((entry) => isLogEntry(entry))
  );
};

/**
 * Type guard: checks whether the given value is a valid array of
 * `OrderedLogEvent`s (log entries tagged with a `holder` area name).
 */
export const isOrderedLogEvents = (
  data: unknown
): data is OrderedLogEvent[] => {
  if (!Array.isArray(data)) return false;
  return data.every((event) => {
    if (typeof event !== 'object' || event === null) return false;
    const ordered = event as Record<string, unknown>;
    return typeof ordered.holder === 'string' && isLogEntry(event);
  });
};
