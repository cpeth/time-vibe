import { Temporal } from '@js-temporal/polyfill';
import {
  dateFromDayIndex,
  daysInMonth,
  daysInYear,
  fractionOfDay,
  toPlainDate,
  type CalendarDate,
} from '../time/calendar';
import type { Chirality, DialMode } from '../time/modes';

const EARTH_ECCENTRICITY = 0.0167;
const PERIHELION_DAY_INDEX = 2;
const FULL_CIRCLE = 360;
const RADIANS_PER_DEGREE = Math.PI / 180;
const DEGREES_PER_RADIAN = 180 / Math.PI;
const INVERSE_EPSILON = 1e-7;

export function normalizeAngle(angle: number): number {
  const normalized = angle % FULL_CIRCLE;
  return normalized < 0 ? normalized + FULL_CIRCLE : normalized;
}

function uniformMonthAngle(date: CalendarDate): number {
  const plainDate = toPlainDate(date);
  const monthProgress =
    (plainDate.day - 1 + fractionOfDay(date)) /
    daysInMonth(plainDate.year, plainDate.month);

  return (plainDate.month - 1 + monthProgress) * 30;
}

function equationOfCenter(meanAnomaly: number): number {
  return (
    2 * EARTH_ECCENTRICITY * Math.sin(meanAnomaly) +
    (5 / 4) * EARTH_ECCENTRICITY ** 2 * Math.sin(2 * meanAnomaly)
  );
}

function trueAnomalyAtDay(dayPosition: number, year: number): number {
  const meanAnomaly =
    ((dayPosition - PERIHELION_DAY_INDEX) / daysInYear(year)) * 2 * Math.PI;
  return meanAnomaly + equationOfCenter(meanAnomaly);
}

function trueAnomalyAngle(date: CalendarDate): number {
  const plainDate = toPlainDate(date);
  const dayPosition = plainDate.dayOfYear - 1 + fractionOfDay(date);
  const anomalyAtStartOfYear = trueAnomalyAtDay(0, plainDate.year);

  return (
    (trueAnomalyAtDay(dayPosition, plainDate.year) - anomalyAtStartOfYear) *
    DEGREES_PER_RADIAN
  );
}

function canonicalAngle(date: CalendarDate, mode: DialMode): number {
  return mode.warp === 'uniform-month'
    ? uniformMonthAngle(date)
    : trueAnomalyAngle(date);
}

function originAngle(year: number, mode: DialMode): number {
  const origin = Temporal.PlainDate.from({ year, ...mode.origin });
  return canonicalAngle(origin, mode);
}

export function screenToDialAngle(angle: number, direction: Chirality): number {
  return direction === 'cw' ? normalizeAngle(angle) : normalizeAngle(-angle);
}

export function dialToScreenAngle(angle: number, direction: Chirality): number {
  return direction === 'cw' ? normalizeAngle(angle) : normalizeAngle(-angle);
}

export function dateToAngle(date: CalendarDate, mode: DialMode): number {
  const year = toPlainDate(date).year;
  const dialAngle = normalizeAngle(canonicalAngle(date, mode) - originAngle(year, mode));
  return dialToScreenAngle(dialAngle, mode.direction);
}

function uniformAngleToDate(canonical: number, year: number): Temporal.PlainDate {
  const monthIndex = Math.min(11, Math.floor(canonical / 30 + INVERSE_EPSILON));
  const month = monthIndex + 1;
  const monthFraction = (canonical - monthIndex * 30) / 30;
  const dayIndex = Math.min(
    daysInMonth(year, month) - 1,
    Math.floor(monthFraction * daysInMonth(year, month) + INVERSE_EPSILON),
  );

  return Temporal.PlainDate.from({ year, month, day: dayIndex + 1 });
}

function anomalyDerivative(dayPosition: number, year: number): number {
  const meanAnomaly =
    ((dayPosition - PERIHELION_DAY_INDEX) / daysInYear(year)) * 2 * Math.PI;
  const derivativeByMeanAnomaly =
    1 +
    2 * EARTH_ECCENTRICITY * Math.cos(meanAnomaly) +
    (5 / 2) * EARTH_ECCENTRICITY ** 2 * Math.cos(2 * meanAnomaly);

  return (FULL_CIRCLE / daysInYear(year)) * derivativeByMeanAnomaly;
}

function anomalyAngleAtDay(dayPosition: number, year: number): number {
  return (
    (trueAnomalyAtDay(dayPosition, year) - trueAnomalyAtDay(0, year)) *
    DEGREES_PER_RADIAN
  );
}

function anomalyAngleToDate(canonical: number, year: number): Temporal.PlainDate {
  const yearLength = daysInYear(year);
  let dayPosition = (canonical / FULL_CIRCLE) * yearLength;

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const error = anomalyAngleAtDay(dayPosition, year) - canonical;
    dayPosition -= error / anomalyDerivative(dayPosition, year);
  }

  const dayIndex = Math.max(
    0,
    Math.min(yearLength - 1, Math.floor(dayPosition + INVERSE_EPSILON)),
  );
  return dateFromDayIndex(year, dayIndex);
}

export function angleToDate(
  angleDeg: number,
  year: number,
  mode: DialMode,
): Temporal.PlainDate {
  const dialAngle = screenToDialAngle(angleDeg, mode.direction);
  const canonical = normalizeAngle(originAngle(year, mode) + dialAngle);

  return mode.warp === 'uniform-month'
    ? uniformAngleToDate(canonical, year)
    : anomalyAngleToDate(canonical, year);
}

export function angularDistance(from: number, to: number): number {
  return normalizeAngle(to - from);
}

export function degreesToRadians(degrees: number): number {
  return degrees * RADIANS_PER_DEGREE;
}