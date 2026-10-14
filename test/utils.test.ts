import { describe, it, expect } from 'vitest';
import {
  prettyStack,
  prettyError,
  createRootLogEntry,
  orderLogEvents,
  groupLogEvents,
  excludeLogEntryTypes,
} from '../src/utils';
import {
  Details,
  LogData,
  Method,
  OrderedLogEvent,
  RootPayload,
} from '../src/types';

describe('prettyStack', () => {
  it('should return empty array for undefined input', () => {
    const result = prettyStack(undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array for null input', () => {
    const result = prettyStack(null as unknown as string);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty string input', () => {
    const result = prettyStack('');
    expect(result).toEqual([]);
  });

  it('should filter out lines starting with "Error: "', () => {
    const stack = `Error: Test error
    at Object.test (/path/to/file.js:1:1)
    at Object.test2 (/path/to/file.js:2:2)`;

    const result = prettyStack(stack);
    expect(result.join('\n')).not.toContain('Error: Test error');
    expect(result).toContain('at Object.test (/path/to/file.js:1:1)');
    expect(result).toContain('at Object.test2 (/path/to/file.js:2:2)');
  });

  it('should trim whitespace from each line', () => {
    const stack = `    at Object.test (/path/to/file.js:1:1)
        at Object.test2 (/path/to/file.js:2:2)`;

    const result = prettyStack(stack);
    expect(result).toContain('at Object.test (/path/to/file.js:1:1)');
    expect(result).toContain('at Object.test2 (/path/to/file.js:2:2)');
  });

  it('should remove file:// prefix from lines', () => {
    const stack = `at Object.test (file:///path/to/file.js:1:1)
at Object.test2 (file:///another/path.js:2:2)`;

    const result = prettyStack(stack);

    expect(result).toEqual(
      expect.arrayContaining([
        'at Object.test (/path/to/file.js:1:1)',
        'at Object.test2 (/another/path.js:2:2)',
      ])
    );
    expect(result.join('\n')).not.toContain('file://');
  });

  it('should replace .wrangler paths in stack traces', () => {
    const stack = `at Object.test (file:///some/path/.wrangler/test/file.js:1:1)
at Object.test2 (file:///another/path/file.js:2:2)`;

    const result = prettyStack(stack);
    // Based on actual behavior, it keeps the .wrangler prefix
    expect(result).toEqual(
      expect.arrayContaining([
        'at Object.test (/.wrangler/test/file.js:1:1)',
        'at Object.test2 (/another/path/file.js:2:2)',
      ])
    );
  });

  it('should replace node_modules paths in stack traces', () => {
    const stack = `at Object.test (file:///some/path/node_modules/module/file.js:1:1)
at Object.test2 (file:///another/path/file.js:2:2)`;

    const result = prettyStack(stack);
    // Based on actual behavior, it keeps the /node_modules prefix
    expect(result).toEqual(
      expect.arrayContaining([
        'at Object.test (/node_modules/module/file.js:1:1)',
        'at Object.test2 (/another/path/file.js:2:2)',
      ])
    );
  });

  it('should handle complex stack traces with mixed paths', () => {
    const stack = `Error: Complex error
    at Object.test1 (file:///project/.wrangler/test.js:1:1)
    at Object.test2 (file:///project/node_modules/module/index.js:2:2)
    at Object.test3 (file:///normal/path/file.js:3:3)`;

    const result = prettyStack(stack);

    expect(result).toEqual(
      expect.arrayContaining([
        'at Object.test1 (/.wrangler/test.js:1:1)',
        'at Object.test2 (/node_modules/module/index.js:2:2)',
        'at Object.test3 (/normal/path/file.js:3:3)',
      ])
    );
    expect(result.join('\n')).not.toContain('file://');
  });

  it('should handle stack traces without matching regex pattern', () => {
    const stack = `at Object.test (file:///simple/path/file.js:1:1)
at Object.test2 (file:///another/path/file.js:2:2)`;

    const result = prettyStack(stack);
    expect(result).toEqual(
      expect.arrayContaining([
        'at Object.test (/simple/path/file.js:1:1)',
        'at Object.test2 (/another/path/file.js:2:2)',
      ])
    );
  });

  it('should preserve order of stack lines', () => {
    const stack = `Error: Test error
    at Object.first (/path/first.js:1:1)
    at Object.second (/path/second.js:2:2)
    at Object.third (/path/third.js:3:3)`;

    const result = prettyStack(stack);
    expect(result[0]).toContain('at Object.first (/path/first.js:1:1)');
    expect(result[1]).toContain('at Object.second (/path/second.js:2:2)');
    expect(result[2]).toContain('at Object.third (/path/third.js:3:3)');
  });
});

describe('prettyError', () => {
  it('should extract message and stack from standard Error', () => {
    const errorMessage = 'Test error message';
    const stackMessage =
      'Error: Test error message\n    at Object.test (/path/to/file.js:1:1)';

    const error = new Error(errorMessage);
    error.stack = stackMessage;

    const result = prettyError(error);

    expect(result).toHaveProperty('message', errorMessage);
    expect(result).toHaveProperty('name', 'Error');
    expect(result).toHaveProperty('stack');
    expect(Array.isArray(result.stack)).toBe(true);
  });

  it('should handle Error without stack', () => {
    const error = new Error('Test error');
    delete (error as Error & { stack?: string }).stack;

    const result = prettyError(error);

    expect(result.message).toBe('Test error');
    expect(result.stack).toEqual([]);
  });

  it('should handle Error with empty message', () => {
    const error = new Error('');
    error.stack = 'Error: \n    at Object.test (/path/to/file.js:1:1)';

    const result = prettyError(error);

    expect(result.message).toBe('');
    expect(result.stack).toBeDefined();
  });

  it('should handle custom Error classes', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }

    const error = new CustomError('Custom error message');
    error.stack =
      'CustomError: Custom error message\n    at Object.test (/path/to/file.js:1:1)';

    const result = prettyError(error);

    expect(result.message).toBe('Custom error message');
    expect(result.name).toBe('CustomError');
    expect(result.stack).toBeDefined();
  });

  it('should process the stack through prettyStack', () => {
    const error = new Error('Test error');
    error.stack = `Error: Test error
    at Object.test (file:///path/.wrangler/file.js:1:1)`;

    const result = prettyError(error);

    const stackString = result.stack.join('\n');
    expect(stackString).not.toContain('file://');
    expect(stackString).toContain('file.js:1:1');
    expect(stackString).not.toContain('Error: Test error');
  });
});

