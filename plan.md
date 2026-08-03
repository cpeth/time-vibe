# Year Clock — Build Plan

A radial visualization of the calendar year, modeled like an analog clock: 12 months at 30° each, concentric data rings (seasons, a composite climate band, sports seasons), event markers, and clock-style hands showing now / ±3 / ±6 months. Two dial modes at v1 (standard and a personal birthday-origin mode), three visual themes, Bay Area (Pleasanton) data, deployed on Cloudflare Pages — with a heliocentric orbital mode and a year-over-year helix reserved as architecturally supported stretch goals (§11). Personal project, one primary user, occasionally shared with friends via URL.

This document is the source of truth. Where it specifies a contract or invariant, implement exactly that. Where it says "implementer's choice," use judgment.

---

## 1. Locked decisions

- **Geometry:** months are exactly 30° each ("clock hours"), so ±3 months = exactly ±90° and ±6 months = 180° always. Days interpolate linearly within their month's 30° arc. Leap years are handled automatically by this rule (Feb 29 just makes February's per-day arc slightly narrower). Do NOT use day-proportional angles (360/365).
- **Two dial modes:**
  - `standard`: origin = Jan 1 at 12 o'clock, direction = clockwise.
  - `birthday`: origin = Aug 25 at 12 o'clock, direction = **counter**clockwise.
- **Fixed dial, moving hands.** The dial does not rotate with time. Hands: a solid "now" hand at fractional-day precision, plus ghost hands at exactly +90°, −90°, and 180° from it (±3 and ±6 months). A separate scrubber hand follows the pointer.
- **Seasons:** astronomical (equinox/solstice bounded), computed per year — boundaries drift a day or so year to year, never hardcode.
- **Location:** Pleasanton, CA — lat 37.6624, lon −121.8747, timezone `America/Los_Angeles` pinned everywhere. Single-location v1.
- **Sports:** NFL, NBA, NHL as thin arcs. NFL segmented into regular season / wild card week / divisional / conference championships / Super Bowl. NBA and NHL segmented into regular season / postseason (fold the NBA play-in into postseason). Championship games get terminal-node emphasis. **No** non-game events (no draft, trade deadline, free agency).
- **Golf:** markers for the four majors (Masters, PGA Championship, U.S. Open, The Open) plus the Ryder Cup. The Ryder Cup is **biennial (odd years)** — the marker system must tolerate "not present this year."
- **Personal dates:** anniversary + close family birthdays from a gitignored config (`personal.config.ts`, with a committed `personal.config.example.ts`). See honesty note in §7.6.
- **Climate band — one ring, the user's own design (§6.4):** daylight, temperature, and precipitation composed into a single arc via separate channels. Radial position = wall-clock time (sunrise/sunset edges, so band width *is* day length), color = temperature on the user's scale, precipitation = texture density, plus a live "this year actual" overlay trace. There are **no** separate temperature, precipitation, or "usable evenings" rings.
- **DST transitions are event markers** (spring-forward, second Sunday of March; fall-back, first Sunday of November), category `astro`, rule-computed.
- **Sports intensity glow** rendered behind the league arcs (§6.5), and **Super Bowl Sunday cross-registered as a holiday marker** — it functionally is one.
- **Composition principle — channels before rings (§6.0):** before any new ring is added, check whether an existing ring has a free channel (thickness, radial position, color, opacity/glow, texture, particles). Rings are expensive; channels are cheap.
- **Future-proofing (locked now, shipped later):** four rules keep orbital mode and the year-helix (§11) cheap to add and cost almost nothing today: (1) `DialMode` carries a `warp` axis from day one, with both warps implemented and tested in the engine in Phase 1; (2) exactly one polar→screen projection function; (3) no current-year singletons anywhere — every ring and provider is year-parameterized and multiple year-instances must be constructible simultaneously; (4) sports data is stored unclipped, with calendar clipping as a pure view function (§7.5).
- **Themes:** three selectable themes; selector sits next to the mode toggle. See §8.
- **Deployment:** Cloudflare Pages + Pages Functions + Workers KV for live data fetch/caching. App must also render fully from bundled fallback data with the network unplugged.

---

## 2. Stack

- **Vite + React 19 + TypeScript (strict).** Boring on purpose.
- **d3 for math only:** `d3-shape` (arc generation), `d3-scale`, `d3-interpolate`. No `d3-selection` — React owns the DOM.
- **Date math isolated in `src/time/`** and nowhere else. Preferred: the Temporal API via `@js-temporal/polyfill` (`Temporal.PlainDate`, `ZonedDateTime`); if that fights the toolchain, fall back to `date-fns` + `date-fns-tz`. Either way, no raw `Date` arithmetic outside `src/time/`.
- **Astronomy:** `astronomy-engine` (npm) — `Seasons(year)` for equinox/solstice instants, `SearchRiseSet` for sunrise/sunset. Pure computation, no API, works for any year forever.
- **Cloudflare tooling:** `wrangler` + the official `@cloudflare/vite-plugin` so Pages Functions and KV bindings run in local dev (`vite dev` should serve `/api/*`). Functions live in `/functions` per Pages convention.
- **Testing:** Vitest. The angle engine gets property-style unit tests (see §4). Everything else, light coverage.

### Repo layout

```
/functions/api/            Cloudflare Pages Functions (sports, actuals)
/scripts/refresh-data.ts   yearly data bake → src/data/fallback/*.json
/public/logos/             optional real logos (see §7.7)
/src/time/                 all date math, mode definitions
/src/geometry/             angle engine, polar helpers, radial layout
/src/rings/                one module per ring (implements RingDef)
/src/data/providers/       astronomy, climate, holidays, sports, actuals
/src/data/fallback/        committed JSON (sports per year, normals)
/src/data/schemas.ts       shared TS types + zod (or hand-rolled) validators
/src/themes/               theme definitions + per-theme seasonal art
/src/ui/                   hub readout, scrub panel, toggles, popovers
personal.config.example.ts
personal.config.ts         (gitignored)
```

---

## 3. The angle engine — the single most important abstraction

Everything renders through one invertible pair of pure functions. Build this first, test it hard, and never let any other module do its own date→angle math. Retrofitting chirality later is misery; building it in from commit one makes birthday mode free.

```ts
// src/geometry/angle.ts
export type Chirality = 'cw' | 'ccw';
export type Warp = 'uniform-month' | 'true-anomaly';

export interface DialMode {
  id: 'standard' | 'birthday' | 'orbital';
  origin: { month: number; day: number };  // 1-based; {1,1} and {8,25}
  direction: Chirality;
  warp: Warp;   // v1 UI ships uniform-month only; the engine implements BOTH from Phase 1 (§11)
}

// Returns SCREEN angle in degrees [0, 360):
//   0 = 12 o'clock, increasing clockwise on screen (SVG convention).
// Chirality is already applied — callers never think about direction.
// `date` may carry fractional-day precision for smooth hand motion.
export function dateToAngle(date: ZonedDateTime | PlainDate, mode: DialMode): number;

// Exact inverse (to day resolution, plus optional fractional day).
export function angleToDate(angleDeg: number, year: number, mode: DialMode): PlainDate;
```

Internal formula (dial-space angle θ before chirality):

```
monthsFromOrigin = (month - origin.month + 12) mod 12          // whole months
dayFraction      = (dayIndexFrom0 + timeOfDayFraction) / daysInMonth(year, month)
θ                = 30 * monthsFromOrigin + 30 * dayFraction    // minus origin day offset
screenAngle      = direction === 'cw' ? θ : (360 - θ) mod 360
```

Note the origin-day offset: in birthday mode the origin is Aug **25**, not Aug 1, so subtract the origin's own within-month fraction before applying chirality. Get this right or the whole dial is rotated by ~24 days.

**The warp axis.** The formula above is `uniform-month`. The second warp, `true-anomaly`, makes dial angle proportional to Earth's actual heliocentric ecliptic longitude — the physical position along the orbit. Implementation is the classical equation of center with Earth's eccentricity e = 0.0167: `ν ≈ M + 2e·sin M + (5/4)e²·sin 2M`, where M is mean anomaly (linear in time from perihelion, ~Jan 3). At this eccentricity the series is accurate to arcseconds; the deviation from uniform motion peaks at ~±1.9° (around early April and early October), and the inverse (angle → date) converges in 2–3 Newton iterations or the reversed series. It is ~10 lines of pure math living behind the `warp` flag. Consequences under `true-anomaly`: months no longer span 30° (January is wider than July), but the equinoxes and solstices sit at **exactly 90° spacings** — the symmetry migrates from months to seasons, by definition of heliocentric longitude. Both warps are implemented and property-tested in Phase 1 even though v1's UI exposes only `uniform-month`; this is precisely what makes orbital mode (§11.1) a rendering task later instead of an engine rewrite.

### Invariants — encode as warp-parameterized Vitest property tests

Hold for **every** warp and mode:
1. Round trip: `angleToDate(dateToAngle(d, m), year, m) === d` for every day of a leap year and a common year.
2. Origin: `dateToAngle(origin, m) === 0` (Jan 1 standard, Aug 25 birthday).
3. Feb 29 maps to a valid unique angle in leap years and `angleToDate` never emits it in common years.
4. Monotonicity within a year (in dial space): later dates → strictly larger θ.

`uniform-month` only:
5. Adding exactly 3 calendar months (same day-of-month) changes screen angle by exactly +90° in `cw`, −90° in `ccw`; 6 months = 180° in both.
6. Month boundaries land on exact multiples of 30° in dial space, every year, leap or not.

`true-anomaly` only (invariants 5–6 intentionally fail here — the tests must be parameterized, not duplicated):
7. The four equinox/solstice instants (from `astronomy-engine.Seasons`) land at 90° spacings within a few arcminutes.
8. Angular speed near perihelion (~Jan 3) exceeds angular speed near aphelion (~Jul 4–6) — Kepler's second law as a unit test.

### Label chirality rule

Text never mirrors. Month labels may rotate tangentially to follow the ring, but must auto-flip 180° when they'd render upside-down (the classic radial-label rule: flip when the label's angle falls in the lower semicircle). Event-marker labels and all readouts are always horizontal. This rule applies identically in both modes — only geometry flips, never glyphs.

---

## 4. Rendering architecture

Layer stack, back to front:

1. **Backdrop canvas** — theme ambience (star field, paper texture, vignette). Cheap, mostly static.
2. **SVG dial** — all rings, ticks, labels, markers, hands. This is the data layer: crisp text, `clipPath` for art-filled arcs, trivial hit-testing, React-rendered.
3. **Foreground canvas** — particles (leaves/snow/petals/shimmer per season sector, per theme). Single `requestAnimationFrame` loop, hard particle cap (~300), fully disabled under `prefers-reduced-motion` and in the editorial theme.
4. **HTML chrome** — hub readout, scrub panel, mode/theme controls, popovers.

