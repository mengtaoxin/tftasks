import { AppError } from '../errors.ts';

export type TaskDateBoundary = 'start' | 'end';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

type CalendarDay = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

export function taskDateInstant(value: unknown, boundary: TaskDateBoundary): string {
  const day = calendarDay(value);
  if (day === undefined) {
    throw new AppError(invalidDateMessage(boundary));
  }
  const instant =
    boundary === 'start'
      ? new Date(day.year, day.month - 1, day.day, 0, 0, 0, 0)
      : new Date(day.year, day.month - 1, day.day, 23, 59, 59, 999);
  return instant.toISOString();
}

function calendarDay(value: unknown): CalendarDay | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const dateOnly = DATE_ONLY.exec(value);
  if (dateOnly !== null) {
    return realDay(dateOnly[1], dateOnly[2], dateOnly[3]);
  }

  const dateTime = DATE_TIME.exec(value);
  if (dateTime === null || realDay(dateTime[1], dateTime[2], dateTime[3]) === undefined) {
    return undefined;
  }
  const hour = Number(dateTime[4]);
  const minute = Number(dateTime[5]);
  const second = Number(dateTime[6]);
  if (hour > 23 || minute > 59 || second > 59) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return { year: parsed.getFullYear(), month: parsed.getMonth() + 1, day: parsed.getDate() };
}

function realDay(
  yearText: string | undefined,
  monthText: string | undefined,
  dayText: string | undefined,
): CalendarDay | undefined {
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    return undefined;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return { year, month, day };
}

function invalidDateMessage(boundary: TaskDateBoundary): string {
  return boundary === 'start' ? 'Invalid startsAt.' : 'Invalid endsAt.';
}
