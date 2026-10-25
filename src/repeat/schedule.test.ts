import { describe, expect, it } from 'vitest';
import { assessSchedule } from './schedule.ts';

function at(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  return new Date(year, month - 1, day, hour, minute, second, millisecond);
}

describe('assessSchedule', () => {
  it('uses the supplied now and treats the creation local day as the first daily window', () => {
    const createdAt = at(2035, 3, 10, 15, 30);

    expect(
      assessSchedule({
        createdAt,
        period: 'day',
        interval: 1,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2035, 3, 10, 0, 0),
      }),
    ).toEqual({
      active: true,
      window: { start: at(2035, 3, 10), end: at(2035, 3, 11) },
      remaining: 1,
    });

    expect(
      assessSchedule({
        createdAt,
        period: 'day',
        interval: 1,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2035, 3, 9, 23, 59, 59, 999),
      }),
    ).toEqual({ active: false, window: null, remaining: 0 });
  });

  it('skips inactive days when the interval is greater than one', () => {
    const createdAt = at(2026, 3, 10, 15, 30);
    const input = {
      createdAt,
      period: 'day' as const,
      interval: 2,
      timesPerPeriod: 1,
      completedAt: [],
    };

    expect(assessSchedule({ ...input, now: at(2026, 3, 10, 8) }).active).toBe(true);
    expect(assessSchedule({ ...input, now: at(2026, 3, 11, 8) })).toEqual({
      active: false,
      window: null,
      remaining: 0,
    });
    expect(assessSchedule({ ...input, now: at(2026, 3, 12, 8) })).toEqual({
      active: true,
      window: { start: at(2026, 3, 12), end: at(2026, 3, 13) },
      remaining: 1,
    });
  });

  it('aligns weeks to local Monday and includes the whole creation week', () => {
    const createdAt = at(2026, 3, 11, 15);

    expect(
      assessSchedule({
        createdAt,
        period: 'week',
        interval: 1,
        timesPerPeriod: 2,
        completedAt: [],
        now: at(2026, 3, 9, 0, 0),
      }),
    ).toEqual({
      active: true,
      window: { start: at(2026, 3, 9), end: at(2026, 3, 16) },
      remaining: 2,
    });

    expect(
      assessSchedule({
        createdAt,
        period: 'week',
        interval: 1,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2026, 3, 8, 23, 59),
      }).active,
    ).toBe(false);
  });

  it('skips inactive weeks and keeps a Monday window across the new year', () => {
    expect(
      assessSchedule({
        createdAt: at(2026, 3, 11, 15),
        period: 'week',
        interval: 2,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2026, 3, 16, 0, 0),
      }).active,
    ).toBe(false);

    expect(
      assessSchedule({
        createdAt: at(2026, 3, 11, 15),
        period: 'week',
        interval: 2,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2026, 3, 23, 12),
      }),
    ).toEqual({
      active: true,
      window: { start: at(2026, 3, 23), end: at(2026, 3, 30) },
      remaining: 1,
    });

    expect(
      assessSchedule({
        createdAt: at(2026, 1, 1, 12),
        period: 'week',
        interval: 1,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2026, 1, 4, 23, 59),
      }),
    ).toEqual({
      active: true,
      window: { start: at(2025, 12, 29), end: at(2026, 1, 5) },
      remaining: 1,
    });
  });

  it('activates every other month from the creation month, using the calendar month as the window', () => {
    const createdAt = at(2026, 1, 15, 12);
    const input = {
      createdAt,
      period: 'month' as const,
      interval: 2,
      timesPerPeriod: 1,
      completedAt: [],
    };

    expect(assessSchedule({ ...input, now: at(2026, 1, 1, 0, 0) })).toEqual({
      active: true,
      window: { start: at(2026, 1, 1), end: at(2026, 2, 1) },
      remaining: 1,
    });
    expect(assessSchedule({ ...input, now: at(2025, 12, 31, 23, 59) }).active).toBe(false);
    expect(assessSchedule({ ...input, now: at(2026, 2, 1, 0, 0) }).active).toBe(false);
    expect(assessSchedule({ ...input, now: at(2026, 3, 31, 23, 59) })).toEqual({
      active: true,
      window: { start: at(2026, 3, 1), end: at(2026, 4, 1) },
      remaining: 1,
    });
    expect(assessSchedule({ ...input, now: at(2026, 5, 2) }).active).toBe(true);
    expect(assessSchedule({ ...input, now: at(2026, 4, 15) }).active).toBe(false);
  });

  it('ends a December window at the next local new year and includes leap day in February', () => {
    expect(
      assessSchedule({
        createdAt: at(2026, 12, 5, 9),
        period: 'month',
        interval: 1,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2026, 12, 31, 23, 59),
      }).window,
    ).toEqual({ start: at(2026, 12, 1), end: at(2027, 1, 1) });

    expect(
      assessSchedule({
        createdAt: at(2028, 2, 10, 8),
        period: 'month',
        interval: 1,
        timesPerPeriod: 1,
        completedAt: [],
        now: at(2028, 2, 29, 12),
      }).window,
    ).toEqual({ start: at(2028, 2, 1), end: at(2028, 3, 1) });
  });

  it('aligns years to the local calendar year and skips years outside the interval', () => {
    const createdAt = at(2026, 6, 15, 8);
    const input = {
      createdAt,
      period: 'year' as const,
      interval: 2,
      timesPerPeriod: 4,
      completedAt: [],
    };

    expect(assessSchedule({ ...input, now: at(2026, 1, 2) })).toEqual({
      active: true,
      window: { start: at(2026, 1, 1), end: at(2027, 1, 1) },
      remaining: 4,
    });
    expect(assessSchedule({ ...input, now: at(2025, 12, 31, 23, 59) }).active).toBe(false);
    expect(assessSchedule({ ...input, now: at(2027, 1, 1) }).active).toBe(false);
    expect(assessSchedule({ ...input, now: at(2028, 3, 1) })).toEqual({
      active: true,
      window: { start: at(2028, 1, 1), end: at(2029, 1, 1) },
      remaining: 4,
    });
  });

  it('counts completions only inside the active window and clamps remaining at zero', () => {
    const createdAt = at(2026, 3, 10, 15);

    expect(
      assessSchedule({
        createdAt,
        period: 'day',
        interval: 2,
        timesPerPeriod: 3,
        now: at(2026, 3, 12, 8),
        completedAt: [
          at(2026, 3, 10, 18),
          at(2026, 3, 12, 0, 0),
          at(2026, 3, 12, 23, 59, 59, 999),
          at(2026, 3, 13, 0, 0),
        ],
      }),
    ).toEqual({
      active: true,
      window: { start: at(2026, 3, 12), end: at(2026, 3, 13) },
      remaining: 1,
    });

    expect(
      assessSchedule({
        createdAt,
        period: 'day',
        interval: 1,
        timesPerPeriod: 1,
        now: at(2026, 3, 10, 18),
        completedAt: [at(2026, 3, 10, 16), at(2026, 3, 10, 17)],
      }),
    ).toMatchObject({ active: true, remaining: 0 });
  });
});
