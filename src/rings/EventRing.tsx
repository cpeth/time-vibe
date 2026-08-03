import { dateToAngle } from '../geometry/angle';
import { DIAL_CENTER, RADII } from '../geometry/layout';
import { staggerAngularCollisions } from '../geometry/paths';
import { polarToScreen } from '../geometry/polar';
import type { EventMarker } from '../data/schemas';
import { dateFromIso } from '../time/rules';
import type { DialMode } from '../time/modes';

interface EventRingProps {
  mode: DialMode;
  markers: EventMarker[];
  selectedId: string | null;
  onSelect: (marker: EventMarker) => void;
}

function markerPath(category: EventMarker['category']): string {
  if (category === 'golf') return 'M0 -6 L5 4 L-5 4 Z';
  if (category === 'astro') return 'M0 -6 L6 0 L0 6 L-6 0 Z';
  if (category === 'personal') return 'M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z';
  return 'M0 -5 A5 5 0 1 1 0 5 A5 5 0 1 1 0 -5';
}

export function EventRing({ mode, markers, selectedId, onSelect }: EventRingProps) {
  const markerById = new Map(markers.map((marker) => [marker.id, marker]));
  const layout = staggerAngularCollisions(
    markers.map((marker) => ({ id: marker.id, angle: dateToAngle(dateFromIso(marker.date), mode) })),
  );

  return (
    <g className="event-ring">
      {layout.map(({ id, angle, level }) => {
        const marker = markerById.get(id)!;
        const radius = RADII.events + level * 12;
        const base = polarToScreen(angle, RADII.events - 5, DIAL_CENTER, DIAL_CENTER);
        const point = polarToScreen(angle, radius, DIAL_CENTER, DIAL_CENTER);
        const selected = id === selectedId;
        const featured =
          marker.label === 'Birthday' ||
          marker.label === 'Super Bowl Sunday' ||
          marker.category === 'astro';
        const labelPoint = polarToScreen(angle, radius + 15, DIAL_CENTER, DIAL_CENTER);
        return (
          <g
            aria-label={`${marker.label}, ${marker.date}${marker.approximate ? ', approximate' : ''}`}
            className={`event-marker event-marker--${marker.category}${selected ? ' is-selected' : ''}`}
            key={id}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(marker);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onSelect(marker);
            }}
            role="button"
            tabIndex={0}
          >
            <title>{marker.label}</title>
            {level > 0 && (
              <line className="marker-leader" x1={base.x} y1={base.y} x2={point.x} y2={point.y} />
            )}
            <g transform={`translate(${point.x} ${point.y})`}>
              <path className="marker-glyph" d={markerPath(marker.category)} />
              {marker.approximate && <circle className="marker-approximate" cx={7} cy={-7} r={1.6} />}
            </g>
            {(featured || selected) && (
              <text
                className="marker-label"
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={labelPoint.x < DIAL_CENTER - 8 ? 'end' : labelPoint.x > DIAL_CENTER + 8 ? 'start' : 'middle'}
              >
                {marker.label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}