import {
  CalendarDays,
  CloudRain,
  MapPin,
  SunMedium,
  ThermometerSun,
  Trophy,
} from 'lucide-react';
import { Temporal } from '@js-temporal/polyfill';
import {
  actualForDate,
  normalForDate,
  waterYearStat,
} from '../data/providers/climate';
import { nearestEventMarkers } from '../data/providers/events';
import { sportsStatusesForDate } from '../data/providers/sports';
import type {
  ClimateActuals,
  ClimateSeries,
  EventMarker,
  SportsYear,
} from '../data/schemas';
import {
  nextSeasonBoundary,
  seasonForDate,
  type SeasonBoundary,
  type SunDay,
} from '../time/astronomy';
import {
  daysBetween,
  formatClockTime,
  formatShortDate,
  monthName,
  weekdayName,
  yearProgress,
} from '../time/rules';
import { composeVibe } from './vibe';

interface ReadoutProps {
  date: Temporal.PlainDate;
  sunDays: SunDay[];
  boundaries: SeasonBoundary[];
  normals: ClimateSeries;
  actuals: Array<ClimateActuals | null>;
  sports: SportsYear;
  markers: EventMarker[];
  selectedMarker: EventMarker | null;
}

function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}h ${String(remainder).padStart(2, '0')}m`;
}

function countdownLabel(days: number): string {
  if (days === 0) return 'today';
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export function Readout({
  date,
  sunDays,
  boundaries,
  normals,
  actuals,
  sports,
  markers,
  selectedMarker,
}: ReadoutProps) {
  const sun = sunDays[date.dayOfYear - 1] ?? sunDays[0]!;
  const yesterdaySun = sunDays[Math.max(0, date.dayOfYear - 2)] ?? sun;
  const normal = normalForDate(date, normals);
  const actual = actuals.map((series) => actualForDate(date, series)).find(Boolean) ?? null;
  const latestActualDate = actuals
    .flatMap((series) => series?.daily ?? [])
    .map(({ date: actualDate }) => actualDate)
    .sort()
    .at(-1);
  const water = waterYearStat(date, normals, actuals);
  const sportsStatuses = sportsStatusesForDate(date, sports);
  const activeSports = sportsStatuses.filter(({ phase }) => phase !== 'offseason');
  const nearby = nearestEventMarkers(date, markers, 2);
  const season = seasonForDate(date, boundaries);
  const nextBoundary = nextSeasonBoundary(date, boundaries);
  const progress = yearProgress(date);
  const sunset = formatClockTime(sun.sunset);
  const vibe = composeVibe({
    sunset,
    sunsetHour: sun.sunsetHour,
    precipIn: normal.precipIn,
    temperatureF: normal.hiF,
    sports: sportsStatuses,
  });

  return (
    <aside className="readout" aria-live="polite">
      <div className="readout__location">
        <MapPin aria-hidden="true" size={13} /> Pleasanton, California
      </div>

      {selectedMarker && (
        <div className={`selected-event selected-event--${selectedMarker.category}`}>
          <span>{selectedMarker.category}</span>
          <strong>{selectedMarker.label}</strong>
          <small>
            {formatShortDate(Temporal.PlainDate.from(selectedMarker.date))}
            {selectedMarker.approximate ? ' · approximate' : ''}
          </small>
        </div>
      )}

      <header className="readout__header">
        <p>{weekdayName(date)} · day {progress.day}</p>
        <h2><span>{monthName(date)}</span> {date.day}</h2>
        <div className="readout__season">
          <span className={`season-dot season-dot--${season}`} />
          {season}
          {nextBoundary && (
            <small>
              {daysBetween(date, nextBoundary.instant.toPlainDate())} days to {nextBoundary.label.toLowerCase()}
            </small>
          )}
        </div>
      </header>

      <p className="vibe-line">{vibe}</p>

      <dl className="data-list">
        <div className="data-row">
          <dt><SunMedium aria-hidden="true" size={17} /><span>Daylight</span></dt>
          <dd>
            <strong>{formatClockTime(sun.sunrise)} → {sunset}</strong>
            <small>
              {durationLabel(sun.dayLengthMinutes)} · {sun.dayLengthMinutes >= yesterdaySun.dayLengthMinutes ? '+' : ''}
              {Math.round(sun.dayLengthMinutes - yesterdaySun.dayLengthMinutes)}m vs yesterday
            </small>
          </dd>
        </div>
        <div className="data-row">
          <dt><ThermometerSun aria-hidden="true" size={17} /><span>Air</span></dt>
          <dd>
            <strong>{Math.round(normal.hiF)}° / {Math.round(normal.loF)}° normal</strong>
            <small>
              {actual
                ? `Actual ${Math.round(actual.hiF)}° · ${actual.hiF - normal.hiF >= 0 ? '+' : ''}${Math.round(actual.hiF - normal.hiF)}°`
                : latestActualDate
                  ? `Actuals through ${formatShortDate(Temporal.PlainDate.from(latestActualDate))}`
                  : 'Actual trace waits for the live archive'}
            </small>
          </dd>
        </div>
        <div className="data-row">
          <dt><CloudRain aria-hidden="true" size={17} /><span>Rain</span></dt>
          <dd>
            <strong>{normal.precipIn.toFixed(2)}″ daily normal</strong>
            <small>
              {water.percentOfNormal === null
                ? 'Water-year actuals unavailable offline'
                : `${Math.round(water.percentOfNormal)}% of normal since Oct 1`}
            </small>
          </dd>
        </div>
        <div className="data-row">
          <dt><Trophy aria-hidden="true" size={17} /><span>Sports</span></dt>
          <dd>
            <strong>
              {activeSports.length > 0
                ? activeSports.map(({ league, label }) => `${league.toUpperCase()} ${label}`).join(' · ')
                : 'The desert'}
            </strong>
            <small>
              {activeSports.length > 0
                ? `${activeSports.length} ${activeSports.length === 1 ? 'league' : 'leagues'} in motion`
                : sportsStatuses.find(({ detail }) => detail)?.detail ?? 'No active league seasons'}
              {sports.source === 'heuristic' ? ' · approximate' : ''}
            </small>
          </dd>
        </div>
        <div className="data-row">
          <dt><CalendarDays aria-hidden="true" size={17} /><span>Near</span></dt>
          <dd>
            <strong>{nearby[0]?.marker.label ?? 'Clear horizon'}</strong>
            <small>
              {nearby.map(({ marker, days }) => `${marker.label} ${countdownLabel(days)}`).join(' · ')}
            </small>
          </dd>
        </div>
      </dl>

      <div className="readout__progress">
        <span>Year elapsed</span>
        <div className="progress-track"><i style={{ width: `${progress.percent}%` }} /></div>
        <strong>{progress.percent.toFixed(1)}%</strong>
      </div>

      <div className="legend" aria-label="Dial legend">
        <span><i className="legend__line legend__line--nfl" />NFL</span>
        <span><i className="legend__line legend__line--nba" />NBA</span>
        <span><i className="legend__line legend__line--nhl" />NHL</span>
        <span><i className="legend__marker" />Events</span>
      </div>
    </aside>
  );
}