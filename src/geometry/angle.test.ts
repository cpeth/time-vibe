import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  angleToDate,
  angularDistance,
  dateToAngle,
  screenToDialAngle,
} from './angle';
import {
  BIRTHDAY_MODE,
  STANDARD_MODE,
  modeWithWarp,
  type DialMode,
} from '../time/modes';
import { dateFromDayIndex, daysInYear } from '../time/calendar';

const MODES: DialMode[] = [
  STANDARD_MODE,
  BIRTHDAY_MODE,
  modeWithWarp(STANDARD_MODE, 'true-anomaly'),
  modeWithWarp(BIRTHDAY_MODE, 'true-anomaly'),
];

describe.each(MODES)('$id / $warp angle engine', (mode) => {
  it.each([2024, 2025])('round trips every day of %i', (year) => {
    for (let dayIndex = 0; dayIndex < daysInYear(year); dayIndex += 1) {
      const date = dateFromDayIndex(year, dayIndex);
      expect(angleToDate(dateToAngle(date, mode), year, mode).equals(date)).toBe(true);
    }
  });

  it('places its origin at 12 o’clock', () => {
    const origin = Temporal.PlainDate.from({ year: 2026, ...mode.origin });
    expect(dateToAngle(origin, mode)).toBeCloseTo(0, 9);
  });

  it('maps leap day to a unique angle', () => {
    const february28 = Temporal.PlainDate.from('2024-02-28');
    const leapDay = Temporal.PlainDate.from('2024-02-29');
    const march1 = Temporal.PlainDate.from('2024-03-01');
    const angles = [february28, leapDay, march1].map((date) => dateToAngle(date, mode));
    expect(new Set(angles).size).toBe(3);
    expect(angleToDate(angles[1]!, 2024, mode).equals(leapDay)).toBe(true);
  });

  it('moves strictly forward in unwrapped dial space', () => {
    let previous = screenToDialAngle(
      dateToAngle(dateFromDayIndex(2024, 0), mode),
      mode.direction,
    );
    let turns = 0;

    for (let dayIndex = 1; dayIndex < daysInYear(2024); dayIndex += 1) {
      const wrapped = screenToDialAngle(
        dateToAngle(dateFromDayIndex(2024, dayIndex), mode),
        mode.direction,
      );
      if (wrapped < previous % 360) {
        turns += 1;
      }
      const unwrapped = wrapped + turns * 360;
      expect(unwrapped).toBeGreaterThan(previous);
      previous = unwrapped;
    }
  });
});

describe.each([STANDARD_MODE, BIRTHDAY_MODE])('$id uniform-month invariants', (mode) => {
  it('keeps quarter and half-year month boundaries exact', () => {
    const january = Temporal.PlainDate.from('2025-01-01');
    const april = Temporal.PlainDate.from('2025-04-01');
    const july = Temporal.PlainDate.from('2025-07-01');
    const expectedQuarter = mode.direction === 'cw' ? 90 : 270;

    expect(angularDistance(dateToAngle(january, mode), dateToAngle(april, mode))).toBeCloseTo(
      expectedQuarter,
      9,
    );
    expect(angularDistance(dateToAngle(january, mode), dateToAngle(july, mode))).toBeCloseTo(
      180,
      9,
    );
  });

  it('spaces every month boundary by exactly 30 degrees in dial space', () => {
    const boundaries = Array.from({ length: 12 }, (_, monthIndex) =>
      screenToDialAngle(
        dateToAngle(
          Temporal.PlainDate.from({ year: 2025, month: monthIndex + 1, day: 1 }),
          mode,
        ),
        mode.direction,
      ),
    );

    for (let index = 0; index < boundaries.length; index += 1) {
      const next = boundaries[(index + 1) % boundaries.length]!;
      expect(angularDistance(boundaries[index]!, next)).toBeCloseTo(30, 9);
    }
  });
});

describe('true-anomaly invariants', () => {
  const mode = modeWithWarp(STANDARD_MODE, 'true-anomaly');

  it('moves faster near perihelion than aphelion', () => {
    const perihelionSpeed = angularDistance(
      dateToAngle(Temporal.PlainDate.from('2025-01-03'), mode),
      dateToAngle(Temporal.PlainDate.from('2025-01-04'), mode),
    );
    const aphelionSpeed = angularDistance(
      dateToAngle(Temporal.PlainDate.from('2025-07-04'), mode),
      dateToAngle(Temporal.PlainDate.from('2025-07-05'), mode),
    );

    expect(perihelionSpeed).toBeGreaterThan(aphelionSpeed);
  });
});