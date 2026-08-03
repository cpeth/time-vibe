import { ClimateActualsSchema } from '../../../../src/data/schemas';
import { climateArchiveRange } from '../../../../src/time/apiDates';
import { PLEASANTON } from '../../../../src/time/location';
import { jsonResponse, parseYear, readJsonCache, writeJsonCache } from '../../../lib/http';
import type { Env, PagesFunction, WaitUntilContext } from '../../../types';

interface OpenMeteoDaily {
  time?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_sum?: unknown;
}

function numberArray(value: unknown): number[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
    ? value
    : null;
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null;
}

async function fetchActuals(year: number) {
  const range = climateArchiveRange(year);
  if (!range) {
    return ClimateActualsSchema.parse({
      year,
      location: { lat: PLEASANTON.lat, lon: PLEASANTON.lon, name: PLEASANTON.name },
      daily: [],
      source: 'live',
    });
  }
  const endpoint = new URL('https://archive-api.open-meteo.com/v1/archive');
  endpoint.searchParams.set('latitude', String(PLEASANTON.lat));
  endpoint.searchParams.set('longitude', String(PLEASANTON.lon));
  endpoint.searchParams.set('start_date', range.start);
  endpoint.searchParams.set('end_date', range.end);
  endpoint.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  endpoint.searchParams.set('temperature_unit', 'fahrenheit');
  endpoint.searchParams.set('precipitation_unit', 'inch');
  endpoint.searchParams.set('timezone', PLEASANTON.timeZone);
  const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const payload = await response.json() as { daily?: OpenMeteoDaily };
  const dates = stringArray(payload.daily?.time);
  const highs = numberArray(payload.daily?.temperature_2m_max);
  const lows = numberArray(payload.daily?.temperature_2m_min);
  const precipitation = numberArray(payload.daily?.precipitation_sum);
  if (!dates || !highs || !lows || !precipitation || !dates.every((_, index) =>
    highs[index] !== undefined && lows[index] !== undefined && precipitation[index] !== undefined,
  )) {
    throw new Error('Malformed Open-Meteo response');
  }
  return ClimateActualsSchema.parse({
    year,
    location: { lat: PLEASANTON.lat, lon: PLEASANTON.lon, name: PLEASANTON.name },
    daily: dates.map((date, index) => ({
      date,
      hiF: highs[index],
      loF: lows[index],
      precipIn: precipitation[index],
    })),
    source: 'live',
  });
}

export async function handleClimateActuals(
  yearValue: string | undefined,
  env: Env,
  context: WaitUntilContext,
): Promise<Response> {
  const year = parseYear(yearValue);
  if (!year) return jsonResponse({ error: 'Invalid year' }, { status: 400 });
  const key = `climate:actual:${year}`;
  const cached = ClimateActualsSchema.safeParse(await readJsonCache(env, key));
  if (cached.success) return jsonResponse(cached.data);
  const actuals = await fetchActuals(year);
  writeJsonCache(env, context, key, actuals, 24 * 60 * 60);
  return jsonResponse(actuals);
}

export const onRequestGet: PagesFunction<Env> = ({ params, env, waitUntil }) =>
  handleClimateActuals(
    typeof params.year === 'string' ? params.year : undefined,
    env,
    { waitUntil },
  );