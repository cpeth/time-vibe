import type { Env, WaitUntilContext } from '../types';

export function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', headers.get('cache-control') ?? 'public, max-age=300');
  return new Response(JSON.stringify(value), { ...init, headers });
}

export async function readJsonCache<T>(env: Env, key: string): Promise<T | null> {
  if (!env.YEAR_CLOCK_KV) return null;
  return env.YEAR_CLOCK_KV.get<T>(key, 'json');
}

export function writeJsonCache(
  env: Env,
  context: WaitUntilContext,
  key: string,
  value: unknown,
  expirationTtl: number,
): void {
  if (!env.YEAR_CLOCK_KV) return;
  context.waitUntil(
    env.YEAR_CLOCK_KV.put(key, JSON.stringify(value), { expirationTtl }),
  );
}

export function parseYear(value: string | undefined): number | null {
  const year = Number(value);
  return Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null;
}