export const DIAL_SIZE = 1_000;
export const DIAL_CENTER = DIAL_SIZE / 2;

export const RADII = {
  hub: 116,
  seasonsInner: 152,
  seasonsOuter: 205,
  climateInner: 224,
  climateOuter: 322,
  sportsGlowInner: 333,
  sportsGlowOuter: 374,
  nflInner: 340,
  nflOuter: 349,
  nbaInner: 353,
  nbaOuter: 362,
  nhlInner: 366,
  nhlOuter: 375,
  baseballInner: 382,
  baseballOuter: 388,
  monthInner: 394,
  monthOuter: 427,
  events: 444,
  labels: 468,
} as const;

export function timeOfDayToRadius(hour: number): number {
  const clamped = Math.max(4, Math.min(22, hour));
  return RADII.climateInner + ((clamped - 4) / 18) * (RADII.climateOuter - RADII.climateInner);
}

export function temperatureDepartureToRadius(departureF: number): number {
  return timeOfDayToRadius(15.5 + Math.max(-3, Math.min(3, departureF * 0.12)));
}