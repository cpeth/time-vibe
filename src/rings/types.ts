import type { Temporal } from '@js-temporal/polyfill';
import type { ReactNode } from 'react';
import type { ClimateSeries, SportsYear } from '../data/schemas';
import type { DialMode } from '../time/modes';
import type { Theme } from '../themes/types';

export interface DialGeometry {
  year: number;
  size: number;
  center: number;
}

export interface DataContext {
  location: { lat: number; lon: number; name: string; timeZone: string };
  climate: ClimateSeries;
  sports: SportsYear;
}

export interface ScrubEntry {
  label: string;
  value: string;
  detail?: string;
}

export interface ParticleConfig {
  family: 'leaves' | 'snow' | 'petals' | 'shimmer' | 'stars';
  cap: number;
  speed: number;
}

export interface RingDef<T> {
  id: string;
  label: string;
  radial: { inner: number; outer: number };
  data(year: number, ctx: DataContext): Promise<T>;
  render(props: {
    data: T;
    geom: DialGeometry;
    theme: Theme;
    mode: DialMode;
  }): ReactNode;
  scrub?(date: Temporal.PlainDate, data: T): ScrubEntry | null;
  ambience?(theme: Theme): ParticleConfig | null;
}