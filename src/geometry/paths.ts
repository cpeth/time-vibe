import type { Chirality } from '../time/modes';
import { normalizeAngle } from './angle';
import { DIAL_CENTER } from './layout';
import { polarToScreen } from './polar';

export interface PolarSample {
  angle: number;
  radius: number;
}

export function polarPath(samples: PolarSample[], close = false): string {
  if (samples.length === 0) {
    return '';
  }
  const commands = samples.map((sample, index) => {
    const point = polarToScreen(sample.angle, sample.radius, DIAL_CENTER, DIAL_CENTER);
    return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  });
  return `${commands.join(' ')}${close ? ' Z' : ''}`;
}

export function directedMidAngle(
  startAngle: number,
  endAngle: number,
  direction: Chirality,
): number {
  let directedEnd = endAngle;
  if (direction === 'cw') {
    while (directedEnd <= startAngle) {
      directedEnd += 360;
    }
  } else {
    while (directedEnd >= startAngle) {
      directedEnd -= 360;
    }
  }
  return normalizeAngle(startAngle + (directedEnd - startAngle) / 2);
}

export interface AngularItem {
  id: string;
  angle: number;
}

export interface LaidOutAngularItem extends AngularItem {
  level: number;
}

export function staggerAngularCollisions(
  items: AngularItem[],
  thresholdDegrees = 6,
): LaidOutAngularItem[] {
  const sorted = [...items].sort((left, right) => left.angle - right.angle);
  return sorted.map((item, index) => {
    const previous = sorted[index - 1];
    const previousLevel = index > 0 ? (sorted[index - 1] as LaidOutAngularItem | undefined)?.level : 0;
    const crowded = previous ? item.angle - previous.angle < thresholdDegrees : false;
    const level = crowded ? ((previousLevel ?? 0) + 1) % 3 : 0;
    const laidOut = { ...item, level };
    sorted[index] = laidOut;
    return laidOut;
  });
}