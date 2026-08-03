import { dateToAngle } from '../geometry/angle';
import { directedAnnularArcPath } from '../geometry/d3Arc';
import { DIAL_CENTER, RADII } from '../geometry/layout';
import { directedMidAngle } from '../geometry/paths';
import { polarToScreen, radialLabelRotation } from '../geometry/polar';
import { clipToCalendarYear } from '../data/providers/sports';
import type { LeagueSeason, SegmentKind, SportsYear } from '../data/schemas';
import { addDays, dateFromIso, daysBetween } from '../time/rules';
import type { DialMode } from '../time/modes';
import type { Theme } from '../themes/types';

interface SportsRingProps {
  year: number;
  mode: DialMode;
  theme: Theme;
  sports: SportsYear;
  showBaseball: boolean;
}

const LEAGUE_RADII = {
  nfl: [RADII.nflInner, RADII.nflOuter],
  nba: [RADII.nbaInner, RADII.nbaOuter],
  nhl: [RADII.nhlInner, RADII.nhlOuter],
} as const;

const LEAGUE_COLORS = {
  nfl: '#3ab08a',
  nba: '#e27642',
  nhl: '#6598d0',
} as const;

function phaseWeight(kind: SegmentKind): number {
  if (kind === 'superbowl') return 3;
  if (kind === 'regular') return 1;
  return 2;
}

function seasonArc(
  segment: LeagueSeason['segments'][number],
  mode: DialMode,
  inner: number,
  outer: number,
): string {
  const start = dateToAngle(dateFromIso(segment.start), mode);
  const end = dateToAngle(addDays(dateFromIso(segment.end), 1), mode);
  return directedAnnularArcPath(start, end, mode.direction, inner, outer, 4);
}

export function SportsRing({ year, mode, theme, sports, showBaseball }: SportsRingProps) {
  const seasons = clipToCalendarYear(sports);
  const springEnds = seasons
    .filter(({ league }) => league !== 'nfl')
    .flatMap(({ segments }) => segments)
    .filter(({ kind, end }) => kind === 'postseason' && end.startsWith(`${year}-`))
    .map(({ end }) => end)
    .sort();
  const fallStarts = seasons
    .filter(({ league }) => league === 'nfl')
    .flatMap(({ segments }) => segments)
    .filter(({ kind, start }) => kind === 'regular' && start.startsWith(`${year}-`))
    .map(({ start }) => start)
    .sort();
  const desertStart = springEnds.at(-1);
  const desertEnd = fallStarts[0];
  const desertDays = desertStart && desertEnd
    ? daysBetween(dateFromIso(desertStart), dateFromIso(desertEnd)) - 1
    : 0;
  const desertMid = desertStart && desertEnd
    ? addDays(dateFromIso(desertStart), Math.round(daysBetween(dateFromIso(desertStart), dateFromIso(desertEnd)) / 2))
    : null;
  const baseballStart = dateFromIso(`${year}-03-27`);
  const baseballEnd = dateFromIso(`${year}-11-02`);

  return (
    <g className={`sports-ring sports-ring--${theme.id}`}>
      <defs>
        <filter id="sports-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>
      {seasons.flatMap((season) =>
        season.segments.map((segment) => {
          return (
            <path
              className="sports-intensity"
              d={seasonArc(segment, mode, RADII.sportsGlowInner, RADII.sportsGlowOuter)}
              fill={LEAGUE_COLORS[season.league]}
              key={`glow-${season.league}-${season.seasonLabel}-${segment.kind}`}
              opacity={theme.tokens.glow ? phaseWeight(segment.kind) * 0.075 : phaseWeight(segment.kind) * 0.035}
              transform={`translate(${DIAL_CENTER} ${DIAL_CENTER})`}
            />
          );
        }),
      )}
      {seasons.flatMap((season) =>
        season.segments.map((segment) => {
          const [inner, outer] = LEAGUE_RADII[season.league];
          const emphasis = phaseWeight(segment.kind);
          return (
            <path
              className={`league-arc league-arc--${segment.kind}`}
              d={seasonArc(segment, mode, inner, outer)}
              fill={LEAGUE_COLORS[season.league]}
              key={`${season.league}-${season.seasonLabel}-${segment.kind}`}
              opacity={0.42 + emphasis * 0.19}
              transform={`translate(${DIAL_CENTER} ${DIAL_CENTER})`}
            />
          );
        }),
      )}
      {seasons.flatMap((season) => {
        const championship = season.championship;
        if (!championship?.date.startsWith(`${year}-`)) return [];
        const [, outer] = LEAGUE_RADII[season.league];
        const point = polarToScreen(
          dateToAngle(dateFromIso(championship.date), mode),
          outer - 4,
          DIAL_CENTER,
          DIAL_CENTER,
        );
        return [
          <circle
            className="championship-node"
            cx={point.x}
            cy={point.y}
            fill={LEAGUE_COLORS[season.league]}
            key={`${season.league}-championship`}
            r={5.5}
          />,
        ];
      })}
      {showBaseball && (
        <path
          className="baseball-arc"
          d={directedAnnularArcPath(
            dateToAngle(baseballStart, mode),
            dateToAngle(baseballEnd, mode),
            mode.direction,
            RADII.baseballInner,
            RADII.baseballOuter,
            3,
          )}
          transform={`translate(${DIAL_CENTER} ${DIAL_CENTER})`}
        />
      )}
      {desertMid && desertDays > 0 && (() => {
        const angle = dateToAngle(desertMid, mode);
        const point = polarToScreen(angle, 357, DIAL_CENTER, DIAL_CENTER);
        return (
          <text
            className="desert-label"
            x={point.x}
            y={point.y}
            transform={`rotate(${radialLabelRotation(angle)} ${point.x} ${point.y})`}
          >
            THE DESERT · {desertDays} DAYS
          </text>
        );
      })()}
      {showBaseball && (() => {
        const midpoint = directedMidAngle(
          dateToAngle(baseballStart, mode),
          dateToAngle(baseballEnd, mode),
          mode.direction,
        );
        const point = polarToScreen(midpoint, 385, DIAL_CENTER, DIAL_CENTER);
        return (
          <text
            className="baseball-label"
            x={point.x}
            y={point.y}
            transform={`rotate(${radialLabelRotation(midpoint)} ${point.x} ${point.y})`}
          >
            BASEBALL, TECHNICALLY
          </text>
        );
      })()}
    </g>
  );
}