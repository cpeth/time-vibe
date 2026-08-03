import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { appConfig } from './config';
import { getClimateActuals, getClimateNormals } from './data/providers/climate';
import { eventMarkers } from './data/providers/events';
import { getSportsYear, heuristicSportsYear } from './data/providers/sports';
import type { ClimateActuals, EventMarker } from './data/schemas';
import { dateFromDayIndex, daysInYear, nowInPleasanton } from './time/calendar';
import { getSeasonBoundaries, getSunYear, seasonForDate } from './time/astronomy';
import { BIRTHDAY_MODE, STANDARD_MODE, type DialMode } from './time/modes';
import { dateFromIso, dateInYear, stepWithinYear } from './time/rules';
import { THEME_ORDER, THEMES, themeCssProperties } from './themes/themes';
import type { ThemeId } from './themes/types';
import { BackdropCanvas } from './ui/BackdropCanvas';
import { Controls } from './ui/Controls';
import { Dial } from './ui/Dial';
import { Readout } from './ui/Readout';
import { useReducedMotion } from './ui/useReducedMotion';

type V1ModeId = 'standard' | 'birthday';

const MODES: Record<V1ModeId, DialMode> = {
  standard: STANDARD_MODE,
  birthday: BIRTHDAY_MODE,
};

function initialTheme(): ThemeId {
  const query = new URLSearchParams(window.location.search).get('theme');
  if (query && THEME_ORDER.includes(query as ThemeId)) return query as ThemeId;
  const stored = window.localStorage.getItem('year-clock-theme');
  return stored && THEME_ORDER.includes(stored as ThemeId) ? stored as ThemeId : 'observatory';
}

function initialMode(): V1ModeId {
  return new URLSearchParams(window.location.search).get('mode') === 'birthday'
    ? 'birthday'
    : 'standard';
}

function initialYear(): number {
  const query = Number(new URLSearchParams(window.location.search).get('year'));
  return Number.isInteger(query) && query >= 1900 && query <= 2200
    ? query
    : nowInPleasanton().year;
}

