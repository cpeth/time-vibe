import {
  CakeSlice,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LocateFixed,
  Pause,
  Play,
} from 'lucide-react';
import type { DialModeId } from '../time/modes';
import { THEME_ORDER, THEMES } from '../themes/themes';
import type { ThemeId } from '../themes/types';

interface ControlsProps {
  year: number;
  mode: DialModeId;
  theme: ThemeId;
  timeLapse: boolean;
  reducedMotion: boolean;
  disabled: boolean;
  onYear: (year: number) => void;
  onToday: () => void;
  onMode: (mode: 'standard' | 'birthday') => void;
  onTheme: (theme: ThemeId) => void;
  onTimeLapse: () => void;
}

export function Controls({
  year,
  mode,
  theme,
  timeLapse,
  reducedMotion,
  disabled,
  onYear,
  onToday,
  onMode,
  onTheme,
  onTimeLapse,
}: ControlsProps) {
  return (
    <div className="controls" aria-label="Year Clock controls">
      <div className="year-control">
        <button className="icon-button" onClick={() => onYear(year - 1)} title="Previous year">
          <ChevronLeft aria-hidden="true" size={17} />
        </button>
        <output className="year-control__value">{year}</output>
        <button className="icon-button" onClick={() => onYear(year + 1)} title="Next year">
          <ChevronRight aria-hidden="true" size={17} />
        </button>
        <button className="icon-button" onClick={onToday} title="Return to today">
          <LocateFixed aria-hidden="true" size={16} />
        </button>
      </div>

      <div className="segmented-control" aria-label="Dial mode">
        <button
          aria-pressed={mode === 'standard'}
          disabled={disabled}
          onClick={() => onMode('standard')}
          title="Calendar year"
        >
          <Clock3 aria-hidden="true" size={15} />
          <span>Calendar</span>
        </button>
        <button
          aria-pressed={mode === 'birthday'}
          disabled={disabled}
          onClick={() => onMode('birthday')}
          title="Birthday year"
        >
          <CakeSlice aria-hidden="true" size={15} />
          <span>Birthday</span>
        </button>
      </div>

      <div className="theme-switcher" aria-label="Theme">
        {THEME_ORDER.map((themeId) => (
          <button
            aria-label={THEMES[themeId].label}
            aria-pressed={theme === themeId}
            className={`theme-swatch theme-swatch--${themeId}`}
            key={themeId}
            onClick={() => onTheme(themeId)}
            title={THEMES[themeId].label}
          />
        ))}
      </div>

      <button
        aria-pressed={timeLapse}
        className="icon-button time-lapse-button"
        disabled={reducedMotion}
        onClick={onTimeLapse}
        title={timeLapse ? 'Pause time-lapse' : 'Play year time-lapse'}
      >
        {timeLapse ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
      </button>
    </div>
  );
}