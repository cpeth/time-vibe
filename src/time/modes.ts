export type Chirality = 'cw' | 'ccw';
export type Warp = 'uniform-month' | 'true-anomaly';
export type DialModeId = 'standard' | 'birthday' | 'orbital';

export interface DialMode {
  id: DialModeId;
  origin: { month: number; day: number };
  direction: Chirality;
  warp: Warp;
}

export const STANDARD_MODE: DialMode = {
  id: 'standard',
  origin: { month: 1, day: 1 },
  direction: 'cw',
  warp: 'uniform-month',
};

export const BIRTHDAY_MODE: DialMode = {
  id: 'birthday',
  origin: { month: 8, day: 25 },
  direction: 'ccw',
  warp: 'uniform-month',
};

export const ORBITAL_MODE: DialMode = {
  id: 'orbital',
  origin: { month: 3, day: 20 },
  direction: 'ccw',
  warp: 'true-anomaly',
};

export const V1_MODES = [STANDARD_MODE, BIRTHDAY_MODE] as const;

export function modeWithWarp(mode: DialMode, warp: Warp): DialMode {
  return { ...mode, warp };
}