import { Temporal } from '@js-temporal/polyfill';
import {
  climatologyDayOfYear,
  dateFromDayIndex,
  daysInMonth,
} from '../../time/calendar';
import { waterYearToDate } from '../../time/rules';
import { PLEASANTON } from '../../time/location';
import {
  ClimateActualsSchema,
  ClimateSeriesSchema,
  type ClimateActuals,
  type ClimateSeries,
} from '../schemas';

const MONTHLY_NORMALS = [
  { hiF: 58, loF: 40, precipIn: 2.8 },
  { hiF: 62, loF: 42, precipIn: 2.6 },
  { hiF: 66, loF: 44, precipIn: 2.0 },
  { hiF: 71, loF: 47, precipIn: 0.8 },
  { hiF: 77, loF: 51, precipIn: 0.35 },
  { hiF: 84, loF: 55, precipIn: 0.08 },
  { hiF: 89, loF: 58, precipIn: 0.01 },
  { hiF: 89, loF: 58, precipIn: 0.02 },
  { hiF: 86, loF: 56, precipIn: 0.1 },
  { hiF: 78, loF: 51, precipIn: 0.65 },
  { hiF: 66, loF: 44, precipIn: 1.45 },
  { hiF: 58, loF: 40, precipIn: 2.6 },
] as const;

export interface ClimateNormalDay {
  doy: number;
  hiF: number;
  loF: number;
  precipIn: number;
}

export interface WaterYearStat {
  actualIn: number;
  normalIn: number;
  percentOfNormal: number | null;
}

function interpolate(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function generateClimateNormals(): ClimateSeries {
  const daily = Array.from({ length: 366 }, (_, dayIndex) => {
    const date = dateFromDayIndex(2024, dayIndex);
    const current = MONTHLY_NORMALS[date.month - 1]!;
    const next = MONTHLY_NORMALS[date.month % 12]!;
    const amount = (date.day - 1) / daysInMonth(date.year, date.month);

    return {
      doy: dayIndex + 1,
      hiF: interpolate(current.hiF, next.hiF, amount),
      loF: interpolate(current.loF, next.loF, amount),
      precipIn:
        interpolate(
          current.precipIn / daysInMonth(date.year, date.month),
          next.precipIn / daysInMonth(date.year, (date.month % 12) + 1),
          amount,
        ),
    };
  });

  return ClimateSeriesSchema.parse({
    location: {
      lat: PLEASANTON.lat,
      lon: PLEASANTON.lon,
      name: PLEASANTON.name,
    },
    daily,
  });
}

const FALLBACKS = import.meta.glob('../fallback/climate-normals.json', {
  eager: true,
  import: 'default',
});

export function getClimateNormals(): ClimateSeries {
  const candidate = Object.values(FALLBACKS)[0];
  const parsed = ClimateSeriesSchema.safeParse(candidate);
  return parsed.success && parsed.data.daily.length === 366
    ? parsed.data
    : generateClimateNormals();
}

export async function getClimateActuals(year: number): Promise<ClimateActuals | null> {
  try {
    const response = await fetch(`/api/climate/actuals/${year}`);
    if (!response.ok) {
      return null;
    }
    const parsed = ClimateActualsSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function normalForDate(
  date: Temporal.PlainDate,
  normals: ClimateSeries,
): ClimateNormalDay {
  return normals.daily[climatologyDayOfYear(date) - 1] ?? normals.daily[0]!;
}

export function actualForDate(
  date: Temporal.PlainDate,
  actuals: ClimateActuals | null,
): ClimateActuals['daily'][number] | null {
  return actuals?.daily.find((day) => day.date === date.toString()) ?? null;
}

export function temperatureAtHour(
  normal: ClimateNormalDay,
  hour: number,
  sunriseHour: number,
): number {
  const peakHour = 15.5;
  if (hour <= sunriseHour) {
    return normal.loF;
  }
  if (hour <= peakHour) {
    const phase = (hour - sunriseHour) / (peakHour - sunriseHour);
    const eased = phase * phase * (3 - 2 * phase);
    return normal.loF + (normal.hiF - normal.loF) * eased;
  }
  const cooling = Math.min(1, (hour - peakHour) / (24 - peakHour + sunriseHour));
  const eased = cooling * cooling * (3 - 2 * cooling);
  return normal.hiF - (normal.hiF - normal.loF) * eased;
}

export function waterYearStat(
  date: Temporal.PlainDate,
  normals: ClimateSeries,
  actualSeries: Array<ClimateActuals | null>,
): WaterYearStat {
  const actualByDate = new Map(
    actualSeries.flatMap((series) => series?.daily ?? []).map((day) => [day.date, day]),
  );
  let actualIn = 0;
  let normalIn = 0;

  for (const waterDate of waterYearToDate(date)) {
    actualIn += actualByDate.get(waterDate.toString())?.precipIn ?? 0;
    normalIn += normalForDate(waterDate, normals).precipIn;
  }

  return {
    actualIn,
    normalIn,
    percentOfNormal: normalIn > 0 && actualByDate.size > 0 ? (actualIn / normalIn) * 100 : null,
  };
}