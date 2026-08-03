import {
  dateFromIso,
  daysBetween,
} from '../../time/rules';
import type { Temporal } from '@js-temporal/polyfill';
import {
  SportsYearSchema,
  type LeagueSeason,
  type Segment,
  type SportsYear,
} from '../schemas';
import { heuristicSportsYear } from '../sportsHeuristics';

export { heuristicSportsYear } from '../sportsHeuristics';

export interface ClippedLeagueSeason extends Omit<LeagueSeason, 'segments'> {
  segments: Segment[];
}

export interface LeagueStatus {
  league: LeagueSeason['league'];
  phase: Segment['kind'] | 'offseason';
  label: string;
  detail?: string;
}

export function clipToCalendarYear(sportsYear: SportsYear): ClippedLeagueSeason[] {
  const yearStart = `${sportsYear.year}-01-01`;
  const yearEnd = `${sportsYear.year}-12-31`;

  return sportsYear.leagues.flatMap((season) => {
    const segments = season.segments.flatMap((segment) => {
      const start = segment.start < yearStart ? yearStart : segment.start;
      const end = segment.end > yearEnd ? yearEnd : segment.end;
      return start <= end ? [{ ...segment, start, end }] : [];
    });

    return segments.length > 0 ? [{ ...season, segments }] : [];
  });
}

const PHASE_LABELS: Record<Segment['kind'], string> = {
  regular: 'regular season',
  wildcard: 'wild card weekend',
  divisional: 'divisional round',
  conference: 'conference championships',
  superbowl: 'Super Bowl Sunday',
  postseason: 'postseason',
};

export function sportsStatusesForDate(
  date: Temporal.PlainDate,
  sportsYear: SportsYear,
): LeagueStatus[] {
  const iso = date.toString();
  return (['nfl', 'nba', 'nhl'] as const).map((league) => {
    const seasons = clipToCalendarYear(sportsYear).filter((season) => season.league === league);
    const segment = seasons.flatMap((season) => season.segments).find(({ start, end }) =>
      start <= iso && iso <= end,
    );
    if (segment) {
      return { league, phase: segment.kind, label: PHASE_LABELS[segment.kind] };
    }
    const nextKickoff = seasons
      .flatMap((season) => season.segments)
      .filter(({ kind, start }) => kind === 'regular' && start > iso)
      .map(({ start }) => start)
      .sort()[0];
    return {
      league,
      phase: 'offseason',
      label: 'off-season',
      detail: nextKickoff
        ? `${daysBetween(date, dateFromIso(nextKickoff))} days to opening night`
        : undefined,
    };
  });
}

const FALLBACKS = import.meta.glob('../fallback/sports-*.json', {
  eager: true,
  import: 'default',
});

function bundledSports(year: number): SportsYear | null {
  const match = Object.entries(FALLBACKS).find(([path]) => path.endsWith(`sports-${year}.json`));
  if (!match) {
    return null;
  }
  const parsed = SportsYearSchema.safeParse(match[1]);
  return parsed.success ? parsed.data : null;
}

export async function getSportsYear(year: number): Promise<SportsYear> {
  let remoteFallback: SportsYear | null = null;
  try {
    const response = await fetch(`/api/sports/${year}`);
    if (response.ok) {
      const parsed = SportsYearSchema.safeParse(await response.json());
      if (parsed.success) {
        if (parsed.data.source === 'live') return parsed.data;
        remoteFallback = parsed.data;
      }
    }
  } catch {
    // Offline is a first-class mode; continue through the fallback chain.
  }

  return bundledSports(year) ?? remoteFallback ?? heuristicSportsYear(year);
}