import { handleHealth } from '../functions/api/health';
import { handleSports } from '../functions/api/sports/[year]';
import { handleClimateActuals } from '../functions/api/climate/actuals/[year]';
import type { Env, WaitUntilContext } from '../functions/types';

export default {
  async fetch(request: Request, env: Env, context: WaitUntilContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }
    if (url.pathname === '/api/health') {
      return handleHealth();
    }
    const sports = url.pathname.match(/^\/api\/sports\/(\d{4})$/);
    if (sports) {
      return handleSports(sports[1], env, context);
    }
    const climate = url.pathname.match(/^\/api\/climate\/actuals\/(\d{4})$/);
    if (climate) {
      return handleClimateActuals(climate[1], env, context);
    }
    return env.ASSETS?.fetch(request) ?? new Response('Not found', { status: 404 });
  },
};