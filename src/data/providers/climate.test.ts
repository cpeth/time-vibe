import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  generateClimateNormals,
  normalForDate,
  temperatureAtHour,
  waterYearStat,
} from './climate';
import type { ClimateActuals } from '../schemas';

describe('climate fallback', () => {
  const normals = generateClimateNormals();

  it('provides a complete leap-safe climatology', () => {
    expect(normals.daily).toHaveLength(366);
    const january = normalForDate(Temporal.PlainDate.from('2026-01-15'), normals);
    const july = normalForDate(Temporal.PlainDate.from('2026-07-15'), normals);
    expect(july.hiF).toBeGreaterThan(january.hiF + 25);
    expect(january.precipIn).toBeGreaterThan(july.precipIn * 20);
  });

  it('peaks in mid-afternoon and bottoms near sunrise', () => {
    const normal = normalForDate(Temporal.PlainDate.from('2026-07-15'), normals);
    expect(temperatureAtHour(normal, 6, 6)).toBeCloseTo(normal.loF, 5);
    expect(temperatureAtHour(normal, 15.5, 6)).toBeCloseTo(normal.hiF, 5);
  });

  it('composes water years from adjacent calendar responses', () => {
    const previous: ClimateActuals = {
      year: 2025,
      location: normals.location,
      daily: [{ date: '2025-10-01', hiF: 80, loF: 50, precipIn: 1 }],
      source: 'baked',
    };
    const current: ClimateActuals = {
      year: 2026,
      location: normals.location,
      daily: [{ date: '2026-01-15', hiF: 60, loF: 40, precipIn: 2 }],
      source: 'live',
    };
    const stat = waterYearStat(
      Temporal.PlainDate.from('2026-01-15'),
      normals,
      [previous, current],
    );
    expect(stat.actualIn).toBe(3);
    expect(stat.percentOfNormal).not.toBeNull();
  });
});