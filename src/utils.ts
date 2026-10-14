import {
  CreateRootLogEntryOptions,
  LogData,
  LogEntryType,
  OrderedLogEvent,
  RootPayload,
} from './types';

/**
 * Cleans up an error stack trace: removes `Error: ` lines, trims whitespace,
 * strips `file://` prefixes, and truncates absolute paths up to `.wrangler/`
 * or `node_modules/`.
 */
export const prettyStack = (stack?: string): string[] => {
  if (!stack) return [];
  let toReplace = '';

  const regex = /file:\/\/\/(.*)(\.wrangler|node_modules)\/.*\)/gm;
  const m = regex.exec(stack);

  if (m && m.length > 1) {
    toReplace = m[1];
  }

  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('Error: '))
    .map((line) => line.replace(toReplace, ''))
    .map((line) => line.replace('file://', ''));
};

/**
 * Converts an Error into a `{ message, name, stack }` object with the stack cleaned
 * up by `prettyStack`.
 */
export const prettyError = (
  err: Error
): {
  message: string;
  name: string;
  stack: string[];
} => {
  const stack = prettyStack(err.stack);
  const message = err.message;
  const name = err.name;
  return { message, name, stack };
};

/**
 * Creates the initial ordered log events: a `root` "Request received" event.
 * When `expectParentEventId` is set but no `parentEventId` is provided, a
 * `root` error event is appended.
 */
export const createRootLogEntry = <
  AdditionalDetails extends Record<string, unknown> = Record<string, unknown>,
>({
  path,
  method,
  details,
  eventId,
  parentEventId,
  expectParentEventId,
}: CreateRootLogEntryOptions<AdditionalDetails>): OrderedLogEvent[] => {
  const rootLogEvents: OrderedLogEvent[] = [
    {
      holder: 'root',
      type: 'info',
      message: 'Log started',
      payload: {
        eventId,
        details,
        ...(path && { path }),
        ...(method && { method }),
        ...(parentEventId && { parentEventId }),
      } as RootPayload,
      timestamp: Date.now(),
    },
  ];

  if (expectParentEventId && !parentEventId) {
    rootLogEvents.push({
      holder: 'root',
      type: 'error',
      message: 'Parent event ID expected but not provided',
      timestamp: Date.now(),
    });
  }

  return rootLogEvents;
};

/**
 * Returns the given ordered log events without those whose type is listed in
 * `excludeLogTypes`. When no types are provided, the events are returned
 * unchanged.
 */
export const excludeLogEntryTypes = (
  events: OrderedLogEvent[],
  excludeLogTypes?: LogEntryType[]
): OrderedLogEvent[] => {
  if (!excludeLogTypes || excludeLogTypes.length === 0) return events;
  return events.filter((event) => !excludeLogTypes.includes(event.type));
};

/**
 * Flattens log data into a single array of events sorted by timestamp in
 * ascending order, tagging each event with the name of its holder area.
 */
export const orderLogEvents = (logData: LogData): OrderedLogEvent[] => {
  return (
    Object.entries(logData)
      // 1. Flatten the object into a 1D array while mapping the holder name
      .flatMap(([holder, events]) =>
        events.map((event) => ({
          holder,
          ...event,
        }))
      )
      // 2. Sort the combined array by timestamp (ascending order)
      .sort((a, b) => a.timestamp - b.timestamp)
  );
};

/**
 * Groups ordered log events back into a `LogData` object keyed by the holder
 * area of each event, preserving the relative order within each area.
 */
export const groupLogEvents = (events: OrderedLogEvent[]): LogData => {
  const logData: LogData = {};
  for (const { holder, ...entry } of events) {
    if (!logData[holder]) {
      logData[holder] = [];
    }
    logData[holder].push(entry);
  }
  return logData;
};
