import type { DumpLoggerOptions } from './types';

/**
 * Default options applied by `Logger#dump` / `Logger#dumpFlat`: keep the
 * `root` area and append the final "Request completed" entry. No log entry
 * types are excluded unless `excludeLogTypes` is passed explicitly.
 */
export const DEFAULT_PREPARE_DUMP_OPTIONS: DumpLoggerOptions = {
  omitRoot: false,
  finalizeLog: true,
};
