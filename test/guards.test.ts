import { describe, it, expect } from 'vitest';
import { isLogData, isOrderedLogEvents, hasRootPayload } from '../src/guards';

describe('isLogData', () => {
  it('should return true for a valid LogData object', () => {
    const logData = {
      root: [{ type: 'info', message: 'Log started', timestamp: 1 }],
    };

    expect(isLogData(logData)).toBe(true);
  });

  it('should return true for an empty object', () => {
    expect(isLogData({})).toBe(true);
  });

  it('should return false for null and undefined', () => {
    expect(isLogData(null)).toBe(false);
    expect(isLogData(undefined)).toBe(false);
  });

  it('should return false for primitives', () => {
    expect(isLogData('log')).toBe(false);
    expect(isLogData(42)).toBe(false);
    expect(isLogData(true)).toBe(false);
  });

  it('should return false for arrays', () => {
    expect(isLogData([])).toBe(false);
    expect(isLogData([{ type: 'info', message: 'm', timestamp: 1 }])).toBe(
      false
    );
  });

  it('should return false when an area value is not an array', () => {
    expect(isLogData({ area: 'not-an-array' })).toBe(false);
    expect(isLogData({ area: null })).toBe(false);
  });

  it('should return false when an entry is invalid', () => {
    expect(
      isLogData({ area: [{ type: 'info', message: 'no timestamp' }] })
    ).toBe(false);
    expect(
      isLogData({ area: [{ type: 'unknown', message: 'm', timestamp: 1 }] })
    ).toBe(false);
    expect(isLogData({ area: [{ type: 'info', timestamp: 1 }] })).toBe(false);
    expect(isLogData({ area: [null] })).toBe(false);
  });

  it('should return false when a payload is not an object', () => {
    expect(
      isLogData({
        area: [{ type: 'info', message: 'm', timestamp: 1, payload: 'bad' }],
      })
    ).toBe(false);
  });

  it('should accept entries with an undefined payload', () => {
    expect(
      isLogData({
        area: [
          { type: 'info', message: 'm', timestamp: 1, payload: undefined },
        ],
      })
    ).toBe(true);
  });

  it('should return true for multiple valid areas', () => {
    const logData = {
      'area-a': [{ type: 'info', message: 'a', timestamp: 1 }],
      'area-b': [{ type: 'debug', message: 'b', timestamp: 2 }],
    };

    expect(isLogData(logData)).toBe(true);
  });

  it('should accept every log entry type', () => {
    const types = ['info', 'warn', 'error', 'log', 'debug'] as const;

    types.forEach((type) => {
      expect(isLogData({ area: [{ type, message: 'm', timestamp: 1 }] })).toBe(
        true
      );
      expect(
        isOrderedLogEvents([
          { holder: 'area', type, message: 'm', timestamp: 1 },
        ])
      ).toBe(true);
    });
  });
});

describe('isOrderedLogEvents', () => {
  it('should return true for a valid array of ordered log events', () => {
    const events = [
      { holder: 'area-a', type: 'info', message: 'a', timestamp: 1 },
    ];

    expect(isOrderedLogEvents(events)).toBe(true);
  });

  it('should return true for an empty array', () => {
    expect(isOrderedLogEvents([])).toBe(true);
  });

  it('should return false for null and undefined', () => {
    expect(isOrderedLogEvents(null)).toBe(false);
    expect(isOrderedLogEvents(undefined)).toBe(false);
  });

  it('should return false for non-array values', () => {
    expect(isOrderedLogEvents('events')).toBe(false);
    expect(isOrderedLogEvents({})).toBe(false);
  });

  it('should return false when an event has no holder', () => {
    const events = [{ type: 'info', message: 'a', timestamp: 1 }];

    expect(isOrderedLogEvents(events)).toBe(false);
  });

  it('should return false when the holder is not a string', () => {
    const events = [{ holder: 42, type: 'info', message: 'a', timestamp: 1 }];

    expect(isOrderedLogEvents(events)).toBe(false);
  });

  it('should return false when an event is invalid', () => {
    expect(
      isOrderedLogEvents([
        { holder: 'area-a', type: 'info', message: 'no timestamp' },
      ])
    ).toBe(false);
    expect(isOrderedLogEvents([{ holder: 'area-a' }])).toBe(false);
    expect(isOrderedLogEvents([null])).toBe(false);
  });

  it('should return true for multiple valid events across holders', () => {
    const events = [
      { holder: 'area-a', type: 'info', message: 'a', timestamp: 1 },
      { holder: 'area-b', type: 'error', message: 'b', timestamp: 2 },
    ];

    expect(isOrderedLogEvents(events)).toBe(true);
  });
});

describe('hasRootPayload', () => {
  const validRootPayload = {
    path: '/api/test',
    method: 'get',
    eventId: 'event-123',
    details: { instance: 'test-instance' },
  };

  it('should return true when a root event carries a valid payload', () => {
    expect(
      hasRootPayload([
        {
          holder: 'root',
          type: 'info',
          message: 'Log started',
          payload: validRootPayload,
          timestamp: 1,
        },
      ])
    ).toBe(true);
  });

  it('should return true when other events exist alongside a valid root', () => {
    expect(
      hasRootPayload([
        {
          holder: 'root',
          type: 'info',
          message: 'Log started',
          payload: validRootPayload,
          timestamp: 1,
        },
        { holder: 'area-a', type: 'info', message: 'm', timestamp: 2 },
      ])
    ).toBe(true);
  });

  it('should return false when there is no root event', () => {
    expect(
      hasRootPayload([
        { holder: 'area-a', type: 'info', message: 'm', timestamp: 1 },
      ])
    ).toBe(false);
    expect(hasRootPayload([])).toBe(false);
  });

  it('should return false when the root event has no payload', () => {
    expect(
      hasRootPayload([
        {
          holder: 'root',
          type: 'info',
          message: 'Log started',
          timestamp: 1,
        },
      ])
    ).toBe(false);
  });

  it('should return false when the payload has no eventId', () => {
    expect(
      hasRootPayload([
        {
          holder: 'root',
          type: 'info',
          message: 'Log started',
          payload: { details: { instance: 's' } },
          timestamp: 1,
        },
      ])
    ).toBe(false);
  });

  it('should return false when eventId is not a string', () => {
    expect(
      hasRootPayload([
        {
          holder: 'root',
          type: 'info',
          message: 'Log started',
          payload: { eventId: 42, details: { instance: 's' } },
          timestamp: 1,
        },
      ])
    ).toBe(false);
  });

  it('should return false when details is missing instance', () => {
    expect(
      hasRootPayload([
        {
          holder: 'root',
          type: 'info',
          message: 'Log started',
          payload: { eventId: 'e', details: { other: true } },
          timestamp: 1,
        },
      ])
    ).toBe(false);
  });

  it('should return false when details is null', () => {
    expect(
      hasRootPayload([
        {
          holder: 'root',
          type: 'info',
          message: 'Log started',
          payload: { eventId: 'e', details: null },
          timestamp: 1,
        },
      ])
    ).toBe(false);
  });

  it('should return false for non-ordered-event values', () => {
    expect(hasRootPayload(null)).toBe(false);
    expect(hasRootPayload(undefined)).toBe(false);
    expect(hasRootPayload({})).toBe(false);
    expect(hasRootPayload('root')).toBe(false);
  });
});