Not full 3D at v1. A flat piece executed with texture, color, and motion reads better than a mediocre torus, and radial text dies in perspective. The sanctioned Phase 3 stretch is **2.5D semantic depth** (§11.2 tier 1): rings on separate transform layers where **depth = year**, with a subtle pointer-following tilt (≤ ~6°) and soft shadow between layers. An optional WebGL backdrop (shader star field) may replace layer 1 later; the SVG data layer stays 2D. The true 3D helix is a sanctioned future fork (§11.2 tier 3), not a bolt-on.

**Single projection rule.** All polar→screen conversion goes through exactly one `polarToScreen(angleDeg, radius)` function in `src/geometry/` — no inline trig anywhere, ever. This is the door to everything in §11: the helix or any 3D view is then a projection swap (add a z term, change the mapping), not a refactor of every ring.

**Known SVG limitation, plan around it:** SVG cannot vary color along an arc, let alone across a 2D (angle × radius) field. The climate band (§6.4) needs exactly that — color varying by angle (date) *and* radius (time of day), plus precipitation texture — so it renders as a **canvas color field**: one offscreen pass per `(year, mode, size)` that walks the annulus, maps each pixel → (date, time-of-day) via the angle engine, evaluates temperature and precip, and paints. Never per-frame. SVG draws the hairline sunrise/sunset edge curves, the evening-light threshold circle, and the actuals trace on top of it. Simpler angular-only color needs elsewhere may use per-day sliver `<path>` segments (365 flat-filled paths is cheap).

**d3-shape adapter:** `d3.arc()` measures angles in radians clockwise from 12 o'clock. Write one tested adapter from the angle engine's degrees to d3's radians and route every arc through it. No inline conversions scattered around.

Geometry is memoized per `(year, mode, canvasSize)`. Rings receive precomputed geometry; they never call the angle engine per-frame.

---

## 5. Ring plugin interface

Rings are pluggable and ordered by a registry so they can be toggled, reordered, and extended (the Phase 4 backlog rings must slot in without core changes).

```ts
// src/rings/types.ts
export interface RingDef<T> {
  id: string;
  label: string;
  radial: { inner: number; outer: number };   // normalized 0..1 of dial radius
  data(year: number, ctx: DataContext): Promise<T>;   // ctx: location, tz, fetch/fallback helpers
  render(props: { data: T; geom: DialGeometry; theme: Theme; mode: DialMode }): ReactNode; // SVG subtree
  scrub?(date: PlainDate, data: T): ScrubEntry | null;  // contribution to the hover readout
  ambience?(theme: Theme): ParticleConfig | null;       // e.g. seasons ring emits leaves/snow
}
```

`ScrubEntry` is a small `{ label, value, detail? }` record; the scrub panel assembles all rings' entries for the hovered date.

---

## 6. Ring stack spec (inner → outer)

Radial budget is a suggestion; tune visually. Data-dense rings sit at larger radii where there are more pixels per day.

### 6.0 Channels before rings
A ring is the expensive unit; a channel is the cheap one. Every ring has up to seven: angular extent (when), radial thickness (magnitude), radial position (a second scale), color (a variable), opacity/glow (intensity), texture (a variable), particles (ambience). Before proposing a new ring, exhaust the free channels of an existing one — the climate band (§6.4) is the worked example, carrying four datasets in one annulus. Corollary: the dial supports roughly five data rings before it turns to noise. The registry may hold more; default-visible stays at or under that.

### 6.1 Hub (center)
Current date, big; "day N of 365/366 · X.X% complete"; in birthday mode additionally "day N of your year." Hands originate here: solid now-hand (re-render on a 60 s timer is smooth enough; fractional-day angle), ghost hands at exactly ±90° and 180°, visually subordinate (thin, dashed, shorter). Scrubber hand appears on hover, distinct color. The hub is a **swappable render slot** — orbital mode (§11.1) replaces it with the sun.

### 6.2 Month dial
12 sectors × 30°. Tick per day (hairline), heavier tick at month boundaries, month labels tangential with the flip rule. Optional week-start ticks (Mondays) as a middle weight — implementer's choice, drop it if noisy.

### 6.3 Seasons ring
Four arcs bounded at computed equinox/solstice instants for the displayed year (`astronomy-engine.Seasons`). Boundary markers at the exact instants; scrub shows e.g. "Winter solstice — Dec 21, 7:03 AM PST." Fill treatment is theme-owned: clipPath'd illustrated art (almanac), luminous gradient washes (observatory), flat editorial color (editorial). This ring's `ambience()` emits the seasonal particle configs, keyed to the *sector the emitting arc occupies on screen* so particles fall over the right part of the dial in both modes. Particle *family* is chosen by season, but emission *intensity* is driven by climate data — rain particles scale with precip normals, heat shimmer with temperature — so the ambience is truthful, not merely categorical.

### 6.4 Climate band — daylight × temperature × precipitation (one ring)
The centerpiece, and the user's own design: three datasets in one arc through separate channels.

