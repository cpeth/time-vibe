import { dateToAngle } from '../geometry/angle';
import { directedAnnularArcPath } from '../geometry/d3Arc';
import { DIAL_CENTER, RADII } from '../geometry/layout';
import { directedMidAngle } from '../geometry/paths';
import { polarToScreen, radialLabelRotation } from '../geometry/polar';
import { yearStart } from '../time/calendar';
import type { SeasonBoundary, SeasonName } from '../time/astronomy';
import type { DialMode } from '../time/modes';
import type { Theme } from '../themes/types';

interface SeasonRingProps {
  year: number;
  mode: DialMode;
  theme: Theme;
  boundaries: SeasonBoundary[];
}

interface SeasonSegment {
  season: SeasonName;
  start: Parameters<typeof dateToAngle>[0];
  end: Parameters<typeof dateToAngle>[0];
}

function buildSegments(year: number, boundaries: SeasonBoundary[]): SeasonSegment[] {
  const [spring, summer, autumn, winter] = boundaries;
  if (!spring || !summer || !autumn || !winter) {
    return [];
  }
  return [
    { season: 'winter', start: yearStart(year), end: spring.instant },
    { season: 'spring', start: spring.instant, end: summer.instant },
    { season: 'summer', start: summer.instant, end: autumn.instant },
    { season: 'autumn', start: autumn.instant, end: winter.instant },
    { season: 'winter', start: winter.instant, end: yearStart(year + 1) },
  ];
}

export function SeasonRing({ year, mode, theme, boundaries }: SeasonRingProps) {
  const segments = buildSegments(year, boundaries);
  return (
    <g className={`season-ring season-ring--${theme.id}`}>
      <defs>
        <pattern id="season-hatch" width="11" height="11" patternUnits="userSpaceOnUse">
          <path d="M-2 9 L9 -2 M2 13 L13 2" className="season-pattern-line" />
        </pattern>
        <pattern id="season-speckle" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="5" r="1.4" className="season-pattern-dot" />
          <circle cx="14" cy="12" r="0.8" className="season-pattern-dot" />
        </pattern>
      </defs>
      {segments.map((segment, index) => {
        const start = dateToAngle(segment.start, mode);
        const end = dateToAngle(segment.end, mode);
        const path = directedAnnularArcPath(
          start,
          end,
          mode.direction,
          RADII.seasonsInner,
          RADII.seasonsOuter,
          2,
        );
        const midpoint = directedMidAngle(start, end, mode.direction);
        const labelPoint = polarToScreen(midpoint, 178, DIAL_CENTER, DIAL_CENTER);
        return (
          <g key={`${segment.season}-${index}`}>
            <path
              className="season-arc"
              d={path}
              fill={theme.seasons[segment.season]}
              transform={`translate(${DIAL_CENTER} ${DIAL_CENTER})`}
            />
            {theme.id === 'almanac' && (
              <path
                className="season-art"
                d={path}
                fill={`url(#${segment.season === 'winter' ? 'season-speckle' : 'season-hatch'})`}
                transform={`translate(${DIAL_CENTER} ${DIAL_CENTER})`}
              />
            )}
            {index > 0 && (
              <text
                className="season-label"
                x={labelPoint.x}
                y={labelPoint.y}
                transform={`rotate(${radialLabelRotation(midpoint)} ${labelPoint.x} ${labelPoint.y})`}
              >
                {segment.season}
              </text>
            )}
          </g>
        );
      })}
      {boundaries.map((boundary) => {
        const angle = dateToAngle(boundary.instant, mode);
        const inner = polarToScreen(angle, RADII.seasonsInner - 5, DIAL_CENTER, DIAL_CENTER);
        const outer = polarToScreen(angle, RADII.seasonsOuter + 5, DIAL_CENTER, DIAL_CENTER);
        return (
          <line
            className="season-boundary"
            key={boundary.season}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
          />
        );
      })}
    </g>
  );
}