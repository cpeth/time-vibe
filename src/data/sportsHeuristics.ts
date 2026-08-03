import { addDays, isoDate, nthWeekdayOfMonth } from '../time/rules';
import {
  SportsYearSchema,
  type LeagueSeason,
  type SportsYear,
} from './schemas';

function seasonLabel(startYear: number): string {
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

function nflSeason(startYear: number): LeagueSeason {
  const laborDay = nthWeekdayOfMonth(startYear, 9, 1, 1);
  const kickoff = addDays(laborDay, 3);
  const regularEnd = nthWeekdayOfMonth(startYear + 1, 1, 7, 1);
  const wildcardStart = addDays(regularEnd, 5);
  const wildcardEnd = addDays(regularEnd, 8);
  const divisionalStart = addDays(wildcardEnd, 5);
  const divisionalEnd = addDays(wildcardEnd, 7);
  const conference = addDays(divisionalEnd, 7);
  const superBowl = nthWeekdayOfMonth(startYear + 1, 2, 7, 2);

  return {
    league: 'nfl',
    seasonLabel: seasonLabel(startYear),
    segments: [
      { kind: 'regular', start: isoDate(kickoff), end: isoDate(regularEnd) },
      { kind: 'wildcard', start: isoDate(wildcardStart), end: isoDate(wildcardEnd) },
      { kind: 'divisional', start: isoDate(divisionalStart), end: isoDate(divisionalEnd) },
      { kind: 'conference', start: isoDate(conference), end: isoDate(conference) },
      { kind: 'superbowl', start: isoDate(superBowl), end: isoDate(superBowl) },
    ],
    championship: {
      date: isoDate(superBowl),
      name: `Super Bowl ${startYear + 1}`,
    },
  };
}

function nbaSeason(startYear: number): LeagueSeason {
  const opening = nthWeekdayOfMonth(startYear, 10, 2, 3);
  const regularEnd = nthWeekdayOfMonth(startYear + 1, 4, 7, 2);
  const postseasonStart = addDays(regularEnd, 1);
  const finalsEnd = nthWeekdayOfMonth(startYear + 1, 6, 7, 3);

  return {
    league: 'nba',
    seasonLabel: seasonLabel(startYear),
    segments: [
      { kind: 'regular', start: isoDate(opening), end: isoDate(regularEnd) },
      { kind: 'postseason', start: isoDate(postseasonStart), end: isoDate(finalsEnd) },
    ],
    championship: { date: isoDate(finalsEnd), name: 'NBA Finals' },
  };
}

function nhlSeason(startYear: number): LeagueSeason {
  const opening = nthWeekdayOfMonth(startYear, 10, 2, 1);
  const regularEnd = nthWeekdayOfMonth(startYear + 1, 4, 4, 3);
  const postseasonStart = addDays(regularEnd, 1);
  const cupFinal = nthWeekdayOfMonth(startYear + 1, 6, 7, 4);

  return {
    league: 'nhl',
    seasonLabel: seasonLabel(startYear),
    segments: [
      { kind: 'regular', start: isoDate(opening), end: isoDate(regularEnd) },
      { kind: 'postseason', start: isoDate(postseasonStart), end: isoDate(cupFinal) },
    ],
    championship: { date: isoDate(cupFinal), name: 'Stanley Cup Final' },
  };
}

export function heuristicSportsYear(year: number): SportsYear {
  return SportsYearSchema.parse({
    year,
    leagues: [
      nflSeason(year - 1),
      nflSeason(year),
      nbaSeason(year - 1),
      nbaSeason(year),
      nhlSeason(year - 1),
      nhlSeason(year),
    ],
    source: 'heuristic',
  });
}