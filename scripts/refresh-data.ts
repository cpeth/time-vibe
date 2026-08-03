import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchSportsYear } from '../functions/lib/espn';
import { ClimateSeriesSchema, SportsYearSchema } from '../src/data/schemas';
import { dateFromDayIndex } from '../src/time/calendar';
import { PLEASANTON } from '../src/time/location';

interface OpenMeteoArchive {
  daily?: {
    time?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
    precipitation_sum?: unknown;
  };
}

interface DailyAggregate {
  highs: number[];
  lows: number[];
  precipitation: number[];
}

const outputDirectory = resolve('src/data/fallback');

function parseYearArgument(): number | null {
  const index = process.argv.indexOf('--year');
  if (index < 0) return null;
  const year = Number(process.argv[index + 1]);
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error('Expected --year YYYY');
  }
  return year;
}

function numericArray(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'number')) {
    throw new Error('Open-Meteo returned a malformed numeric series');
  }
  return value;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Open-Meteo returned a malformed date series');
  }
  return value;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function smoothCircular(values: number[], before: number, after: number): number[] {
  return values.map((_, index) => {
    const window: number[] = [];
    for (let offset = -before; offset <= after; offset += 1) {
      window.push(values[(index + offset + values.length) % values.length]!);
    }
    return mean(window);
  });
}

async function refreshClimateNormals(): Promise<void> {
  const endpoint = new URL('https://archive-api.open-meteo.com/v1/archive');
  endpoint.searchParams.set('latitude', String(PLEASANTON.lat));
  endpoint.searchParams.set('longitude', String(PLEASANTON.lon));
  endpoint.searchParams.set('start_date', '2016-01-01');
  endpoint.searchParams.set('end_date', '2025-12-31');
  endpoint.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum');
  endpoint.searchParams.set('temperature_unit', 'fahrenheit');
  endpoint.searchParams.set('precipitation_unit', 'inch');
  endpoint.searchParams.set('timezone', PLEASANTON.timeZone);
  const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const payload = await response.json() as OpenMeteoArchive;
  const dates = stringArray(payload.daily?.time);
  const highs = numericArray(payload.daily?.temperature_2m_max);
  const lows = numericArray(payload.daily?.temperature_2m_min);
  const precipitation = numericArray(payload.daily?.precipitation_sum);
  const aggregates = new Map<string, DailyAggregate>();

  dates.forEach((date, index) => {
    const key = date.slice(5);
    const aggregate = aggregates.get(key) ?? { highs: [], lows: [], precipitation: [] };
    aggregate.highs.push(highs[index]!);
    aggregate.lows.push(lows[index]!);
    aggregate.precipitation.push(precipitation[index]!);
    aggregates.set(key, aggregate);
  });

  const raw = Array.from({ length: 366 }, (_, dayIndex) => {
    const date = dateFromDayIndex(2024, dayIndex);
    const key = `${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    const aggregate = aggregates.get(key);
    if (!aggregate) throw new Error(`No climate samples for ${key}`);
    return {
      doy: dayIndex + 1,
      hiF: mean(aggregate.highs),
      loF: mean(aggregate.lows),
      precipIn: mean(aggregate.precipitation),
    };
  });
  const smoothedHighs = smoothCircular(raw.map(({ hiF }) => hiF), 6, 7);
  const smoothedLows = smoothCircular(raw.map(({ loF }) => loF), 6, 7);
  const smoothedPrecipitation = smoothCircular(raw.map(({ precipIn }) => precipIn), 15, 15);
  const climate = ClimateSeriesSchema.parse({
    location: { lat: PLEASANTON.lat, lon: PLEASANTON.lon, name: PLEASANTON.name },
    daily: raw.map(({ doy }, index) => ({
      doy,
      hiF: Number(smoothedHighs[index]!.toFixed(2)),
      loF: Number(smoothedLows[index]!.toFixed(2)),
      precipIn: Number(smoothedPrecipitation[index]!.toFixed(4)),
    })),
  });
  await writeFile(
    resolve(outputDirectory, 'climate-normals.json'),
    `${JSON.stringify(climate, null, 2)}\n`,
  );
  console.log(`Wrote ${climate.daily.length} climate normals from 2016–2025`);
}

async function refreshSports(year: number): Promise<void> {
  const sports = SportsYearSchema.parse(await fetchSportsYear(year));
  await writeFile(
    resolve(outputDirectory, `sports-${year}.json`),
    `${JSON.stringify(sports, null, 2)}\n`,
  );
  console.log(`Wrote ${sports.leagues.length} ${sports.source} league seasons for ${year}`);
}

await mkdir(outputDirectory, { recursive: true });
const year = parseYearArgument();
if (year) {
  await refreshSports(year);
} else {
  await refreshClimateNormals();
}