import { heuristicSportsYear } from '../../src/data/sportsHeuristics';
import {
  SportsYearSchema,
  type LeagueSeason,
  type SegmentKind,
  type SportsYear,
} from '../../src/data/schemas';

type League = LeagueSeason['league'];

interface CalendarRange {
  label: string;
  start: string;
  end: string;
}

interface SeasonUpdate {
  league: League;
  startYear: number;
  label?: string;
  ranges: Map<SegmentKind, CalendarRange>;
}

const ESPN_PATHS: Record<League, string> = {
  nfl: 'football/nfl',
  nba: 'basketball/nba',
  nhl: 'hockey/nhl',
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isoDate(value: unknown): string | null {
  const candidate = text(value)?.slice(0, 10) ?? null;
  return candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function collectRanges(value: unknown, inheritedLabel = '', output: CalendarRange[] = []): CalendarRange[] {
  if (Array.isArray(value)) {
    value.forEach((item) => collectRanges(item, inheritedLabel, output));
    return output;
  }
  const item = record(value);
  if (!item) return output;
  const label = text(item.label) ?? text(item.name) ?? text(item.displayName) ?? inheritedLabel;
  const start = isoDate(item.startDate) ?? isoDate(item.start);
  const end = isoDate(item.endDate) ?? isoDate(item.end);
  if (start && end) output.push({ label, start, end });
  for (const key of ['calendar', 'entries', 'children', 'weeks']) {
    if (key in item) collectRanges(item[key], label, output);
  }
  return output;
}

function classify(label: string, league: League): SegmentKind | null {
  const normalized = label.toLowerCase();
  if (normalized.includes('preseason')) return null;
  if (normalized.includes('super bowl')) return 'superbowl';
  if (normalized.includes('wild card')) return 'wildcard';
  if (normalized.includes('divisional')) return 'divisional';
  if (normalized.includes('conference champ')) return 'conference';
  if (normalized.includes('regular')) return 'regular';
  if (
    normalized.includes('postseason') ||
    normalized.includes('playoff') ||
    (league !== 'nfl' && normalized.includes('final'))
  ) {
    return 'postseason';
  }
  return null;
}

function seasonDisplayName(payload: unknown): string | undefined {
  const root = record(payload);
  const league = record(Array.isArray(root?.leagues) ? root.leagues[0] : null);
  const season = record(league?.season);
  return text(season?.displayName) ?? text(season?.name) ?? undefined;
}

function updateFromPayload(payload: unknown, league: League): SeasonUpdate | null {
  const root = record(payload);
  const leagueRecord = record(Array.isArray(root?.leagues) ? root.leagues[0] : null);
  const ranges = collectRanges(leagueRecord?.calendar);
  const regular = ranges.find((range) => classify(range.label, league) === 'regular');
  const dated = regular ?? ranges[0];
  if (!dated) return null;
  const startYear = Number(dated.start.slice(0, 4));
  if (!Number.isInteger(startYear)) return null;
  const byKind = new Map<SegmentKind, CalendarRange>();
  for (const range of ranges) {
    const kind = classify(range.label, league);
    if (kind && !byKind.has(kind)) byKind.set(kind, range);
  }
  return { league, startYear, label: seasonDisplayName(payload), ranges: byKind };
}

function applyUpdate(season: LeagueSeason, update: SeasonUpdate): LeagueSeason {
  const segments = season.segments.map((segment) => {
    const range = update.ranges.get(segment.kind);
    return range ? { ...segment, start: range.start, end: range.end } : segment;
  });
  return {
    ...season,
    seasonLabel: update.label ?? season.seasonLabel,
    segments: segments.sort((left, right) => left.start.localeCompare(right.start)),
    championship: season.championship && update.ranges.get(
      season.league === 'nfl' ? 'superbowl' : 'postseason',
    )
      ? {
          ...season.championship,
          date: update.ranges.get(season.league === 'nfl' ? 'superbowl' : 'postseason')!.end,
        }
      : season.championship,
  };
}

async function fetchCalendar(league: League, date: string): Promise<unknown> {
  const endpoint = new URL(`https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATHS[league]}/scoreboard`);
  endpoint.searchParams.set('dates', date);
  endpoint.searchParams.set('limit', '1');
  const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`ESPN ${league} returned ${response.status}`);
  return response.json();
}

export async function fetchSportsYear(year: number): Promise<SportsYear> {
  const fallback = heuristicSportsYear(year);
  const requests = (['nfl', 'nba', 'nhl'] as const).flatMap((league) => [
    fetchCalendar(league, `${year}0115`).then((payload) => updateFromPayload(payload, league)),
    fetchCalendar(league, `${year}1101`).then((payload) => updateFromPayload(payload, league)),
  ]);
  const settled = await Promise.allSettled(requests);
  const updates = settled.flatMap((result) =>
    result.status === 'fulfilled' && result.value ? [result.value] : [],
  );
  const byKey = new Map(updates.map((update) => [`${update.league}-${update.startYear}`, update]));
  if (byKey.size !== 6) {
    return fallback;
  }
  const leagues = fallback.leagues.map((season) => {
    const regularStart = season.segments.find(({ kind }) => kind === 'regular')?.start;
    const startYear = regularStart ? Number(regularStart.slice(0, 4)) : 0;
    const update = byKey.get(`${season.league}-${startYear}`);
    return update ? applyUpdate(season, update) : season;
  });

  return SportsYearSchema.parse({
    year,
    leagues,
    source: 'live',
  });
}