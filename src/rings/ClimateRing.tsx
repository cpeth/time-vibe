import { useEffect, useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import { angleToDate, dateToAngle } from '../geometry/angle';
import {
  DIAL_CENTER,
  DIAL_SIZE,
  RADII,
  temperatureDepartureToRadius,
  timeOfDayToRadius,
} from '../geometry/layout';
import { polarPath } from '../geometry/paths';
import { polarToScreen, screenPointToPolar } from '../geometry/polar';
import {
  normalForDate,
  temperatureAtHour,
} from '../data/providers/climate';
import type { ClimateActuals, ClimateSeries } from '../data/schemas';
import { dateFromIso } from '../time/rules';
import type { SunDay } from '../time/astronomy';
import type { DialMode } from '../time/modes';
import type { Theme } from '../themes/types';

interface ClimateRingProps {
  year: number;
  size: number;
  mode: DialMode;
  theme: Theme;
  sunDays: SunDay[];
  normals: ClimateSeries;
  actuals: ClimateActuals | null;
  eveningLightThreshold: number;
}

function colorChannels(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const value = color.slice(1);
    return [
      Number.parseInt(value.slice(0, 2), 16),
      Number.parseInt(value.slice(2, 4), 16),
      Number.parseInt(value.slice(4, 6), 16),
    ];
  }
  const channels = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
  return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0];
}

function textureNoise(x: number, y: number, day: number): number {
  let value = (x * 37_439 + y * 67_961 + day * 9_973) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295;
}

export function ClimateField({
  year,
  size,
  mode,
  theme,
  sunDays,
  normals,
}: Omit<ClimateRingProps, 'actuals' | 'eveningLightThreshold'>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sunDays.length === 0) {
      return;
    }
    const resolution = Math.min(900, Math.max(480, Math.round(size * window.devicePixelRatio)));
    canvas.width = resolution;
    canvas.height = resolution;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    const image = context.createImageData(resolution, resolution);
    const scale = resolution / DIAL_SIZE;
    const center = resolution / 2;
    const bins = 1_440;
    const byDate = new Map(sunDays.map((day) => [day.date.toString(), day]));
    const samples = Array.from({ length: bins }, (_, index) => {
      const angle = (index / bins) * 360;
      const date = angleToDate(angle, year, mode);
      return {
        date,
        sun: byDate.get(date.toString())!,
        normal: normalForDate(date, normals),
      };
    });
    const temperatureScale = scaleLinear<string>()
      .domain(theme.temperatureStops.map(([temperature]) => temperature))
      .range(theme.temperatureStops.map(([, color]) => color))
      .clamp(true);
    const minPixel = Math.floor(center - RADII.climateOuter * scale);
    const maxPixel = Math.ceil(center + RADII.climateOuter * scale);

    for (let y = minPixel; y <= maxPixel; y += 1) {
      for (let x = minPixel; x <= maxPixel; x += 1) {
        const polar = screenPointToPolar(x - center, y - center);
        const radius = polar.radius / scale;
        if (radius < RADII.climateInner || radius > RADII.climateOuter) {
          continue;
        }
        const sample = samples[Math.round((polar.angle / 360) * bins) % bins]!;
        const hour = 4 + ((radius - RADII.climateInner) / (RADII.climateOuter - RADII.climateInner)) * 18;
        if (!sample.sun || hour < sample.sun.sunriseHour || hour > sample.sun.sunsetHour) {
          continue;
        }
        const temperature = temperatureAtHour(sample.normal, hour, sample.sun.sunriseHour);
        const [red, green, blue] = colorChannels(temperatureScale(temperature));
        const pixelIndex = (y * resolution + x) * 4;
        const precipitation = Math.min(0.34, sample.normal.precipIn * 5.5);
        const noise = textureNoise(x, y, sample.date.dayOfYear);
        const textured = noise < precipitation;
        const hatch = theme.precipTexture === 'hatch' && (x + y) % 9 < 2 && noise < precipitation * 2;
        const streak = theme.precipTexture === 'streak' && (x + y * 3) % 13 < 2 && noise < precipitation * 2;
        const texture = textured || hatch || streak;
        image.data[pixelIndex] = texture ? Math.round(red * 0.56) : red;
        image.data[pixelIndex + 1] = texture ? Math.round(green * 0.62) : green;
        image.data[pixelIndex + 2] = texture ? Math.round(blue * 0.72) : blue;
        image.data[pixelIndex + 3] = theme.id === 'editorial' ? 224 : 238;
      }
    }
    context.putImageData(image, 0, 0);
  }, [mode, normals, size, sunDays, theme, year]);

  return <canvas aria-hidden="true" className="climate-field" ref={canvasRef} />;
}

export function ClimateOverlay({
  mode,
  theme,
  sunDays,
  normals,
  actuals,
  eveningLightThreshold,
}: Omit<ClimateRingProps, 'year' | 'size'>) {
  const sunrisePath = polarPath(
    sunDays.map((day) => ({
      angle: dateToAngle(day.date, mode),
      radius: timeOfDayToRadius(day.sunriseHour),
    })),
  );
  const sunsetPath = polarPath(
    sunDays.map((day) => ({
      angle: dateToAngle(day.date, mode),
      radius: timeOfDayToRadius(day.sunsetHour),
    })),
  );
  const eveningPath = polarPath(
    sunDays
      .filter((day) => day.sunsetHour >= eveningLightThreshold)
      .map((day) => ({
        angle: dateToAngle(day.date, mode),
        radius: timeOfDayToRadius(day.sunsetHour) + 2,
      })),
  );
  const actualSamples = (actuals?.daily ?? []).flatMap((actual) => {
    const date = dateFromIso(actual.date);
    const normal = normalForDate(date, normals);
    const departure = actual.hiF - normal.hiF;
    return [{ angle: dateToAngle(date, mode), radius: temperatureDepartureToRadius(departure) }];
  });
  const terminus = actualSamples.at(-1);
  const terminusPoint = terminus
    ? polarToScreen(terminus.angle, terminus.radius, DIAL_CENTER, DIAL_CENTER)
    : null;

  return (
    <g className={`climate-overlay climate-overlay--${theme.id}`}>
      <circle
        className="evening-threshold"
        cx={DIAL_CENTER}
        cy={DIAL_CENTER}
        r={timeOfDayToRadius(eveningLightThreshold)}
      />
      <path className="climate-edge" d={sunrisePath} />
      <path className="climate-edge" d={sunsetPath} />
      <path className="evening-rim" d={eveningPath} />
      {actualSamples.length > 0 && <path className="actuals-trace" d={polarPath(actualSamples)} />}
      {terminusPoint && (
        <circle className="actuals-terminus" cx={terminusPoint.x} cy={terminusPoint.y} r={4} />
      )}
    </g>
  );
}

export function ClimateRing(props: ClimateRingProps) {
  return (
    <>
      <ClimateField {...props} />
      <ClimateOverlay {...props} />
    </>
  );
}