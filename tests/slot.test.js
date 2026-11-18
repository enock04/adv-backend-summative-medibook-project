const { validateSlot, parseDateTime } = require('../src/utils/slot');

const now = new Date(2030, 0, 1, 8, 0, 0);

describe('validateSlot', () => {
  test('accepts the first slot of the day (09:00)', () => {
    expect(validateSlot('2030-06-10 09:00', now).valid).toBe(true);
  });

  test('accepts the last slot of the day (16:30)', () => {
    expect(validateSlot('2030-06-10 16:30', now).valid).toBe(true);
  });

  test('rejects 17:00 exactly because the working day has ended', () => {
    const result = validateSlot('2030-06-10 17:00', now);
    expect(result.valid).toBe(false);
    expect(result.code).toBe('OUTSIDE_HOURS');
  });

  test('rejects 08:30, before opening', () => {
    expect(validateSlot('2030-06-10 08:30', now).code).toBe('OUTSIDE_HOURS');
  });

  test('rejects 09:15, off the 30-minute boundary', () => {
    expect(validateSlot('2030-06-10 09:15', now).code).toBe('NOT_ON_BOUNDARY');
  });

  test('rejects a slot with non-zero seconds', () => {
    expect(validateSlot('2030-06-10 09:00:30', now).code).toBe('NOT_ON_BOUNDARY');
  });

  test('rejects a slot in the past', () => {
    expect(validateSlot('2029-12-31 10:00', now).code).toBe('NOT_FUTURE');
  });

  test('rejects malformed input', () => {
    expect(validateSlot('next tuesday', now).code).toBe('MALFORMED');
    expect(validateSlot(undefined, now).code).toBe('MALFORMED');
  });

  test('rejects impossible calendar dates', () => {
    expect(validateSlot('2030-02-30 10:00', now).code).toBe('MALFORMED');
  });
});

describe('parseDateTime', () => {
  test('accepts a T separator', () => {
    expect(parseDateTime('2030-06-10T10:30')).toEqual(new Date(2030, 5, 10, 10, 30));
  });
});
