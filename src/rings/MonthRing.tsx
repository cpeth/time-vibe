import { dateToAngle } from '../geometry/angle';
import { DIAL_CENTER, RADII } from '../geometry/layout';
import { polarToScreen, radialLabelRotation } from '../geometry/polar';
import {
  dateFromDayIndex,
  daysInYear,
  monthMidpoints,
} from '../time/calendar';
import type { DialMode } from '../time/modes';

interface MonthRingProps {
  year: number;
  mode: DialMode;
}

export function MonthRing({ year, mode }: MonthRingProps) {
  const days = Array.from({ length: daysInYear(year) }, (_, dayIndex) =>
    dateFromDayIndex(year, dayIndex),
  );

  return (
    <g className="month-ring">
      <circle
        className="month-ring__rail"
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={(RADII.monthInner + RADII.monthOuter) / 2}
      />
      {days.map((date) => {
        const angle = dateToAngle(date, mode);
        const isBoundary = date.day === 1;
        const inner = polarToScreen(
          angle,
          isBoundary ? RADII.monthInner - 4 : RADII.monthOuter - 8,
          DIAL_CENTER,
          DIAL_CENTER,
        );
        const outer = polarToScreen(angle, RADII.monthOuter, DIAL_CENTER, DIAL_CENTER);
        return (
          <line
            className={isBoundary ? 'day-tick day-tick--month' : 'day-tick'}
            key={date.toString()}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
          />
        );
      })}
      {monthMidpoints(year).map((date) => {
        const angle = dateToAngle(date, mode);
        const point = polarToScreen(angle, 409, DIAL_CENTER, DIAL_CENTER);
        return (
          <text
            className="month-label"
            key={date.month}
            x={point.x}
            y={point.y}
            transform={`rotate(${radialLabelRotation(angle)} ${point.x} ${point.y})`}
          >
            {date.toLocaleString('en-US', { month: 'short' }).toUpperCase()}
          </text>
        );
      })}
    </g>
  );
}