import type { LeagueStatus } from '../data/providers/sports';

interface VibeInput {
  sunset: string;
  sunsetHour: number;
  precipIn: number;
  temperatureF: number;
  sports: LeagueStatus[];
}

export function composeVibe({
  sunset,
  sunsetHour,
  precipIn,
  temperatureF,
  sports,
}: VibeInput): string {
  const light = sunsetHour < 18
    ? `Dark by ${sunset}.`
    : sunsetHour >= 20
      ? `Light lingers until ${sunset}.`
      : `Golden until ${sunset}.`;
  const weather = precipIn >= 0.08
    ? 'Rain has a vote.'
    : temperatureF >= 86
      ? 'The afternoon runs hot.'
      : precipIn < 0.01
        ? 'Bone-dry.'
        : 'A little weather in the air.';
  const active = sports.find(({ phase }) => phase !== 'offseason');
  const games = active
    ? `${active.league.toUpperCase()} ${active.label}.`
    : 'The leagues are quiet.';
  return `${light} ${weather} ${games}`;
}