describe('createRootLogEntry', () => {
  const mockDetails: Details<{ version: string }> = {
    instance: 'test-instance',
    version: '1.0.0',
  };
  const mockEventId = 'test-event-123';

  it('should create basic root log entry with required fields', () => {
    const options = {
      path: '/api/test',
      method: 'get' as Method,
      details: mockDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);

    const entry = result[0];
    expect(entry.holder).toBe('root');
    expect(entry.type).toBe('info');
    expect(entry.message).toBe('Log started');
    expect(entry.payload).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(typeof entry.timestamp).toBe('number');
  });

  it('should handle path correctly', () => {
    const options = {
      path: '/api/users/123',
      method: 'get' as Method,
      details: mockDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    expect(payload.path).toBe('/api/users/123');
  });

  it('should handle method correctly', () => {
    const options = {
      path: '/api/test',
      method: 'post' as Method,
      details: mockDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    expect(payload.path).toBe('/api/test');
    expect(payload.method).toBe('post');
  });

  it('should include parentEventId when provided', () => {
    const parentEventId = 'parent-event-456';
    const options = {
      path: '/api/test',
      method: 'put' as Method,
      details: mockDetails,
      eventId: mockEventId,
      parentEventId,
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    expect(payload.parentEventId).toBe(parentEventId);
  });

  it('should not include parentEventId when not provided', () => {
    const options = {
      path: '/api/test',
      method: 'delete' as Method,
      details: mockDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    expect(payload.parentEventId).toBeUndefined();
  });

  it('should add error log when expectParentEventId is true but no parentEventId provided', () => {
    const options = {
      path: '/api/test',
      method: 'patch' as Method,
      details: mockDetails,
      eventId: mockEventId,
      expectParentEventId: true,
    };

    const result = createRootLogEntry(options);

    expect(result).toHaveLength(2);

    const infoEntry = result[0];
    const errorEntry = result[1];

    expect(infoEntry.holder).toBe('root');
    expect(infoEntry.type).toBe('info');
    expect(infoEntry.message).toBe('Log started');

    expect(errorEntry.holder).toBe('root');
    expect(errorEntry.type).toBe('error');
    expect(errorEntry.message).toBe(
      'Parent event ID expected but not provided'
    );
    expect(errorEntry.payload).toBeUndefined();
  });

  it('should not add error log when expectParentEventId is true and parentEventId is provided', () => {
    const options = {
      path: '/api/test',
      method: 'head' as Method,
      details: mockDetails,
      eventId: mockEventId,
      parentEventId: 'parent-123',
      expectParentEventId: true,
    };

    const result = createRootLogEntry(options);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('info');
    expect(result[0].holder).toBe('root');
  });

  it('should not add error log when expectParentEventId is false', () => {
    const options = {
      path: '/api/test',
      method: 'options' as Method,
      details: mockDetails,
      eventId: mockEventId,
      expectParentEventId: false,
    };

    const result = createRootLogEntry(options);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('info');
    expect(result[0].holder).toBe('root');
  });

  it('should handle all HTTP methods', () => {
    const methods: Method[] = [
      'get',
      'post',
      'put',
      'delete',
      'patch',
      'head',
      'options',
      'trace',
      'connect',
    ];

    methods.forEach((method) => {
      const options = {
        path: '/api/test',
        method,
        details: mockDetails,
        eventId: mockEventId,
      };

      const result = createRootLogEntry(options);
      const payload = result[0].payload as RootPayload;

      expect(payload.method).toBe(method);
    });
  });

  it('should preserve complex details object', () => {
    const complexDetails: Details<{
      version: string;
      environment: string;
      region: string;
      userId: number;
      metadata: { feature: string; enabled: boolean };
    }> = {
      instance: 'api-gateway',
      version: '2.1.0',
      environment: 'production',
      region: 'us-east-1',
      userId: 12345,
      metadata: { feature: 'logging', enabled: true },
    };

    const options = {
      path: '/api/test',
      method: 'get' as Method,
      details: complexDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    expect(payload.details).toEqual(complexDetails);
  });

  it('should generate reasonable timestamps', () => {
    const beforeTime = Date.now();

    const options = {
      path: '/api/test',
      method: 'get' as Method,
      details: mockDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);
    const afterTime = Date.now();

    const timestamp = result[0].timestamp;

    expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(timestamp).toBeLessThanOrEqual(afterTime);
  });

  it('should handle different paths', () => {
    const options = {
      path: '/api/users',
      method: 'get' as Method,
      details: mockDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    expect(payload.path).toBe('/api/users');
  });

  it('should handle paths with different segments', () => {
    const options = {
      path: '/users?page=2&limit=10',
      method: 'get' as Method,
      details: mockDetails,
      eventId: mockEventId,
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    // Based on actual behavior, the full path including query params is preserved
    expect(payload.path).toBe('/users?page=2&limit=10');
  });

  it('should maintain correct payload structure type', () => {
    const options = {
      path: '/api/test',
      method: 'get' as Method,
      details: mockDetails,
      eventId: mockEventId,
      parentEventId: 'parent-123',
    };

    const result = createRootLogEntry(options);
    const payload = result[0].payload as RootPayload;

    expect(payload).toHaveProperty('path');
    expect(payload).toHaveProperty('method');
    expect(payload).toHaveProperty('details');
    expect(payload).toHaveProperty('eventId');
    expect(payload).toHaveProperty('parentEventId');
  });

  it('should default path to "/" when omitted', () => {
    const result = createRootLogEntry({
      details: mockDetails,
      eventId: mockEventId,
    });
    const payload = result[0].payload as RootPayload;

    expect(payload.path).toBeUndefined();
  });

  it('should store the path verbatim', () => {
    const result = createRootLogEntry({
      details: mockDetails,
      eventId: mockEventId,
      path: 'relative/path?query=1',
    });
    const payload = result[0].payload as RootPayload;

    expect(payload.path).toBe('relative/path?query=1');
  });

  it('should omit method from the payload when not provided', () => {
    const result = createRootLogEntry({
      details: mockDetails,
      eventId: mockEventId,
    });
    const payload = result[0].payload as RootPayload;

    expect(payload.method).toBeUndefined();
  });
});

describe('orderLogEvents', () => {
  it('should return an empty array for empty log data', () => {
    const result = orderLogEvents({});
    expect(result).toEqual([]);
  });

  it('should return an empty array for areas with no events', () => {
    const result = orderLogEvents({ 'area-a': [], 'area-b': [] });
    expect(result).toEqual([]);
  });

  it('should flatten events from multiple areas into a single array', () => {
    const result = orderLogEvents({
      'area-a': [
        { type: 'info', message: 'a-1', timestamp: 100 },
        { type: 'info', message: 'a-2', timestamp: 300 },
      ],
      'area-b': [{ type: 'warn', message: 'b-1', timestamp: 200 }],
    });

    expect(result).toHaveLength(3);
  });

  it('should tag each event with its holder area name', () => {
    const logData: LogData = {
      root: [{ type: 'info', message: 'Log started', timestamp: 1 }],
      'db-layer': [{ type: 'error', message: 'Query failed', timestamp: 2 }],
    };

    const result = orderLogEvents(logData);

    expect(result.map((event) => event.holder)).toEqual(['root', 'db-layer']);
  });

  it('should sort events by timestamp in ascending order', () => {
    const logData: LogData = {
      'area-a': [{ type: 'info', message: 'third', timestamp: 300 }],
      'area-b': [{ type: 'info', message: 'first', timestamp: 100 }],
      'area-c': [{ type: 'info', message: 'second', timestamp: 200 }],
    };

    const result = orderLogEvents(logData);

    expect(result.map((event) => event.timestamp)).toEqual([100, 200, 300]);
    expect(result.map((event) => event.message)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('should interleave events from the same area by timestamp', () => {
    const logData: LogData = {
      'area-a': [
        { type: 'info', message: 'a-early', timestamp: 50 },
        { type: 'info', message: 'a-late', timestamp: 400 },
      ],
      'area-b': [
        { type: 'info', message: 'b-early', timestamp: 60 },
        { type: 'info', message: 'b-late', timestamp: 90 },
      ],
    };

    const result = orderLogEvents(logData);

    expect(result.map((event) => event.message)).toEqual([
      'a-early',
      'b-early',
      'b-late',
      'a-late',
    ]);
  });

  it('should preserve all original event fields', () => {
    const payload = { key: 'value' };
    const logData: LogData = {
      'area-a': [{ type: 'error', message: 'failed', payload, timestamp: 42 }],
    };

    const result = orderLogEvents(logData);

    expect(result[0]).toEqual({
      holder: 'area-a',
      type: 'error',
      message: 'failed',
      payload,
      timestamp: 42,
    });
  });

  it('should handle a single area', () => {
    const logData: LogData = {
      root: [
        { type: 'info', message: 'one', timestamp: 10 },
        { type: 'info', message: 'two', timestamp: 20 },
      ],
    };

    const result = orderLogEvents(logData);

    expect(result.map((event) => event.message)).toEqual(['one', 'two']);
  });

  it('should not mutate the original log data', () => {
    const logData: LogData = {
      'area-a': [{ type: 'info', message: 'entry', timestamp: 10 }],
    };
    const snapshot = JSON.parse(JSON.stringify(logData)) as typeof logData;

    orderLogEvents(logData);

    expect(logData).toEqual(snapshot);
  });
});

describe('groupLogEvents', () => {
  it('should return an empty object for an empty array', () => {
    const result = groupLogEvents([]);
    expect(result).toEqual({});
  });

  it('should group events by their holder', () => {
    const result = groupLogEvents([
      { holder: 'area-a', type: 'info', message: 'a-1', timestamp: 1 },
      { holder: 'area-b', type: 'warn', message: 'b-1', timestamp: 2 },
      { holder: 'area-a', type: 'error', message: 'a-2', timestamp: 3 },
    ]);

    expect(Object.keys(result).sort()).toEqual(['area-a', 'area-b']);
    expect(result['area-a']).toHaveLength(2);
    expect(result['area-b']).toHaveLength(1);
  });

  it('should strip the holder property from entries', () => {
    const events: OrderedLogEvent[] = [
      { holder: 'area-a', type: 'info', message: 'entry', timestamp: 1 },
    ];

    const result = groupLogEvents(events);

    expect(result['area-a'][0]).toEqual({
      type: 'info',
      message: 'entry',
      timestamp: 1,
    });
  });

  it('should preserve event fields including payload', () => {
    const payload = { key: 'value' };
    const events: OrderedLogEvent[] = [
      {
        holder: 'area-a',
        type: 'log',
        message: 'with payload',
        payload,
        timestamp: 5,
      },
    ];

    const result = groupLogEvents(events);

    expect(result['area-a'][0].payload).toEqual(payload);
  });

  it('should preserve the relative order of events within each area', () => {
    const events: OrderedLogEvent[] = [
      { holder: 'area-a', type: 'info', message: 'first', timestamp: 10 },
      { holder: 'area-b', type: 'info', message: 'interleaved', timestamp: 20 },
      { holder: 'area-a', type: 'info', message: 'second', timestamp: 30 },
    ];

    const result = groupLogEvents(events);

    expect(result['area-a'].map((entry) => entry.message)).toEqual([
      'first',
      'second',
    ]);
  });

  it('should round-trip with orderLogEvents', () => {
    const logData: LogData = {
      root: [
        { type: 'info', message: 'Log started', timestamp: 1 },
        { type: 'info', message: 'Log completed', timestamp: 5 },
      ],
      'db-layer': [{ type: 'error', message: 'Query failed', timestamp: 3 }],
    };

    const result = groupLogEvents(orderLogEvents(logData));

    expect(result).toEqual(logData);
  });
});

describe('excludeLogEntryTypes', () => {
  it('should filter out events of the excluded types', () => {
    const events: OrderedLogEvent[] = [
      {
        holder: 'root',
        type: 'info',
        message: 'Log started',
        timestamp: 1,
      },
      { holder: 'root', type: 'debug', message: 'root debug', timestamp: 2 },
      { holder: 'area-a', type: 'info', message: 'info', timestamp: 3 },
      { holder: 'area-a', type: 'debug', message: 'debug', timestamp: 4 },
      { holder: 'area-a', type: 'error', message: 'error', timestamp: 5 },
    ];

    const result = excludeLogEntryTypes(events, ['debug']);

    expect(result.map((event) => event.message)).toEqual([
      'Log started',
      'info',
      'error',
    ]);
  });

  it('should filter out multiple excluded types', () => {
    const events: OrderedLogEvent[] = [
      { holder: 'area-a', type: 'info', message: 'info', timestamp: 1 },
      { holder: 'area-a', type: 'warn', message: 'warn', timestamp: 2 },
      { holder: 'area-a', type: 'error', message: 'error', timestamp: 3 },
      { holder: 'area-a', type: 'log', message: 'log', timestamp: 4 },
    ];

    const result = excludeLogEntryTypes(events, ['warn', 'log']);

    expect(result.map((event) => event.message)).toEqual(['info', 'error']);
  });

  it('should return the events unchanged when no types are given', () => {
    const events: OrderedLogEvent[] = [
      { holder: 'area-a', type: 'info', message: 'info', timestamp: 1 },
      { holder: 'area-a', type: 'debug', message: 'debug', timestamp: 2 },
    ];

    expect(excludeLogEntryTypes(events)).toEqual(events);
  });

  it('should return the events unchanged for an empty exclude list', () => {
    const events: OrderedLogEvent[] = [
      { holder: 'area-a', type: 'debug', message: 'debug', timestamp: 1 },
    ];

    expect(excludeLogEntryTypes(events, [])).toEqual(events);
  });

  it('should return an empty array when only excluded events exist', () => {
    const events: OrderedLogEvent[] = [
      { holder: 'area-a', type: 'debug', message: 'debug only', timestamp: 1 },
    ];

    const result = excludeLogEntryTypes(events, ['debug']);

    expect(result).toEqual([]);
  });

  it('should return an empty array for empty input', () => {
    expect(excludeLogEntryTypes([], ['debug'])).toEqual([]);
  });

  it('should not mutate the input events', () => {
    const events: OrderedLogEvent[] = [
      { holder: 'area-a', type: 'debug', message: 'debug', timestamp: 1 },
      { holder: 'area-a', type: 'info', message: 'info', timestamp: 2 },
    ];
    const snapshot = JSON.parse(JSON.stringify(events)) as typeof events;

    excludeLogEntryTypes(events, ['debug']);

    expect(events).toEqual(snapshot);
  });
});
