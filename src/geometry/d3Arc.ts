import { arc } from 'd3-shape';
import { degreesToRadians } from './angle';
import type { Chirality } from '../time/modes';

export function screenDegreesToD3Radians(angleDeg: number): number {
  return degreesToRadians(angleDeg);
}

export function annularArcPath(
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number,
  cornerRadius = 0,
): string {
  return (
    arc().cornerRadius(cornerRadius)({
      innerRadius,
      outerRadius,
      startAngle: screenDegreesToD3Radians(startAngle),
      endAngle: screenDegreesToD3Radians(endAngle),
    }) ?? ''
  );
}

export function directedAnnularArcPath(
  startAngle: number,
  endAngle: number,
  direction: Chirality,
  innerRadius: number,
  outerRadius: number,
  cornerRadius = 0,
): string {
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
  return annularArcPath(startAngle, directedEnd, innerRadius, outerRadius, cornerRadius);
}