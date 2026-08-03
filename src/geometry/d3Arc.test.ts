import { describe, expect, it } from 'vitest';
import { screenDegreesToD3Radians } from './d3Arc';

describe('screenDegreesToD3Radians', () => {
  it('preserves d3-shape’s clockwise, noon-origin convention', () => {
    expect(screenDegreesToD3Radians(0)).toBe(0);
    expect(screenDegreesToD3Radians(90)).toBeCloseTo(Math.PI / 2, 12);
    expect(screenDegreesToD3Radians(360)).toBeCloseTo(Math.PI * 2, 12);
  });
});