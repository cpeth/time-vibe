import { Temporal } from '@js-temporal/polyfill';

export const PLEASANTON_TIME_ZONE = 'America/Los_Angeles';

export type CalendarDate = Temporal.PlainDate | Temporal.ZonedDateTime;

export function toPlainDate(date: CalendarDate): Temporal.PlainDate {
  return date instanceof Temporal.ZonedDateTime ? date.toPlainDate() : date;
}

export function fractionOfDay(date: CalendarDate): number {
  if (!(date instanceof Temporal.ZonedDateTime)) {
    return 0;
  }

  const nanoseconds =
    (((date.hour * 60 + date.minute) * 60 + date.second) * 1_000 +
      date.millisecond) *
      1_000_000 +
    date.microsecond * 1_000 +
    date.nanosecond;

  return nanoseconds / 86_400_000_000_000;
}

export function daysInMonth(year: number, month: number): number {
  return Temporal.PlainYearMonth.from({ year, month }).daysInMonth;
}

export function daysInYear(year: number): number {
  return Temporal.PlainDate.from({ year, month: 1, day: 1 }).daysInYear;
}

export function dateFromDayIndex(year: number, dayIndex: number): Temporal.PlainDate {
  return Temporal.PlainDate.from({ year, month: 1, day: 1 }).add({ days: dayIndex });
}

export function climatologyDayOfYear(date: Temporal.PlainDate): number {
  return Temporal.PlainDate.from({ year: 2024, month: date.month, day: date.day }).dayOfYear;
}

export function monthBoundaries(year: number): Temporal.PlainDate[] {
  return Array.from({ length: 13 }, (_, index) =>
    Temporal.PlainDate.from({ year, month: 1, day: 1 }).add({ months: index }),
  );
}

export function monthMidpoints(year: number): Temporal.PlainDate[] {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const day = Math.ceil(daysInMonth(year, month) / 2);
    return Temporal.PlainDate.from({ year, month, day });
  });
}

export function yearStart(year: number): Temporal.PlainDate {
  return Temporal.PlainDate.from({ year, month: 1, day: 1 });
}

export function nowInPleasanton(): Temporal.ZonedDateTime {
  return Temporal.Now.zonedDateTimeISO(PLEASANTON_TIME_ZONE);
}