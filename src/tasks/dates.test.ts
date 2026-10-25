import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.ts';
import { taskDateInstant } from './dates.ts';

describe('taskDateInstant', () => {
  it('stores a calendar date as the local start or end of that day', () => {
    expect(taskDateInstant('2026-10-26', 'start')).toBe(localDayStart(2026, 10, 26));
    expect(taskDateInstant('2026-10-26', 'end')).toBe(localDayEnd(2026, 10, 26));
    expect(taskDateInstant('2024-02-29', 'start')).toBe(localDayStart(2024, 2, 29));
  });

  it('snaps an instant to the local calendar day it falls on', () => {
    const earlyMorning = new Date(2026, 9, 27, 0, 30, 0, 0);

    expect(taskDateInstant(earlyMorning.toISOString(), 'start')).toBe(localDayStart(2026, 10, 27));
    expect(taskDateInstant(earlyMorning.toISOString(), 'end')).toBe(localDayEnd(2026, 10, 27));
    expect(taskDateInstant('2026-10-26T15:04:05.006+08:00', 'start')).toBe(
      localDayStart(
        new Date('2026-10-26T15:04:05.006+08:00').getFullYear(),
        new Date('2026-10-26T15:04:05.006+08:00').getMonth() + 1,
        new Date('2026-10-26T15:04:05.006+08:00').getDate(),
      ),
    );
  });

  it('rejects values that are not a real calendar date or zoned timestamp', () => {
    expect(() => taskDateInstant('2026-02-31', 'start')).toThrow(AppError);
    expect(() => taskDateInstant('2026-02-31', 'start')).toThrow('Invalid startsAt.');
    expect(() => taskDateInstant('2026-02-29', 'end')).toThrow('Invalid endsAt.');
    expect(() => taskDateInstant('2026-13-01', 'start')).toThrow('Invalid startsAt.');
    expect(() => taskDateInstant('2026-10-26T00:00:00', 'end')).toThrow('Invalid endsAt.');
    expect(() => taskDateInstant('2026-10-26T24:00:00.000Z', 'start')).toThrow('Invalid startsAt.');
    expect(() => taskDateInstant('Monday', 'end')).toThrow('Invalid endsAt.');
    expect(() => taskDateInstant(1, 'start')).toThrow('Invalid startsAt.');
    expect(() => taskDateInstant(null, 'end')).toThrow('Invalid endsAt.');
  });
});

function localDayStart(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function localDayEnd(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}
