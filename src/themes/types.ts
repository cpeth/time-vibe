export type ThemeId = 'observatory' | 'editorial' | 'almanac';

export type RingId = 'seasons' | 'climate' | 'sports' | 'events';

export interface ThemeTokens {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  accentAlt: string;
  warm: string;
  cool: string;
  displayFont: string;
  bodyFont: string;
  glow: boolean;
}

export interface Theme {
  id: ThemeId;
  label: string;
  tokens: ThemeTokens;
  seasons: Record<'winter' | 'spring' | 'summer' | 'autumn', string>;
  temperatureStops: [number, string][];
  backdrop: 'stars' | 'print' | 'paper';
  precipTexture: 'streak' | 'stipple' | 'hatch';
  ambience: 'celestial' | 'seasonal' | null;
}