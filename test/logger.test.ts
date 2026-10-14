import { describe, it, expect } from 'vitest';
import { createLogger, Logger } from '../src/Logger';
import type { Details, LogData, OrderedLogEvent } from '../src/types';

describe('Logger', () => {
  const mockDetails: Details = { instance: 'test-instance' };
  const eventId = `event-test-instance`;

  it('should create a logger with details', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should create a logger with custom options', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      path: 'test-path',
      parentEventId: 'parent-123',
    });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should create area logger and log messages', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test info message');
    areaLogger.warn('test warn message');
    areaLogger.error('test error message');

    const logs = logger.dump({ finalizeLog: false });
    expect(logs['test-area']).toHaveLength(3);
    expect(logs['test-area'][0].message).toBe('test info message');
    expect(logs['test-area'][1].type).toBe('warn');
    expect(logs['test-area'][2].type).toBe('error');
  });

  it('should create event IDs via eventId', () => {
    const logger = createLogger({ details: mockDetails, eventId });

    expect(logger.eventId).toBe('event-test-instance');
  });

  it('should store the parent event ID in the root payload', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      parentEventId: 'parent-123',
    });

    expect(logger.retrieveRootPayload().parentEventId).toBe('parent-123');
  });

  it('should adopt populated log data and sync the event id', () => {
    const populated: LogData = {
      root: [
        {
          type: 'info',
          message: 'Log started',
          payload: {
            path: '/populated',
            details: mockDetails,
            eventId: 'populated-event-id',
          },
          timestamp: 1000,
        },
      ],
      'area-a': [{ type: 'info', message: 'from population', timestamp: 2000 }],
    };

    const logger = createLogger({
      details: mockDetails,
      eventId,
      populateLog: populated,
    });

    expect(logger.eventId).toBe('populated-event-id');

    const logs = logger.dump({ finalizeLog: false });
    expect(logs.root).toHaveLength(1);
    expect(logs['area-a'][0].message).toBe('from population');
  });

  it('should populate from ordered log events', () => {
    const events: OrderedLogEvent[] = [
      {
        holder: 'root',
        type: 'info',
        message: 'Log started',
        payload: { details: mockDetails, eventId: 'ordered-event-id' },
        timestamp: 1000,
      },
      { holder: 'area-a', type: 'info', message: 'grouped', timestamp: 2000 },
    ];

    const logger = createLogger({
      details: mockDetails,
      eventId,
      populateLog: events,
    });

    expect(logger.eventId).toBe('ordered-event-id');

    const logs = logger.dump({ finalizeLog: false });
    expect(logs.root).toHaveLength(1);
    expect(logs['area-a'][0].message).toBe('grouped');
  });

  it('should ignore populated log data without a valid root payload', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      populateLog: {
        'area-a': [{ type: 'info', message: 'orphan', timestamp: 1000 }],
      },
    });

    const logs = logger.dump({ finalizeLog: false });

    expect(logs.root).toBeDefined();
    expect(logs['area-a']).toBeUndefined();
    expect(logger.eventId).toBe(eventId);
    expect(logger.retrieveRootPayload().eventId).toBe(eventId);
  });

  it('should ignore invalid populateLog values', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      populateLog: 'garbage' as unknown as LogData,
    });

    const logs = logger.dump({ finalizeLog: false });

    expect(logs.root).toBeDefined();
    expect(logs.root).toHaveLength(1);
    expect(logger.eventId).toBe(eventId);
  });

  it('should finalize the root area with a completion entry', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      path: 'test',
    });
    const logs = logger.dump();

    expect(logs.root).toBeDefined();
    expect(logs.root).toHaveLength(2);
    expect(logs.root[0].message).toBe('Log started');
    expect(logs.root[1].message).toBe('Log completed');
    expect(logs.root[1].payload).toHaveProperty('totalDuration');
  });

  it('should not append a completion entry when finalizeLog is disabled', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      path: 'test',
    });
    const logs = logger.dump({ finalizeLog: false });

    expect(logs.root).toHaveLength(1);
    expect(logs.root[0].message).toBe('Log started');
  });

  it('should not mutate the log on repeated finalizing dumps', () => {
    const logger = createLogger({ details: mockDetails, eventId });

    const first = logger.dump();
    expect(first.root).toHaveLength(2);

    const second = logger.dump();
    expect(second.root).toHaveLength(2);
    expect(second.root.map((entry) => entry.message)).toEqual([
      'Log started',
      'Log completed',
    ]);
  });

  it('should apply dumpOptions provided at construction', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      dumpOptions: { omitRoot: true },
    });
    logger.getArea('area-a').info('message a');

    const logs = logger.dump();

    expect(logs.root).toBeUndefined();
    expect(logs['area-a']).toHaveLength(1);
  });

  it('should apply construction dumpOptions to dumpFlat', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      dumpOptions: { omitRoot: true },
    });
    logger.getArea('area-a').info('message a');

    const flat = logger.dumpFlat();

    expect(flat.some((event) => event.holder === 'root')).toBe(false);
    expect(flat.some((event) => event.holder === 'area-a')).toBe(true);
  });

  it('should exclude log types configured at construction', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      dumpOptions: { excludeLogTypes: ['debug'] },
    });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test message');
    areaLogger.debug('test debug');

    const logs = logger.dump({ finalizeLog: false });
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test message',
    ]);
  });

  it('should skip finalization when disabled at construction', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      dumpOptions: { finalizeLog: false },
    });

    const logs = logger.dump();
    expect(logs.root).toHaveLength(1);
    expect(logs.root[0].message).toBe('Log started');
  });

  it('should let per-call options override construction dumpOptions', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      dumpOptions: { omitRoot: true, excludeLogTypes: ['debug'] },
    });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test message');
    areaLogger.debug('test debug');

    // Per-call omitRoot wins over the construction default; the
    // construction excludeLogTypes still applies.
    const logs = logger.dump({ omitRoot: false, finalizeLog: false });

    expect(logs.root).toBeDefined();
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test message',
    ]);
  });

  it('should exclude the root area when omitRoot is set', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    logger.getArea('area-a').info('message a');

    const logs = logger.dump({ omitRoot: true });

    expect(logs.root).toBeUndefined();
    expect(logs['area-a']).toHaveLength(1);
  });

  it('should keep the root area intact for later dumps after omitRoot', () => {
    const logger = createLogger({ details: mockDetails, eventId });

    logger.dump({ omitRoot: true });

    const logs = logger.dump({ finalizeLog: false });
    expect(logs.root).toBeDefined();
    expect(logs.root).toHaveLength(1);
  });

  it('should handle errors in error logging', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    const testError = new Error('Test error');
    areaLogger.error('error occurred', testError);

    const logs = logger.dump({ finalizeLog: false });
    expect(logs['test-area'][0].payload).toHaveProperty(
      'message',
      'Test error'
    );
  });

  it('should lazily create an area without entries', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    logger.getArea('test-area');

    expect(logger.retrieveAreaEvents('test-area')).toEqual([]);

    // Empty areas are dropped from dump output
    const logs = logger.dump();
    expect(logs['test-area']).toBeUndefined();
  });

  it('should reuse an existing area', () => {
    const logger = createLogger({ details: mockDetails, eventId });

    logger.getArea('test-area').info('first');
    logger.getArea('test-area').info('second');

    const logs = logger.dump({ finalizeLog: false });
    expect(logs['test-area']).toHaveLength(2);
  });

  it('should record all log levels', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test message');
    areaLogger.warn('test warning');
    areaLogger.error('test error');
    areaLogger.debug('test debug');
    areaLogger.log('test log');

    const logs = logger.dump({ finalizeLog: false });
    expect(logs['test-area']).toHaveLength(5);
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test message',
      'test warning',
      'test error',
      'test debug',
      'test log',
    ]);
  });

  it('should keep debug entries by default', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test message');
    areaLogger.debug('test debug');

    const logs = logger.dump({ finalizeLog: false });
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test message',
      'test debug',
    ]);
  });

  it('should exclude debug entries when excludeLogTypes is set', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test message');
    areaLogger.warn('test warning');
    areaLogger.error('test error');
    areaLogger.debug('test debug');
    areaLogger.log('test log');

    const logs = logger.dump({ excludeLogTypes: ['debug'] });
    expect(logs['test-area']).toHaveLength(4);
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test message',
      'test warning',
      'test error',
      'test log',
    ]);
  });

  it('should honor custom excludeLogTypes in dumps', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test message');
    areaLogger.warn('test warning');
    areaLogger.error('test error');
    areaLogger.debug('test debug');
    areaLogger.log('test log');

    const logs = logger.dump({ excludeLogTypes: ['info', 'warn'] });
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test error',
      'test debug',
      'test log',
    ]);
  });

  it('should not filter entries when excludeLogTypes is an empty list', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    areaLogger.info('test message');
    areaLogger.debug('test debug');

    const logs = logger.dump({ excludeLogTypes: [] });
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test message',
      'test debug',
    ]);
  });

  it('should exclude empty areas from dumps', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('test-area');

    logger.getArea('test-area-empty');

    areaLogger.info('test message');
    areaLogger.warn('test warning');
    areaLogger.error('test error');
    areaLogger.debug('test debug');
    areaLogger.log('test log');

    const logs = logger.dump({ excludeLogTypes: ['debug'] });
    expect(logs['test-area-empty']).toBeUndefined();
    expect(logs['test-area']).toHaveLength(4);
    expect(logs['test-area'].map((entry) => entry.message)).toEqual([
      'test message',
      'test warning',
      'test error',
      'test log',
    ]);
  });

  it('should handle expectParentEventId true without parentEventId', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      expectParentEventId: true,
    });

    const logs = logger.dump();
    expect(logs.root).toHaveLength(3);
    expect(logs.root[1].type).toBe('error');
    expect(logs.root[1].message).toBe(
      'Parent event ID expected but not provided'
    );
  });

  it('should flatten logs with dumpFlat', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    logger.getArea('area-a').info('message a');

    const flat = logger.dumpFlat({ finalizeLog: false });

    expect(Array.isArray(flat)).toBe(true);
    expect(flat).toHaveLength(2);
    expect(flat.every((event) => typeof event.holder === 'string')).toBe(true);
    expect(flat.map((event) => event.holder).sort()).toEqual([
      'area-a',
      'root',
    ]);

    const timestamps = flat.map((event) => event.timestamp);
    expect([...timestamps].sort((a, b) => a - b)).toEqual(timestamps);
  });

  it('should apply dump options through dumpFlat', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    logger.getArea('area-a').info('message a');

    const flat = logger.dumpFlat({ omitRoot: true });

    expect(flat.some((event) => event.holder === 'root')).toBe(false);
    expect(flat.some((event) => event.holder === 'area-a')).toBe(true);
  });

  it('should retrieve events for an area', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    logger.getArea('area-a').info('hello');

    const events = logger.retrieveAreaEvents('area-a');
    expect(events).toHaveLength(1);
    expect(events[0].message).toBe('hello');
  });

  it('should return an empty array for unknown areas', () => {
    const logger = createLogger({ details: mockDetails, eventId });

    expect(logger.retrieveAreaEvents('missing')).toEqual([]);
  });

  it('should retrieve area events excluding given log types', () => {
    const logger = createLogger({ details: mockDetails, eventId });
    const areaLogger = logger.getArea('area-a');

    areaLogger.info('info entry');
    areaLogger.debug('debug entry');
    areaLogger.error('error entry');

    const events = logger.retrieveAreaEvents('area-a', ['debug']);

    expect(events.map((entry) => entry.message)).toEqual([
      'info entry',
      'error entry',
    ]);
  });

  it('should retrieve the root payload', () => {
    const logger = createLogger({
      details: mockDetails,
      eventId,
      path: '/api/test',
      method: 'get',
      parentEventId: 'parent-123',
    });

    const rootPayload = logger.retrieveRootPayload();

    expect(rootPayload.eventId).toBe('event-test-instance');
    expect(rootPayload.path).toBe('/api/test');
    expect(rootPayload.method).toBe('get');
    expect(rootPayload.parentEventId).toBe('parent-123');
    expect(rootPayload.details).toEqual(mockDetails);
  });
});

describe('createLogger', () => {
  const mockdetails: Details = { instance: 'test-instance' };

  it('should create a logger instance', () => {
    const logger = createLogger({
      details: mockdetails,
      eventId: 'event-id',
    });
    expect(logger).toBeInstanceOf(Logger);
  });

  it('should create a logger with options', () => {
    const logger = createLogger({
      details: mockdetails,
      eventId: 'event-id',
      path: 'test-path',
      parentEventId: 'parent-123',
    });
    expect(logger).toBeInstanceOf(Logger);
  });
});
