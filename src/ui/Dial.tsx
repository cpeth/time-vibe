import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Temporal } from '@js-temporal/polyfill';
import { angleToDate, dateToAngle, normalizeAngle } from '../geometry/angle';
import { DIAL_CENTER, DIAL_SIZE, RADII } from '../geometry/layout';
import { polarToScreen, screenPointToPolar } from '../geometry/polar';
import type { ClimateActuals, ClimateSeries, EventMarker, SportsYear } from '../data/schemas';
import { MonthRing } from '../rings/MonthRing';
import { SeasonRing } from '../rings/SeasonRing';
import { ClimateField, ClimateOverlay } from '../rings/ClimateRing';
import { SportsRing } from '../rings/SportsRing';
import { EventRing } from '../rings/EventRing';
import type { CalendarDate } from '../time/calendar';
import type { SeasonBoundary, SunDay } from '../time/astronomy';
import type { DialMode } from '../time/modes';
import { monthName, personalYearDay, yearProgress } from '../time/rules';
import type { Theme } from '../themes/types';
import { AmbienceCanvas } from './AmbienceCanvas';
import { useElementSize } from './useElementSize';

interface DialProps {
  year: number;
  mode: DialMode;
  theme: Theme;
  now: CalendarDate;
  focusDate: Temporal.PlainDate;
  scrubbed: boolean;
  isSwitching: boolean;
  reducedMotion: boolean;
  boundaries: SeasonBoundary[];
  sunDays: SunDay[];
  normals: ClimateSeries;
  actuals: ClimateActuals | null;
  sports: SportsYear;
  markers: EventMarker[];
  selectedMarkerId: string | null;
  eveningLightThreshold: number;
  showBaseball: boolean;
  onScrub: (date: Temporal.PlainDate) => void;
  onClearScrub: () => void;
  onSelectMarker: (marker: EventMarker) => void;
  onClearMarker: () => void;
}

interface HandProps {
  angle: number;
  radius: number;
  className: string;
}

function Hand({ angle, radius, className }: HandProps) {
  const point = polarToScreen(angle, radius, DIAL_CENTER, DIAL_CENTER);
  return (
    <line
      className={className}
      x1={DIAL_CENTER}
      y1={DIAL_CENTER}
      x2={point.x}
      y2={point.y}
    />
  );
}