- **Shape (daylight):** two polar curves — sunrise and sunset in local wall-clock time via `SearchRiseSet` — bound the band. Radial axis is a time-of-day scale (~4:00 → 22:00 across the ring's radial extent), so band **width is day length** and **radial position shows when the light falls**. DST transitions appear as steps (wall-clock truth — embrace, never smooth); solstices are the widest/narrowest points. Build all curves by sampling 365/366 points through the angle engine; do not trust `d3.areaRadial` conventions without the adapter.
- **Color (temperature):** the band is the canvas color field from §4. Primary spec: a **diurnal field** — at each pixel, radius → time of day; temperature interpolated between that date's normal low (at the sunrise edge) and normal high (mid-afternoon peak ~15:30) with a simple sinusoidal diurnal curve. Precision is irrelevant; it's a felt field, not a forecast. Result: winter dawn edges go frost-white, summer afternoons blaze red at the outer edge, and the full scale gets used. Fallback if the field fights: flat per-day color = normal high (note: Pleasanton highs span ~55–90 °F, so only blue→green→red would ever fire).
- **Temperature scale** (config stops; default is the user's): 100 °F = full red → 70s = green → 50s = blue → 30s = white → 0s = purple ("it's never 0s in Pleasanton" — define it anyway; the scale should be honest about what it *would* show). Interpolate smoothly between stops. Two engineering notes: (1) the scale is deliberately non-perceptual — it encodes *felt categories*, which is correct for this instrument; do **not** "fix" it to viridis or any perceptual map. (2) The white stop vanishes on light backgrounds; each theme may remap stops (editorial: white → pale ice-blue) or add a hairline band edge.
- **Texture (precipitation):** rain-streak/stipple density ∝ smoothed daily precip normals (~31-day window — raw daily precip normals are noise), painted in the same canvas pass. Theme-flavored: hatching in almanac, faint streaks in observatory, sparse stipple in editorial. Winter reads thin-blue-streaked; summer reads fat-red-bone-dry. The Mediterranean climate in one object.
- **Evening-light threshold:** a hairline dashed reference circle at a configurable wall-clock time (`eveningLightThreshold`, default 19:00). Where the sunset edge rises above it, apply a subtle warm rim treatment to the band's outer edge. This *is* the "usable evenings" layer with zero extra rings — and the March DST step is the sunset curve **vaulting the threshold in a single day**: evening season switching on. The November fall-back step is it dying. Scrub reports the crossing dates.
- **Actuals overlay:** this-year actual temps as a thin bright trace terminating at the now-hand — data ends yesterday, and the trace catching up to the hand is a feature; style the terminus (small glow), don't pad it.
- **Built-in stories — don't hide them:** the band's thickest point (June solstice) is *not* its reddest (mid-July, normal high ~90 °F). Seasonal thermal lag, rendered inside one object, reads more strongly than it ever did as two separate rings. And the wet texture occupies the thin blue months almost exclusively.
- **Scrub:** sunrise, sunset, day length h:mm + Δ vs. yesterday; normal high/low, actual + departure; normal precip for the date; and **season-to-date rainfall as % of normal on the water year (Oct 1–Sep 30)** — the stat every Bay Area local actually tracks.

### 6.5 Sports rings (three thin arcs: NFL, NBA, NHL) + intensity glow
Each league is one thin annulus with typed segments:

- NFL: `regular` (Thu after Labor Day → early Jan) → `wildcard` → `divisional` → `conference` → `superbowl` (single-day terminal node).
- NBA: `regular` → `postseason` (play-in folded in), Finals end as terminal node.
- NHL: `regular` → `postseason`, Stanley Cup Final end as terminal node.

Visual grammar: regular season muted/base saturation, playoff segments brighter/saturated, championship as an emphasized terminal cap (glow in observatory theme). Round the league's off-season gap ends (`strokeLinecap: round` equivalent on the arc ends). Default colors are league colors; support optional team-accent overrides in config (`teamAccents: { nfl?: TeamColors, ... }`) — the user hasn't specified teams, leave the stub with a comment. Scrub: league phase at that date ("NFL — divisional round"), or "off-season, kickoff in N days."

**Intensity glow — negative space made visible.** Compute `intensity(date) = Σ_league phaseWeight` (regular = 1, playoffs = 2, championship day = 3; equal league weights, tune by eye) and render it as a soft luminous underlay behind the three arcs, opacity ∝ intensity. January burns; mid-summer goes dark. Annotate the longest zero-intensity stretch — Finals end → NFL kickoff — as **"the desert: N days"**, placed in the sparse summer sector. Editorial theme has no glow by charter: render as a value-tinted density strip there instead.

**`showBaseballTechnically`** (config flag, default **on**): a deliberately washed-out gray arc from late March to the end of the World Series, labeled "baseball, technically." Heuristic dates only — it does not merit an API. It is the correct editorial voice for this instrument; the flag exists for guests.

### 6.6 Event marker ring (outermost)
Point markers with categories: `holiday`, `golf`, `personal`, `astro`.

- Holidays, computed from rules (no API): New Year's Day, MLK Day (3rd Mon Jan), Presidents' Day, Memorial Day (last Mon May), July 4, Labor Day (1st Mon Sep), Halloween, Thanksgiving (4th Thu Nov), Christmas Eve/Day, New Year's Eve. Set is a config list; trim freely. **Super Bowl Sunday is cross-registered here as a holiday** from the sports data (with heuristic fallback) — it functionally is one.
- Astro: DST spring-forward (2nd Sunday of March) and fall-back (1st Sunday of November), rule-computed like holidays. These are two of the most *felt* days of the year and they interact directly with the climate band's evening-light threshold (§6.4).
- Golf: the four majors + Ryder Cup (odd years only) from the sports data layer.
- Personal: from `personal.config.ts` — `{ label, month, day, category: 'personal', icon? }`. Birthday Aug 25 gets special treatment: it is the *origin* of birthday mode, render it with distinct emphasis (it sits at 12 o'clock in that mode — make that moment land).

**Collision handling is required, not optional** (see the Oct–Feb reality below): markers within ~6° of a neighbor stack at staggered radii with hairline leader lines; a cluster expands on hover; labels are horizontal, placed by a simple greedy declutterer, hidden below a zoom/priority threshold rather than overlapped.

### The Oct–Feb pile-up
All three leagues plus the holiday cluster occupy one third of the circle; May–August is golf, July 4, and the birthday. This is true of the actual year and should read that way — dense winter, airy summer — but it is why §6.6's collision system and §6.5's thin-ring restraint exist. Do not let any single sector's labels overlap; degrade gracefully by dropping label text before dropping markers.

---

## 7. Data layer

Four problems with four different right answers. The unifying rule: **runtime never hard-depends on a live API.** Client resolution order for anything fetched: Pages Function (`/api/*`, KV-cached) → bundled fallback JSON → heuristic generator. The app must render completely with the network unplugged.

### 7.1 Astronomy — computed, zero APIs
Sunrise/sunset, equinoxes/solstices via `astronomy-engine` at the Pleasanton coordinates, client-side, for any year. Nothing to fetch, nothing to break.

### 7.2 Climate normals — baked at build time
`scripts/refresh-data.ts` fetches ~10 years of daily `temperature_2m_max/min` (°F) **and `precipitation_sum` (inches)** for the coordinates from the Open-Meteo historical archive API (free, no key: `archive-api.open-meteo.com/v1/archive`), averages by day-of-year, and smooths. Temperature smoothing: a centered 14-day rolling mean or, nicer, a 2-harmonic Fourier fit (the standard climatology technique — clean curves, no edge artifacts across the Dec/Jan wrap). Precipitation smoothing: ~31-day centered window (daily precip normals are pure noise otherwise). Output: `src/data/fallback/climate-normals.json`. Normals are static by definition; regenerate rarely.

### 7.3 This-year actuals — Pages Function + KV
`GET /api/climate/actuals/:year` → KV key `climate:actual:{year}` (TTL 24 h) → on miss, fetch Open-Meteo archive for Jan 1 → yesterday (temps **and** precipitation), store, return. Same JSON shape as normals plus per-day actuals. **Water-year note:** the season-to-date rainfall stat runs Oct 1–Sep 30, so for dates Jan–Sep it needs the *previous* calendar year's Q4 actuals — the client composes the water year from two calendar-year responses (both KV-cached; no special endpoint needed).

### 7.4 Sports — Pages Function + KV + committed fallback + heuristics
`GET /api/sports/:year` → KV key `sports:{year}` (TTL 7 days) → on miss, fetch and normalize from ESPN's unofficial JSON endpoints, store, return.

ESPN notes (unofficial — probe and adapt, wrap in defensive parsing, and treat every field as optional):
- Base: `site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard` (e.g. `football/nfl`, `basketball/nba`, `hockey/nhl`, `golf/pga`).
- The scoreboard payload's `leagues[0].calendar` describes season structure: season types (pre/regular/post) with date ranges, and for the NFL, labeled weeks including Wild Card, Divisional Round, Conference Championship, Super Bowl — exactly the segmentation §6.5 needs.
- Golf: the league scoreboard/schedule lists season events; identify the majors and Ryder Cup by name match.
- These endpoints are unofficial and can change or die without notice. That is why they are touched only by the Function and the refresh script, never by the client directly.

`scripts/refresh-data.ts --year 2027` hits the same normalizer and writes `src/data/fallback/sports-2027.json` for commit — run once a year when schedules drop. Last-resort heuristic generator (used only if both live and fallback are missing for a year): NFL kickoff = Thursday after Labor Day, Super Bowl ≈ second Sunday of February; NBA opens ≈ third week of October, Finals to mid-June; NHL opens ≈ first full week of October, Cup Final to late June; Masters ends the second Sunday of April, U.S. Open ends Father's Day, The Open mid-July, Ryder Cup late September in odd years. Heuristic data is flagged in the UI with a subtle "approximate" affordance on scrub.

### 7.5 Schemas (`src/data/schemas.ts`)

```ts
interface SportsYear {
  year: number;                       // calendar year requested
  leagues: LeagueSeason[];            // BOTH league seasons touching this calendar year, UNCLIPPED
  source: 'live' | 'baked' | 'heuristic';
}
interface LeagueSeason {
  league: 'nfl' | 'nba' | 'nhl';
  seasonLabel: string;                // "2026–27"
  segments: Segment[];                // sorted, non-overlapping
  championship?: { date: string; name: string };  // "Super Bowl LXI"
}
interface Segment {
  kind: 'regular' | 'wildcard' | 'divisional' | 'conference' | 'superbowl' | 'postseason';
  start: string;  // ISO date
  end: string;
}
interface EventMarker {
  id: string; date: string; label: string;
  category: 'holiday' | 'golf' | 'personal' | 'astro';
  icon?: string;
  approximate?: boolean;
}
interface ClimateSeries {
  location: { lat: number; lon: number; name: string };
  daily: { doy: number; hiF: number; loF: number; precipIn: number }[];  // normals: 366 entries; precip pre-smoothed
}
```

Validate at every boundary (Function output, fallback load) — malformed data degrades to the next tier, never to a crash.

**Cross-year subtlety:** NFL/NBA/NHL seasons span calendar years. The dial shows one calendar year, so a given year's ring draws segments from *two* league seasons (e.g. calendar 2026 shows the tail of 2025–26 — Jan–Jun playoffs — and the head of 2026–27 starting in the fall). The Function/normalizer returns both adjacent seasons **unclipped**; a pure `clipToCalendarYear(sportsYear)` view util produces the flat-dial segments. Clipping at the view layer rather than in the data is deliberate: the flat ring is the helix viewed end-on, and the clip is an artifact of that projection — the future helix (§11.2) consumes the *same* payload as continuous ribbons with no seam. Get a test on the clip util; it is the most likely data bug.

### 7.6 Personal dates — honesty note
`personal.config.ts` is gitignored, which protects the repo. It does **not** protect the deployed site: anything rendered ends up in the served bundle, so anyone with the URL sees the dates. That's fine for friends and for birthdays/anniversaries; just don't put anything genuinely sensitive in it. No cleverness needed beyond this note.

### 7.7 Logos
The refresh script may optionally download league logos from ESPN's CDN into `/public/logos/`, behind a `useRealLogos` config flag (default off). The default-on path is an original glyph set drawn as small SVGs: green jacket (Masters), claret jug (The Open), trophy silhouettes for the leagues' championships, etc. Rationale: personal use of real marks is a non-issue; a public Cloudflare Pages URL is still low-risk fan-site territory, but Augusta National in particular is aggressively protective of the Masters brand, so the shipping default is original glyphs and the real logos are one flag away on the user's own deployment.

---

## 8. Theme system

Three themes, selectable next to the mode toggle, persisted in `localStorage` and reflected in the URL (`?theme=observatory&mode=birthday`) so shared links reproduce the exact view.

A theme is not just a palette. It owns: design tokens (colors, type, stroke weights), per-ring style hooks (how the seasons ring fills its arcs, how the climate band's precip texture reads, remapped temperature-scale stops), the backdrop treatment, and the ambience config (which particles, if any).

```ts
interface Theme {
  id: 'observatory' | 'editorial' | 'almanac';
  tokens: { /* palette, fonts, strokes, glow on/off */ };
  ringStyles: Partial<Record<RingId, RingStyleHooks>>;
  backdrop: BackdropSpec;         // star canvas | flat | paper texture
  ambience: AmbienceSpec | null;  // particle families per season, caps, speeds
}
```

Directions (briefs, not specs — the implementer should do a real design pass per theme):

- **observatory** — dark astronomical instrument: astrolabe/orrery energy, deep field, fine metallic ring strokes, restrained glow on hands and championship nodes, luminous seasonal washes, star-field backdrop, particles subtle and sparse.
- **editorial** — light print-infographic: flat color, crisp hairlines, exceptional typography, zero particles, zero glow. The theme that proves the information design stands on its own.
- **almanac** — illustrated and warm: seasonal artwork clipped inside the season arcs (autumn trees in the fall arc, etc.), paper-grain backdrop, full particle ambience (leaves, snow, petals, heat shimmer). Art is hand-built stylized SVG committed to `src/themes/art/` — no external asset pipeline, no stock imagery.

**Design-quality guardrail:** AI-generated "dark themes" cluster hard around near-black + one acid accent, and light themes around warm cream + terracotta. Both are defaults, not choices. Ground each theme in its actual subject — brass and engraved instrument markings for observatory, mid-century almanac/print vernacular for almanac, real editorial type discipline for editorial. Per theme, pick a deliberate palette (4–6 named values), a display/body type pairing chosen for that theme, and one signature element (e.g. observatory's could be the glowing terminus of the actuals trace meeting the now-hand). Spend boldness in one place per theme; keep the rest quiet.

---

## 9. Interaction & modes

- **Scrub:** pointer angle → `angleToDate` → every ring's `scrub()` → assembled panel: date, day N / %, season (+ days to next boundary), sunrise/sunset/day length, normal high/low + actual + departure, precip + water-year % of normal, active sports phases, nearest markers with countdowns. Panel is an ARIA live region; docks below the dial on narrow screens. Touch: drag to scrub.
- **Vibe line:** the scrub panel's first line composes the active layers into one sentence — "Dark by 5:10, rain likely, wild card weekend." v1 is rule-based (templates over season / daylight / precip / sports state). Optional upgrade, refresh-time only: `refresh-data` calls the Anthropic API once a year to write 52 weekly captions into a JSON the panel prefers when present. Never a runtime LLM call.
- **Ambient grading:** the backdrop tint tracks the composite state of the hovered (else current) date — cool blue-gray depths in January, gold haze in August. Cheap, theme-owned (the backdrop already is), subtle, disabled in editorial.
- **Mode switch — the signature animation.** Chirality cannot be tweened continuously without mirroring glyphs, so do not try. Two-beat transition (~1.4 s total): (1) rings sweep and retract into the hub while the dial rotates toward the new origin; (2) rings re-grow outward in the new chirality with the new origin at 12 o'clock. Reads as intentional, avoids every mirrored-text artifact, and makes switching modes feel like an event. Ghost hands and particles re-derive after the transition, never during.
- **Marker click:** popover with name, date, countdown/count-since, icon/logo.
- **Keyboard:** ←/→ step the scrubbed day (Shift = week), `m` toggles mode, `t` cycles theme, `Esc` clears scrub. Visible focus states.
- **Time-lapse (Phase 3):** sweep the year in ~20 s; ambience follows the sweeping hand's season; any scrub input cancels.
- **Responsive:** square dial, sensible minimum ~360 px; chrome reflows around it.
- **Reduced motion:** `prefers-reduced-motion` disables particles, parallax, time-lapse autoplay, and replaces the mode transition with a crossfade.

---

## 10. Phases

Ship each phase working before starting the next. Phase 1 is the whole ballgame architecturally — if the angle engine and dual-mode rendering are right, everything after is additive.

### Phase 0 — Scaffold
Vite + React + TS strict, Vitest, wrangler + Cloudflare Vite plugin with a stub `/api/health` Function and a KV binding, deploy pipeline to Cloudflare Pages. AC: `vite dev` serves the app and `/api/health` locally; a push deploys.

### Phase 1 — The clock (no external data)
`src/time` + angle engine with the §3 invariant tests — **both warps implemented** (`uniform-month` for the UI, `true-anomaly` as tested engine math per §3; it's ~10 lines and doing it now is what makes orbital mode a rendering task later); the single `polarToScreen` projection function; month dial with day ticks and flip-rule labels; seasons ring (flat colors fine, computed boundaries); hub + now/ghost hands; scrubber with date-only readout; **both v1 modes fully working** with a basic crossfade toggle; state in URL params.
AC: all §3 property tests green including leap years, parameterized over warp (invariants 1–4 both warps, 5–6 uniform, 7–8 true-anomaly); Aug 25 renders at 12 o'clock in birthday mode with the dial running counterclockwise; +90° of screen angle = exactly +3 months in both modes; no mirrored or upside-down text in either mode; grep finds no polar math outside `src/geometry/`.

### Phase 2 — Data
Climate band per §6.4 (shape from astronomy; diurnal canvas color field with the flat-color fallback path proven first; precip texture; evening-light threshold; actuals overlay via Function + KV); normals bake incl. precip; holidays + astro (DST) markers; sports Function + KV + normalizer + `refresh-data` fallback writer + heuristic tier + cross-year clipping test; sports intensity glow + desert annotation + `showBaseballTechnically`; Super Bowl holiday cross-registration; golf majors + biennial Ryder Cup; personal config; marker collision system; full scrub panel incl. water-year rainfall stat and the rule-based vibe line.
AC: network unplugged → app renders completely from fallbacks with the "approximate" affordance where applicable; `refresh-data --year 2027` emits schema-valid files; calendar-year clipping test passes (Jan playoffs from season N−1, fall start of season N); the climate field recomputes only on (year, mode, size) change.

### Phase 3 — Themes & motion
All three themes + selector; ambience particle system (climate-data-driven intensity); ambient backdrop grading; the two-beat mode-switch animation; time-lapse; optional Claude-written weekly vibe captions in `refresh-data`; **2.5D semantic depth as the sanctioned stretch goal** (§11.2 tier 1: separate transform layers where depth = year — last year's actuals + markers ghosted beneath, next year faint above — with ≤ ~6° pointer tilt, inter-layer shadow; optional WebGL star-field backdrop) — build it behind a flag so it can be disabled without trace; keyboard map; reduced-motion pass; performance pass (steady 60 fps with particles on a mid-range laptop; idle CPU near zero when static).

### Phase 4 — Backlog (explicitly not v1)
- **Orbital mode** (§11.1). The engine already carries the warp from Phase 1; this item is the rendering: sun hub, off-center focus, Earth-as-hand, perihelion/aphelion markers.
- **True 3D helix** (§11.2 tier 3). A separate project-scale fork; do not bolt it onto the flat renderer.
- UCI DH World Cup calendar + Whistler Bike Park operating dates. Neither has a clean API; the intended pattern is an **LLM-assisted extractor**: a refresh-time script (or Function) fetches the source pages and calls the Anthropic API with a strict JSON schema prompt to extract dates, writing to the same fallback format, with a human-reviewed diff before commit. Ring registry must accept these without core changes.
- F1 ring (deferred by choice, not difficulty — ergast-style community APIs exist if wanted).
- Multi-location climate profiles for sharing beyond the Bay Area.
- Toggleable seasonal soundscape (rain on the window, crickets, distant crowd roar keyed to sports intensity). Off by default forever; the kind of thing that's either magic or annoying.

---

## 11. Stretch geometries — sanctioned, foundation-supported, not v1

The features below are nice-to-haves. The **foundation is not optional**: the four future-proofing rules in §1 (warp axis with both warps engine-implemented in Phase 1, single projection function, no current-year singletons, unclipped sports data) are v1 requirements precisely because retrofitting any of them means re-litigating every ring. With them in place, everything here is additive.

### 11.1 Orbital mode (heliocentric)

`{ id: 'orbital', origin: configurable, direction: 'ccw', warp: 'true-anomaly' }`. Direction is not a choice: viewed from above the north pole, Earth orbits **counterclockwise** — orbital mode is ccw by physics, and happens to share birthday mode's chirality. Suggested origin: the March equinox, following the astronomy convention (heliocentric longitude 0° at the vernal equinox, increasing ccw); implementer may tune.

- **Warp consequences are the features:** equinoxes/solstices at exactly 90° — seasons become the perfect quadrants while months wobble (Jan spans more degrees than Jul, Feb ≠ 30°). The equal-angle quadrants have unequal durations — northern winter ~89 days, summer ~93–94 — which is Kepler's second law readable directly on the dial.
- **Honest ellipse:** at e = 0.0167 the orbit's flattening is ~0.014% — draw a circle; an exaggerated egg is Discovery-Channel dishonesty. The truthful tells are the **sun offset from dial center by ~1.7% of the orbit radius toward perihelion** (it sits at a focus, not the center) and `astro` markers at perihelion (~Jan 3) and aphelion (~Jul 4–6; some years literally the 4th — Earth farthest from the sun on Independence Day, the scrub fact nobody believes).
- **Sun hub:** the hub render slot (§6.1) becomes the sun. Theme-appropriate: engraved/radiant in observatory, flat disc in editorial, warm illustration in almanac.
- **Earth as the now-hand terminus:** v1 of this mode uses pre-shaded 2D globe sprites (12–36 phases) with the terminator always facing away from center. The stretch-of-the-stretch is a tiny 3D globe — 23.4° axial tilt at a **fixed screen orientation year-round** (the axis points at Polaris regardless of orbital position), night hemisphere facing away from the central sun. Watch it complete one orbit and the reason for seasons is simply *visible*: the north pole leaning into the light in June, into darkness in December.
- **Cost profile:** because every ring routes through the angle engine and the single projection, the rings warp automatically — zero per-ring work. The engine math ships in Phase 1; this mode is sprites, a sun, and two markers.

### 11.2 The helix (year over year)

Framing that governs the design: **the flat dial is the helix viewed exactly end-on, and the linear timeline is the same coil viewed from the side.** Cross-year clipping (§7.5) is an artifact of the end-on projection — on the coil, league seasons are continuous ribbons, and spans *longer* than a year (an Olympics band, Ryder Cups on alternating turns, a "daughter: age N" ribbon) become natively renderable for the first time. Three tiers:

1. **Semantic depth (Phase 3 — this replaces decorative parallax and absorbs the old ghost-year backlog item):** depth = year. Last year's ring ghosted beneath (climate actuals + markers are the layers that carry real year-over-year signal), next year faint above, cross-year sports ribbons visibly diving between planes. Eighty percent of "time continues" inside the current architecture.
2. **2D Archimedean spiral view (considered, allowed, unscheduled):** one thin band per year in a single plane. Honest tradeoff: the ring stack collapses to roughly color + markers per turn, and inner years starve for circumference. Build only if the itch demands it.
3. **True 3D helix (a separate project-scale fork — do not bolt on):** three.js/WebGL, tube geometry, billboarded labels, camera flight, and a **flatten/extrude toggle** — the coil collapsing into the flat dial and re-extruding, the mode-switch animation's big sibling. The killer dataset is a decade of Pleasanton climate actuals as colored turns (the Hawkins climate-spiral lineage) plus accumulating personal markers. The rendering architecture differs enough that this forks the renderer, not the data or geometry layers — which is exactly what the foundation rules protect.

---

## 12. Implementer's gotcha checklist

- Origin-day offset in birthday mode (Aug 25, not Aug 1) — see §3.
- Season boundaries move yearly; always compute, never hardcode.
- Ryder Cup: odd years only; markers must tolerate absence.
- Sports seasons span calendar years; storage is unclipped, and the flat dial clips via the pure view util only (§7.5).
- No color-along-arc in SVG; the climate band is a canvas field computed once per (year, mode, size), never per frame (§4). Angular-only cases may use per-day slivers.
- One tested adapter between engine degrees and d3-shape radians; no inline conversions.
- Text never mirrors; tangential labels flip at the lower semicircle; this holds in ccw mode.
- ESPN endpoints are unofficial: defensive parsing, Function/script only, never client-direct.
- DST steps in the climate band are correct behavior — do not smooth them away. The evening-light threshold is wall-clock, so the steps interacting with it is by design.
- The actuals trace ends at the now-hand by nature of the data; style the terminus, don't pad it.
- The temperature scale stops are config; themes may remap the white stop for light backgrounds. Do not replace the scale with a perceptual colormap.
- Precip normals must be smoothed (~31 d) before texturing; raw daily values are noise.
- Water-year rainfall (Oct 1 start): composing season-to-date for Jan–Sep needs the prior calendar year's Q4 actuals (§7.3).
- Particles keyed to on-screen sector, so autumn leaves fall over the fall arc in *both* modes.
- `prefers-reduced-motion` respected everywhere motion exists.
- Memoize geometry per (year, mode, size); rings never call the angle engine per frame.
- Both warps live in the engine from Phase 1 even though the UI ships one; tests are warp-parameterized, and invariants 5–6 *intentionally fail* under `true-anomaly` — do not "fix" that.
- Exactly one `polarToScreen` function; a grep for `Math.sin`/`Math.cos` outside `src/geometry/` should come back empty.
- No module-level "current year" state anywhere; two year-instances of any ring must be constructible side by side (semantic depth and the helix both depend on it).
- Sports data stays unclipped in storage and transport; `clipToCalendarYear` is a pure view util and the only place clipping happens.

---

## 13. Non-goals — considered and cut, do not re-propose

Trail/dirt-condition layer (owner has a separate project for it; rain, cold, and dark on the climate band already signal mud vs. hero-dirt season). Hillside green/gold arc (derivative of the same inputs). Gaming/release-calendar layer (downtime filler, not seasonal structure). Fire/smoke season. Local events (county fair). Meteor showers. Work/fiscal calendars. And structurally: separate temperature, precipitation, or "usable evenings" rings — all three live inside the climate band's channels (§6.4). When tempted by a new layer, re-read §6.0 first.# Year Clock — Build Plan

A radial visualization of the calendar year, modeled like an analog clock: 12 months at 30° each, concentric data rings (seasons, a composite climate band, sports seasons), event markers, and clock-style hands showing now / ±3 / ±6 months. Two dial modes at v1 (standard and a personal birthday-origin mode), three visual themes, Bay Area (Pleasanton) data, deployed on Cloudflare Pages — with a heliocentric orbital mode and a year-over-year helix reserved as architecturally supported stretch goals (§11). Personal project, one primary user, occasionally shared with friends via URL.

This document is the source of truth. Where it specifies a contract or invariant, implement exactly that. Where it says "implementer's choice," use judgment.

---

## 1. Locked decisions

- **Geometry:** months are exactly 30° each ("clock hours"), so ±3 months = exactly ±90° and ±6 months = 180° always. Days interpolate linearly within their month's 30° arc. Leap years are handled automatically by this rule (Feb 29 just makes February's per-day arc slightly narrower). Do NOT use day-proportional angles (360/365).
- **Two dial modes:**
  - `standard`: origin = Jan 1 at 12 o'clock, direction = clockwise.
  - `birthday`: origin = Aug 25 at 12 o'clock, direction = **counter**clockwise.
- **Fixed dial, moving hands.** The dial does not rotate with time. Hands: a solid "now" hand at fractional-day precision, plus ghost hands at exactly +90°, −90°, and 180° from it (±3 and ±6 months). A separate scrubber hand follows the pointer.
- **Seasons:** astronomical (equinox/solstice bounded), computed per year — boundaries drift a day or so year to year, never hardcode.
- **Location:** Pleasanton, CA — lat 37.6624, lon −121.8747, timezone `America/Los_Angeles` pinned everywhere. Single-location v1.
- **Sports:** NFL, NBA, NHL as thin arcs. NFL segmented into regular season / wild card week / divisional / conference championships / Super Bowl. NBA and NHL segmented into regular season / postseason (fold the NBA play-in into postseason). Championship games get terminal-node emphasis. **No** non-game events (no draft, trade deadline, free agency).
- **Golf:** markers for the four majors (Masters, PGA Championship, U.S. Open, The Open) plus the Ryder Cup. The Ryder Cup is **biennial (odd years)** — the marker system must tolerate "not present this year."
- **Personal dates:** anniversary + close family birthdays from a gitignored config (`personal.config.ts`, with a committed `personal.config.example.ts`). See honesty note in §7.6.
- **Climate band — one ring, the user's own design (§6.4):** daylight, temperature, and precipitation composed into a single arc via separate channels. Radial position = wall-clock time (sunrise/sunset edges, so band width *is* day length), color = temperature on the user's scale, precipitation = texture density, plus a live "this year actual" overlay trace. There are **no** separate temperature, precipitation, or "usable evenings" rings.
- **DST transitions are event markers** (spring-forward, second Sunday of March; fall-back, first Sunday of November), category `astro`, rule-computed.
- **Sports intensity glow** rendered behind the league arcs (§6.5), and **Super Bowl Sunday cross-registered as a holiday marker** — it functionally is one.
- **Composition principle — channels before rings (§6.0):** before any new ring is added, check whether an existing ring has a free channel (thickness, radial position, color, opacity/glow, texture, particles). Rings are expensive; channels are cheap.
- **Future-proofing (locked now, shipped later):** four rules keep orbital mode and the year-helix (§11) cheap to add and cost almost nothing today: (1) `DialMode` carries a `warp` axis from day one, with both warps implemented and tested in the engine in Phase 1; (2) exactly one polar→screen projection function; (3) no current-year singletons anywhere — every ring and provider is year-parameterized and multiple year-instances must be constructible simultaneously; (4) sports data is stored unclipped, with calendar clipping as a pure view function (§7.5).
- **Themes:** three selectable themes; selector sits next to the mode toggle. See §8.
- **Deployment:** Cloudflare Pages + Pages Functions + Workers KV for live data fetch/caching. App must also render fully from bundled fallback data with the network unplugged.

---

## 2. Stack

- **Vite + React 19 + TypeScript (strict).** Boring on purpose.
- **d3 for math only:** `d3-shape` (arc generation), `d3-scale`, `d3-interpolate`. No `d3-selection` — React owns the DOM.
- **Date math isolated in `src/time/`** and nowhere else. Preferred: the Temporal API via `@js-temporal/polyfill` (`Temporal.PlainDate`, `ZonedDateTime`); if that fights the toolchain, fall back to `date-fns` + `date-fns-tz`. Either way, no raw `Date` arithmetic outside `src/time/`.
- **Astronomy:** `astronomy-engine` (npm) — `Seasons(year)` for equinox/solstice instants, `SearchRiseSet` for sunrise/sunset. Pure computation, no API, works for any year forever.
- **Cloudflare tooling:** `wrangler` + the official `@cloudflare/vite-plugin` so Pages Functions and KV bindings run in local dev (`vite dev` should serve `/api/*`). Functions live in `/functions` per Pages convention.
- **Testing:** Vitest. The angle engine gets property-style unit tests (see §4). Everything else, light coverage.

### Repo layout

```
/functions/api/            Cloudflare Pages Functions (sports, actuals)
/scripts/refresh-data.ts   yearly data bake → src/data/fallback/*.json
/public/logos/             optional real logos (see §7.7)
/src/time/                 all date math, mode definitions
/src/geometry/             angle engine, polar helpers, radial layout
/src/rings/                one module per ring (implements RingDef)
/src/data/providers/       astronomy, climate, holidays, sports, actuals
/src/data/fallback/        committed JSON (sports per year, normals)
/src/data/schemas.ts       shared TS types + zod (or hand-rolled) validators
/src/themes/               theme definitions + per-theme seasonal art
/src/ui/                   hub readout, scrub panel, toggles, popovers
personal.config.example.ts
personal.config.ts         (gitignored)
```

---

## 3. The angle engine — the single most important abstraction

Everything renders through one invertible pair of pure functions. Build this first, test it hard, and never let any other module do its own date→angle math. Retrofitting chirality later is misery; building it in from commit one makes birthday mode free.

```ts
// src/geometry/angle.ts
export type Chirality = 'cw' | 'ccw';
export type Warp = 'uniform-month' | 'true-anomaly';

export interface DialMode {
  id: 'standard' | 'birthday' | 'orbital';
  origin: { month: number; day: number };  // 1-based; {1,1} and {8,25}
  direction: Chirality;
  warp: Warp;   // v1 UI ships uniform-month only; the engine implements BOTH from Phase 1 (§11)
}

// Returns SCREEN angle in degrees [0, 360):
//   0 = 12 o'clock, increasing clockwise on screen (SVG convention).
// Chirality is already applied — callers never think about direction.
// `date` may carry fractional-day precision for smooth hand motion.
export function dateToAngle(date: ZonedDateTime | PlainDate, mode: DialMode): number;

// Exact inverse (to day resolution, plus optional fractional day).
export function angleToDate(angleDeg: number, year: number, mode: DialMode): PlainDate;
```

Internal formula (dial-space angle θ before chirality):

```
monthsFromOrigin = (month - origin.month + 12) mod 12          // whole months
dayFraction      = (dayIndexFrom0 + timeOfDayFraction) / daysInMonth(year, month)
θ                = 30 * monthsFromOrigin + 30 * dayFraction    // minus origin day offset
screenAngle      = direction === 'cw' ? θ : (360 - θ) mod 360
```

Note the origin-day offset: in birthday mode the origin is Aug **25**, not Aug 1, so subtract the origin's own within-month fraction before applying chirality. Get this right or the whole dial is rotated by ~24 days.

**The warp axis.** The formula above is `uniform-month`. The second warp, `true-anomaly`, makes dial angle proportional to Earth's actual heliocentric ecliptic longitude — the physical position along the orbit. Implementation is the classical equation of center with Earth's eccentricity e = 0.0167: `ν ≈ M + 2e·sin M + (5/4)e²·sin 2M`, where M is mean anomaly (linear in time from perihelion, ~Jan 3). At this eccentricity the series is accurate to arcseconds; the deviation from uniform motion peaks at ~±1.9° (around early April and early October), and the inverse (angle → date) converges in 2–3 Newton iterations or the reversed series. It is ~10 lines of pure math living behind the `warp` flag. Consequences under `true-anomaly`: months no longer span 30° (January is wider than July), but the equinoxes and solstices sit at **exactly 90° spacings** — the symmetry migrates from months to seasons, by definition of heliocentric longitude. Both warps are implemented and property-tested in Phase 1 even though v1's UI exposes only `uniform-month`; this is precisely what makes orbital mode (§11.1) a rendering task later instead of an engine rewrite.

### Invariants — encode as warp-parameterized Vitest property tests

Hold for **every** warp and mode:
1. Round trip: `angleToDate(dateToAngle(d, m), year, m) === d` for every day of a leap year and a common year.
2. Origin: `dateToAngle(origin, m) === 0` (Jan 1 standard, Aug 25 birthday).
3. Feb 29 maps to a valid unique angle in leap years and `angleToDate` never emits it in common years.
4. Monotonicity within a year (in dial space): later dates → strictly larger θ.

`uniform-month` only:
5. Adding exactly 3 calendar months (same day-of-month) changes screen angle by exactly +90° in `cw`, −90° in `ccw`; 6 months = 180° in both.
6. Month boundaries land on exact multiples of 30° in dial space, every year, leap or not.

`true-anomaly` only (invariants 5–6 intentionally fail here — the tests must be parameterized, not duplicated):
7. The four equinox/solstice instants (from `astronomy-engine.Seasons`) land at 90° spacings within a few arcminutes.
8. Angular speed near perihelion (~Jan 3) exceeds angular speed near aphelion (~Jul 4–6) — Kepler's second law as a unit test.

### Label chirality rule

Text never mirrors. Month labels may rotate tangentially to follow the ring, but must auto-flip 180° when they'd render upside-down (the classic radial-label rule: flip when the label's angle falls in the lower semicircle). Event-marker labels and all readouts are always horizontal. This rule applies identically in both modes — only geometry flips, never glyphs.

---

## 4. Rendering architecture

Layer stack, back to front:

1. **Backdrop canvas** — theme ambience (star field, paper texture, vignette). Cheap, mostly static.
2. **SVG dial** — all rings, ticks, labels, markers, hands. This is the data layer: crisp text, `clipPath` for art-filled arcs, trivial hit-testing, React-rendered.
3. **Foreground canvas** — particles (leaves/snow/petals/shimmer per season sector, per theme). Single `requestAnimationFrame` loop, hard particle cap (~300), fully disabled under `prefers-reduced-motion` and in the editorial theme.
4. **HTML chrome** — hub readout, scrub panel, mode/theme controls, popovers.

Not full 3D at v1. A flat piece executed with texture, color, and motion reads better than a mediocre torus, and radial text dies in perspective. The sanctioned Phase 3 stretch is **2.5D semantic depth** (§11.2 tier 1): rings on separate transform layers where **depth = year**, with a subtle pointer-following tilt (≤ ~6°) and soft shadow between layers. An optional WebGL backdrop (shader star field) may replace layer 1 later; the SVG data layer stays 2D. The true 3D helix is a sanctioned future fork (§11.2 tier 3), not a bolt-on.

**Single projection rule.** All polar→screen conversion goes through exactly one `polarToScreen(angleDeg, radius)` function in `src/geometry/` — no inline trig anywhere, ever. This is the door to everything in §11: the helix or any 3D view is then a projection swap (add a z term, change the mapping), not a refactor of every ring.

**Known SVG limitation, plan around it:** SVG cannot vary color along an arc, let alone across a 2D (angle × radius) field. The climate band (§6.4) needs exactly that — color varying by angle (date) *and* radius (time of day), plus precipitation texture — so it renders as a **canvas color field**: one offscreen pass per `(year, mode, size)` that walks the annulus, maps each pixel → (date, time-of-day) via the angle engine, evaluates temperature and precip, and paints. Never per-frame. SVG draws the hairline sunrise/sunset edge curves, the evening-light threshold circle, and the actuals trace on top of it. Simpler angular-only color needs elsewhere may use per-day sliver `<path>` segments (365 flat-filled paths is cheap).

**d3-shape adapter:** `d3.arc()` measures angles in radians clockwise from 12 o'clock. Write one tested adapter from the angle engine's degrees to d3's radians and route every arc through it. No inline conversions scattered around.

Geometry is memoized per `(year, mode, canvasSize)`. Rings receive precomputed geometry; they never call the angle engine per-frame.

---

## 5. Ring plugin interface

Rings are pluggable and ordered by a registry so they can be toggled, reordered, and extended (the Phase 4 backlog rings must slot in without core changes).

```ts
// src/rings/types.ts
export interface RingDef<T> {
  id: string;
  label: string;
  radial: { inner: number; outer: number };   // normalized 0..1 of dial radius
  data(year: number, ctx: DataContext): Promise<T>;   // ctx: location, tz, fetch/fallback helpers
  render(props: { data: T; geom: DialGeometry; theme: Theme; mode: DialMode }): ReactNode; // SVG subtree
  scrub?(date: PlainDate, data: T): ScrubEntry | null;  // contribution to the hover readout
  ambience?(theme: Theme): ParticleConfig | null;       // e.g. seasons ring emits leaves/snow
}
```

`ScrubEntry` is a small `{ label, value, detail? }` record; the scrub panel assembles all rings' entries for the hovered date.

---

## 6. Ring stack spec (inner → outer)

Radial budget is a suggestion; tune visually. Data-dense rings sit at larger radii where there are more pixels per day.

### 6.0 Channels before rings
A ring is the expensive unit; a channel is the cheap one. Every ring has up to seven: angular extent (when), radial thickness (magnitude), radial position (a second scale), color (a variable), opacity/glow (intensity), texture (a variable), particles (ambience). Before proposing a new ring, exhaust the free channels of an existing one — the climate band (§6.4) is the worked example, carrying four datasets in one annulus. Corollary: the dial supports roughly five data rings before it turns to noise. The registry may hold more; default-visible stays at or under that.

### 6.1 Hub (center)
Current date, big; "day N of 365/366 · X.X% complete"; in birthday mode additionally "day N of your year." Hands originate here: solid now-hand (re-render on a 60 s timer is smooth enough; fractional-day angle), ghost hands at exactly ±90° and 180°, visually subordinate (thin, dashed, shorter). Scrubber hand appears on hover, distinct color. The hub is a **swappable render slot** — orbital mode (§11.1) replaces it with the sun.

### 6.2 Month dial
12 sectors × 30°. Tick per day (hairline), heavier tick at month boundaries, month labels tangential with the flip rule. Optional week-start ticks (Mondays) as a middle weight — implementer's choice, drop it if noisy.

### 6.3 Seasons ring
Four arcs bounded at computed equinox/solstice instants for the displayed year (`astronomy-engine.Seasons`). Boundary markers at the exact instants; scrub shows e.g. "Winter solstice — Dec 21, 7:03 AM PST." Fill treatment is theme-owned: clipPath'd illustrated art (almanac), luminous gradient washes (observatory), flat editorial color (editorial). This ring's `ambience()` emits the seasonal particle configs, keyed to the *sector the emitting arc occupies on screen* so particles fall over the right part of the dial in both modes. Particle *family* is chosen by season, but emission *intensity* is driven by climate data — rain particles scale with precip normals, heat shimmer with temperature — so the ambience is truthful, not merely categorical.

### 6.4 Climate band — daylight × temperature × precipitation (one ring)
The centerpiece, and the user's own design: three datasets in one arc through separate channels.

- **Shape (daylight):** two polar curves — sunrise and sunset in local wall-clock time via `SearchRiseSet` — bound the band. Radial axis is a time-of-day scale (~4:00 → 22:00 across the ring's radial extent), so band **width is day length** and **radial position shows when the light falls**. DST transitions appear as steps (wall-clock truth — embrace, never smooth); solstices are the widest/narrowest points. Build all curves by sampling 365/366 points through the angle engine; do not trust `d3.areaRadial` conventions without the adapter.
- **Color (temperature):** the band is the canvas color field from §4. Primary spec: a **diurnal field** — at each pixel, radius → time of day; temperature interpolated between that date's normal low (at the sunrise edge) and normal high (mid-afternoon peak ~15:30) with a simple sinusoidal diurnal curve. Precision is irrelevant; it's a felt field, not a forecast. Result: winter dawn edges go frost-white, summer afternoons blaze red at the outer edge, and the full scale gets used. Fallback if the field fights: flat per-day color = normal high (note: Pleasanton highs span ~55–90 °F, so only blue→green→red would ever fire).
- **Temperature scale** (config stops; default is the user's): 100 °F = full red → 70s = green → 50s = blue → 30s = white → 0s = purple ("it's never 0s in Pleasanton" — define it anyway; the scale should be honest about what it *would* show). Interpolate smoothly between stops. Two engineering notes: (1) the scale is deliberately non-perceptual — it encodes *felt categories*, which is correct for this instrument; do **not** "fix" it to viridis or any perceptual map. (2) The white stop vanishes on light backgrounds; each theme may remap stops (editorial: white → pale ice-blue) or add a hairline band edge.
- **Texture (precipitation):** rain-streak/stipple density ∝ smoothed daily precip normals (~31-day window — raw daily precip normals are noise), painted in the same canvas pass. Theme-flavored: hatching in almanac, faint streaks in observatory, sparse stipple in editorial. Winter reads thin-blue-streaked; summer reads fat-red-bone-dry. The Mediterranean climate in one object.
- **Evening-light threshold:** a hairline dashed reference circle at a configurable wall-clock time (`eveningLightThreshold`, default 19:00). Where the sunset edge rises above it, apply a subtle warm rim treatment to the band's outer edge. This *is* the "usable evenings" layer with zero extra rings — and the March DST step is the sunset curve **vaulting the threshold in a single day**: evening season switching on. The November fall-back step is it dying. Scrub reports the crossing dates.
- **Actuals overlay:** this-year actual temps as a thin bright trace terminating at the now-hand — data ends yesterday, and the trace catching up to the hand is a feature; style the terminus (small glow), don't pad it.
- **Built-in stories — don't hide them:** the band's thickest point (June solstice) is *not* its reddest (mid-July, normal high ~90 °F). Seasonal thermal lag, rendered inside one object, reads more strongly than it ever did as two separate rings. And the wet texture occupies the thin blue months almost exclusively.
- **Scrub:** sunrise, sunset, day length h:mm + Δ vs. yesterday; normal high/low, actual + departure; normal precip for the date; and **season-to-date rainfall as % of normal on the water year (Oct 1–Sep 30)** — the stat every Bay Area local actually tracks.

### 6.5 Sports rings (three thin arcs: NFL, NBA, NHL) + intensity glow
Each league is one thin annulus with typed segments:

- NFL: `regular` (Thu after Labor Day → early Jan) → `wildcard` → `divisional` → `conference` → `superbowl` (single-day terminal node).
- NBA: `regular` → `postseason` (play-in folded in), Finals end as terminal node.
- NHL: `regular` → `postseason`, Stanley Cup Final end as terminal node.

Visual grammar: regular season muted/base saturation, playoff segments brighter/saturated, championship as an emphasized terminal cap (glow in observatory theme). Round the league's off-season gap ends (`strokeLinecap: round` equivalent on the arc ends). Default colors are league colors; support optional team-accent overrides in config (`teamAccents: { nfl?: TeamColors, ... }`) — the user hasn't specified teams, leave the stub with a comment. Scrub: league phase at that date ("NFL — divisional round"), or "off-season, kickoff in N days."

**Intensity glow — negative space made visible.** Compute `intensity(date) = Σ_league phaseWeight` (regular = 1, playoffs = 2, championship day = 3; equal league weights, tune by eye) and render it as a soft luminous underlay behind the three arcs, opacity ∝ intensity. January burns; mid-summer goes dark. Annotate the longest zero-intensity stretch — Finals end → NFL kickoff — as **"the desert: N days"**, placed in the sparse summer sector. Editorial theme has no glow by charter: render as a value-tinted density strip there instead.

**`showBaseballTechnically`** (config flag, default **on**): a deliberately washed-out gray arc from late March to the end of the World Series, labeled "baseball, technically." Heuristic dates only — it does not merit an API. It is the correct editorial voice for this instrument; the flag exists for guests.

### 6.6 Event marker ring (outermost)
Point markers with categories: `holiday`, `golf`, `personal`, `astro`.

- Holidays, computed from rules (no API): New Year's Day, MLK Day (3rd Mon Jan), Presidents' Day, Memorial Day (last Mon May), July 4, Labor Day (1st Mon Sep), Halloween, Thanksgiving (4th Thu Nov), Christmas Eve/Day, New Year's Eve. Set is a config list; trim freely. **Super Bowl Sunday is cross-registered here as a holiday** from the sports data (with heuristic fallback) — it functionally is one.
- Astro: DST spring-forward (2nd Sunday of March) and fall-back (1st Sunday of November), rule-computed like holidays. These are two of the most *felt* days of the year and they interact directly with the climate band's evening-light threshold (§6.4).
- Golf: the four majors + Ryder Cup (odd years only) from the sports data layer.
- Personal: from `personal.config.ts` — `{ label, month, day, category: 'personal', icon? }`. Birthday Aug 25 gets special treatment: it is the *origin* of birthday mode, render it with distinct emphasis (it sits at 12 o'clock in that mode — make that moment land).

**Collision handling is required, not optional** (see the Oct–Feb reality below): markers within ~6° of a neighbor stack at staggered radii with hairline leader lines; a cluster expands on hover; labels are horizontal, placed by a simple greedy declutterer, hidden below a zoom/priority threshold rather than overlapped.

### The Oct–Feb pile-up
All three leagues plus the holiday cluster occupy one third of the circle; May–August is golf, July 4, and the birthday. This is true of the actual year and should read that way — dense winter, airy summer — but it is why §6.6's collision system and §6.5's thin-ring restraint exist. Do not let any single sector's labels overlap; degrade gracefully by dropping label text before dropping markers.

---

## 7. Data layer

Four problems with four different right answers. The unifying rule: **runtime never hard-depends on a live API.** Client resolution order for anything fetched: Pages Function (`/api/*`, KV-cached) → bundled fallback JSON → heuristic generator. The app must render completely with the network unplugged.

### 7.1 Astronomy — computed, zero APIs
Sunrise/sunset, equinoxes/solstices via `astronomy-engine` at the Pleasanton coordinates, client-side, for any year. Nothing to fetch, nothing to break.

### 7.2 Climate normals — baked at build time
`scripts/refresh-data.ts` fetches ~10 years of daily `temperature_2m_max/min` (°F) **and `precipitation_sum` (inches)** for the coordinates from the Open-Meteo historical archive API (free, no key: `archive-api.open-meteo.com/v1/archive`), averages by day-of-year, and smooths. Temperature smoothing: a centered 14-day rolling mean or, nicer, a 2-harmonic Fourier fit (the standard climatology technique — clean curves, no edge artifacts across the Dec/Jan wrap). Precipitation smoothing: ~31-day centered window (daily precip normals are pure noise otherwise). Output: `src/data/fallback/climate-normals.json`. Normals are static by definition; regenerate rarely.

### 7.3 This-year actuals — Pages Function + KV
`GET /api/climate/actuals/:year` → KV key `climate:actual:{year}` (TTL 24 h) → on miss, fetch Open-Meteo archive for Jan 1 → yesterday (temps **and** precipitation), store, return. Same JSON shape as normals plus per-day actuals. **Water-year note:** the season-to-date rainfall stat runs Oct 1–Sep 30, so for dates Jan–Sep it needs the *previous* calendar year's Q4 actuals — the client composes the water year from two calendar-year responses (both KV-cached; no special endpoint needed).

### 7.4 Sports — Pages Function + KV + committed fallback + heuristics
`GET /api/sports/:year` → KV key `sports:{year}` (TTL 7 days) → on miss, fetch and normalize from ESPN's unofficial JSON endpoints, store, return.

ESPN notes (unofficial — probe and adapt, wrap in defensive parsing, and treat every field as optional):
- Base: `site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard` (e.g. `football/nfl`, `basketball/nba`, `hockey/nhl`, `golf/pga`).
- The scoreboard payload's `leagues[0].calendar` describes season structure: season types (pre/regular/post) with date ranges, and for the NFL, labeled weeks including Wild Card, Divisional Round, Conference Championship, Super Bowl — exactly the segmentation §6.5 needs.
- Golf: the league scoreboard/schedule lists season events; identify the majors and Ryder Cup by name match.
- These endpoints are unofficial and can change or die without notice. That is why they are touched only by the Function and the refresh script, never by the client directly.

`scripts/refresh-data.ts --year 2027` hits the same normalizer and writes `src/data/fallback/sports-2027.json` for commit — run once a year when schedules drop. Last-resort heuristic generator (used only if both live and fallback are missing for a year): NFL kickoff = Thursday after Labor Day, Super Bowl ≈ second Sunday of February; NBA opens ≈ third week of October, Finals to mid-June; NHL opens ≈ first full week of October, Cup Final to late June; Masters ends the second Sunday of April, U.S. Open ends Father's Day, The Open mid-July, Ryder Cup late September in odd years. Heuristic data is flagged in the UI with a subtle "approximate" affordance on scrub.

### 7.5 Schemas (`src/data/schemas.ts`)

```ts
interface SportsYear {
  year: number;                       // calendar year requested
  leagues: LeagueSeason[];            // BOTH league seasons touching this calendar year, UNCLIPPED
  source: 'live' | 'baked' | 'heuristic';
}
interface LeagueSeason {
  league: 'nfl' | 'nba' | 'nhl';
  seasonLabel: string;                // "2026–27"
  segments: Segment[];                // sorted, non-overlapping
  championship?: { date: string; name: string };  // "Super Bowl LXI"
}
interface Segment {
  kind: 'regular' | 'wildcard' | 'divisional' | 'conference' | 'superbowl' | 'postseason';
  start: string;  // ISO date
  end: string;
}
interface EventMarker {
  id: string; date: string; label: string;
  category: 'holiday' | 'golf' | 'personal' | 'astro';
  icon?: string;
  approximate?: boolean;
}
interface ClimateSeries {
  location: { lat: number; lon: number; name: string };
  daily: { doy: number; hiF: number; loF: number; precipIn: number }[];  // normals: 366 entries; precip pre-smoothed
}
```

Validate at every boundary (Function output, fallback load) — malformed data degrades to the next tier, never to a crash.

**Cross-year subtlety:** NFL/NBA/NHL seasons span calendar years. The dial shows one calendar year, so a given year's ring draws segments from *two* league seasons (e.g. calendar 2026 shows the tail of 2025–26 — Jan–Jun playoffs — and the head of 2026–27 starting in the fall). The Function/normalizer returns both adjacent seasons **unclipped**; a pure `clipToCalendarYear(sportsYear)` view util produces the flat-dial segments. Clipping at the view layer rather than in the data is deliberate: the flat ring is the helix viewed end-on, and the clip is an artifact of that projection — the future helix (§11.2) consumes the *same* payload as continuous ribbons with no seam. Get a test on the clip util; it is the most likely data bug.

### 7.6 Personal dates — honesty note
`personal.config.ts` is gitignored, which protects the repo. It does **not** protect the deployed site: anything rendered ends up in the served bundle, so anyone with the URL sees the dates. That's fine for friends and for birthdays/anniversaries; just don't put anything genuinely sensitive in it. No cleverness needed beyond this note.

### 7.7 Logos
The refresh script may optionally download league logos from ESPN's CDN into `/public/logos/`, behind a `useRealLogos` config flag (default off). The default-on path is an original glyph set drawn as small SVGs: green jacket (Masters), claret jug (The Open), trophy silhouettes for the leagues' championships, etc. Rationale: personal use of real marks is a non-issue; a public Cloudflare Pages URL is still low-risk fan-site territory, but Augusta National in particular is aggressively protective of the Masters brand, so the shipping default is original glyphs and the real logos are one flag away on the user's own deployment.

---

## 8. Theme system

Three themes, selectable next to the mode toggle, persisted in `localStorage` and reflected in the URL (`?theme=observatory&mode=birthday`) so shared links reproduce the exact view.

A theme is not just a palette. It owns: design tokens (colors, type, stroke weights), per-ring style hooks (how the seasons ring fills its arcs, how the climate band's precip texture reads, remapped temperature-scale stops), the backdrop treatment, and the ambience config (which particles, if any).

```ts
interface Theme {
  id: 'observatory' | 'editorial' | 'almanac';
  tokens: { /* palette, fonts, strokes, glow on/off */ };
  ringStyles: Partial<Record<RingId, RingStyleHooks>>;
  backdrop: BackdropSpec;         // star canvas | flat | paper texture
  ambience: AmbienceSpec | null;  // particle families per season, caps, speeds
}
```

Directions (briefs, not specs — the implementer should do a real design pass per theme):

- **observatory** — dark astronomical instrument: astrolabe/orrery energy, deep field, fine metallic ring strokes, restrained glow on hands and championship nodes, luminous seasonal washes, star-field backdrop, particles subtle and sparse.
- **editorial** — light print-infographic: flat color, crisp hairlines, exceptional typography, zero particles, zero glow. The theme that proves the information design stands on its own.
- **almanac** — illustrated and warm: seasonal artwork clipped inside the season arcs (autumn trees in the fall arc, etc.), paper-grain backdrop, full particle ambience (leaves, snow, petals, heat shimmer). Art is hand-built stylized SVG committed to `src/themes/art/` — no external asset pipeline, no stock imagery.

**Design-quality guardrail:** AI-generated "dark themes" cluster hard around near-black + one acid accent, and light themes around warm cream + terracotta. Both are defaults, not choices. Ground each theme in its actual subject — brass and engraved instrument markings for observatory, mid-century almanac/print vernacular for almanac, real editorial type discipline for editorial. Per theme, pick a deliberate palette (4–6 named values), a display/body type pairing chosen for that theme, and one signature element (e.g. observatory's could be the glowing terminus of the actuals trace meeting the now-hand). Spend boldness in one place per theme; keep the rest quiet.

---

## 9. Interaction & modes

- **Scrub:** pointer angle → `angleToDate` → every ring's `scrub()` → assembled panel: date, day N / %, season (+ days to next boundary), sunrise/sunset/day length, normal high/low + actual + departure, precip + water-year % of normal, active sports phases, nearest markers with countdowns. Panel is an ARIA live region; docks below the dial on narrow screens. Touch: drag to scrub.
- **Vibe line:** the scrub panel's first line composes the active layers into one sentence — "Dark by 5:10, rain likely, wild card weekend." v1 is rule-based (templates over season / daylight / precip / sports state). Optional upgrade, refresh-time only: `refresh-data` calls the Anthropic API once a year to write 52 weekly captions into a JSON the panel prefers when present. Never a runtime LLM call.
- **Ambient grading:** the backdrop tint tracks the composite state of the hovered (else current) date — cool blue-gray depths in January, gold haze in August. Cheap, theme-owned (the backdrop already is), subtle, disabled in editorial.
- **Mode switch — the signature animation.** Chirality cannot be tweened continuously without mirroring glyphs, so do not try. Two-beat transition (~1.4 s total): (1) rings sweep and retract into the hub while the dial rotates toward the new origin; (2) rings re-grow outward in the new chirality with the new origin at 12 o'clock. Reads as intentional, avoids every mirrored-text artifact, and makes switching modes feel like an event. Ghost hands and particles re-derive after the transition, never during.
- **Marker click:** popover with name, date, countdown/count-since, icon/logo.
- **Keyboard:** ←/→ step the scrubbed day (Shift = week), `m` toggles mode, `t` cycles theme, `Esc` clears scrub. Visible focus states.
- **Time-lapse (Phase 3):** sweep the year in ~20 s; ambience follows the sweeping hand's season; any scrub input cancels.
- **Responsive:** square dial, sensible minimum ~360 px; chrome reflows around it.
- **Reduced motion:** `prefers-reduced-motion` disables particles, parallax, time-lapse autoplay, and replaces the mode transition with a crossfade.

---

## 10. Phases

Ship each phase working before starting the next. Phase 1 is the whole ballgame architecturally — if the angle engine and dual-mode rendering are right, everything after is additive.

### Phase 0 — Scaffold
Vite + React + TS strict, Vitest, wrangler + Cloudflare Vite plugin with a stub `/api/health` Function and a KV binding, deploy pipeline to Cloudflare Pages. AC: `vite dev` serves the app and `/api/health` locally; a push deploys.

### Phase 1 — The clock (no external data)
`src/time` + angle engine with the §3 invariant tests — **both warps implemented** (`uniform-month` for the UI, `true-anomaly` as tested engine math per §3; it's ~10 lines and doing it now is what makes orbital mode a rendering task later); the single `polarToScreen` projection function; month dial with day ticks and flip-rule labels; seasons ring (flat colors fine, computed boundaries); hub + now/ghost hands; scrubber with date-only readout; **both v1 modes fully working** with a basic crossfade toggle; state in URL params.
AC: all §3 property tests green including leap years, parameterized over warp (invariants 1–4 both warps, 5–6 uniform, 7–8 true-anomaly); Aug 25 renders at 12 o'clock in birthday mode with the dial running counterclockwise; +90° of screen angle = exactly +3 months in both modes; no mirrored or upside-down text in either mode; grep finds no polar math outside `src/geometry/`.

### Phase 2 — Data
Climate band per §6.4 (shape from astronomy; diurnal canvas color field with the flat-color fallback path proven first; precip texture; evening-light threshold; actuals overlay via Function + KV); normals bake incl. precip; holidays + astro (DST) markers; sports Function + KV + normalizer + `refresh-data` fallback writer + heuristic tier + cross-year clipping test; sports intensity glow + desert annotation + `showBaseballTechnically`; Super Bowl holiday cross-registration; golf majors + biennial Ryder Cup; personal config; marker collision system; full scrub panel incl. water-year rainfall stat and the rule-based vibe line.
AC: network unplugged → app renders completely from fallbacks with the "approximate" affordance where applicable; `refresh-data --year 2027` emits schema-valid files; calendar-year clipping test passes (Jan playoffs from season N−1, fall start of season N); the climate field recomputes only on (year, mode, size) change.

### Phase 3 — Themes & motion
All three themes + selector; ambience particle system (climate-data-driven intensity); ambient backdrop grading; the two-beat mode-switch animation; time-lapse; optional Claude-written weekly vibe captions in `refresh-data`; **2.5D semantic depth as the sanctioned stretch goal** (§11.2 tier 1: separate transform layers where depth = year — last year's actuals + markers ghosted beneath, next year faint above — with ≤ ~6° pointer tilt, inter-layer shadow; optional WebGL star-field backdrop) — build it behind a flag so it can be disabled without trace; keyboard map; reduced-motion pass; performance pass (steady 60 fps with particles on a mid-range laptop; idle CPU near zero when static).

### Phase 4 — Backlog (explicitly not v1)
- **Orbital mode** (§11.1). The engine already carries the warp from Phase 1; this item is the rendering: sun hub, off-center focus, Earth-as-hand, perihelion/aphelion markers.
- **True 3D helix** (§11.2 tier 3). A separate project-scale fork; do not bolt it onto the flat renderer.
- UCI DH World Cup calendar + Whistler Bike Park operating dates. Neither has a clean API; the intended pattern is an **LLM-assisted extractor**: a refresh-time script (or Function) fetches the source pages and calls the Anthropic API with a strict JSON schema prompt to extract dates, writing to the same fallback format, with a human-reviewed diff before commit. Ring registry must accept these without core changes.
- F1 ring (deferred by choice, not difficulty — ergast-style community APIs exist if wanted).
- Multi-location climate profiles for sharing beyond the Bay Area.
- Toggleable seasonal soundscape (rain on the window, crickets, distant crowd roar keyed to sports intensity). Off by default forever; the kind of thing that's either magic or annoying.

---

## 11. Stretch geometries — sanctioned, foundation-supported, not v1

The features below are nice-to-haves. The **foundation is not optional**: the four future-proofing rules in §1 (warp axis with both warps engine-implemented in Phase 1, single projection function, no current-year singletons, unclipped sports data) are v1 requirements precisely because retrofitting any of them means re-litigating every ring. With them in place, everything here is additive.

### 11.1 Orbital mode (heliocentric)

`{ id: 'orbital', origin: configurable, direction: 'ccw', warp: 'true-anomaly' }`. Direction is not a choice: viewed from above the north pole, Earth orbits **counterclockwise** — orbital mode is ccw by physics, and happens to share birthday mode's chirality. Suggested origin: the March equinox, following the astronomy convention (heliocentric longitude 0° at the vernal equinox, increasing ccw); implementer may tune.

- **Warp consequences are the features:** equinoxes/solstices at exactly 90° — seasons become the perfect quadrants while months wobble (Jan spans more degrees than Jul, Feb ≠ 30°). The equal-angle quadrants have unequal durations — northern winter ~89 days, summer ~93–94 — which is Kepler's second law readable directly on the dial.
- **Honest ellipse:** at e = 0.0167 the orbit's flattening is ~0.014% — draw a circle; an exaggerated egg is Discovery-Channel dishonesty. The truthful tells are the **sun offset from dial center by ~1.7% of the orbit radius toward perihelion** (it sits at a focus, not the center) and `astro` markers at perihelion (~Jan 3) and aphelion (~Jul 4–6; some years literally the 4th — Earth farthest from the sun on Independence Day, the scrub fact nobody believes).
- **Sun hub:** the hub render slot (§6.1) becomes the sun. Theme-appropriate: engraved/radiant in observatory, flat disc in editorial, warm illustration in almanac.
- **Earth as the now-hand terminus:** v1 of this mode uses pre-shaded 2D globe sprites (12–36 phases) with the terminator always facing away from center. The stretch-of-the-stretch is a tiny 3D globe — 23.4° axial tilt at a **fixed screen orientation year-round** (the axis points at Polaris regardless of orbital position), night hemisphere facing away from the central sun. Watch it complete one orbit and the reason for seasons is simply *visible*: the north pole leaning into the light in June, into darkness in December.
- **Cost profile:** because every ring routes through the angle engine and the single projection, the rings warp automatically — zero per-ring work. The engine math ships in Phase 1; this mode is sprites, a sun, and two markers.

### 11.2 The helix (year over year)

Framing that governs the design: **the flat dial is the helix viewed exactly end-on, and the linear timeline is the same coil viewed from the side.** Cross-year clipping (§7.5) is an artifact of the end-on projection — on the coil, league seasons are continuous ribbons, and spans *longer* than a year (an Olympics band, Ryder Cups on alternating turns, a "daughter: age N" ribbon) become natively renderable for the first time. Three tiers:

1. **Semantic depth (Phase 3 — this replaces decorative parallax and absorbs the old ghost-year backlog item):** depth = year. Last year's ring ghosted beneath (climate actuals + markers are the layers that carry real year-over-year signal), next year faint above, cross-year sports ribbons visibly diving between planes. Eighty percent of "time continues" inside the current architecture.
2. **2D Archimedean spiral view (considered, allowed, unscheduled):** one thin band per year in a single plane. Honest tradeoff: the ring stack collapses to roughly color + markers per turn, and inner years starve for circumference. Build only if the itch demands it.
3. **True 3D helix (a separate project-scale fork — do not bolt on):** three.js/WebGL, tube geometry, billboarded labels, camera flight, and a **flatten/extrude toggle** — the coil collapsing into the flat dial and re-extruding, the mode-switch animation's big sibling. The killer dataset is a decade of Pleasanton climate actuals as colored turns (the Hawkins climate-spiral lineage) plus accumulating personal markers. The rendering architecture differs enough that this forks the renderer, not the data or geometry layers — which is exactly what the foundation rules protect.

---

## 12. Implementer's gotcha checklist

- Origin-day offset in birthday mode (Aug 25, not Aug 1) — see §3.
- Season boundaries move yearly; always compute, never hardcode.
- Ryder Cup: odd years only; markers must tolerate absence.
- Sports seasons span calendar years; storage is unclipped, and the flat dial clips via the pure view util only (§7.5).
- No color-along-arc in SVG; the climate band is a canvas field computed once per (year, mode, size), never per frame (§4). Angular-only cases may use per-day slivers.
- One tested adapter between engine degrees and d3-shape radians; no inline conversions.
- Text never mirrors; tangential labels flip at the lower semicircle; this holds in ccw mode.
- ESPN endpoints are unofficial: defensive parsing, Function/script only, never client-direct.
- DST steps in the climate band are correct behavior — do not smooth them away. The evening-light threshold is wall-clock, so the steps interacting with it is by design.
- The actuals trace ends at the now-hand by nature of the data; style the terminus, don't pad it.
- The temperature scale stops are config; themes may remap the white stop for light backgrounds. Do not replace the scale with a perceptual colormap.
- Precip normals must be smoothed (~31 d) before texturing; raw daily values are noise.
- Water-year rainfall (Oct 1 start): composing season-to-date for Jan–Sep needs the prior calendar year's Q4 actuals (§7.3).
- Particles keyed to on-screen sector, so autumn leaves fall over the fall arc in *both* modes.
- `prefers-reduced-motion` respected everywhere motion exists.
- Memoize geometry per (year, mode, size); rings never call the angle engine per frame.
- Both warps live in the engine from Phase 1 even though the UI ships one; tests are warp-parameterized, and invariants 5–6 *intentionally fail* under `true-anomaly` — do not "fix" that.
- Exactly one `polarToScreen` function; a grep for `Math.sin`/`Math.cos` outside `src/geometry/` should come back empty.
- No module-level "current year" state anywhere; two year-instances of any ring must be constructible side by side (semantic depth and the helix both depend on it).
- Sports data stays unclipped in storage and transport; `clipToCalendarYear` is a pure view util and the only place clipping happens.

---

## 13. Non-goals — considered and cut, do not re-propose

Trail/dirt-condition layer (owner has a separate project for it; rain, cold, and dark on the climate band already signal mud vs. hero-dirt season). Hillside green/gold arc (derivative of the same inputs). Gaming/release-calendar layer (downtime filler, not seasonal structure). Fire/smoke season. Local events (county fair). Meteor showers. Work/fiscal calendars. And structurally: separate temperature, precipitation, or "usable evenings" rings — all three live inside the climate band's channels (§6.4). When tempted by a new layer, re-read §6.0 first.