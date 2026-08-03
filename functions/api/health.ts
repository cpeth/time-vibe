import { jsonResponse } from '../lib/http';
import type { Env, PagesFunction } from '../types';

export function handleHealth(): Response {
  return jsonResponse({
    ok: true,
    service: 'year-clock',
    location: 'Pleasanton, CA',
  }, { headers: { 'cache-control': 'no-store' } });
}

export const onRequestGet: PagesFunction<Env> = () => handleHealth();