# Year Clock

A radial calendar instrument for seeing the whole year at once. It combines astronomical seasons, Pleasanton daylight and climate, cross-year sports seasons, holidays, golf, personal dates, and exact now/quarter/half-year hands in one responsive dial.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The Cloudflare Vite plugin runs the API in workerd alongside the React app; `GET /api/health` should return `{ "ok": true }`.

Useful checks:

```bash
npm test
npm run build
npm run typecheck
```

## Data behavior

- Astronomy is computed locally with `astronomy-engine` for any requested year.
- Climate actuals resolve through `/api/climate/actuals/:year` and Workers KV.
- Sports resolve through `/api/sports/:year`, then committed fallback JSON, then deterministic heuristics.
- `src/data/fallback/climate-normals.json` contains 366 smoothed normals baked from Pleasanton observations for 2016–2025.
- The application remains complete offline. Missing live actuals are shown honestly rather than synthesized.

Refresh the climate bake or a sports year with:

```bash
npm run refresh-data
npm run refresh-data -- --year 2027
```

## Personal dates

Copy `personal.config.example.ts` to `personal.config.ts` and edit the local file. It is gitignored. Anything rendered into a deployed app is still visible to visitors, so do not include genuinely sensitive information.

## Cloudflare Pages

1. Create a Pages project named `year-clock`.
2. Create a KV namespace and set its ID in `wrangler.toml`.
3. Bind the namespace as `YEAR_CLOCK_KV` in preview and production.
4. Run `npm run deploy`, or add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets for the included GitHub workflow.

The canonical Pages handlers live in `functions/api`. `src/worker.ts` is a thin adapter over those same handlers so the official Cloudflare Vite plugin can provide local workerd development. `npm run deploy:worker` is also available for Workers Assets deployments.

## Architecture invariants

- All date/angle conversion routes through `src/geometry/angle.ts`.
- Both uniform-month and true-anomaly warps are implemented and tested.
- All polar projection routes through `src/geometry/polar.ts`.
- Providers and rings are year-parameterized; no module owns a singleton current year.
- Sports storage remains unclipped. `clipToCalendarYear` is a pure view operation.
