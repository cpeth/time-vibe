import { degreesToRadians } from './angle';
import { normalizeAngle } from './angle';

export interface ScreenPoint {
  x: number;
  y: number;
}

export function polarToScreen(
  angleDeg: number,
  radius: number,
  centerX = 0,
  centerY = 0,
): ScreenPoint {
  const radians = degreesToRadians(angleDeg);
  return {
    x: centerX + Math.sin(radians) * radius,
    y: centerY - Math.cos(radians) * radius,
  };
}

export function screenPointToPolar(x: number, y: number): {
  angle: number;
  radius: number;
} {
  return {
    angle: normalizeAngle((Math.atan2(x, -y) * 180) / Math.PI),
    radius: Math.hypot(x, y),
  };
}

export function radialLabelRotation(angleDeg: number): number {
  const normalized = normalizeAngle(angleDeg);
  return normalized > 90 && normalized < 270 ? normalized + 180 : normalized;
}