export function Dial({
  year,
  mode,
  theme,
  now,
  focusDate,
  scrubbed,
  isSwitching,
  reducedMotion,
  boundaries,
  sunDays,
  normals,
  actuals,
  sports,
  markers,
  selectedMarkerId,
  eveningLightThreshold,
  showBaseball,
  onScrub,
  onClearScrub,
  onSelectMarker,
  onClearMarker,
}: DialProps) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const nowAngle = dateToAngle(now, mode);
  const focusAngle = dateToAngle(focusDate, mode);
  const progress = yearProgress(focusDate);
  const hubMonth = monthName(focusDate).slice(0, 3).toUpperCase();

  const updateScrub = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== 'mouse' && !dragging.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * DIAL_SIZE - DIAL_CENTER;
    const y = ((event.clientY - bounds.top) / bounds.height) * DIAL_SIZE - DIAL_CENTER;
    const polar = screenPointToPolar(x, y);
    if (polar.radius <= RADII.labels + 28) {
      onScrub(angleToDate(polar.angle, year, mode));
    }
  };

  return (
    <div
      className={`dial-frame${isSwitching ? ' is-switching' : ''}`}
      ref={ref}
    >
      <div className="dial-stage">
        <ClimateField
          mode={mode}
          normals={normals}
          size={size}
          sunDays={sunDays}
          theme={theme}
          year={year}
        />
        <svg
          aria-label={`Year Clock for ${year}, focused on ${focusDate.toString()}`}
          className="dial-svg"
          onClick={onClearMarker}
          onPointerDown={(event) => {
            dragging.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            updateScrub(event);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse' && !dragging.current) onClearScrub();
          }}
          onPointerMove={updateScrub}
          onPointerUp={(event) => {
            dragging.current = false;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          ref={svgRef}
          role="img"
          viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        >
          <defs>
            <filter id="hand-glow" x="-80%" y="-20%" width="260%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="hub-shadow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="7" stdDeviation="9" floodOpacity="0.22" />
            </filter>
          </defs>
          <circle className="dial-bed" cx={DIAL_CENTER} cy={DIAL_CENTER} r={RADII.labels + 8} />
          <circle className="dial-outer-rule" cx={DIAL_CENTER} cy={DIAL_CENTER} r={RADII.events + 25} />

          <SeasonRing boundaries={boundaries} mode={mode} theme={theme} year={year} />
          <ClimateOverlay
            actuals={actuals}
            eveningLightThreshold={eveningLightThreshold}
            mode={mode}
            normals={normals}
            sunDays={sunDays}
            theme={theme}
          />
          <SportsRing
            mode={mode}
            showBaseball={showBaseball}
            sports={sports}
            theme={theme}
            year={year}
          />
          <MonthRing mode={mode} year={year} />

          <g className="hands" aria-hidden="true">
            <Hand angle={normalizeAngle(nowAngle - 90)} className="hand hand--ghost" radius={305} />
            <Hand angle={normalizeAngle(nowAngle + 90)} className="hand hand--ghost" radius={305} />
            <Hand angle={normalizeAngle(nowAngle + 180)} className="hand hand--ghost hand--six" radius={278} />
            <Hand angle={nowAngle} className="hand hand--now" radius={388} />
            {scrubbed && <Hand angle={focusAngle} className="hand hand--scrub" radius={437} />}
          </g>

          <EventRing
            markers={markers}
            mode={mode}
            onSelect={onSelectMarker}
            selectedId={selectedMarkerId}
          />

          <g className="hub" filter="url(#hub-shadow)">
            <circle className="hub__outer" cx={DIAL_CENTER} cy={DIAL_CENTER} r={RADII.hub} />
            <circle className="hub__inner" cx={DIAL_CENTER} cy={DIAL_CENTER} r={RADII.hub - 12} />
            <circle
              className="hub__progress-track"
              cx={DIAL_CENTER}
              cy={DIAL_CENTER}
              r={RADII.hub - 6}
            />
            <circle
              className="hub__progress-value"
              cx={DIAL_CENTER}
              cy={DIAL_CENTER}
              r={RADII.hub - 6}
              pathLength="100"
              strokeDasharray={`${progress.percent} 100`}
              transform={`rotate(-90 ${DIAL_CENTER} ${DIAL_CENTER})`}
            />
            <text className="hub__eyebrow" x={DIAL_CENTER} y={DIAL_CENTER - 51}>
              {scrubbed ? 'IN FOCUS' : 'NOW'} · {year}
            </text>
            <text className="hub__month" x={DIAL_CENTER} y={DIAL_CENTER - 12}>{hubMonth}</text>
            <text className="hub__day" x={DIAL_CENTER} y={DIAL_CENTER + 43}>{focusDate.day}</text>
            <text className="hub__meta" x={DIAL_CENTER} y={DIAL_CENTER + 72}>
              DAY {progress.day} / {progress.total}
            </text>
            {mode.id === 'birthday' && (
              <text className="hub__personal-year" x={DIAL_CENTER} y={DIAL_CENTER + 91}>
                PERSONAL YEAR · DAY {personalYearDay(focusDate, mode.origin)}
              </text>
            )}
            <circle className="hub__pin" cx={DIAL_CENTER} cy={DIAL_CENTER} r={5} />
          </g>
        </svg>
        <AmbienceCanvas
          mode={mode}
          normals={normals}
          paused={isSwitching}
          reducedMotion={reducedMotion}
          size={size}
          theme={theme}
          year={year}
        />
      </div>
    </div>
  );
}