export function App() {
  const [now, setNow] = useState(nowInPleasanton);
  const [year, setYear] = useState(initialYear);
  const [modeId, setModeId] = useState<V1ModeId>(initialMode);
  const [themeId, setThemeId] = useState<ThemeId>(initialTheme);
  const [scrubDate, setScrubDate] = useState<Temporal.PlainDate | null>(null);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [timeLapse, setTimeLapse] = useState(false);
  const [sports, setSports] = useState(() => heuristicSportsYear(initialYear()));
  const [actuals, setActuals] = useState<Array<ClimateActuals | null>>([null, null]);
  const transitionTimers = useRef<number[]>([]);
  const reducedMotion = useReducedMotion();
  const mode = MODES[modeId];
  const theme = THEMES[themeId];
  const normals = useMemo(getClimateNormals, []);
  const sunDays = useMemo(() => getSunYear(year), [year]);
  const boundaries = useMemo(() => getSeasonBoundaries(year), [year]);
  const todayInYear = dateInYear(year, now.toPlainDate());
  const focusDate = scrubDate ?? todayInYear;
  const nowForDial = now.year === year ? now : todayInYear;
  const markers = useMemo(
    () => eventMarkers(year, sports, appConfig.personalDates),
    [sports, year],
  );
  const selectedMarker = markers.find(({ id }) => id === selectedMarkerId) ?? null;
  const activeSeason = seasonForDate(focusDate, boundaries);
  const currentActuals = actuals.find((series) => series?.year === year) ?? null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(nowInPleasanton()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    setSports(heuristicSportsYear(year));
    void getSportsYear(year).then((next) => {
      if (active) setSports(next);
    });
    return () => {
      active = false;
    };
  }, [year]);

  useEffect(() => {
    let active = true;
    void Promise.all([getClimateActuals(year - 1), getClimateActuals(year)]).then((series) => {
      if (active) setActuals(series);
    });
    return () => {
      active = false;
    };
  }, [year]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('theme', themeId);
    url.searchParams.set('mode', modeId);
    url.searchParams.set('year', String(year));
    window.history.replaceState({}, '', url);
    window.localStorage.setItem('year-clock-theme', themeId);
  }, [modeId, themeId, year]);

  useEffect(() => () => {
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!timeLapse) return;
    const startedAt = performance.now();
    let animation = 0;
    const animate = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / 20_000);
      const dayIndex = Math.min(daysInYear(year) - 1, Math.floor(progress * daysInYear(year)));
      setScrubDate(dateFromDayIndex(year, dayIndex));
      if (progress < 1) {
        animation = requestAnimationFrame(animate);
      } else {
        setTimeLapse(false);
      }
    };
    animation = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animation);
  }, [timeLapse, year]);

  const changeMode = (nextMode: V1ModeId) => {
    if (nextMode === modeId || isSwitching) return;
    setTimeLapse(false);
    setSelectedMarkerId(null);
    if (reducedMotion) {
      setModeId(nextMode);
      return;
    }
    setIsSwitching(true);
    transitionTimers.current.push(
      window.setTimeout(() => setModeId(nextMode), 560),
      window.setTimeout(() => setIsSwitching(false), 1_400),
    );
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setTimeLapse(false);
        const amount = (event.shiftKey ? 7 : 1) * (event.key === 'ArrowLeft' ? -1 : 1);
        setScrubDate((current) => stepWithinYear(current ?? focusDate, amount));
      } else if (event.key.toLowerCase() === 'm') {
        changeMode(modeId === 'standard' ? 'birthday' : 'standard');
      } else if (event.key.toLowerCase() === 't') {
        const index = THEME_ORDER.indexOf(themeId);
        setThemeId(THEME_ORDER[(index + 1) % THEME_ORDER.length]!);
      } else if (event.key === 'Escape') {
        setTimeLapse(false);
        setScrubDate(null);
        setSelectedMarkerId(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [focusDate, isSwitching, modeId, reducedMotion, themeId]);

  const appStyle = {
    ...themeCssProperties(theme),
    '--ambient': theme.seasons[activeSeason],
  } as CSSProperties;

  const changeYear = (nextYear: number) => {
    setYear(Math.max(1900, Math.min(2200, nextYear)));
    setScrubDate(null);
    setSelectedMarkerId(null);
    setTimeLapse(false);
  };

  const selectMarker = (marker: EventMarker) => {
    setSelectedMarkerId(marker.id);
    setScrubDate(dateFromIso(marker.date));
    setTimeLapse(false);
  };

  return (
    <div className={`app theme-${themeId}`} style={appStyle}>
      <BackdropCanvas theme={theme} />
      <div className="ambient-grade" aria-hidden="true" />

      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            changeYear(now.year);
            setScrubDate(null);
          }}
          title="Return to the current year"
        >
          <span className="brand__name"><strong>YEAR</strong> CLOCK</span>
          <span className="brand__line">A year, felt all at once</span>
        </button>
        <Controls
          disabled={isSwitching}
          mode={modeId}
          onMode={changeMode}
          onTheme={setThemeId}
          onTimeLapse={() => {
            setSelectedMarkerId(null);
            setTimeLapse((running) => !running);
          }}
          onToday={() => {
            changeYear(now.year);
            setScrubDate(null);
          }}
          onYear={changeYear}
          reducedMotion={reducedMotion}
          theme={themeId}
          timeLapse={timeLapse}
          year={year}
        />
      </header>

      <main className="instrument-layout">
        <section className="dial-column" aria-label="Year dial">
          <div className="dial-caption">
            <span>{modeId === 'birthday' ? 'AUG 25 ORIGIN · COUNTERCLOCKWISE' : 'JAN 01 ORIGIN · CLOCKWISE'}</span>
            <span className={`source-status source-status--${sports.source}`}>
              {sports.source === 'heuristic' ? 'APPROXIMATE SCHEDULES' : `${sports.source.toUpperCase()} SCHEDULES`}
            </span>
          </div>
          <Dial
            actuals={currentActuals}
            boundaries={boundaries}
            eveningLightThreshold={appConfig.eveningLightThreshold}
            focusDate={focusDate}
            isSwitching={isSwitching}
            markers={markers}
            mode={mode}
            normals={normals}
            now={nowForDial}
            onClearMarker={() => setSelectedMarkerId(null)}
            onClearScrub={() => {
              if (!timeLapse) setScrubDate(null);
            }}
            onScrub={(date) => {
              setTimeLapse(false);
              setScrubDate(date);
            }}
            onSelectMarker={selectMarker}
            reducedMotion={reducedMotion}
            scrubbed={scrubDate !== null}
            selectedMarkerId={selectedMarkerId}
            showBaseball={appConfig.showBaseballTechnically}
            sports={sports}
            sunDays={sunDays}
            theme={theme}
            year={year}
          />
          <div className="dial-key">
            <span><i className="dial-key__daylight" />SUNRISE → SUNSET</span>
            <span><i className="dial-key__threshold" />19:00 EVENING LINE</span>
            <span><i className="dial-key__actual" />ACTUAL HIGH TRACE</span>
          </div>
        </section>

        <Readout
          actuals={actuals}
          boundaries={boundaries}
          date={focusDate}
          markers={markers}
          normals={normals}
          selectedMarker={selectedMarker}
          sports={sports}
          sunDays={sunDays}
        />
      </main>

      <footer className="app-footer">
        <span>37.6624° N · 121.8747° W</span>
        <span>AMERICA / LOS ANGELES</span>
        <span>ASTRONOMICAL SEASONS</span>
      </footer>
    </div>
  );
}