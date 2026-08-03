import { Temporal } from '@js-temporal/polyfill';
import { nowInPleasanton } from './calendar';

export interface ArchiveDateRange {
  start: string;
  end: string;
}

export function climateArchiveRange(year: number): ArchiveDateRange | null {
  const today = nowInPleasanton().toPlainDate();
  if (year > today.year) return null;
  const start = Temporal.PlainDate.from({ year, month: 1, day: 1 });
  const end = year < today.year
    ? Temporal.PlainDate.from({ year, month: 12, day: 31 })
    : today.subtract({ days: 1 });
  return Temporal.PlainDate.compare(end, start) >= 0
    ? { start: start.toString(), end: end.toString() }
    : null;
}