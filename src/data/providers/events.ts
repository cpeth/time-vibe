import { Temporal } from '@js-temporal/polyfill';
import {
  dateFromIso,
  daysBetween,
  isoDate,
  lastWeekdayOfMonth,
  nthWeekdayOfMonth,
} from '../../time/rules';
import type { EventMarker, PersonalDate, SportsYear } from '../schemas';

function fixedEvent(
  year: number,
  month: number,
  day: number,
  id: string,
  label: string,
): EventMarker {
  return {
    id: `${year}-${id}`,
    date: isoDate(Temporal.PlainDate.from({ year, month, day })),
    label,
    category: 'holiday',
  };
}

export function holidayMarkers(year: number): EventMarker[] {
  return [
    fixedEvent(year, 1, 1, 'new-year', 'New Year’s Day'),
    {
      id: `${year}-mlk-day`,
      date: isoDate(nthWeekdayOfMonth(year, 1, 1, 3)),
      label: 'Martin Luther King Jr. Day',
      category: 'holiday',
    },
    {
      id: `${year}-presidents-day`,
      date: isoDate(nthWeekdayOfMonth(year, 2, 1, 3)),
      label: 'Presidents’ Day',
      category: 'holiday',
    },
    {
      id: `${year}-memorial-day`,
      date: isoDate(lastWeekdayOfMonth(year, 5, 1)),
      label: 'Memorial Day',
      category: 'holiday',
    },
    fixedEvent(year, 7, 4, 'july-fourth', 'Independence Day'),
    {
      id: `${year}-labor-day`,
      date: isoDate(nthWeekdayOfMonth(year, 9, 1, 1)),
      label: 'Labor Day',
      category: 'holiday',
    },
    fixedEvent(year, 10, 31, 'halloween', 'Halloween'),
    {
      id: `${year}-thanksgiving`,
      date: isoDate(nthWeekdayOfMonth(year, 11, 4, 4)),
      label: 'Thanksgiving',
      category: 'holiday',
    },
    fixedEvent(year, 12, 24, 'christmas-eve', 'Christmas Eve'),
    fixedEvent(year, 12, 25, 'christmas', 'Christmas Day'),
    fixedEvent(year, 12, 31, 'new-years-eve', 'New Year’s Eve'),
  ];
}

export function astroMarkers(year: number): EventMarker[] {
  return [
    {
      id: `${year}-dst-spring`,
      date: isoDate(nthWeekdayOfMonth(year, 3, 7, 2)),
      label: 'Spring forward',
      category: 'astro',
    },
    {
      id: `${year}-dst-fall`,
      date: isoDate(nthWeekdayOfMonth(year, 11, 7, 1)),
      label: 'Fall back',
      category: 'astro',
    },
  ];
}

export function golfMarkers(year: number): EventMarker[] {
  const markers: EventMarker[] = [
    {
      id: `${year}-masters`,
      date: isoDate(nthWeekdayOfMonth(year, 4, 7, 2)),
      label: 'Masters Sunday',
      category: 'golf',
      approximate: true,
    },
    {
      id: `${year}-pga`,
      date: isoDate(nthWeekdayOfMonth(year, 5, 7, 3)),
      label: 'PGA Championship',
      category: 'golf',
      approximate: true,
    },
    {
      id: `${year}-us-open`,
      date: isoDate(nthWeekdayOfMonth(year, 6, 7, 3)),
      label: 'U.S. Open',
      category: 'golf',
      approximate: true,
    },
    {
      id: `${year}-the-open`,
      date: isoDate(nthWeekdayOfMonth(year, 7, 7, 3)),
      label: 'The Open',
      category: 'golf',
      approximate: true,
    },
  ];

  if (year % 2 === 1) {
    markers.push({
      id: `${year}-ryder-cup`,
      date: isoDate(lastWeekdayOfMonth(year, 9, 7)),
      label: 'Ryder Cup',
      category: 'golf',
      approximate: true,
    });
  }

  return markers;
}

function superBowlMarkers(year: number, sports: SportsYear): EventMarker[] {
  return sports.leagues.flatMap((season) => {
    const championship = season.league === 'nfl' ? season.championship : undefined;
    return championship?.date.startsWith(`${year}-`)
      ? [
          {
            id: `${year}-super-bowl`,
            date: championship.date,
            label: 'Super Bowl Sunday',
            category: 'holiday' as const,
            approximate: sports.source === 'heuristic',
          },
        ]
      : [];
  });
}

export function eventMarkers(
  year: number,
  sports: SportsYear,
  personalDates: PersonalDate[] = [],
): EventMarker[] {
  const personal: EventMarker[] = personalDates.map((event, index) => ({
    id: `${year}-personal-${index}`,
    date: isoDate(Temporal.PlainDate.from({ year, month: event.month, day: event.day })),
    label: event.label,
    category: 'personal',
    icon: event.icon,
  }));

  return [
    ...holidayMarkers(year),
    ...astroMarkers(year),
    ...golfMarkers(year),
    ...superBowlMarkers(year, sports),
    ...personal,
  ].sort((left, right) => left.date.localeCompare(right.date));
}

export function nearestEventMarkers(
  date: Temporal.PlainDate,
  markers: EventMarker[],
  count = 2,
): Array<{ marker: EventMarker; days: number }> {
  return markers
    .map((marker) => ({
      marker,
      days: daysBetween(date, dateFromIso(marker.date)),
    }))
    .sort((left, right) => Math.abs(left.days) - Math.abs(right.days))
    .slice(0, count);
}