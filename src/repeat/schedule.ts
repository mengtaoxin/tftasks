export type Period = 'day' | 'week' | 'month' | 'year';

export type PeriodWindow = {
  readonly start: Date;
  readonly end: Date;
};

export type ScheduleResult = {
  readonly active: boolean;
  readonly window: PeriodWindow | null;
  readonly remaining: number;
};

export type ScheduleInput = {
  readonly createdAt: Date;
  readonly period: Period;
  readonly interval: number;
  readonly timesPerPeriod: number;
  readonly completedAt: readonly Date[];
  readonly now: Date;
};

const INACTIVE: ScheduleResult = { active: false, window: null, remaining: 0 };

export function assessSchedule(input: ScheduleInput): ScheduleResult {
  assertValidDate(input.createdAt, 'createdAt');
  assertValidDate(input.now, 'now');
  const offset = periodOffset(input.period, input.createdAt, input.now);
  if (offset < 0 || offset % input.interval !== 0) {
    return INACTIVE;
  }

  const start = periodStart(input.period, input.now);
  const end = periodEnd(input.period, start);
  let used = 0;
  for (const completedAt of input.completedAt) {
    assertValidDate(completedAt, 'completedAt');
    if (completedAt >= start && completedAt < end) {
      used += 1;
    }
  }

  return {
    active: true,
    window: { start, end },
    remaining: Math.max(0, input.timesPerPeriod - used),
  };
}

function assertValidDate(date: Date, label: string): void {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label}.`);
  }
}

function periodOffset(period: Period, createdAt: Date, now: Date): number {
  switch (period) {
    case 'day':
      return calendarDayNumber(now) - calendarDayNumber(createdAt);
    case 'week':
      return Math.round(
        (calendarDayNumber(startOfWeek(now)) - calendarDayNumber(startOfWeek(createdAt))) / 7,
      );
    case 'month':
      return monthNumber(now) - monthNumber(createdAt);
    case 'year':
      return now.getFullYear() - createdAt.getFullYear();
    default:
      return assertNever(period);
  }
}

function periodStart(period: Period, date: Date): Date {
  switch (period) {
    case 'day':
      return startOfDay(date);
    case 'week':
      return startOfWeek(date);
    case 'month':
      return new Date(date.getFullYear(), date.getMonth(), 1);
    case 'year':
      return new Date(date.getFullYear(), 0, 1);
    default:
      return assertNever(period);
  }
}

function periodEnd(period: Period, start: Date): Date {
  switch (period) {
    case 'day':
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    case 'week':
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    case 'month':
      return new Date(start.getFullYear(), start.getMonth() + 1, 1);
    case 'year':
      return new Date(start.getFullYear() + 1, 0, 1);
    default:
      return assertNever(period);
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  const weekday = start.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() - daysFromMonday);
}

function calendarDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

function monthNumber(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

export function parseStoredTimestamp(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Unexpected timestamp.');
  }
  return date;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected: ${String(value)}`);
}
