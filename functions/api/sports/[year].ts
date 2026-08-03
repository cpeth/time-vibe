import { SportsYearSchema } from '../../../src/data/schemas';
import { fetchSportsYear } from '../../lib/espn';
import { jsonResponse, parseYear, readJsonCache, writeJsonCache } from '../../lib/http';
import type { Env, PagesFunction, WaitUntilContext } from '../../types';

export async function handleSports(
  yearValue: string | undefined,
  env: Env,
  context: WaitUntilContext,
): Promise<Response> {
  const year = parseYear(yearValue);
  if (!year) return jsonResponse({ error: 'Invalid year' }, { status: 400 });
  const key = `sports:v2:${year}`;
  const cached = SportsYearSchema.safeParse(await readJsonCache(env, key));
  if (cached.success) return jsonResponse(cached.data);

  const sports = await fetchSportsYear(year);
  writeJsonCache(env, context, key, sports, 7 * 24 * 60 * 60);
  return jsonResponse(sports);
}

export const onRequestGet: PagesFunction<Env> = ({ params, env, waitUntil }) =>
  handleSports(
    typeof params.year === 'string' ? params.year : undefined,
    env,
    { waitUntil },
  );