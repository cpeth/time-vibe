import { Temporal } from '@js-temporal/polyfill';

export function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
): Temporal.PlainDate {
  const first = Temporal.PlainDate.from({ year, month, day: 1 });
  const offset = (weekday - first.dayOfWeek + 7) % 7;
  return first.add({ days: offset + (occurrence - 1) * 7 });
}

export function lastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
): Temporal.PlainDate {
  const last = Temporal.PlainYearMonth.from({ year, month }).toPlainDate({ day: 1 }).with({
    day: Temporal.PlainYearMonth.from({ year, month }).daysInMonth,
  });
  const offset = (last.dayOfWeek - weekday + 7) % 7;
  return last.subtract({ days: offset });
}

export function isoDate(date: Temporal.PlainDate): string {
  return date.toString();
}

export function addDays(date: Temporal.PlainDate, days: number): Temporal.PlainDate {
  return date.add({ days });
}

export function daysBetween(from: Temporal.PlainDate, to: Temporal.PlainDate): number {
  return from.until(to, { largestUnit: 'days' }).days;
}

export function datesBetweenInclusive(
  from: Temporal.PlainDate,
  to: Temporal.PlainDate,
): Temporal.PlainDate[] {
  const length = daysBetween(from, to) + 1;
  return Array.from({ length }, (_, index) => from.add({ days: index }));
}

export function waterYearToDate(date: Temporal.PlainDate): Temporal.PlainDate[] {
  const startYear = date.month >= 10 ? date.year : date.year - 1;
  const start = Temporal.PlainDate.from({ year: startYear, month: 10, day: 1 });
  return datesBetweenInclusive(start, date);
}

export function dateFromIso(date: string): Temporal.PlainDate {
  return Temporal.PlainDate.from(date);
}

export function formatDate(date: Temporal.PlainDate): string {
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(date: Temporal.PlainDate): string {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric' });
}

export function formatClockTime(date: Temporal.ZonedDateTime): string {
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function dateInYear(year: number, source: Temporal.PlainDate): Temporal.PlainDate {
  return Temporal.PlainDate.from({
    year,
    month: source.month,
    day: Math.min(source.day, Temporal.PlainYearMonth.from({ year, month: source.month }).daysInMonth),
  });
}

export function yearProgress(date: Temporal.PlainDate): {
  day: number;
  total: number;
  percent: number;
} {
  return {
    day: date.dayOfYear,
    total: date.daysInYear,
    percent: (date.dayOfYear / date.daysInYear) * 100,
  };
}

export function personalYearDay(
  date: Temporal.PlainDate,
  origin: { month: number; day: number },
): number {
  const thisYearOrigin = Temporal.PlainDate.from({ year: date.year, ...origin });
  const start = Temporal.PlainDate.compare(date, thisYearOrigin) >= 0
    ? thisYearOrigin
    : Temporal.PlainDate.from({ year: date.year - 1, ...origin });
  return daysBetween(start, date) + 1;
}

export function stepWithinYear(
  date: Temporal.PlainDate,
  days: number,
): Temporal.PlainDate {
  const stepped = date.add({ days });
  if (stepped.year < date.year) {
    return Temporal.PlainDate.from({ year: date.year, month: 1, day: 1 });
  }
  if (stepped.year > date.year) {
    return Temporal.PlainDate.from({ year: date.year, month: 12, day: 31 });
  }
  return stepped;
}

export function monthName(date: Temporal.PlainDate): string {
  return date.toLocaleString('en-US', { month: 'long' });
}

export function weekdayName(date: Temporal.PlainDate): string {
  return date.toLocaleString('en-US', { weekday: 'long' });
}