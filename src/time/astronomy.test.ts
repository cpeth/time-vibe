import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { angularDistance, dateToAngle } from '../geometry/angle';
import { modeWithWarp, STANDARD_MODE } from './modes';
import { getSeasonBoundaries, getSunDay } from './astronomy';

describe('Pleasanton astronomy', () => {
  it('computes moving astronomical season boundaries', () => {
    const boundaries = getSeasonBoundaries(2026);
    expect(boundaries.map(({ instant }) => instant.month)).toEqual([3, 6, 9, 12]);
    expect(boundaries.map(({ instant }) => instant.day)).toEqual([20, 21, 22, 21]);
  });

  it('computes substantially longer summer daylight', () => {
    const winter = getSunDay(Temporal.PlainDate.from('2026-12-21'));
    const summer = getSunDay(Temporal.PlainDate.from('2026-06-21'));
    expect(summer.dayLengthMinutes - winter.dayLengthMinutes).toBeGreaterThan(300);
  });

  it('places season boundaries at near-right angles under true anomaly', () => {
    const mode = modeWithWarp(STANDARD_MODE, 'true-anomaly');
    const angles = getSeasonBoundaries(2026).map(({ instant }) => dateToAngle(instant, mode));
    const spacings = angles.slice(0, -1).map((angle, index) =>
      angularDistance(angle, angles[index + 1]!),
    );

    for (const spacing of spacings) {
      expect(Math.abs(spacing - 90)).toBeLessThan(0.15);
    }
  });
});