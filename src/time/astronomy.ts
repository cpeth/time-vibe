import {
  Body,
  Observer,
  SearchRiseSet,
  Seasons,
  type AstroTime,
} from 'astronomy-engine';
import { Temporal } from '@js-temporal/polyfill';
import {
  PLEASANTON_TIME_ZONE,
  dateFromDayIndex,
  daysInYear,
} from './calendar';
import { PLEASANTON } from './location';

export { PLEASANTON } from './location';

const OBSERVER = new Observer(PLEASANTON.lat, PLEASANTON.lon, 107);

export type SeasonName = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonBoundary {
  season: SeasonName;
  label: string;
  instant: Temporal.ZonedDateTime;
}

export interface SunDay {
  date: Temporal.PlainDate;
  sunrise: Temporal.ZonedDateTime;
  sunset: Temporal.ZonedDateTime;
  sunriseHour: number;
  sunsetHour: number;
  dayLengthMinutes: number;
}

function astroTimeToZonedDateTime(time: AstroTime): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(time.date.getTime()).toZonedDateTimeISO(
    PLEASANTON_TIME_ZONE,
  );
}

function startOfLocalDate(date: Temporal.PlainDate): Date {
  const zoned = date.toZonedDateTime({
    timeZone: PLEASANTON_TIME_ZONE,
    plainTime: Temporal.PlainTime.from('00:00'),
  });
  return new Date(zoned.epochMilliseconds);
}

function wallClockHour(date: Temporal.ZonedDateTime): number {
  return date.hour + date.minute / 60 + date.second / 3_600;
}

export function getSeasonBoundaries(year: number): SeasonBoundary[] {
  const seasons = Seasons(year);
  return [
    {
      season: 'spring',
      label: 'Spring equinox',
      instant: astroTimeToZonedDateTime(seasons.mar_equinox),
    },
    {
      season: 'summer',
      label: 'Summer solstice',
      instant: astroTimeToZonedDateTime(seasons.jun_solstice),
    },
    {
      season: 'autumn',
      label: 'Autumn equinox',
      instant: astroTimeToZonedDateTime(seasons.sep_equinox),
    },
    {
      season: 'winter',
      label: 'Winter solstice',
      instant: astroTimeToZonedDateTime(seasons.dec_solstice),
    },
  ];
}

export function getSunDay(date: Temporal.PlainDate): SunDay {
  const searchStart = startOfLocalDate(date);
  const rise = SearchRiseSet(Body.Sun, OBSERVER, 1, searchStart, 1);
  const set = SearchRiseSet(Body.Sun, OBSERVER, -1, searchStart, 1);

  if (!rise || !set) {
    throw new Error(`No sunrise or sunset found for ${date.toString()}`);
  }

  const sunrise = astroTimeToZonedDateTime(rise);
  const sunset = astroTimeToZonedDateTime(set);

  return {
    date,
    sunrise,
    sunset,
    sunriseHour: wallClockHour(sunrise),
    sunsetHour: wallClockHour(sunset),
    dayLengthMinutes: (sunset.epochMilliseconds - sunrise.epochMilliseconds) / 60_000,
  };
}

export function getSunYear(year: number): SunDay[] {
  return Array.from({ length: daysInYear(year) }, (_, dayIndex) =>
    getSunDay(dateFromDayIndex(year, dayIndex)),
  );
}

export function seasonForDate(
  date: Temporal.PlainDate,
  boundaries: SeasonBoundary[],
): SeasonName {
  const [spring, summer, autumn, winter] = boundaries.map(({ instant }) => instant.toPlainDate());
  if (!spring || !summer || !autumn || !winter) {
    return 'winter';
  }
  if (Temporal.PlainDate.compare(date, spring) < 0) return 'winter';
  if (Temporal.PlainDate.compare(date, summer) < 0) return 'spring';
  if (Temporal.PlainDate.compare(date, autumn) < 0) return 'summer';
  if (Temporal.PlainDate.compare(date, winter) < 0) return 'autumn';
  return 'winter';
}

export function nextSeasonBoundary(
  date: Temporal.PlainDate,
  boundaries: SeasonBoundary[],
): SeasonBoundary | null {
  return boundaries.find(({ instant }) =>
    Temporal.PlainDate.compare(instant.toPlainDate(), date) > 0,
  ) ?? null;
}