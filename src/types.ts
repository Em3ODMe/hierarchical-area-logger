export type Details<
  AdditionalDetails extends Record<string, unknown> = Record<string, unknown>,
> = {
  instance: string;
} & AdditionalDetails;

export type Method =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'head'
  | 'options'
  | 'trace'
  | 'connect';

export type LogEntryType = 'info' | 'warn' | 'error' | 'log' | 'debug';

export type CreateRootLogEntryOptions<
  AdditionalDetails extends Record<string, unknown> = Record<string, unknown>,
> = RootPayload<AdditionalDetails> & {
  expectParentEventId?: boolean;
};

export type CheckRootStructure = Omit<CreateRootLogEntryOptions, 'eventId'>;

export type LogData = Record<string, LogEntry[]>;

export type OrderedLogEvent = LogEntry & { holder: string };

export interface LogEntry {
  type: LogEntryType;
  message: string;
  payload?: object;
  timestamp: number;
}

export interface RootPayload<
  AdditionalDetails extends Record<string, unknown> = Record<string, unknown>,
> {
  eventId: string;
  details: Details<AdditionalDetails>;
  path?: string;
  method?: Method;
  parentEventId?: string;
}

export interface CreateRootOptions {
  expectParentEventId?: boolean;
}

export interface LoggerOptions<
  AdditionalDetails extends Record<string, unknown> = Record<string, unknown>,
> {
  populateLog?: LogData | OrderedLogEvent[];
  parentEventId?: string;
  expectParentEventId?: boolean;
  details: Details<AdditionalDetails>;
  path?: string;
  method?: Method;
  dumpOptions?: DumpLoggerOptions;
  eventId: string;
}

export interface DumpLoggerOptions {
  omitRoot?: boolean;
  finalizeLog?: boolean;
  excludeLogTypes?: LogEntryType[];
}

export interface GetAreaMethods {
  info: (message: string, payload?: LogEntry['payload']) => void;
  warn: (message: string, payload?: LogEntry['payload']) => void;
  error: (message: string, payload?: LogEntry['payload'] | Error) => void;
  log: (message: string, payload?: LogEntry['payload']) => void;
  debug: (message: string, payload?: LogEntry['payload']) => void;
}
